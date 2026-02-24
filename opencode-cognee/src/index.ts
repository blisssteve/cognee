import { tool } from "@opencode-ai/plugin/tool";
import { CogneeClient, CogneeUnavailableError, CogneeAPIError } from "./services/client.js";
import { loadConfig, ensureConfigDir } from "./config.js";

// Initialize config
ensureConfigDir();
const config = loadConfig();

// Initialize Cognee client
const cogneeClient = new CogneeClient(config.cogneeUrl);

// Track conversation state
const conversations = new Map();
const injectedSessions = new Set();

const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`]+`/g;

const MEMORY_KEYWORD_PATTERN = new RegExp(
  `\\b(${config.keywordPatterns.join("|")})\\b`,
  "i"
);

const MEMORY_NUDGE_MESSAGE = `[MEMORY TRIGGER DETECTED]
The user wants you to remember something. You MUST use the \`cognee\` tool with \`action: "add"\` to save this information.

Extract the key information the user wants remembered and save it as a concise, searchable memory.
Use appropriate tags to categorize: preferences, decisions, learnings, projects, tools.

DO NOT skip this step. The user explicitly asked you to remember.`;

const CONTEXT_WARNING_MESSAGE = `[CONTEXT MANAGEMENT REMINDER]
Context is accumulating. Consider proactively saving important information to Cognee memory:
- Decisions made → tags:decisions
- User preferences learned → tags:preferences  
- Key learnings → tags:learnings
- Project context → tags:projects

Use: cognee action:add content:"..." tags:...

When context is ~70% full, save a session summary and inform user they can /clear to continue with retrieved context.`;

function removeCodeBlocks(text) {
  return text.replace(CODE_BLOCK_PATTERN, "").replace(INLINE_CODE_PATTERN, "");
}

function detectMemoryKeyword(text) {
  const textWithoutCode = removeCodeBlocks(text);
  return MEMORY_KEYWORD_PATTERN.test(textWithoutCode);
}

function formatConversation(messages) {
  return messages
    .map((msg) => {
      const time = new Date(msg.timestamp).toISOString();
      return `[${time}] ${msg.role.toUpperCase()}: ${msg.content}`;
    })
    .join("\n\n");
}

// Toast helper - will be set when plugin initializes
let showToast: ((message: string, variant?: "info" | "success" | "error") => Promise<void>) | null = null;

export const CogneePlugin = async ({ project, client, $, directory, worktree }) => {
  // Set up toast helper using the SDK client
  showToast = async (message: string, variant: "info" | "success" | "error" = "info") => {
    try {
      await client.tui.showToast({ body: { message: `🧠 ${message}`, variant } });
    } catch {
      // Silently fail if TUI not available
    }
  };

  // Silent init - only show toast on errors

  // Check Cognee health on init (silent unless error)
  try {
    const health = await cogneeClient.healthCheck();
    if (!health) {
      showToast?.("Cognee unavailable", "error");
    }
  } catch {
    showToast?.("Cognee connection failed", "error");
  }

  return {
    // Configure compaction settings when plugin is active
    // Settings come from ~/.config/opencode/cognee.json
    // When plugin is disabled, OpenCode reverts to default compaction behavior
    config: async (openCodeConfig: any) => {
      openCodeConfig.compaction = {
        auto: config.compaction.auto,
        prune: config.compaction.prune,
      };
    },

    "chat.message": async (input, output) => {
      try {
        // Get text parts from output
        const textParts = output.parts.filter((p) => p.type === "text");

        if (textParts.length === 0) {
          return;
        }

        const userMessage = textParts.map((p) => p.text).join("\n");

        if (!userMessage.trim()) {
          return;
        }

        // Silent processing - no verbose logging

        // Track conversation
        let state = conversations.get(input.sessionID);
        if (!state) {
          state = {
            messages: [],
            startTime: Date.now(),
          };
          conversations.set(input.sessionID, state);
        }

        state.messages.push({
          role: "user",
          content: userMessage,
          timestamp: Date.now(),
        });

        // Detect memory keyword and nudge
        if (detectMemoryKeyword(userMessage)) {
          showToast?.("Memory trigger detected", "info");
          output.parts.push({
            id: `cognee-nudge-${Date.now()}`,
            sessionID: input.sessionID,
            messageID: output.message.id,
            type: "text",
            text: MEMORY_NUDGE_MESSAGE,
            synthetic: true,
          });
        }

        // Inject memories on first message
        const isFirstMessage = !injectedSessions.has(input.sessionID);

        if (isFirstMessage) {
          injectedSessions.add(input.sessionID);

          try {
            // Use configured search type for memory injection (default: CHUNKS for fast startup)
            const memories = await cogneeClient.searchMemories(
              userMessage, 
              config.injection.searchType, 
              config.injection.topK, 
              input.sessionID
            );

            if (memories.length > 0) {
              const relevantMemories = memories
                .slice(0, config.maxMemories)
                .map((m) => m.content)
                .join("\n\n---\n\n");

              output.parts.unshift({
                id: `cognee-context-${Date.now()}`,
                sessionID: input.sessionID,
                messageID: output.message.id,
                type: "text",
                text: `<remembered_context>
${relevantMemories}
</remembered_context>`,
                synthetic: true,
              });

              showToast?.(`Loaded ${memories.length} memories`, "success");
            }
          } catch (error) {
            if (error instanceof CogneeUnavailableError) {
              showToast?.("Cognee unavailable - memories not loaded", "error");
            } else {
              showToast?.("Failed to fetch memories", "error");
            }
          }
        }
      } catch (error) {
        showToast?.("Memory hook error", "error");
      }
    },

    tool: {
      cognee: tool({
        description:
          "Search, add, or list memories from Cognee knowledge graph. Use 'search' to find relevant memories, 'timeline' for time-based queries, 'add' to store new knowledge with optional tags, 'list' to see datasets. Supports multiple search types: GRAPH_COMPLETION (complex reasoning), RAG_COMPLETION (fast facts), CHUNKS (raw text), SUMMARIES (overviews), COT (chain-of-thought).",
        args: {
          action: tool.schema
            .enum(["search", "timeline", "add", "list", "help"])
            .optional(),
          query: tool.schema.string().optional(),
          content: tool.schema.string().optional(),
          tags: tool.schema.string().optional().describe("Comma-separated NodeSet tags for organizing memories (e.g., 'preferences,tools' or 'decisions,project_x')"),
          searchType: tool.schema
            .enum(["GRAPH_COMPLETION", "RAG_COMPLETION", "CHUNKS", "SUMMARIES", "GRAPH_COMPLETION_COT", "FEELING_LUCKY"])
            .optional()
            .describe("Search type: GRAPH_COMPLETION (default, complex reasoning), RAG_COMPLETION (fast facts), CHUNKS (raw text), SUMMARIES (overviews), GRAPH_COMPLETION_COT (chain-of-thought), FEELING_LUCKY (auto-select)"),
          topK: tool.schema.number().optional().describe("Number of results to return (default: 10)"),
        },
        async execute(args, context) {
          const action = args.action || "help";

          try {
            switch (action) {
              case "help": {
                return JSON.stringify({
                  success: true,
                  message: "Cognee Memory Usage Guide",
                  commands: [
                    {
                      command: "search",
                      description: "Search memories with configurable search type",
                      args: ["query", "searchType (optional)", "topK (optional)"],
                      searchTypes: {
                        GRAPH_COMPLETION: "Default - Complex reasoning with graph context (slower, most intelligent)",
                        RAG_COMPLETION: "Fast fact retrieval without graph structure",
                        CHUNKS: "Raw text passages - fastest option",
                        SUMMARIES: "Pre-generated hierarchical summaries",
                        GRAPH_COMPLETION_COT: "Chain-of-thought for complex multi-step reasoning",
                        FEELING_LUCKY: "Auto-select best search type",
                      },
                    },
                    {
                      command: "timeline",
                      description: "Time-aware search (e.g., 'what happened last week', 'before 2024')",
                      args: ["query"],
                    },
                    {
                      command: "add",
                      description: "Add new memory with optional NodeSet tags for organization",
                      args: ["content", "tags (optional, comma-separated)"],
                      example: "add content='default_user prefers dark mode' tags='preferences,ui'",
                    },
                    {
                      command: "list",
                      description: "List all datasets",
                      args: [],
                    },
                  ],
                  nodeSets: {
                    description: "NodeSets are tags that organize memories into searchable groups",
                    examples: ["preferences", "tools", "decisions", "projects", "sessions"],
                    automatic: ["sessions", "conversations", "user_memories"],
                  },
                  searchTypeGuide: {
                    simpleFacts: "Use RAG_COMPLETION for quick fact lookups",
                    complexReasoning: "Use GRAPH_COMPLETION for questions requiring relationship understanding",
                    rawContent: "Use CHUNKS to verify content exists or get exact passages",
                    overviews: "Use SUMMARIES for quick document overviews",
                    multiStep: "Use GRAPH_COMPLETION_COT for differential diagnosis or complex analysis",
                  },
                });
              }

              case "search": {
                if (!args.query) {
                  return JSON.stringify({
                    success: false,
                    error: "query parameter is required for search action",
                  });
                }

                // Use provided searchType or default to GRAPH_COMPLETION
                const searchType = args.searchType || 'GRAPH_COMPLETION';
                const topK = args.topK || 10;
                
                // Pass session ID for conversational context
                const sessionId = context?.sessionID;
                const results = await cogneeClient.searchMemories(args.query, searchType, topK, sessionId);

                if (results.length === 0) {
                  return JSON.stringify({
                    success: true,
                    query: args.query,
                    searchType: searchType,
                    count: 0,
                    message: `No memories found for: "${args.query}"`,
                  });
                }

                return JSON.stringify({
                  success: true,
                  query: args.query,
                  searchType: searchType,
                  count: results.length,
                  results: results.slice(0, topK).map((r) => ({
                    content: r.content,
                  })),
                });
              }

              case "timeline": {
                if (!args.query) {
                  return JSON.stringify({
                    success: false,
                    error: "query parameter is required for timeline action",
                  });
                }

                // Use TEMPORAL search type for time-aware queries with session context
                const timelineSessionId = context?.sessionID;
                const results = await cogneeClient.searchMemories(args.query, "TEMPORAL", 15, timelineSessionId);

                if (results.length === 0) {
                  return JSON.stringify({
                    success: true,
                    query: args.query,
                    count: 0,
                    message: `No temporal events found for: "${args.query}"`,
                  });
                }

                return JSON.stringify({
                  success: true,
                  query: args.query,
                  searchType: "TEMPORAL",
                  count: results.length,
                  results: results.slice(0, 15).map((r) => ({
                    content: r.content,
                    metadata: r.metadata,
                  })),
                });
              }

              case "add": {
                if (!args.content) {
                  return JSON.stringify({
                    success: false,
                    error: "content parameter is required for add action",
                  });
                }

                // Parse NodeSet tags from comma-separated string
                const nodeSets = args.tags 
                  ? args.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0)
                  : ['user_memories']; // Default NodeSet for manually added memories

                const addResult = await cogneeClient.addMemory(args.content, 'default_user', nodeSets);

                if (!addResult.success) {
                  return JSON.stringify({
                    success: false,
                    error: addResult.message || "Failed to add memory",
                  });
                }

                // Trigger cognify to process into knowledge graph
                await cogneeClient.cognify();

                return JSON.stringify({
                  success: true,
                  message: `Memory added with tags [${nodeSets.join(', ')}]: "${args.content.substring(0, 100)}${args.content.length > 100 ? "..." : ""}"`,
                  nodeSets: nodeSets,
                });
              }

              case "list": {
                const datasets = await cogneeClient.listDatasets();

                if (datasets.length === 0) {
                  return JSON.stringify({
                    success: true,
                    count: 0,
                    message: "No datasets found in Cognee",
                  });
                }

                return JSON.stringify({
                  success: true,
                  count: datasets.length,
                  datasets: datasets.map((d) => ({
                    id: d.id,
                    name: d.name,
                  })),
                });
              }

              default:
                return JSON.stringify({
                  success: false,
                  error: `Unknown action: ${action}. Use 'search', 'add', 'list', or 'help'`,
                });
            }
          } catch (error) {
            // Show toast for user visibility, then return error for tool output
            if (error instanceof CogneeUnavailableError) {
              showToast?.("Cognee unavailable", "error");
            } else if (error instanceof CogneeAPIError) {
              showToast?.(`Cognee error (${error.status})`, "error");
            } else {
              showToast?.("Memory operation failed", "error");
            }
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        },
      }),
    },

    event: async ({ event }) => {
      const eventType = event.type;

      if (eventType === "session.idle" || eventType === "session.end") {
        // Find conversations to save
        for (const [sessionId, state] of conversations.entries()) {
          if (state.messages.length > 0) {
            try {
              const formattedConversation = formatConversation(state.messages);
              const elapsed = Date.now() - state.startTime;
              const sessionDate = new Date(state.startTime).toISOString().split('T')[0];
              const sessionTime = new Date(state.startTime).toISOString();

              // Format with clear temporal markers for time-aware extraction
              const sessionContext = `Session Record (${sessionDate}):
Date: ${sessionDate}
Time: ${sessionTime}
Session ID: ${sessionId}
Duration: ${Math.round(elapsed / 1000 / 60)} minutes
Message Count: ${state.messages.length}

Events and Conversation:
${formattedConversation}`;

              // Use NodeSets to organize session data
              const sessionNodeSets = ['sessions', 'conversations', `session_${sessionDate.replace(/-/g, '_')}`];
              const addResult = await cogneeClient.addMemory(sessionContext, 'default_user', sessionNodeSets);

              if (addResult.success) {
                // Use temporal cognify for time-aware knowledge extraction
                await cogneeClient.cognify('default_user', { temporalCognify: true });
                showToast?.("Session saved to memory", "success");
              }
            } catch (error) {
              if (error instanceof CogneeUnavailableError) {
                showToast?.("Cognee unavailable - session not saved", "error");
              } else {
                showToast?.("Failed to save session", "error");
              }
            } finally {
              conversations.delete(sessionId);
              injectedSessions.delete(sessionId);
            }
          }
        }
      }
    },
  };
};

export default CogneePlugin;

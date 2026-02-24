/**
 * Cognee MCP Server for Gemini CLI
 * Provides memory tools via Model Context Protocol
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadConfig, ensureConfig } from './config.js';

// Initialize config
ensureConfig();
const config = loadConfig();

const COGNEE_URL = process.env.COGNEE_URL || config.cogneeUrl;
const COGNEE_API_TOKEN = process.env.COGNEE_API_TOKEN;

const server = new McpServer({
  name: 'cognee-memory',
  version: '1.0.0',
});

/**
 * Helper to make API requests to Cognee
 */
async function cogneeRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(COGNEE_API_TOKEN && { 'Authorization': `Bearer ${COGNEE_API_TOKEN}` }),
    ...options.headers,
  };

  const url = `${COGNEE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cognee API error (${response.status}): ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') {
      throw new Error('Cognee server unavailable. Start it with: uv run python -m cognee.api.client');
    }
    throw error;
  }
}

/**
 * Check if Cognee is available
 */
async function healthCheck() {
  try {
    const response = await fetch(`${COGNEE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Add content to Cognee with optional NodeSet tags
 */
async function addMemory(content, datasetName = config.datasetName || 'default_user', nodeSets = []) {
  const formData = new FormData();
  const blob = new Blob([content], { type: 'text/plain' });
  formData.append('data', blob, 'memory.txt');
  formData.append('datasetName', datasetName);
  
  for (const nodeSet of nodeSets) {
    formData.append('node_set', nodeSet);
  }

  const headers = {};
  if (COGNEE_API_TOKEN) {
    headers['Authorization'] = `Bearer ${COGNEE_API_TOKEN}`;
  }

  const response = await fetch(`${COGNEE_URL}/api/v1/add`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to add memory: ${response.status}`);
  }
  
  return { success: true };
}

/**
 * Trigger cognify to process into knowledge graph
 */
async function cognify(datasetName = config.datasetName || 'default_user', temporalCognify = true) {
  return cogneeRequest('/api/v1/cognify', {
    method: 'POST',
    body: JSON.stringify({
      datasets: [datasetName],
      temporal_cognify: temporalCognify,
    }),
  });
}

/**
 * Search memories using graph completion
 */
async function searchMemories(query, searchType = 'GRAPH_COMPLETION', topK = 10, sessionId = null) {
  const body = {
    query,
    search_type: searchType,
    top_k: topK,
  };
  
  if (sessionId) {
    body.session_id = sessionId;
  }

  const result = await cogneeRequest('/api/v1/search', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  // Normalize response format
  if (Array.isArray(result)) {
    return result.map(item => {
      if (typeof item === 'string') return { content: item };
      return { content: item.content || item.text || item.result || JSON.stringify(item) };
    });
  }
  
  if (result.results) {
    return searchMemories(result.results);
  }
  
  return [{ content: String(result) }];
}

/**
 * List all datasets
 */
async function listDatasets() {
  return cogneeRequest('/api/v1/datasets');
}

// Register the main cognee tool
server.registerTool(
  'cognee',
  {
    description: `Search, add, or list memories from Cognee knowledge graph. 
    
Actions:
- search: Find memories by semantic query (configurable search type)
- timeline: Time-aware search for queries like "what happened yesterday"
- add: Store new knowledge with optional tags for organization
- list: Show all available datasets
- help: Show usage guide

Search Types (for search action):
- GRAPH_COMPLETION: Complex reasoning with graph context (default, slower)
- RAG_COMPLETION: Fast fact retrieval without graph structure
- CHUNKS: Raw text passages - fastest option
- SUMMARIES: Pre-generated hierarchical summaries
- GRAPH_COMPLETION_COT: Chain-of-thought for complex multi-step reasoning
- FEELING_LUCKY: Auto-select best search type

Examples:
- cognee action:search query:"user preferences" searchType:GRAPH_COMPLETION
- cognee action:search query:"database port" searchType:CHUNKS topK:5
- cognee action:add content:"default_user prefers TypeScript" tags:"preferences,coding"
- cognee action:timeline query:"decisions made last week"`,
    inputSchema: z.object({
      action: z.enum(['search', 'timeline', 'add', 'list', 'help']).optional().describe('The action to perform'),
      query: z.string().optional().describe('Search query for search/timeline actions'),
      content: z.string().optional().describe('Content to add for add action'),
      tags: z.string().optional().describe('Comma-separated NodeSet tags for organizing memories'),
      searchType: z.enum(['GRAPH_COMPLETION', 'RAG_COMPLETION', 'CHUNKS', 'SUMMARIES', 'GRAPH_COMPLETION_COT', 'FEELING_LUCKY'])
        .optional().describe('Search type: GRAPH_COMPLETION (default, complex reasoning), RAG_COMPLETION (fast facts), CHUNKS (raw text), SUMMARIES (overviews), GRAPH_COMPLETION_COT (chain-of-thought), FEELING_LUCKY (auto-select)'),
      topK: z.number().optional().describe('Number of results to return (default: 10)'),
    }).shape,
  },
  async (args) => {
    const action = args.action || 'help';
    
    try {
      switch (action) {
        case 'help': {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Cognee Memory Usage Guide',
                commands: [
                  {
                    command: 'search',
                    description: 'Search memories with configurable search type',
                    args: ['query', 'searchType (optional)', 'topK (optional)'],
                    searchTypes: {
                      GRAPH_COMPLETION: 'Default - Complex reasoning with graph context (slower, most intelligent)',
                      RAG_COMPLETION: 'Fast fact retrieval without graph structure',
                      CHUNKS: 'Raw text passages - fastest option',
                      SUMMARIES: 'Pre-generated hierarchical summaries',
                      GRAPH_COMPLETION_COT: 'Chain-of-thought for complex multi-step reasoning',
                      FEELING_LUCKY: 'Auto-select best search type',
                    },
                  },
                  {
                    command: 'timeline',
                    description: 'Time-aware search (e.g., "what happened last week")',
                    args: ['query'],
                  },
                  {
                    command: 'add',
                    description: 'Add memory with optional NodeSet tags for organization',
                    args: ['content', 'tags (optional, comma-separated)'],
                    example: 'add content="default_user prefers dark mode" tags="preferences,ui"',
                  },
                  {
                    command: 'list',
                    description: 'List all datasets',
                    args: [],
                  },
                ],
                nodeSets: {
                  description: 'NodeSets are tags that organize memories into searchable groups',
                  examples: ['preferences', 'tools', 'decisions', 'projects', 'sessions'],
                  automatic: ['sessions', 'conversations', 'user_memories'],
                },
                searchTypeGuide: {
                  simpleFacts: 'Use RAG_COMPLETION for quick fact lookups',
                  complexReasoning: 'Use GRAPH_COMPLETION for questions requiring relationship understanding',
                  rawContent: 'Use CHUNKS to verify content exists or get exact passages',
                  overviews: 'Use SUMMARIES for quick document overviews',
                  multiStep: 'Use GRAPH_COMPLETION_COT for differential diagnosis or complex analysis',
                },
              }, null, 2),
            }],
          };
        }

        case 'search': {
          if (!args.query) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success: false, error: 'query parameter required for search' }),
              }],
            };
          }

          // Use provided searchType or default to GRAPH_COMPLETION
          const searchType = args.searchType || 'GRAPH_COMPLETION';
          const topK = args.topK || 10;
          const results = await searchMemories(args.query, searchType, topK);
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                query: args.query,
                searchType: searchType,
                count: results.length,
                results: results.slice(0, topK),
              }, null, 2),
            }],
          };
        }

        case 'timeline': {
          if (!args.query) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success: false, error: 'query parameter required for timeline' }),
              }],
            };
          }

          const results = await searchMemories(args.query, 'TEMPORAL', 15);
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                query: args.query,
                searchType: 'TEMPORAL',
                count: results.length,
                results: results.slice(0, 15),
              }, null, 2),
            }],
          };
        }

        case 'add': {
          if (!args.content) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success: false, error: 'content parameter required for add' }),
              }],
            };
          }

          const nodeSets = args.tags 
            ? args.tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
            : ['user_memories'];

          await addMemory(args.content, 'gemini_memories', nodeSets);
          await cognify('gemini_memories', true);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Memory added with tags [${nodeSets.join(', ')}]`,
                preview: args.content.substring(0, 100) + (args.content.length > 100 ? '...' : ''),
              }, null, 2),
            }],
          };
        }

        case 'list': {
          const datasets = await listDatasets();
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: datasets.length,
                datasets: datasets.map(d => ({ id: d.id, name: d.name })),
              }, null, 2),
            }],
          };
        }

        default:
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
            }],
          };
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            hint: error.message.includes('unavailable') 
              ? 'Start Cognee with: uv run python -m cognee.api.client'
              : undefined,
          }, null, 2),
        }],
      };
    }
  }
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);

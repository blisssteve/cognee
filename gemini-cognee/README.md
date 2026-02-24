# Gemini CLI Cognee Extension

Persistent memory for Gemini CLI via Cognee knowledge graph. Automatically saves sessions and injects relevant context into conversations.

## Features

- **🧠 Semantic Memory**: Store and retrieve knowledge using Cognee's graph-based search
- **⏰ Temporal Awareness**: Time-based queries like "what happened yesterday"
- **🔄 Auto-Session Saving**: Conversations are automatically saved on session end
- **💉 Context Injection**: Relevant memories are injected before each interaction
- **🏷️ NodeSet Tags**: Organize memories with tags for better searchability

## Prerequisites

1. **Gemini CLI** installed and configured
2. **Cognee server** running (local or remote)

### Starting Cognee

```bash
# From the cognee repository
uv run python -m cognee.api.client

# Or with Docker
docker run -p 8000:8000 cognee/cognee:latest
```

## Installation

### From Local Path

```bash
# Clone or navigate to the cognee repo
cd /path/to/cognee/gemini-cognee

# Install dependencies
npm install

# Link the extension for development
gemini extensions link .
```

### From GitHub (once published)

```bash
gemini extensions install https://github.com/topoteretes/cognee --ref main
```

## Configuration

On first install, Gemini CLI will prompt for:

- **Cognee URL**: Your Cognee server URL (default: `http://localhost:8000`)
- **Cognee API Token**: Optional authentication token

You can also set these via environment variables:

```bash
export COGNEE_URL=http://localhost:8000
export COGNEE_API_TOKEN=your_token_here
```

Or update settings later:

```bash
gemini extensions config gemini-cognee
```

## Usage

### Manual Memory Operations

The extension provides a `cognee` tool with these actions:

```
# Search memories
cognee action:search query:"user preferences"

# Time-based search
cognee action:timeline query:"what happened last week"

# Add a memory
cognee action:add content:"default_user prefers TypeScript" tags:"preferences,coding"

# List all datasets
cognee action:list
```

### Automatic Behavior

- **On Session Start**: Recent memories are loaded and injected
- **Before Each Turn**: Relevant memories for the current prompt are searched
- **Memory Triggers**: Saying "remember this" or "don't forget" nudges the model to save
- **On Session End**: Conversation summary is saved with temporal markers

### NodeSet Tags

Organize your memories with tags:

| Tag | Purpose |
|-----|---------|
| `preferences` | User settings, coding style |
| `decisions` | Architectural choices made |
| `learnings` | Insights, gotchas discovered |
| `projects` | Project-specific context |
| `tools` | Tool configurations |
| `sessions` | Auto-saved session records |

## Architecture

```
gemini-cognee/
├── gemini-extension.json    # Extension manifest
├── GEMINI.md                # Agent instructions
├── package.json             # Node.js dependencies
├── src/
│   └── server.js            # MCP server with cognee tool
├── hooks/
│   └── hooks.json           # Lifecycle hook definitions
└── scripts/
    ├── session-start.js     # Load memories on startup
    ├── before-agent.js      # Inject context per turn
    └── session-end.js       # Save session on exit
```

## Comparison with OpenCode Plugin

| Feature | OpenCode Plugin | Gemini CLI Extension |
|---------|----------------|---------------------|
| Tool API | `tool()` with `execute()` | MCP `registerTool()` |
| Context injection | `output.parts.unshift()` | Hook `additionalContext` |
| Session events | `session.idle`, `session.end` | `SessionStart`, `SessionEnd` hooks |
| User feedback | `showToast()` | `systemMessage` in hook output |
| Config | Plugin export | `gemini-extension.json` settings |

## Troubleshooting

### "Cognee unavailable" message

1. Ensure Cognee server is running: `curl http://localhost:8000/health`
2. Check COGNEE_URL is correct: `gemini extensions config gemini-cognee`
3. Verify network connectivity if using remote server

### Hooks not firing

1. Restart Gemini CLI after installing/updating
2. Check hook logs: `gemini --verbose`
3. Verify hooks.json syntax: `cat ~/.gemini/extensions/gemini-cognee/hooks/hooks.json`

### No memories being saved

1. Check Cognee API connectivity
2. Verify transcript_path in SessionEnd hook
3. Look for errors in stderr output

## License

Apache-2.0 - See [LICENSE](../LICENSE)

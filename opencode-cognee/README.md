# opencode-cognee

Integrate [Cognee](https://github.com/cognelytics/cognee) as a persistent memory backend for OpenCode.

## Features

- **Automatic Context Injection**: Relevant memories are automatically injected into conversations based on similarity search
- **Explicit Memory Saving**: Use keywords like "remember", "note", or "save this" to explicitly save information
- **Session Persistence**: Conversations are automatically saved to Cognee when sessions become idle
- **Manual Operations**: Access Cognee through the `cognee` tool for search, add, and list operations

## Installation

1. Clone this repository or install via npm (when published):
```bash
npm install opencode-cognee
```

2. Ensure Cognee MCP server is running:
```bash
# Start Cognee with MCP server
cd /path/to/cognee/cognee-mcp
uv run python src/server.py --transport http --host 127.0.0.1 --port 8003 --path /mcp
```

3. Configure the plugin:
```bash
# Config file is auto-created at ~/.config/opencode/cognee.json
# Edit to customize settings
```

## Configuration

The plugin reads configuration from `~/.config/opencode/cognee.json`:

```json
{
  "cogneeUrl": "http://localhost:8003",
  "similarityThreshold": 0.7,
  "maxMemories": 5,
  "keywordPatterns": ["remember", "note", "save this", "important"]
}
```

- `cogneeUrl`: URL of the Cognee MCP server
- `similarityThreshold`: Minimum similarity score for memory retrieval (default: 0.7)
- `maxMemories`: Maximum number of memories to inject (default: 5)
- `keywordPatterns`: Keywords that trigger explicit memory saving

## Usage

### Automatic Memory Injection

When you start a conversation, the plugin automatically searches Cognee for relevant memories and injects them as context:

```
<remembered_context>
Previous conversation about Cognee integration...
</remembered_context>
```

### Explicit Memory Saving

Use keywords in your messages to explicitly save information:

```
"Remember that Cognee runs on port 8003"
```

The plugin will save this to Cognee and confirm:

```
<cognee_memory>
I've saved this to your memory: "Remember that Cognee runs on port 8003"
</cognee_memory>
```

### Manual Tool Operations

Use the `cognee` tool for manual operations:

#### Search Memories
```
Tool: cognee
Action: search
Query: "What did we discuss about Cognee?"
```

#### Add Memory
```
Tool: cognee
Action: add
Content: "Important: Always use TypeScript for plugins"
```

#### List Datasets
```
Tool: cognee
Action: list
DatasetId: (optional, leave empty for all)
```

## Architecture

### Chat Message Hook (`chat.message`)

1. **First Message**: Searches Cognee for relevant memories and injects context
2. **Every Message**: Tracks message history for later persistence
3. **Keyword Detection**: Detects "remember" keywords and saves explicitly

### Event Hook (`event`)

1. **Session Idle**: When a session has been idle for 5+ minutes, saves the conversation to Cognee
2. **Session End**: Cleans up in-memory state

### Tool (`cognee`)

Provides manual access to Cognee operations:
- `search`: Query the knowledge graph
- `add`: Add new content to memory
- `list`: List all datasets

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

## Dependencies

- `@opencode-ai/plugin`: OpenCode plugin framework
- Cognee MCP server running on `http://localhost:8003`

## Differences from Supermemory

1. **No API Key Required**: Cognee runs locally with no external authentication
2. **MCP Protocol**: Uses Model Context Protocol for communication
3. **Simpler API**: Focuses on core operations (search, add, cognify)
4. **Local First**: All data stays on your local machine

## License

MIT

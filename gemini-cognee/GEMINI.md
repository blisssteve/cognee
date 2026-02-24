# Cognee Memory System

You have access to a persistent memory system via the `cognee` tool. Use it to remember important information across sessions.

## Available Actions

### Search memories
```
cognee action:search query:"user preferences for UI"
```
Use GRAPH_COMPLETION search for semantic understanding of stored knowledge.

### Timeline search
```
cognee action:timeline query:"what happened yesterday"
```
Use for time-aware queries like "last week", "before March", etc.

### Add memories
```
cognee action:add content:"default_user prefers dark mode and TypeScript" tags:"preferences,coding"
```
Tags help organize memories into searchable groups (NodeSets).

### List datasets
```
cognee action:list
```
See all available memory datasets.

## When to Save Memories

Proactively save information when:
- User says "remember this", "save this", "don't forget"
- Making architectural decisions worth preserving
- Learning user preferences or coding style
- Discovering project-specific patterns or gotchas

## Suggested Tags (NodeSets)

| Tag | Use For |
|-----|---------|
| `preferences` | User settings, coding style, tool preferences |
| `decisions` | Architectural choices, trade-offs made |
| `learnings` | Insights, patterns discovered, gotchas |
| `projects` | Project-specific context |
| `tools` | Tool configurations, MCP settings |
| `sessions` | Auto-saved session summaries |

## Memory Injection

Relevant memories are automatically injected at session start and before each interaction. You'll see them in `<remembered_context>` blocks - use this information to provide personalized, context-aware responses.

---
name: cognee-memory
description: Persistent memory management using Cognee knowledge graph. Use when context is filling up, to save important information, or to retrieve past decisions and learnings.
---

# Cognee Memory Skill

Manage persistent memory across sessions using the built-in `cognee` tool. This enables continuity between conversations.

## Available Actions

The `cognee` tool supports these actions:

| Action | Description | Parameters |
|--------|-------------|------------|
| `search` | Find memories | `query`, `searchType` (optional), `topK` (optional) |
| `timeline` | Time-based search | `query` |
| `add` | Store new memory | `content`, `tags` (comma-separated) |
| `list` | Show all datasets | none |
| `help` | Show usage info | none |

## Search Types

Choose the right search type for your query:

| Search Type | Best For | Speed |
|-------------|----------|-------|
| `GRAPH_COMPLETION` (default) | Complex reasoning, relationships | Slower, most intelligent |
| `RAG_COMPLETION` | Fast fact retrieval | Medium |
| `CHUNKS` | Raw text passages | Fastest |
| `SUMMARIES` | Document overviews | Fast |
| `GRAPH_COMPLETION_COT` | Multi-step reasoning | Slowest |
| `FEELING_LUCKY` | Auto-select best type | Variable |

### Search Type Decision Guide

```
Need relationships between concepts?
├── Yes → GRAPH_COMPLETION or GRAPH_COMPLETION_COT
└── No → Need raw text?
    ├── Yes → CHUNKS
    └── No → Need quick facts?
        ├── Yes → RAG_COMPLETION
        └── No → Need overview?
            ├── Yes → SUMMARIES
            └── No → FEELING_LUCKY
```

## When to Use

- **Session start**: Search for relevant context from past sessions
- **Context filling up**: Save important information before overflow
- **User says "remember"**: Add specific information to memory
- **Making decisions**: Check past decisions on similar topics
- **Learning something new**: Save learnings for future reference

## Quick Reference

### Search Memory (with search types)
```
cognee action:search query:"What are default_user's preferences?"
cognee action:search query:"database decisions" searchType:GRAPH_COMPLETION
cognee action:search query:"exact phrase" searchType:CHUNKS topK:5
cognee action:search query:"quick fact" searchType:RAG_COMPLETION
```

### Time-Based Search
```
cognee action:timeline query:"what happened yesterday"
```

### Add Memory
```
cognee action:add content:"default_user prefers dark mode" tags:preferences
cognee action:add content:"Decision: Use PostgreSQL for ACID" tags:decisions,database
```

### List Datasets
```
cognee action:list
```

## Tags (Memory Categories)

Organize memories using tags:

| Tag | Purpose | Example |
|-----|---------|---------|
| `preferences` | User settings, style | "prefers TypeScript" |
| `decisions` | Architectural choices | "chose PostgreSQL" |
| `learnings` | Insights, patterns | "Redis AOF provides durability" |
| `projects` | Project context | "bull-report uses FlutterFlow" |
| `tools` | Tool configurations | "MCP server on port 8003" |
| `sessions` | Session summaries | "Session 2026-02-01: Fixed X" |

## Workflow Examples

### Session Start - Retrieve Context
```
cognee action:search query:"user preferences and recent decisions"
```

### Quick Fact Lookup
```
cognee action:search query:"database connection string" searchType:RAG_COMPLETION
```

### Complex Relationship Query
```
cognee action:search query:"How does the authentication system relate to the database?" searchType:GRAPH_COMPLETION
```

### Verify Content Exists
```
cognee action:search query:"API endpoint documentation" searchType:CHUNKS
```

### Save a User Preference
User: "I prefer async/await over callbacks"
```
cognee action:add content:"default_user prefers async/await over callbacks" tags:preferences
```

### Check Before Making a Decision
```
cognee action:search query:"past decisions about message queues" searchType:GRAPH_COMPLETION
```

### Context Getting Full - Save Summary
```
cognee action:add content:"Session 2026-02-01: Implemented cognee-memory skill, tested MCP integration" tags:sessions
```
Then inform user: "I've saved the key context. You can `/clear` and I'll retrieve relevant memories."

## Best Practices

1. **Use appropriate search types** - RAG_COMPLETION for facts, GRAPH_COMPLETION for relationships
2. **Use tags** - Organize by type (preferences, decisions, learnings)
3. **Be specific** - "prefers TypeScript" beats "likes typed languages"
4. **Search before deciding** - Check past decisions on similar topics
5. **Save incrementally** - Don't wait for session end
6. **Use timeline** - For recency-based queries ("what did we do yesterday")

## Troubleshooting

If the cognee tool isn't responding:
1. Check the MCP server: `docker ps | grep cognee-mcp`
2. Check logs: `docker logs cognee-mcp`
3. Restart if needed: `cd /home/default_user/cognee && docker compose restart cognee-mcp`

### Problem: "No memories found"

**Diagnosis:**
1. Try CHUNKS search to verify content exists
2. Check if cognify has processed the data
3. Verify dataset permissions

**Solution:**
```
cognee action:search query:"any content" searchType:CHUNKS
```

### Problem: Slow Searches

**Solutions:**
- Use RAG_COMPLETION instead of GRAPH_COMPLETION
- Reduce topK parameter
- Use CHUNKS for fastest results

# Cognee Search Types Reference

Complete reference for all available search types in Cognee, including their internals, use cases, and implementation details.

## Search Type Enum Values

```python
from enum import Enum

class SearchType(Enum):
    SUMMARIES = "SUMMARIES"
    CHUNKS = "CHUNKS"
    RAG_COMPLETION = "RAG_COMPLETION"
    TRIPLET_COMPLETION = "TRIPLET_COMPLETION"
    GRAPH_COMPLETION = "GRAPH_COMPLETION"
    GRAPH_SUMMARY_COMPLETION = "GRAPH_SUMMARY_COMPLETION"
    CYPHER = "CYPHER"
    NATURAL_LANGUAGE = "NATURAL_LANGUAGE"
    GRAPH_COMPLETION_COT = "GRAPH_COMPLETION_COT"
    GRAPH_COMPLETION_CONTEXT_EXTENSION = "GRAPH_COMPLETION_CONTEXT_EXTENSION"
    FEELING_LUCKY = "FEELING_LUCKY"
    FEEDBACK = "FEEDBACK"
    TEMPORAL = "TEMPORAL"
    CODING_RULES = "CODING_RULES"
    CHUNKS_LEXICAL = "CHUNKS_LEXICAL"
```

## Detailed Search Type Documentation

### SUMMARIES

**Retriever:** `SummariesRetriever`

**Description:** Returns pre-generated hierarchical summaries of content. Summaries are created during the cognify process and provide multi-level overviews from detailed to high-level.

**Use Cases:**
- Quick overviews of document content
- Document abstracts
- Topic summaries
- Navigation aids for large document collections

**Parameters:**
- `top_k`: Number of summaries to return (default: 10)

**Example:**
```python
summaries = await cognee.search(
    query_text="treatment protocols for diabetes",
    query_type=SearchType.SUMMARIES,
    top_k=5
)
```

**Output Format:** List of summary objects with hierarchical structure.

---

### CHUNKS

**Retriever:** `ChunksRetriever`

**Description:** Returns raw text segments that match the query semantically using vector similarity search. No LLM processing is applied to the results.

**Use Cases:**
- Finding specific passages
- Citations and quotes
- Exact content verification
- Debugging data ingestion
- Building custom RAG pipelines

**Parameters:**
- `top_k`: Number of chunks to return (default: 10)

**Example:**
```python
chunks = await cognee.search(
    query_text="feline pancreatitis symptoms",
    query_type=SearchType.CHUNKS,
    top_k=10
)
```

**Output Format:** List of chunk objects with metadata including source document, page numbers, and similarity scores.

**Performance:** Fastest search type - pure vector similarity without LLM calls.

---

### RAG_COMPLETION

**Retriever:** `CompletionRetriever`

**Description:** Traditional RAG (Retrieval-Augmented Generation) using document chunks without graph structure. Retrieves relevant chunks and uses an LLM to generate a response.

**Use Cases:**
- Direct document retrieval
- Specific fact-finding
- Faster responses when graph relationships aren't needed
- Simple Q&A scenarios

**Parameters:**
- `top_k`: Number of chunks to retrieve for context (default: 10)
- `system_prompt_path`: Path to system prompt file (default: "answer_simple_question.txt")
- `system_prompt`: Custom system prompt string

**Example:**
```python
result = await cognee.search(
    query_text="What are the side effects of xylazine?",
    query_type=SearchType.RAG_COMPLETION,
    top_k=5,
    system_prompt="You are a veterinary expert. Answer concisely."
)
```

**Output Format:** LLM-generated response string based on retrieved chunks.

**Performance:** Medium speed - uses LLM + document chunks without graph traversal.

---

### TRIPLET_COMPLETION

**Retriever:** `TripletRetriever`

**Description:** Uses knowledge graph triplets (subject-predicate-object) for retrieval and completion. Provides structured relationship context.

**Use Cases:**
- Relationship-focused queries
- Structured knowledge extraction
- Entity-relationship exploration

**Parameters:**
- `top_k`: Number of triplets to retrieve (default: 10)
- `system_prompt_path`: Path to system prompt file
- `system_prompt`: Custom system prompt string

**Example:**
```python
result = await cognee.search(
    query_text="What drugs interact with xylazine?",
    query_type=SearchType.TRIPLET_COMPLETION,
    top_k=10
)
```

**Output Format:** LLM response with triplet-based context.

---

### GRAPH_COMPLETION (Default)

**Retriever:** `GraphCompletionRetriever`

**Description:** Natural language Q&A using full graph context and LLM reasoning. Combines vector similarity, graph structure, and LLM capabilities for the most comprehensive search.

**Use Cases:**
- Complex questions requiring relationship understanding
- Analysis and synthesis tasks
- Multi-hop reasoning
- Comprehensive insights

**Parameters:**
- `top_k`: Number of initial nodes to retrieve (default: 10)
- `wide_search_top_k`: Number of nodes for wide search (default: 100)
- `triplet_distance_penalty`: Penalty for triplet distance (default: 3.5)
- `node_type`: Filter by node type (default: NodeSet)
- `node_name`: Filter by node names
- `save_interaction`: Save interaction to graph (default: False)
- `system_prompt_path`: Path to system prompt file
- `system_prompt`: Custom system prompt string

**Example:**
```python
result = await cognee.search(
    query_text="What is the relationship between prednisolone and IBD in cats?",
    query_type=SearchType.GRAPH_COMPLETION,
    top_k=10,
    node_name=["veterinary_docs"],
    save_interaction=True
)
```

**Output Format:** Conversational AI response with graph-backed context.

**Performance:** Slower but most intelligent - uses LLM + graph context + vector similarity.

---

### GRAPH_SUMMARY_COMPLETION

**Retriever:** `GraphSummaryCompletionRetriever`

**Description:** Combines summary-based retrieval with graph context for concise answers. Uses summaries as the primary context source.

**Use Cases:**
- Summary-first answers
- Quick overviews with relationship context
- When brevity is important

**Parameters:**
- Same as GRAPH_COMPLETION

**Example:**
```python
result = await cognee.search(
    query_text="Overview of equine sedation protocols",
    query_type=SearchType.GRAPH_SUMMARY_COMPLETION,
    top_k=5
)
```

**Output Format:** Concise answer with summary and graph context.

---

### GRAPH_COMPLETION_COT (Chain-of-Thought)

**Retriever:** `GraphCompletionCotRetriever`

**Description:** Complex multi-step reasoning with refined answers. Uses chain-of-thought prompting to work through complex queries step by step.

**Use Cases:**
- Complex reasoning tasks
- Differential diagnosis
- Multi-step analysis
- Decision support

**Parameters:**
- Same as GRAPH_COMPLETION

**Example:**
```python
result = await cognee.search(
    query_text="What differential diagnoses should be considered for a cat with chronic vomiting and weight loss?",
    query_type=SearchType.GRAPH_COMPLETION_COT,
    top_k=10
)
```

**Output Format:** Refined answer with reasoning steps.

---

### GRAPH_COMPLETION_CONTEXT_EXTENSION

**Retriever:** `GraphCompletionContextExtensionRetriever`

**Description:** Open-ended exploration with expanded subgraph answers. Extends context by exploring related nodes in the graph.

**Use Cases:**
- Open-ended exploration
- Comprehensive topic coverage
- Discovery of related concepts

**Parameters:**
- Same as GRAPH_COMPLETION

**Example:**
```python
result = await cognee.search(
    query_text="What are all treatment options for inflammatory bowel disease?",
    query_type=SearchType.GRAPH_COMPLETION_CONTEXT_EXTENSION,
    top_k=10
)
```

**Output Format:** Expanded answer with related context.

---

### CYPHER

**Retriever:** `CypherSearchRetriever`

**Description:** Direct graph database queries using Cypher syntax. Bypasses LLM and vector search for precise graph queries.

**Use Cases:**
- Advanced users
- Specific graph traversals
- Debugging
- Precise structural queries

**Security:** Can be disabled with `ALLOW_CYPHER_QUERY=false` environment variable.

**Example:**
```python
result = await cognee.search(
    query_text="MATCH (n:Entity)-[r]->(m:Entity) WHERE n.name CONTAINS 'xylazine' RETURN n, r, m LIMIT 10",
    query_type=SearchType.CYPHER
)
```

**Output Format:** Raw graph query results.

---

### NATURAL_LANGUAGE

**Retriever:** `NaturalLanguageRetriever`

**Description:** Converts natural language queries to Cypher and executes them. Combines LLM translation with graph queries.

**Use Cases:**
- Natural language to graph queries
- Users unfamiliar with Cypher
- Ad-hoc graph exploration

**Security:** Can be disabled with `ALLOW_CYPHER_QUERY=false` environment variable.

**Example:**
```python
result = await cognee.search(
    query_text="Find all drugs that interact with xylazine",
    query_type=SearchType.NATURAL_LANGUAGE
)
```

**Output Format:** Graph query results from translated Cypher.

---

### FEELING_LUCKY

**Description:** Intelligently selects and runs the most appropriate search type based on the query. Uses LLM to analyze the query and choose the best search method.

**Use Cases:**
- General-purpose queries
- When unsure which search type to use
- Quick exploration

**Example:**
```python
result = await cognee.search(
    query_text="What sedatives are used for equine dentistry?",
    query_type=SearchType.FEELING_LUCKY
)
```

**Output Format:** Results from the automatically selected search type.

---

### FEEDBACK

**Retriever:** `UserQAFeedback`

**Description:** Retrieves and manages user Q&A feedback for improving search quality.

**Use Cases:**
- Feedback collection
- Quality improvement
- User interaction history

**Parameters:**
- `last_k`: Number of recent interactions to retrieve

**Example:**
```python
feedback = await cognee.search(
    query_text="previous interactions about xylazine",
    query_type=SearchType.FEEDBACK,
    last_k=5
)
```

---

### TEMPORAL

**Retriever:** `TemporalRetriever`

**Description:** Time-based queries for retrieving information within specific time ranges.

**Use Cases:**
- Time-filtered searches
- Historical queries
- Temporal analysis

**Parameters:**
- `top_k`: Number of results
- `wide_search_top_k`: Wide search parameter
- `triplet_distance_penalty`: Distance penalty

**Example:**
```python
result = await cognee.search(
    query_text="treatment protocols updated in the last year",
    query_type=SearchType.TEMPORAL,
    top_k=10
)
```

---

### CODING_RULES

**Retriever:** `CodingRulesRetriever`

**Description:** Retrieves coding-related knowledge and rules from the knowledge graph.

**Use Cases:**
- Code-related queries
- Development patterns
- Coding best practices

**Parameters:**
- `node_name`: Rules node set name

**Example:**
```python
rules = await cognee.search(
    query_text="error handling patterns",
    query_type=SearchType.CODING_RULES,
    node_name=["coding_rules"]
)
```

---

### CHUNKS_LEXICAL

**Retriever:** `JaccardChunksRetriever`

**Description:** Token-based lexical chunk search using Jaccard similarity. Best for exact-term matching with stopword awareness.

**Use Cases:**
- Exact-term matching
- Stopword-aware lookups
- Traditional keyword search

**Parameters:**
- `top_k`: Number of chunks to return

**Example:**
```python
result = await cognee.search(
    query_text="xylazine contraindications equine",
    query_type=SearchType.CHUNKS_LEXICAL,
    top_k=10
)
```

**Output Format:** Ranked text chunks with optional scores.

---

## Search Type Selection Algorithm

When using `FEELING_LUCKY`, Cognee uses the `select_search_type` function to intelligently choose:

1. Analyzes query complexity and intent
2. Considers available data types
3. Selects optimal search type
4. Executes and returns results

## Performance Comparison

| Search Type | Speed | Intelligence | Graph Usage | LLM Usage |
|-------------|-------|--------------|-------------|-----------|
| CHUNKS | Fastest | Low | No | No |
| SUMMARIES | Fast | Low | No | No |
| CHUNKS_LEXICAL | Fast | Low | No | No |
| RAG_COMPLETION | Medium | Medium | No | Yes |
| GRAPH_COMPLETION | Slow | High | Yes | Yes |
| GRAPH_COMPLETION_COT | Slowest | Highest | Yes | Yes |
| CYPHER | Variable | High | Yes | No |

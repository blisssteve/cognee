# Cognee Query Patterns Reference

Domain-specific query patterns and templates for effective knowledge graph search.

## General Query Patterns

### Pattern: Entity + Relationship Query

```
What is the relationship between {entity1} and {entity2}?
```

**Example:**
```python
result = await cognee.search(
    "What is the relationship between prednisolone and inflammatory bowel disease?",
    query_type=SearchType.GRAPH_COMPLETION
)
```

### Pattern: Attribute Query

```
What are the {attributes} of {entity}?
```

**Example:**
```python
result = await cognee.search(
    "What are the side effects of xylazine?",
    query_type=SearchType.GRAPH_COMPLETION
)
```

### Pattern: Comparison Query

```
What are the differences between {entity1} and {entity2}?
```

**Example:**
```python
result = await cognee.search(
    "What are the differences between xylazine and detomidine for equine sedation?",
    query_type=SearchType.GRAPH_COMPLETION
)
```

### Pattern: List/Enumeration Query

```
What are all the {category} for {context}?
```

**Example:**
```python
result = await cognee.search(
    "What are all the treatment options for feline diabetes?",
    query_type=SearchType.GRAPH_COMPLETION_CONTEXT_EXTENSION
)
```

---

## Veterinary Domain Patterns

### Medication Queries

#### Pattern: Drug + Condition + Species

```
What is the recommended dosage of {drug} for {condition} in {species}?
```

**Example:**
```python
result = await cognee.search(
    "What is the recommended dosage of xylazine for sedation in horses?",
    query_type=SearchType.GRAPH_COMPLETION,
    datasets=["veterinary"]
)
```

#### Pattern: Drug Contraindications

```
What are the contraindications for {drug} in {species}?
```

**Example:**
```python
result = await cognee.search(
    "What are the contraindications for xylazine in horses?",
    query_type=SearchType.GRAPH_COMPLETION,
    datasets=["veterinary"]
)
```

#### Pattern: Drug Interactions

```
What drugs interact with {drug} in {species}?
```

**Example:**
```python
result = await cognee.search(
    "What drugs interact with detomidine in equine patients?",
    query_type=SearchType.GRAPH_COMPLETION,
    datasets=["veterinary"]
)
```

#### Pattern: Drug Side Effects

```
What are the side effects of {drug} in {species}?
```

**Example:**
```python
result = await cognee.search(
    "What are the side effects of prednisolone in cats?",
    query_type=SearchType.GRAPH_COMPLETION,
    datasets=["veterinary"]
)
```

### Symptom/Diagnosis Queries

#### Pattern: Differential Diagnosis

```
What conditions should be considered for a {species} presenting with {symptoms}?
```

**Example:**
```python
result = await cognee.search(
    "What differential diagnoses should be considered for a cat with chronic vomiting and weight loss?",
    query_type=SearchType.GRAPH_COMPLETION_COT,  # Chain-of-thought for complex reasoning
    datasets=["veterinary"]
)
```

#### Pattern: Symptom Causes

```
What causes {symptom} in {species}?
```

**Example:**
```python
result = await cognee.search(
    "What causes polydipsia in dogs?",
    query_type=SearchType.GRAPH_COMPLETION,
    datasets=["veterinary"]
)
```

#### Pattern: Diagnostic Approach

```
How is {condition} diagnosed in {species}?
```

**Example:**
```python
result = await cognee.search(
    "How is pancreatitis diagnosed in cats?",
    query_type=SearchType.GRAPH_COMPLETION,
    datasets=["veterinary"]
)
```

### Treatment Protocol Queries

#### Pattern: Treatment Options

```
What are the treatment protocols for {condition} in {species}?
```

**Example:**
```python
result = await cognee.search(
    "What are the treatment options for inflammatory bowel disease in cats?",
    query_type=SearchType.GRAPH_COMPLETION_CONTEXT_EXTENSION,  # For comprehensive exploration
    datasets=["veterinary"]
)
```

#### Pattern: Treatment Duration

```
How long should {treatment} be administered for {condition} in {species}?
```

**Example:**
```python
result = await cognee.search(
    "How long should antibiotics be administered for urinary tract infection in dogs?",
    query_type=SearchType.GRAPH_COMPLETION,
    datasets=["veterinary"]
)
```

#### Pattern: Treatment Monitoring

```
What monitoring is required during {treatment} for {condition}?
```

**Example:**
```python
result = await cognee.search(
    "What monitoring is required during insulin therapy for diabetes in cats?",
    query_type=SearchType.GRAPH_COMPLETION,
    datasets=["veterinary"]
)
```

### Breed/Species-Specific Queries

#### Pattern: Breed Predispositions

```
What conditions are {breed} prone to?
```

**Example:**
```python
result = await cognee.search(
    "What conditions are German Shepherds prone to?",
    query_type=SearchType.GRAPH_COMPLETION,
    datasets=["veterinary"]
)
```

#### Pattern: Species-Specific Procedures

```
What are the common {procedure_type} in {species} veterinary practice?
```

**Example:**
```python
result = await cognee.search(
    "What are the common dental procedures in equine veterinary practice?",
    query_type=SearchType.GRAPH_COMPLETION,
    datasets=["veterinary"],
    node_name=["equine"]  # Filter to equine-specific content
)
```

---

## Medical Domain Patterns

### Diagnosis Patterns

#### Pattern: Condition Symptoms

```
What are the symptoms of {condition}?
```

**Example:**
```python
result = await cognee.search(
    "What are the symptoms of myocardial infarction?",
    query_type=SearchType.GRAPH_COMPLETION,
    datasets=["medical"]
)
```

#### Pattern: Risk Factors

```
What are the risk factors for {condition}?
```

**Example:**
```python
result = await cognee.search(
    "What are the risk factors for type 2 diabetes?",
    query_type=SearchType.GRAPH_COMPLETION,
    datasets=["medical"]
)
```

### Treatment Patterns

#### Pattern: First-Line Treatment

```
What is the first-line treatment for {condition}?
```

**Example:**
```python
result = await cognee.search(
    "What is the first-line treatment for hypertension?",
    query_type=SearchType.GRAPH_COMPLETION,
    datasets=["medical"]
)
```

---

## Technical/Code Domain Patterns

### Code Understanding Patterns

#### Pattern: Function Purpose

```
What does the function {function_name} do?
```

**Example:**
```python
result = await cognee.search(
    "What does the process_payment function do?",
    query_type=SearchType.CODING_RULES
)
```

#### Pattern: Implementation Pattern

```
How is {feature} implemented in {codebase}?
```

**Example:**
```python
result = await cognee.search(
    "How is authentication implemented in this codebase?",
    query_type=SearchType.GRAPH_COMPLETION,
    datasets=["code"]
)
```

---

## Query Optimization Techniques

### 1. Use Specific Entity Names

```python
# Poor - vague
query = "What about medications?"

# Better - specific
query = "What are the dosing guidelines for xylazine in equine sedation?"
```

### 2. Include Context Constraints

```python
result = await cognee.search(
    "What are the treatment options for IBD in cats?",  # Species constraint included
    query_type=SearchType.GRAPH_COMPLETION,
    datasets=["veterinary"]  # Dataset constraint
)
```

### 3. Use Appropriate Search Type for Query Complexity

```python
# Simple fact lookup
simple_result = await cognee.search(
    "What is the half-life of xylazine?",
    query_type=SearchType.RAG_COMPLETION  # Faster for simple facts
)

# Complex reasoning
complex_result = await cognee.search(
    "What differential diagnoses should be considered for a cat with chronic vomiting?",
    query_type=SearchType.GRAPH_COMPLETION_COT  # Chain-of-thought for reasoning
)
```

### 4. Combine Multiple Search Types

```python
# Step 1: Verify content exists
chunks = await cognee.search(
    "feline IBD treatment",
    query_type=SearchType.CHUNKS,
    top_k=5
)

if chunks:
    # Step 2: Get comprehensive answer
    answer = await cognee.search(
        "What are the treatment options for inflammatory bowel disease in cats?",
        query_type=SearchType.GRAPH_COMPLETION
    )
```

### 5. Use Session IDs for Conversational Context

```python
# First query establishes context
await cognee.search(
    "What sedatives are used for equine dentistry?",
    query_type=SearchType.GRAPH_COMPLETION,
    session_id="equine_consultation_1"
)

# Follow-up query uses previous context
await cognee.search(
    "What are the dosing differences between them?",
    query_type=SearchType.GRAPH_COMPLETION,
    session_id="equine_consultation_1"  # References previous query
)
```

---

## Query Anti-Patterns

### 1. Too Vague

```python
# Poor
query = "What about IBD?"

# Better
query = "What are the treatment options for inflammatory bowel disease in cats?"
```

### 2. Missing Species/Context

```python
# Poor (for veterinary domain)
query = "What is the dosage of xylazine?"

# Better
query = "What is the dosage of xylazine for sedation in horses?"
```

### 3. Wrong Search Type

```python
# Poor - using complex search for simple fact
result = await cognee.search(
    "What is the molecular weight of glucose?",
    query_type=SearchType.GRAPH_COMPLETION_COT  # Overkill
)

# Better
result = await cognee.search(
    "What is the molecular weight of glucose?",
    query_type=SearchType.RAG_COMPLETION  # Appropriate for simple facts
)
```

### 4. Not Scoping to Dataset

```python
# Poor - searches all datasets
result = await cognee.search(
    "What are the treatment protocols?",
    query_type=SearchType.GRAPH_COMPLETION
)

# Better - scoped to relevant dataset
result = await cognee.search(
    "What are the treatment protocols?",
    query_type=SearchType.GRAPH_COMPLETION,
    datasets=["veterinary"]
)
```

---

## Advanced Query Patterns

### Multi-Hop Queries

For queries requiring traversal through multiple relationships:

```python
result = await cognee.search(
    "What medications used for conditions that cause vomiting in cats?",
    query_type=SearchType.GRAPH_COMPLETION,
    top_k=15  # Higher top_k for multi-hop
)
```

### Aggregation Queries

For counting or summarizing:

```python
# Using Cypher for aggregation
result = await cognee.search(
    "MATCH (d:Drug)-[:TREATS]->(c:Condition) RETURN c.name, count(d) as drug_count ORDER BY drug_count DESC LIMIT 10",
    query_type=SearchType.CYPHER
)
```

### Temporal Queries

For time-based information:

```python
result = await cognee.search(
    "What treatment protocols were updated in the last year?",
    query_type=SearchType.TEMPORAL
)
```

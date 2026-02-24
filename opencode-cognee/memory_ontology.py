"""
Custom Memory Ontology for OpenCode-Cognee Plugin

This ontology organizes extracted knowledge into memU-style categories,
making memories more structured and queryable.

Usage:
    await cognee.cognify(
        graph_model_file="/path/to/memory_ontology.py",
        graph_model_name="MemoryItem"
    )
"""

from typing import Literal, Optional, List
from pydantic import Field

# Import Cognee's base class for graph entities
try:
    from cognee.infrastructure.engine.models import DataPoint
except ImportError:
    # Fallback for standalone testing
    from pydantic import BaseModel as DataPoint


class MemoryItem(DataPoint):
    """
    A structured memory item with category classification.
    
    Categories (inspired by memU):
    - preferences: User likes, dislikes, choices (e.g., "prefers TypeScript")
    - habits: Recurring behaviors, patterns, workflows
    - skills: Technical abilities, expertise, knowledge areas
    - tools: Software, libraries, frameworks used
    - projects: Specific projects, apps, codebases
    - people: Collaborators, contacts, relationships
    - decisions: Architectural choices, trade-offs made
    - learnings: Lessons learned, insights, discoveries
    """
    
    category: Literal[
        'preferences',
        'habits', 
        'skills',
        'tools',
        'projects',
        'people',
        'decisions',
        'learnings'
    ] = Field(
        description="The type of memory being stored"
    )
    
    name: str = Field(
        description="Short identifier for this memory (e.g., 'TypeScript preference')"
    )
    
    description: str = Field(
        description="Detailed description of the memory content"
    )
    
    confidence: Literal['high', 'medium', 'low'] = Field(
        default='medium',
        description="How confident the extraction is"
    )
    
    source_context: Optional[str] = Field(
        default=None,
        description="Original context where this was mentioned"
    )
    
    related_entities: Optional[List[str]] = Field(
        default_factory=list,
        description="Other entities this memory relates to"
    )


class MemoryRelationship(DataPoint):
    """
    Relationships between memory items.
    """
    
    source: str = Field(description="Source memory item name")
    target: str = Field(description="Target memory item name")
    
    relationship_type: Literal[
        'uses',           # tool/project usage
        'prefers',        # preference relationship
        'knows',          # skill/knowledge
        'works_with',     # collaboration
        'decided',        # decision made
        'learned_from',   # learning source
        'part_of',        # hierarchical
        'conflicts_with', # incompatibility
        'enhances'        # complementary
    ] = Field(description="Type of relationship")
    
    strength: Literal['strong', 'moderate', 'weak'] = Field(
        default='moderate',
        description="Strength of the relationship"
    )


# For simpler extraction, a combined model
class CategorizedMemory(DataPoint):
    """
    Simplified model for quick memory categorization.
    Use this for session summaries and quick memories.
    """
    
    category: Literal[
        'preferences',
        'habits',
        'skills', 
        'tools',
        'projects',
        'people',
        'decisions',
        'learnings'
    ]
    
    content: str = Field(
        description="The memory content in natural language"
    )
    
    importance: Literal['critical', 'important', 'minor'] = Field(
        default='important',
        description="How important this memory is for future sessions"
    )

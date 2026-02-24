#!/usr/bin/env node
/**
 * BeforeAgent hook - Search and inject relevant memories for user prompt
 * 
 * Also detects "remember" keywords and nudges the model to save
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load config
let config = {
  cogneeUrl: 'http://localhost:8000',
  keywordPatterns: ['remember', 'note', 'save this', 'important', "don't forget", 'keep in mind'],
  injection: { searchType: 'CHUNKS', topK: 3, timeout: 2000 }
};

try {
  const configPath = join(__dirname, '..', 'src', 'config.js');
  const { loadConfig, ensureConfig } = await import(configPath);
  ensureConfig();
  config = loadConfig();
} catch (e) {
  // Use defaults if config not available
}

const COGNEE_URL = process.env.COGNEE_URL || config.cogneeUrl;
const COGNEE_API_TOKEN = process.env.COGNEE_API_TOKEN;

// Build keyword pattern from config
const MEMORY_KEYWORDS = new RegExp(
  `\\b(${config.keywordPatterns.join('|')})\\b`,
  'i'
);

// Code block patterns to exclude from keyword detection
const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`]+`/g;

function removeCodeBlocks(text) {
  return text.replace(CODE_BLOCK_PATTERN, '').replace(INLINE_CODE_PATTERN, '');
}

async function main() {
  const input = JSON.parse(readFileSync(0, 'utf-8'));
  const { prompt, session_id } = input;
  
  if (!prompt || prompt.trim().length === 0) {
    console.log(JSON.stringify({}));
    return;
  }
  
  console.error(`[cognee] Processing prompt for session ${session_id}`);
  
  const output = {};
  const additionalContextParts = [];
  
  // Check for memory trigger keywords
  const textWithoutCode = removeCodeBlocks(prompt);
  if (MEMORY_KEYWORDS.test(textWithoutCode)) {
    console.error('[cognee] Memory trigger detected');
    additionalContextParts.push(`[MEMORY TRIGGER DETECTED]
The user wants you to remember something. Use the \`cognee\` tool with \`action: "add"\` to save this information.
Extract the key information and save it as a concise, searchable memory with appropriate tags.`);
  }
  
  try {
    // Search for relevant memories based on the prompt
    const headers = {
      'Content-Type': 'application/json',
      ...(COGNEE_API_TOKEN && { 'Authorization': `Bearer ${COGNEE_API_TOKEN}` }),
    };

    // Use configured search type for memory injection (default: CHUNKS for fast per-turn search)
    const searchResponse = await fetch(`${COGNEE_URL}/api/v1/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: prompt,
        search_type: config.injection.searchType,
        top_k: config.injection.topK,
      }),
      signal: AbortSignal.timeout(config.injection.timeout),
    });

    if (searchResponse.ok) {
      const memories = await searchResponse.json();
      
      if (Array.isArray(memories) && memories.length > 0) {
        const contextParts = memories.slice(0, 5).map(m => {
          if (typeof m === 'string') return m;
          return m.content || m.text || m.result || JSON.stringify(m);
        });

        additionalContextParts.push(`<remembered_context>
${contextParts.join('\n\n---\n\n')}
</remembered_context>`);

        console.error(`[cognee] Found ${memories.length} relevant memories`);
      }
    }
  } catch (error) {
    console.error(`[cognee] Search error: ${error.message}`);
    // Don't block the request on search failure
  }
  
  // Only add context if we have something
  if (additionalContextParts.length > 0) {
    output.hookSpecificOutput = {
      hookEventName: 'BeforeAgent',
      additionalContext: additionalContextParts.join('\n\n'),
    };
  }
  
  console.log(JSON.stringify(output));
}

main().catch(err => {
  console.error(`[cognee] Error: ${err.message}`);
  console.log(JSON.stringify({}));
});

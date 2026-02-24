#!/usr/bin/env node
/**
 * SessionStart hook - Initialize Cognee and load recent memories
 * 
 * Fires on: startup, resume, clear
 * Outputs: systemMessage (greeting), additionalContext (memories)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load config
let config = {
  cogneeUrl: 'http://localhost:8000',
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

async function main() {
  // Read hook input from stdin
  const input = JSON.parse(readFileSync(0, 'utf-8'));
  const { source, session_id } = input;
  
  console.error(`[cognee] Session ${source}: ${session_id}`);
  
  try {
    // Check if Cognee is available
    const healthResponse = await fetch(`${COGNEE_URL}/health`, { 
      signal: AbortSignal.timeout(3000) 
    });
    
    if (!healthResponse.ok) {
      console.log(JSON.stringify({
        systemMessage: '⚠️ Cognee memory unavailable',
      }));
      return;
    }

    // Fetch recent memories on startup
    const headers = {
      'Content-Type': 'application/json',
      ...(COGNEE_API_TOKEN && { 'Authorization': `Bearer ${COGNEE_API_TOKEN}` }),
    };

    // Use configured search type for memory injection (default: CHUNKS for fast startup)
    const searchResponse = await fetch(`${COGNEE_URL}/api/v1/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: 'recent user preferences decisions learnings',
        search_type: config.injection.searchType,
        top_k: config.injection.topK,
      }),
      signal: AbortSignal.timeout(config.injection.timeout),
    });

    if (!searchResponse.ok) {
      console.log(JSON.stringify({
        systemMessage: '🧠 Cognee memory connected',
      }));
      return;
    }

    const memories = await searchResponse.json();
    
    if (Array.isArray(memories) && memories.length > 0) {
      const contextParts = memories.slice(0, 5).map(m => {
        if (typeof m === 'string') return m;
        return m.content || m.text || m.result || JSON.stringify(m);
      });

      console.log(JSON.stringify({
        systemMessage: `🧠 Loaded ${memories.length} memories`,
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: `<remembered_context>
${contextParts.join('\n\n---\n\n')}
</remembered_context>`,
        },
      }));
    } else {
      console.log(JSON.stringify({
        systemMessage: '🧠 Cognee memory ready (no prior memories)',
      }));
    }
    
  } catch (error) {
    console.error(`[cognee] Init error: ${error.message}`);
    
    // Don't block startup - just notify
    console.log(JSON.stringify({
      systemMessage: '⚠️ Cognee memory offline - memories not loaded',
    }));
  }
}

main().catch(err => {
  console.error(`[cognee] Fatal: ${err.message}`);
  console.log(JSON.stringify({}));
});

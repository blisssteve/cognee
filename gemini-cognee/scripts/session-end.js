#!/usr/bin/env node
/**
 * SessionEnd hook - Save session summary to Cognee memory
 * 
 * Fires on: exit, clear, logout
 * Best-effort: CLI won't wait for completion
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load config
let config = {
  cogneeUrl: 'http://localhost:8000',
  datasetName: 'default_user',  // Shared dataset name
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
  const input = JSON.parse(readFileSync(0, 'utf-8'));
  const { reason, session_id, transcript_path } = input;
  
  console.error(`[cognee] Session ending: ${reason} (${session_id})`);
  
  try {
    // Check if Cognee is available
    const healthResponse = await fetch(`${COGNEE_URL}/health`, { 
      signal: AbortSignal.timeout(2000) 
    });
    
    if (!healthResponse.ok) {
      console.error('[cognee] Cognee unavailable - session not saved');
      console.log(JSON.stringify({
        systemMessage: '⚠️ Session not saved (Cognee offline)',
      }));
      return;
    }

    // Try to read transcript for session summary
    let sessionContent = '';
    
    if (transcript_path && existsSync(transcript_path)) {
      try {
        const transcript = JSON.parse(readFileSync(transcript_path, 'utf-8'));
        
        // Extract key information from transcript
        const messages = transcript.messages || transcript.turns || [];
        if (messages.length > 0) {
          const summaryParts = messages.slice(-10).map((msg, i) => {
            const role = msg.role || 'unknown';
            const content = typeof msg.content === 'string' 
              ? msg.content.substring(0, 500) 
              : JSON.stringify(msg.content).substring(0, 500);
            return `[${role}]: ${content}`;
          });
          
          sessionContent = summaryParts.join('\n\n');
        }
      } catch (e) {
        console.error(`[cognee] Could not read transcript: ${e.message}`);
      }
    }
    
    if (!sessionContent) {
      // No transcript - just log a minimal session record
      sessionContent = `Session ${session_id} ended (${reason})`;
    }

    // Create session record with temporal markers
    const sessionDate = new Date().toISOString().split('T')[0];
    const sessionTime = new Date().toISOString();
    
    const sessionRecord = `Session Record (${sessionDate}):
Date: ${sessionDate}
Time: ${sessionTime}
Session ID: ${session_id}
End Reason: ${reason}

Conversation Summary:
${sessionContent}`;

    // Save to Cognee using shared dataset
    const headers = {};
    if (COGNEE_API_TOKEN) {
      headers['Authorization'] = `Bearer ${COGNEE_API_TOKEN}`;
    }

    const formData = new FormData();
    const blob = new Blob([sessionRecord], { type: 'text/plain' });
    formData.append('data', blob, 'session.txt');
    formData.append('datasetName', config.datasetName || 'default_user');
    formData.append('node_set', 'sessions');
    formData.append('node_set', 'conversations');
    formData.append('node_set', `session_${sessionDate.replace(/-/g, '_')}`);

    const addResponse = await fetch(`${COGNEE_URL}/api/v1/add`, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(5000),
    });

    if (addResponse.ok) {
      // Trigger temporal cognify
      const cognifyHeaders = {
        'Content-Type': 'application/json',
        ...(COGNEE_API_TOKEN && { 'Authorization': `Bearer ${COGNEE_API_TOKEN}` }),
      };

      await fetch(`${COGNEE_URL}/api/v1/cognify`, {
        method: 'POST',
        headers: cognifyHeaders,
        body: JSON.stringify({
          datasets: [config.datasetName || 'default_user'],
          temporal_cognify: true,
        }),
        signal: AbortSignal.timeout(5000),
      });

      console.error('[cognee] Session saved to memory');
      console.log(JSON.stringify({
        systemMessage: '🧠 Session saved to memory',
      }));
    } else {
      console.error(`[cognee] Failed to save session: ${addResponse.status}`);
      console.log(JSON.stringify({}));
    }
    
  } catch (error) {
    console.error(`[cognee] Save error: ${error.message}`);
    console.log(JSON.stringify({}));
  }
}

main().catch(err => {
  console.error(`[cognee] Fatal: ${err.message}`);
  console.log(JSON.stringify({}));
});

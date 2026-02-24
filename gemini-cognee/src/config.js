/**
 * Configuration for Gemini Cognee extension
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Search types available for memory injection
 * @typedef {'CHUNKS' | 'SUMMARIES' | 'RAG_COMPLETION' | 'GRAPH_COMPLETION'} InjectionSearchType
 */

/**
 * @typedef {Object} CogneeConfig
 * @property {string} cogneeUrl - Cognee API URL
 * @property {string} datasetName - Dataset name for storing memories (shared with other plugins)
 * @property {number} similarityThreshold - Threshold for similarity matching
 * @property {number} maxMemories - Maximum memories to inject
 * @property {string[]} keywordPatterns - Keywords that trigger memory save
 * @property {Object} injection - Memory injection settings
 * @property {'CHUNKS' | 'SUMMARIES' | 'RAG_COMPLETION' | 'GRAPH_COMPLETION'} injection.searchType - Search type for injection
 * @property {number} injection.topK - Number of memories to inject
 * @property {number} injection.timeout - Timeout in ms for injection requests
 */

const CONFIG_DIR = join(homedir(), '.config', 'gemini-cognee');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

/** @type {CogneeConfig} */
const DEFAULT_CONFIG = {
  cogneeUrl: 'http://localhost:8000',
  datasetName: 'default_user',  // Shared dataset name (same as opencode-cognee)
  similarityThreshold: 0.7,
  maxMemories: 5,
  keywordPatterns: ['remember', 'note', 'save this', 'important', "don't forget", 'keep in mind'],
  injection: {
    searchType: 'CHUNKS',  // Fastest option - no LLM overhead
    topK: 3,               // Number of memories to inject
    timeout: 2000,         // 2s timeout for fast startup
  },
};

/**
 * Load configuration from file
 * @returns {CogneeConfig}
 */
export function loadConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      const content = readFileSync(CONFIG_PATH, 'utf-8');
      const userConfig = JSON.parse(content);
      return { ...DEFAULT_CONFIG, ...userConfig };
    }
  } catch (error) {
    console.error(`[cognee] Failed to load config: ${error.message}`);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Ensure config directory and default config exist
 */
export function ensureConfig() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  
  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  }
}

export { DEFAULT_CONFIG, CONFIG_PATH };

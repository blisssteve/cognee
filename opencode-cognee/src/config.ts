import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type InjectionSearchType = 'CHUNKS' | 'SUMMARIES' | 'RAG_COMPLETION' | 'GRAPH_COMPLETION';

export interface CogneeConfig {
  cogneeUrl: string;
  similarityThreshold: number;
  maxMemories: number;
  keywordPatterns: string[];
  compaction: {
    auto: boolean;   // Auto-compact when context full (false = Cognee handles memory)
    prune: boolean;  // Prune old tool outputs (true = prevents overflow)
  };
  injection: {
    searchType: InjectionSearchType;  // Search type for automatic memory injection on session start
    topK: number;                     // Number of memories to inject
  };
}

const DEFAULT_CONFIG: CogneeConfig = {
  cogneeUrl: 'http://localhost:8000',  // Cognee REST API
  similarityThreshold: 0.7,
  maxMemories: 5,
  keywordPatterns: ['remember', 'note', 'save this', 'important', 'don\'t forget', 'keep in mind'],
  compaction: {
    auto: false,  // Cognee handles persistent memory, no auto-summarization
    prune: true,  // Prune tool outputs to prevent context overflow
  },
  injection: {
    searchType: 'CHUNKS',  // Fastest option - no LLM overhead for session startup
    topK: 3,               // Number of memories to inject on session start
  },
};

export function loadConfig(): CogneeConfig {
  try {
    const configDir = path.join(os.homedir(), '.config', 'opencode');
    const configPath = path.join(configDir, 'cognee.json');

    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const userConfig = JSON.parse(configContent);
      return { ...DEFAULT_CONFIG, ...userConfig };
    }
  } catch (error) {
    console.warn('Failed to load Cognee config, using defaults:', error);
  }

  return DEFAULT_CONFIG;
}

export function ensureConfigDir(): void {
  const configDir = path.join(os.homedir(), '.config', 'opencode');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const configPath = path.join(configDir, 'cognee.json');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      JSON.stringify(DEFAULT_CONFIG, null, 2),
      'utf-8'
    );
  }
}

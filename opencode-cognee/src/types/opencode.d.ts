/**
 * Type definitions for @opencode-ai/plugin
 * This is a placeholder for development until the actual package is published
 */

export interface Plugin {
  name: string;
  version: string;
  description: string;
  hooks?: {
    'chat.message'?: ChatMessageHook;
    event?: EventHook;
  };
  tools?: ToolDefinition[];
}

export interface ChatMessageContext {
  session: {
    id: string;
    userId?: string;
  };
  message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
  };
  isFirstMessage: boolean;
  inject?: string;
}

export type ChatMessageHook = (context: ChatMessageContext) => Promise<void> | void;

export interface EventContext {
  session: {
    id: string;
    userId?: string;
  };
  event: 'session.start' | 'session.end' | 'session.idle';
}

export type EventHook = (context: EventContext) => Promise<void> | void;

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  execute?: (params: any) => Promise<string> | string;
}

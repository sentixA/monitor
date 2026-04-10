/**
 * LLM Provider 抽象。所有 provider 都实现这个接口，
 * 上层 (manager / mvu / 后续真实流程) 都只依赖接口，不关心具体实现。
 *
 * 第一版只有 claudeNative 一个实现，但接口先就位，
 * 后续加 OpenAI 兼容 provider 时只需新增文件，不改调用方。
 */

export interface ImageBlock {
  kind: "image";
  /** PNG bytes, base64 encoded (no data URL prefix) */
  base64: string;
  mimeType: "image/png" | "image/jpeg";
}

export interface TextBlock {
  kind: "text";
  text: string;
}

export type ContentBlock = TextBlock | ImageBlock;

export interface ChatMessage {
  role: "user" | "assistant";
  content: ContentBlock[];
}

export interface ChatInput {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

export interface ChatResult {
  text: string;
  /** raw provider response, useful for debugging */
  raw?: unknown;
  /** token usage if provider returns it */
  usage?: { inputTokens?: number; outputTokens?: number };
  /** end-to-end latency in ms */
  latencyMs: number;
}

export interface LLMProvider {
  readonly id: string;
  readonly name: string;
  chat(input: ChatInput): Promise<ChatResult>;
}

export interface ProviderConfig {
  id: string;
  type: "claude-native" | "openai-compat";
  apiKey: string;
  model: string;
  baseUrl?: string;
}

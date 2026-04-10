import type {
  ChatInput,
  ChatResult,
  ContentBlock,
  LLMProvider,
  ProviderConfig,
} from "./provider.js";

/**
 * Anthropic Messages API provider.
 *
 * Docs: https://docs.anthropic.com/en/api/messages
 *
 * 选择 claude-native (而非 OpenAI 兼容协议) 是因为:
 *  - vision content blocks 在原生 API 上更稳定
 *  - 错误信息更清晰
 */
export class ClaudeNativeProvider implements LLMProvider {
  readonly id: string;
  readonly name = "Anthropic Claude (native)";

  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config: ProviderConfig) {
    if (config.type !== "claude-native") {
      throw new Error(`ClaudeNativeProvider expects type=claude-native, got ${config.type}`);
    }
    if (!config.apiKey || config.apiKey.includes("REPLACE-ME")) {
      throw new Error(`ClaudeNativeProvider: apiKey is missing or placeholder`);
    }
    this.id = config.id;
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = (config.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");
  }

  async chat(input: ChatInput): Promise<ChatResult> {
    const started = Date.now();

    const body = {
      model: this.model,
      max_tokens: input.maxTokens ?? 512,
      system: input.system,
      messages: input.messages.map((m) => ({
        role: m.role,
        content: m.content.map(toAnthropicBlock),
      })),
    };

    const url = `${this.baseUrl}/v1/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "<unreadable>");
      throw new Error(
        `Anthropic API ${res.status} ${res.statusText}: ${errText.slice(0, 500)}`,
      );
    }

    const json = (await res.json()) as AnthropicResponse;

    const text =
      json.content
        ?.filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n")
        .trim() ?? "";

    return {
      text,
      raw: json,
      usage: {
        inputTokens: json.usage?.input_tokens,
        outputTokens: json.usage?.output_tokens,
      },
      latencyMs: Date.now() - started,
    };
  }
}

function toAnthropicBlock(block: ContentBlock): unknown {
  if (block.kind === "text") {
    return { type: "text", text: block.text };
  }
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: block.mimeType,
      data: block.base64,
    },
  };
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

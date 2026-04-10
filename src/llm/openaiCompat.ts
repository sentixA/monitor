import type {
  ChatInput,
  ChatResult,
  ContentBlock,
  LLMProvider,
  ProviderConfig,
} from "./provider.js";

/**
 * OpenAI 兼容 chat/completions provider。
 *
 * 适用于任何走 OpenAI 标准 /chat/completions 协议的服务，例如：
 *  - OpenAI 直连 (https://api.openai.com/v1)
 *  - 智谱 BigModel (https://open.bigmodel.cn/api/paas/v4)  ← MVU 默认走这里
 *  - DeepSeek / 月之暗面 / dashscope-compat / OneAPI 网关 / 等等
 *
 * 图片走 OpenAI 标准的 image_url + data URL (base64) 格式：
 *   { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
 *
 * 注意：智谱的 /api/anthropic 桥**不走这里**，那是 claude-native 协议且不支持 vision。
 * 走 vision 必须用原生 paas/v4 端点 + 真 vision 模型 (glm-4.5v / glm-4v-plus / 等)。
 */
export class OpenAiCompatProvider implements LLMProvider {
  readonly id: string;
  readonly name = "OpenAI-compatible";

  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly extraBody: Record<string, unknown>;

  constructor(config: ProviderConfig) {
    if (config.type !== "openai-compat") {
      throw new Error(`OpenAiCompatProvider expects type=openai-compat, got ${config.type}`);
    }
    if (!config.apiKey || config.apiKey.includes("REPLACE-ME")) {
      throw new Error(`OpenAiCompatProvider: apiKey is missing or placeholder`);
    }
    if (!config.baseUrl) {
      throw new Error(`OpenAiCompatProvider: baseUrl is required (例如 https://open.bigmodel.cn/api/paas/v4)`);
    }
    this.id = config.id;
    this.apiKey = config.apiKey;
    this.model = config.model;
    // strip 末尾 slash，下面手动拼 /chat/completions
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.extraBody = config.extraBody ?? {};
  }

  async chat(input: ChatInput): Promise<ChatResult> {
    const started = Date.now();

    const body = {
      model: this.model,
      max_tokens: input.maxTokens ?? 512,
      messages: [
        { role: "system", content: input.system },
        ...input.messages.map((m) => ({
          role: m.role,
          content: m.content.map(toOpenAiContent),
        })),
      ],
      // provider-specific 额外字段（例如智谱 GLM-4.6V 需要的 thinking: enabled）。
      // 放在最后展开，但不允许覆盖 model/messages/max_tokens 这些核心字段 —— 这里没做
      // 显式拦截，依赖 config 写入方自觉。MVU 阶段单用户场景这点信任成本可接受。
      ...this.extraBody,
    };

    const url = `${this.baseUrl}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "<unreadable>");
      throw new Error(
        `OpenAI-compat API ${res.status} ${res.statusText} @ ${url}: ${errText.slice(0, 500) || "<empty body>"}`,
      );
    }

    const json = (await res.json()) as OpenAiChatResponse;

    const text = (json.choices?.[0]?.message?.content ?? "").trim();

    return {
      text,
      raw: json,
      usage: {
        inputTokens: json.usage?.prompt_tokens,
        outputTokens: json.usage?.completion_tokens,
      },
      latencyMs: Date.now() - started,
    };
  }
}

function toOpenAiContent(block: ContentBlock): unknown {
  if (block.kind === "text") {
    return { type: "text", text: block.text };
  }
  return {
    type: "image_url",
    image_url: {
      url: `data:${block.mimeType};base64,${block.base64}`,
    },
  };
}

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

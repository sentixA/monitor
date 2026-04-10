import type { ChatInput } from "./provider.js";

/**
 * 把"截图 + 上下文"打包成 LLM 调用所需的 ChatInput。
 * MVU 阶段没有真实上下文（窗口/输入/卡住信号），传 null 即可。
 */
export interface BuildPromptInput {
  screenshotPng: Buffer;
  reason?: string | null;
  appName?: string | null;
  windowTitle?: string | null;
  inputSummary?: string | null;
}

const SYSTEM_PROMPT = `你是一个安静、克制的桌面 AI 助手。我会给你用户当前屏幕的截图，
并可能告诉你"用户为什么看起来卡住了"。你的任务：

1. 先**用一句话**说明用户当前正在做什么具体的事 (比如"在 VS Code 里编辑某个 TS 文件")。
   必须基于截图里**真实存在**的元素 (应用名/文件名/可见文字)，不许编造。
2. 然后**用一两句话**给出可立即行动的建议，必须以动词开头 (点击/检查/试试/切换…)。
3. 总长度 ≤ 80 个汉字。

如果你无法从截图判断出用户在干什么，或者认为现在不需要打扰用户，
**只回复一个词：PASS**。不要解释，不要找借口。

不要使用 markdown，不要加标题，不要加 emoji。`;

export function buildPrompt(input: BuildPromptInput): ChatInput {
  const contextLines: string[] = [];
  if (input.reason) contextLines.push(`触发原因: ${input.reason}`);
  if (input.appName) contextLines.push(`当前应用: ${input.appName}`);
  if (input.windowTitle) contextLines.push(`窗口标题: ${input.windowTitle}`);
  if (input.inputSummary) contextLines.push(`最近操作: ${input.inputSummary}`);

  const userText =
    contextLines.length > 0
      ? `观察到的上下文:\n${contextLines.join("\n")}\n\n这是当前屏幕截图:`
      : `这是当前屏幕截图，请按系统提示处理:`;

  return {
    system: SYSTEM_PROMPT,
    maxTokens: 256,
    messages: [
      {
        role: "user",
        content: [
          { kind: "text", text: userText },
          {
            kind: "image",
            mimeType: "image/png",
            base64: input.screenshotPng.toString("base64"),
          },
        ],
      },
    ],
  };
}

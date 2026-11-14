export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamHooks {
  onDelta?: (delta: string) => void;
  signal?: AbortSignal;
}

interface ChatChunk {
  choices?: {
    delta?: { content?: unknown };
    message?: { content?: unknown };
  }[];
  error?: { message?: unknown };
}

function abortError(): DOMException {
  return new DOMException('生成已取消', 'AbortError');
}

async function readSse(response: Response, hooks: StreamHooks): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('模型响应没有可读取的流');
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let finished = false;

  const consume = (line: string) => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    let chunk: ChatChunk;
    try {
      chunk = JSON.parse(data) as ChatChunk;
    } catch {
      return;
    }
    if (chunk.error?.message) throw new Error(String(chunk.error.message));
    const delta = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content;
    if (typeof delta === 'string' && delta.length > 0) {
      text += delta;
      hooks.onDelta?.(delta);
    }
  };

  while (!finished) {
    if (hooks.signal?.aborted) {
      await reader.cancel().catch(() => undefined);
      throw abortError();
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/, '');
      buffer = buffer.slice(newline + 1);
      consume(line);
      newline = buffer.indexOf('\n');
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) consume(buffer.trim());
  if (!text.trim()) throw new Error('模型没有返回内容，请重试');
  return text;
}

/** 调用本地 /api/llm；Key 只在代理侧。stream 模式逐块回调，并返回完整文本。 */
export async function streamChat(messages: ChatMessage[], hooks: StreamHooks = {}): Promise<string> {
  let response: Response;
  try {
    response = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        messages,
        stream: true,
        temperature: 0.15,
        max_tokens: 8000,
      }),
      signal: hooks.signal,
    });
  } catch (error) {
    if (hooks.signal?.aborted) throw abortError();
    throw new Error(error instanceof Error ? `无法连接模型代理：${error.message}` : '无法连接模型代理');
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let message = raw.slice(0, 600) || response.statusText;
    try {
      const parsed = JSON.parse(raw) as { message?: unknown; error?: unknown };
      if (typeof parsed.message === 'string') message = parsed.message;
      else if (typeof parsed.error === 'string') message = parsed.error;
    } catch {
      // 保留原始文本
    }
    throw new Error(`模型代理返回 ${response.status}：${message}`);
  }

  const type = response.headers.get('content-type') ?? '';
  if (type.includes('text/event-stream')) return readSse(response, hooks);

  // 某些兼容端点即使请求 stream 也返回整包 JSON
  const payload = (await response.json().catch(() => null)) as ChatChunk | null;
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('模型没有返回内容，请重试');
  hooks.onDelta?.(text);
  return text;
}

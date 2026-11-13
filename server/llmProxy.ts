import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { Plugin } from 'vite';

/**
 * `/api/llm` 代理：Key 只留在 `.env.local`，浏览器只拿到结果。
 * dev（`npm run dev`）与 preview（`npm run preview`）共用同一中间件。
 */
export interface LlmProxyOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const MAX_BODY = 2 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 60_000;

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('请求体超过 2MB'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

interface ChatRequest {
  messages?: unknown;
  model?: unknown;
  temperature?: unknown;
  max_tokens?: unknown;
  top_p?: unknown;
  response_format?: unknown;
  stream?: unknown;
}

function pickBody(input: ChatRequest, fallbackModel: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: typeof input.model === 'string' && input.model ? input.model : fallbackModel,
    messages: input.messages,
    temperature: typeof input.temperature === 'number' ? input.temperature : 0.2,
    stream: input.stream === true,
  };
  if (typeof input.max_tokens === 'number') body.max_tokens = input.max_tokens;
  if (typeof input.top_p === 'number') body.top_p = input.top_p;
  if (input.response_format && typeof input.response_format === 'object') body.response_format = input.response_format;
  return body;
}

export function llmProxy(options: LlmProxyOptions): Plugin {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = (req.url ?? '').replace(/^\/api\/llm/, '') || '/';

    if (url === '/health' || url === '/health/') {
      sendJson(res, 200, {
        ok: true,
        keyConfigured: Boolean(options.apiKey),
        model: options.model,
        upstream: baseUrl,
      });
      return;
    }

    if (url !== '/' && url !== '') {
      sendJson(res, 404, { error: 'not_found', message: `未知接口 ${url}` });
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method_not_allowed', message: '只用 POST /api/llm' });
      return;
    }

    if (!options.apiKey) {
      sendJson(res, 503, {
        error: 'missing_key',
        message: '缺少 LLM_API_KEY：把它写进 .env.local，然后重启 dev server。',
      });
      return;
    }

    let payload: ChatRequest;
    try {
      payload = (await readBody(req)) as ChatRequest;
    } catch (error) {
      sendJson(res, 400, { error: 'bad_request', message: error instanceof Error ? error.message : '请求体解析失败' });
      return;
    }

    if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
      sendJson(res, 400, { error: 'bad_request', message: 'messages 必须是非空数组' });
      return;
    }

    const body = pickBody(payload, options.model);

    let upstream: Response;
    try {
      upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
          Accept: body.stream === true ? 'text/event-stream' : 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (error) {
      sendJson(res, 502, {
        error: 'upstream_unreachable',
        message: error instanceof Error ? error.message : '无法连接模型服务',
      });
      return;
    }

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      sendJson(res, upstream.status, {
        error: 'upstream_error',
        status: upstream.status,
        message: detail.slice(0, 600) || upstream.statusText,
      });
      return;
    }

    if (body.stream === true && upstream.body) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
      const stream = Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
      return;
    }

    const text = await upstream.text();
    const upstreamType = upstream.headers.get('content-type') ?? '';
    res.statusCode = 200;
    res.setHeader(
      'Content-Type',
      upstreamType.includes('json') || !upstreamType ? 'application/json; charset=utf-8' : upstreamType,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.end(text);
  };

  return {
    name: 'algoviz-llm-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/llm')) {
          next();
          return;
        }
        void handler(req, res).catch(() => {
          if (!res.headersSent) sendJson(res, 500, { error: 'proxy_crash', message: '代理内部错误' });
          else res.end();
        });
      });

      if (!options.apiKey) {
        server.config.logger.warn('[llm-proxy] 未读到 LLM_API_KEY，/api/llm 会返回 503（演示模式仍可用内置场景）');
      }
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/llm')) {
          next();
          return;
        }
        void handler(req, res).catch(() => {
          if (!res.headersSent) sendJson(res, 500, { error: 'proxy_crash', message: '代理内部错误' });
          else res.end();
        });
      });
    },
  };
}

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { llmProxy } from './server/llmProxy.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      llmProxy({
        baseUrl: env.LLM_BASE_URL?.trim() || 'https://api.deepseek.com/v1',
        apiKey: env.LLM_API_KEY?.trim() || '',
        model: env.LLM_MODEL?.trim() || 'deepseek-chat',
      }),
    ],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
  };
});

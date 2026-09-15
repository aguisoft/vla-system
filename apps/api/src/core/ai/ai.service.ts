import { Injectable, Logger } from '@nestjs/common';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';
const TIMEOUT_MS = 30_000;

interface ChatOpts {
  system?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  modelOverride?: string;
  jsonSchema?: Record<string, unknown>;
}

interface ChatResult {
  content: string;
  provider: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
  truncated?: boolean;
}

/**
 * Core AI service exposed to plugins as `ctx.ai`. Single provider (OpenAI) for now —
 * getDefaultProvider()/getStatus() exist so a second provider can be added later
 * without changing the PluginAiClient interface plugins already code against.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  getDefaultProvider(): string {
    return process.env.AI_DEFAULT_PROVIDER || 'openai';
  }

  getStatus(): Record<string, { configured: boolean; model?: string }> {
    return { openai: { configured: this.isConfigured(), model: this.model } };
  }

  async chat(opts: ChatOpts): Promise<ChatResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('AiService: OPENAI_API_KEY no configurada');

    const messages = [
      ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
      ...opts.messages,
    ];
    const model = opts.modelOverride || this.model;

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 500,
    };
    if (opts.jsonSchema) body.response_format = { type: 'json_object' };

    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`AiService: OpenAI respondió ${res.status} — ${text.slice(0, 300)}`);
    }

    const json: any = await res.json();
    const choice = json.choices?.[0];
    if (!choice) throw new Error('AiService: respuesta de OpenAI sin choices');

    return {
      content: String(choice.message?.content ?? ''),
      provider: 'openai',
      model: json.model || model,
      usage: json.usage
        ? { inputTokens: json.usage.prompt_tokens ?? 0, outputTokens: json.usage.completion_tokens ?? 0 }
        : undefined,
      truncated: choice.finish_reason === 'length',
    };
  }

  async complete(
    prompt: string,
    opts?: { temperature?: number; maxTokens?: number; modelOverride?: string },
  ): Promise<string> {
    const result = await this.chat({
      messages: [{ role: 'user', content: prompt }],
      ...opts,
    });
    return result.content;
  }

  async extractJson<T = Record<string, unknown>>(
    prompt: string,
    schema: Record<string, unknown>,
    opts?: { temperature?: number; maxTokens?: number },
  ): Promise<T> {
    const result = await this.chat({
      messages: [{
        role: 'user',
        content: `${prompt}\n\nResponde ÚNICAMENTE con JSON válido que cumpla este schema:\n${JSON.stringify(schema)}`,
      }],
      jsonSchema: schema,
      ...opts,
    });
    try {
      return JSON.parse(result.content) as T;
    } catch (err) {
      this.logger.warn(`extractJson: respuesta no era JSON válido — ${result.content.slice(0, 200)}`);
      throw new Error('AiService: la IA no devolvió JSON válido');
    }
  }
}

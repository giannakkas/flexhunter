// ==============================================
// AI Engine — Multi-Provider Chain
// ==============================================
// Priority: DeepSeek V3 → OpenAI GPT-4o → Claude Sonnet → Gemini (fallback)
// Each provider is tried in order. First success wins.
//
// Env vars:
//   DEEPSEEK_API_KEY  — primary (cheapest, great JSON)
//   OPENAI_API_KEY    — backup (reliable)
//   ANTHROPIC_API_KEY — 3rd backup (highest quality)
//   GEMINI_API_KEY    — last resort (free)

// ── API tracker ───────────────────────────────

function trackApi(name: string, success: boolean, latency: number, error?: string) {
  try { const { trackExternalApi } = require('../middleware/apiMetrics'); trackExternalApi(name, success, latency, error); } catch {}
  if (!success && error) {
    try {
      const status = error.match(/(\d{3})/)?.[1];
      const { checkAndAlertApiError } = require('../services/adminAlerts');
      checkAndAlertApiError(name, parseInt(status || '500'), error);
    } catch {}
  }
}

export interface AICompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

// ── Parse JSON response ───────────────────────

function parseJsonResponse<T>(text: string): T {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return cleaned as T;
  }
}

// ── Provider 1: DeepSeek V3 (PRIMARY) ─────────
// OpenAI-compatible format, excellent JSON, cheapest

async function deepseekComplete<T = string>(prompt: string, options: AICompletionOptions = {}): Promise<T> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set');

  const { model = 'deepseek-chat', temperature = 0.3, maxTokens = 4096, systemPrompt } = options;
  const start = Date.now();

  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      trackApi('DeepSeek V3', false, Date.now() - start, `${res.status}: ${err.slice(0, 80)}`);
      throw new Error(`DeepSeek error ${res.status}: ${err.slice(0, 150)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    trackApi('DeepSeek V3', true, Date.now() - start);
    return parseJsonResponse<T>(content);
  } catch (err: any) {
    if (!err.message.includes('DeepSeek error')) {
      trackApi('DeepSeek V3', false, Date.now() - start, err.message);
    }
    throw err;
  }
}

// ── Provider 2: OpenAI GPT-4o (BACKUP) ────────

async function openaiComplete<T = string>(prompt: string, options: AICompletionOptions = {}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const { model = 'gpt-4o', temperature = 0.3, maxTokens = 4096, systemPrompt } = options;
  const start = Date.now();

  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      trackApi('OpenAI GPT-4o', false, Date.now() - start, `${res.status}`);
      throw new Error(`OpenAI error ${res.status}: ${err.slice(0, 150)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    trackApi('OpenAI GPT-4o', true, Date.now() - start);
    return parseJsonResponse<T>(content);
  } catch (err: any) {
    if (!err.message.includes('OpenAI error')) {
      trackApi('OpenAI GPT-4o', false, Date.now() - start, err.message);
    }
    throw err;
  }
}

// ── Provider 3: Claude Sonnet (3RD BACKUP) ────

async function claudeComplete<T = string>(prompt: string, options: AICompletionOptions = {}): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const { model = 'claude-sonnet-4-20250514', temperature = 0.3, maxTokens = 4096, systemPrompt } = options;
  const start = Date.now();

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      trackApi('Claude Sonnet', false, Date.now() - start, `${res.status}: ${err.slice(0, 80)}`);
      throw new Error(`Claude error ${res.status}: ${err.slice(0, 150)}`);
    }

    const data = await res.json();
    const content = data.content?.[0]?.text || '';
    trackApi('Claude Sonnet', true, Date.now() - start);
    return parseJsonResponse<T>(content);
  } catch (err: any) {
    if (!err.message.includes('Claude error')) {
      trackApi('Claude Sonnet', false, Date.now() - start, err.message);
    }
    throw err;
  }
}

// ── Provider 4: Gemini Flash (LAST RESORT) ────

async function geminiComplete<T = string>(prompt: string, options: AICompletionOptions = {}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const { temperature = 0.3, maxTokens = 4096, systemPrompt } = options;
  const start = Date.now();

  const contents: any[] = [];
  if (systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
    contents.push({ role: 'model', parts: [{ text: 'OK.' }] });
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });

  const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json',
            ...(model === 'gemini-2.5-flash' ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
      });

      if (!res.ok) {
        trackApi(`Gemini ${model}`, false, Date.now() - start, `${res.status}`);
        continue;
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      trackApi(`Gemini ${model}`, true, Date.now() - start);
      return parseJsonResponse<T>(text);
    } catch (err: any) {
      trackApi(`Gemini ${model}`, false, Date.now() - start, err.message);
    }
  }
  throw new Error('All Gemini models failed');
}

// ══════════════════════════════════════════════
// Main AI Completion — Cascade Chain
// DeepSeek V3 → OpenAI GPT-4o → Claude Sonnet → Gemini
// ══════════════════════════════════════════════

export async function aiComplete<T = string>(
  prompt: string,
  options: AICompletionOptions = {}
): Promise<T> {
  const providers: { name: string; key: string | undefined; fn: () => Promise<T> }[] = [
    { name: 'DeepSeek', key: process.env.DEEPSEEK_API_KEY, fn: () => deepseekComplete<T>(prompt, options) },
    { name: 'OpenAI',   key: process.env.OPENAI_API_KEY,   fn: () => openaiComplete<T>(prompt, options) },
    { name: 'Claude',   key: process.env.ANTHROPIC_API_KEY, fn: () => claudeComplete<T>(prompt, options) },
    { name: 'Gemini',   key: process.env.GEMINI_API_KEY,    fn: () => geminiComplete<T>(prompt, options) },
  ];

  const errors: string[] = [];

  for (const provider of providers) {
    if (!provider.key) continue;
    try {
      return await provider.fn();
    } catch (err: any) {
      const msg = err.message?.slice(0, 80) || 'unknown';
      console.warn(`[AI] ${provider.name} failed: ${msg}`);
      errors.push(`${provider.name}: ${msg}`);
    }
  }

  throw new Error(`All AI providers failed: ${errors.join(' | ')}`);
}

// ── Helper: Get active AI provider info ───────

export function getAIProviderInfo(): { primary: string; available: string[]; count: number } {
  const available: string[] = [];
  if (process.env.DEEPSEEK_API_KEY) available.push('DeepSeek V3');
  if (process.env.OPENAI_API_KEY) available.push('OpenAI GPT-4o');
  if (process.env.ANTHROPIC_API_KEY) available.push('Claude Sonnet');
  if (process.env.GEMINI_API_KEY) available.push('Gemini Flash');
  return { primary: available[0] || 'none', available, count: available.length };
}

// ── Product Analysis Helpers ──────────────────

export async function aiAnalyzeProductFit(
  product: { title: string; description: string; category: string },
  storeContext: {
    description: string;
    audience: string[];
    domainKeywords: string[];
    vibe: string;
    categories: string[];
  }
): Promise<{
  audienceFit: number;
  visualVirality: number;
  trendFit: number;
  novelty: number;
  explanation: string;
  fitReasons: string[];
  concerns: string[];
}> {
  const prompt = `Analyze this product's fit for the store. Return JSON only.

PRODUCT:
Title: ${product.title}
Description: ${product.description}
Category: ${product.category}

STORE CONTEXT:
Description: ${storeContext.description}
Target audience: ${storeContext.audience.join(', ')}
Domain keywords: ${storeContext.domainKeywords.join(', ')}
Brand vibe: ${storeContext.vibe}
Store categories: ${storeContext.categories.join(', ')}

Score each 0-100: audienceFit, visualVirality, trendFit, novelty
Also: explanation (1-2 sentences), fitReasons (array), concerns (array)
Return ONLY valid JSON.`;

  return aiComplete(prompt, {
    temperature: 0.3,
    systemPrompt: 'Product-market fit analyst. Return only valid JSON.',
  });
}

export async function aiGenerateExplanation(
  product: { title: string; category: string; price: number },
  scores: Record<string, number>,
  storeDNA: { vibe: string; audience: string[]; domain: string }
): Promise<string> {
  const prompt = `Write 2-3 sentences: why "${product.title}" (${product.category}, $${product.price}) fits a ${storeDNA.vibe} store targeting ${storeDNA.audience.join(', ')}.
Scores: ${Object.entries(scores).map(([k, v]) => `${k}=${v}`).join(', ')}. Be specific.`;

  return aiComplete<string>(prompt, { temperature: 0.5, maxTokens: 200 });
}

// ==============================================
// AI Engine — Google Gemini 2.5 Flash
// ==============================================
// Uses gemini-2.5-flash-lite (fast, no thinking overhead)
// with gemini-2.5-flash as fallback.
// Falls back to OpenAI if GEMINI_API_KEY not set.

// Lite first (faster, cheaper, no thinking), then full flash
const GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// External API tracker (lazy import to avoid circular deps)
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

/**
 * Call Gemini API via REST — tries multiple models
 */
async function geminiComplete<T = string>(prompt: string, options: AICompletionOptions = {}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const { temperature = 0.4, maxTokens = 4096, systemPrompt } = options;
  const start = Date.now();

  const contents: any[] = [];
  if (systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
    contents.push({ role: 'model', parts: [{ text: 'OK.' }] });
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });

  // Try each model until one works
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json',
            // Disable thinking for flash models (causes issues with JSON mode)
            ...(model.includes('2.5-flash') && !model.includes('lite') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.warn(`[AI] Gemini ${model} failed: ${res.status}`);
        trackApi(`Gemini ${model}`, false, Date.now() - start, `${res.status}: ${err.slice(0, 60)}`);
        continue; // Try next model
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      trackApi(`Gemini ${model}`, true, Date.now() - start);

      try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned) as T;
      } catch {
        return text as T;
      }
    } catch (err: any) {
      console.warn(`[AI] Gemini ${model} error: ${err.message?.slice(0, 60)}`);
      trackApi(`Gemini ${model}`, false, Date.now() - start, err.message);
    }
  }

  // All Gemini models failed
  throw new Error('All Gemini models failed');
}

/**
 * OpenAI fallback
 */
async function openaiComplete<T = string>(prompt: string, options: AICompletionOptions = {}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('No AI API key configured (set GEMINI_API_KEY or OPENAI_API_KEY)');

  const { model = 'gpt-4o-mini', temperature = 0.4, maxTokens = 4096, systemPrompt } = options;
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
      body: JSON.stringify({ model, temperature, max_tokens: maxTokens, messages }),
    });

    if (!res.ok) {
      const err = await res.text();
      trackApi('OpenAI', false, Date.now() - start, `${res.status}`);
      throw new Error(`OpenAI API error ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    trackApi('OpenAI', true, Date.now() - start);

    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned) as T;
    } catch {
      return content as T;
    }
  } catch (err: any) {
    if (!err.message.includes('OpenAI API error')) {
      trackApi('OpenAI', false, Date.now() - start, err.message);
    }
    throw err;
  }
}

/**
 * Main AI completion — uses Gemini if available, falls back to OpenAI on failure
 */
export async function aiComplete<T = string>(
  prompt: string,
  options: AICompletionOptions = {}
): Promise<T> {
  // Try Gemini first
  if (process.env.GEMINI_API_KEY) {
    try {
      return await geminiComplete<T>(prompt, options);
    } catch (err: any) {
      // If Gemini fails (429, 500, etc.) and OpenAI is available, fall back
      if (process.env.OPENAI_API_KEY) {
        console.warn(`[AI] Gemini failed (${err.message?.slice(0, 60)}), falling back to OpenAI`);
        return openaiComplete<T>(prompt, options);
      }
      throw err; // No fallback available
    }
  }
  // No Gemini key — use OpenAI directly
  if (process.env.OPENAI_API_KEY) {
    return openaiComplete<T>(prompt, options);
  }
  throw new Error('No AI API key configured (set GEMINI_API_KEY or OPENAI_API_KEY)');
}

/**
 * AI-powered product analysis for scoring enrichment
 */
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

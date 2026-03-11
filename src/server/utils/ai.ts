// ==============================================
// AI Engine — Google Gemini 2.0 Flash
// ==============================================
// Fast, accurate, essentially free for this volume.
// Falls back to OpenAI if GEMINI_API_KEY not set.

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export interface AICompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

/**
 * Call Gemini 2.0 Flash API directly via REST
 */
async function geminiComplete<T = string>(prompt: string, options: AICompletionOptions = {}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const { temperature = 0.4, maxTokens = 4096, systemPrompt } = options;

  const contents: any[] = [];
  if (systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
    contents.push({ role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] });
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Parse JSON
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return text as T;
  }
}

/**
 * OpenAI fallback
 */
async function openaiComplete<T = string>(prompt: string, options: AICompletionOptions = {}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('No AI API key configured (set GEMINI_API_KEY or OPENAI_API_KEY)');

  const { model = 'gpt-4o-mini', temperature = 0.4, maxTokens = 4096, systemPrompt } = options;

  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

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
    throw new Error(`OpenAI API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';

  try {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return content as T;
  }
}

/**
 * Main AI completion — uses Gemini if available, falls back to OpenAI
 */
export async function aiComplete<T = string>(
  prompt: string,
  options: AICompletionOptions = {}
): Promise<T> {
  if (process.env.GEMINI_API_KEY) {
    return geminiComplete<T>(prompt, options);
  }
  return openaiComplete<T>(prompt, options);
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

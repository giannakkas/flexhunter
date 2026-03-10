import OpenAI from 'openai';
import { config } from '../config';

const openai = new OpenAI({ apiKey: config.ai.openaiKey });

export interface AICompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

/**
 * Generic AI completion - returns parsed JSON or raw text
 */
export async function aiComplete<T = string>(
  prompt: string,
  options: AICompletionOptions = {}
): Promise<T> {
  const {
    model = config.ai.model,
    temperature = 0.4,
    maxTokens = 4096,
    systemPrompt,
  } = options;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await openai.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    messages,
  });

  const content = response.choices[0]?.message?.content || '';

  // Try to parse as JSON
  try {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return content as T;
  }
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

Score each dimension 0-100:
- audienceFit: how well does this product match the target audience?
- visualVirality: how shareable/photogenic is this product on social media?
- trendFit: how trendy/current is this product?
- novelty: how unique/novel is this vs common products?

Also provide:
- explanation: 1-2 sentence summary of why it fits or doesn't
- fitReasons: array of 2-4 specific reasons it fits
- concerns: array of 0-3 potential concerns

Return ONLY valid JSON with these exact keys.`;

  return aiComplete(prompt, {
    model: config.ai.scoringModel,
    temperature: 0.3,
    systemPrompt: 'You are a product-market fit analyst for e-commerce. Return only valid JSON.',
  });
}

/**
 * AI-powered explanation generation for recommendations
 */
export async function aiGenerateExplanation(
  product: { title: string; category: string; price: number },
  scores: Record<string, number>,
  storeDNA: { vibe: string; audience: string[]; domain: string }
): Promise<string> {
  const prompt = `Write a concise 2-3 sentence explanation of why "${product.title}" (${product.category}, $${product.price}) is recommended for a ${storeDNA.vibe} store at ${storeDNA.domain} targeting ${storeDNA.audience.join(', ')}.

Key scores: ${Object.entries(scores).map(([k, v]) => `${k}=${v}`).join(', ')}

Be specific about fit reasons. No fluff.`;

  return aiComplete<string>(prompt, {
    model: config.ai.scoringModel,
    temperature: 0.5,
    maxTokens: 200,
  });
}

export default openai;

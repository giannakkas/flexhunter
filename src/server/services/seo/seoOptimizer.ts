// ==============================================
// SEO Optimization Service
// ==============================================
// Generates optimized SEO content for imported products.
// Can work with or without OpenAI (fallback to templates).

import { aiComplete } from '../../utils/ai';

export interface SeoOptimizationResult {
  originalTitle: string;
  optimizedTitle: string;
  originalDescription: string;
  optimizedDescription: string;
  metaTitle: string;
  metaDescription: string;
  suggestedKeywords: string[];
  suggestedHandle: string;
  altTextSuggestions: string[];
  suggestedTags: string[];
  confidence: number;
}

/**
 * Generate SEO-optimized content for a product
 */
export async function optimizeProductSeo(product: {
  title: string;
  description: string;
  category?: string;
  tags?: string[];
  imageUrls?: string[];
  price?: number;
}, storeContext?: {
  storeName?: string;
  niche?: string;
  audience?: string[];
}): Promise<SeoOptimizationResult> {
  // Try AI-powered optimization
  try {
    return await aiOptimizeSeo(product, storeContext);
  } catch (err) {
    console.warn('[SEO] AI optimization failed, using template fallback:', err);
    return templateOptimizeSeo(product, storeContext);
  }
}

/**
 * AI-powered SEO optimization
 */
async function aiOptimizeSeo(
  product: { title: string; description: string; category?: string; tags?: string[]; imageUrls?: string[]; price?: number },
  storeContext?: { storeName?: string; niche?: string; audience?: string[] }
): Promise<SeoOptimizationResult> {
  const prompt = `You are an e-commerce SEO expert. Optimize this product for search engines and conversions.

PRODUCT:
Title: ${product.title}
Description: ${product.description || 'No description'}
Category: ${product.category || 'General'}
Price: ${product.price ? `$${product.price}` : 'N/A'}
Tags: ${product.tags?.join(', ') || 'None'}

STORE CONTEXT:
Store: ${storeContext?.storeName || 'Online Store'}
Niche: ${storeContext?.niche || 'General'}
Audience: ${storeContext?.audience?.join(', ') || 'General shoppers'}

Return ONLY valid JSON with these exact keys:
{
  "optimizedTitle": "SEO-friendly product title (50-70 chars, include primary keyword early)",
  "optimizedDescription": "Structured HTML product description with benefits, features, and a call to action (200-400 words)",
  "metaTitle": "Page title for search results (50-60 chars)",
  "metaDescription": "Compelling meta description (140-160 chars, include CTA)",
  "suggestedKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "suggestedHandle": "url-friendly-handle",
  "altTextSuggestions": ["descriptive alt text for product image 1"],
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "confidence": 0.85
}

Rules:
- Title must be natural, not keyword-stuffed
- Description should be scannable with short paragraphs
- Meta description must include a call to action
- Keywords should be realistic search terms
- Handle should be short and URL-friendly
- Keep everything merchant-editable and professional`;

  const result = await aiComplete<SeoOptimizationResult>(prompt, {
    temperature: 0.3,
    maxTokens: 2000,
    systemPrompt: 'You are an e-commerce SEO specialist. Return only valid JSON.',
  });

  return {
    originalTitle: product.title,
    optimizedTitle: result.optimizedTitle || product.title,
    originalDescription: product.description || '',
    optimizedDescription: result.optimizedDescription || product.description || '',
    metaTitle: result.metaTitle || product.title.slice(0, 60),
    metaDescription: result.metaDescription || `Shop ${product.title} - Free shipping available.`,
    suggestedKeywords: result.suggestedKeywords || [],
    suggestedHandle: result.suggestedHandle || product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50),
    altTextSuggestions: result.altTextSuggestions || [`${product.title} - product image`],
    suggestedTags: result.suggestedTags || [],
    confidence: result.confidence || 0.7,
  };
}

/**
 * Template-based SEO optimization (no AI needed)
 */
function templateOptimizeSeo(
  product: { title: string; description: string; category?: string; tags?: string[]; imageUrls?: string[]; price?: number },
  storeContext?: { storeName?: string; niche?: string; audience?: string[] }
): SeoOptimizationResult {
  const title = product.title;
  const words = title.toLowerCase().split(/\s+/);
  const category = product.category || 'Products';

  // Clean up title
  const optimizedTitle = title
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 70);

  // Generate handle
  const handle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

  // Generate meta
  const metaTitle = `${optimizedTitle} | ${storeContext?.storeName || 'Shop Now'}`.slice(0, 60);
  const metaDescription = `Shop ${optimizedTitle}. ${product.price ? `Starting at $${product.price}.` : ''} Free shipping available. Order today!`.slice(0, 160);

  // Generate keywords from title
  const keywords = words
    .filter(w => w.length > 3)
    .slice(0, 5)
    .concat([category.toLowerCase(), 'buy online', 'free shipping'])
    .slice(0, 8);

  // Generate description
  const desc = product.description || '';
  const optimizedDescription = desc.length > 50 ? desc : `
<p><strong>${optimizedTitle}</strong> - the perfect addition to your collection.</p>
<p>Upgrade your ${category.toLowerCase()} game with this premium product. Designed for quality and style.</p>
<ul>
<li>Premium quality materials</li>
<li>Perfect for ${storeContext?.audience?.[0] || 'everyone'}</li>
<li>Fast shipping available</li>
</ul>
<p><strong>Order yours today!</strong></p>`.trim();

  return {
    originalTitle: product.title,
    optimizedTitle,
    originalDescription: product.description || '',
    optimizedDescription,
    metaTitle,
    metaDescription,
    suggestedKeywords: [...new Set(keywords)],
    suggestedHandle: handle,
    altTextSuggestions: [`${optimizedTitle} - product image`, `${category} - ${optimizedTitle}`],
    suggestedTags: [category, ...words.slice(0, 3)].filter(Boolean),
    confidence: 0.5,
  };
}

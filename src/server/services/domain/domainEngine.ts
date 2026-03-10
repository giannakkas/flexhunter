// ==============================================
// Domain Intent Engine
// ==============================================
// Analyzes a store's domain name to extract semantic
// signals for product recommendation scoring.

import { DomainIntent } from '../../../shared/types';
import { aiComplete } from '../../utils/ai';
import prisma from '../../utils/db';

// ── Slang / Vibe Dictionaries ──────────────────

const SLANG_DICTIONARY: Record<string, { ageGroup: string; vibe: string[]; categories: string[] }> = {
  flex: { ageGroup: 'gen-z', vibe: ['youth', 'cool', 'showing-off', 'social'], categories: ['gadgets', 'accessories', 'lifestyle', 'tech', 'gaming'] },
  drip: { ageGroup: 'gen-z', vibe: ['fashion', 'style', 'cool'], categories: ['fashion', 'accessories', 'streetwear'] },
  vibe: { ageGroup: 'gen-z/millennial', vibe: ['aesthetic', 'mood', 'lifestyle'], categories: ['room-decor', 'lifestyle', 'aesthetic'] },
  lit: { ageGroup: 'gen-z', vibe: ['exciting', 'party', 'fun'], categories: ['party', 'gadgets', 'entertainment'] },
  slay: { ageGroup: 'gen-z', vibe: ['fashion', 'beauty', 'confidence'], categories: ['beauty', 'fashion', 'accessories'] },
  fire: { ageGroup: 'gen-z', vibe: ['hot', 'trending', 'cool'], categories: ['trending', 'gadgets', 'fashion'] },
  cozy: { ageGroup: 'all', vibe: ['comfort', 'home', 'warm'], categories: ['home', 'blankets', 'candles', 'comfort'] },
  zen: { ageGroup: 'millennial', vibe: ['calm', 'wellness', 'mindful'], categories: ['wellness', 'meditation', 'self-care'] },
  hustle: { ageGroup: 'millennial', vibe: ['work', 'productivity', 'ambition'], categories: ['office', 'productivity', 'tools'] },
  beast: { ageGroup: 'gen-z/millennial', vibe: ['power', 'fitness', 'intensity'], categories: ['fitness', 'sports', 'supplements'] },
  glow: { ageGroup: 'gen-z/millennial', vibe: ['beauty', 'radiance', 'skincare'], categories: ['beauty', 'skincare', 'wellness'] },
  pixel: { ageGroup: 'gen-z', vibe: ['tech', 'gaming', 'digital'], categories: ['gaming', 'tech', 'accessories'] },
  retro: { ageGroup: 'all', vibe: ['vintage', 'nostalgic', 'classic'], categories: ['vintage', 'decor', 'fashion'] },
  neon: { ageGroup: 'gen-z', vibe: ['bright', 'party', 'aesthetic'], categories: ['LED', 'room-decor', 'aesthetic'] },
  boss: { ageGroup: 'millennial', vibe: ['leadership', 'business', 'luxury'], categories: ['office', 'luxury', 'accessories'] },
  chill: { ageGroup: 'gen-z/millennial', vibe: ['relaxed', 'cool', 'easy'], categories: ['lifestyle', 'comfort', 'home'] },
  nova: { ageGroup: 'all', vibe: ['new', 'bright', 'innovative'], categories: ['tech', 'gadgets', 'innovation'] },
  hype: { ageGroup: 'gen-z', vibe: ['trending', 'popular', 'excitement'], categories: ['trending', 'streetwear', 'gadgets'] },
};

const TONE_KEYWORDS: Record<string, string[]> = {
  premium: ['luxe', 'elite', 'prime', 'gold', 'lux', 'prestige', 'royal'],
  playful: ['fun', 'pop', 'buzz', 'joy', 'play', 'happy', 'quirk'],
  technical: ['tech', 'byte', 'code', 'data', 'logic', 'hub', 'sys'],
  lifestyle: ['life', 'live', 'home', 'daily', 'every', 'style'],
  social: ['social', 'share', 'viral', 'trend', 'tok', 'gram'],
  creative: ['craft', 'art', 'create', 'design', 'studio', 'make'],
};

const CONTAINER_WORDS = ['box', 'bucket', 'crate', 'vault', 'chest', 'haul', 'stash', 'drop', 'pack'];

// ── Core Analysis ──────────────────────────────

/**
 * Splits a domain into likely word components
 */
function splitDomainWords(domain: string): string[] {
  // Remove TLD
  const name = domain.replace(/\.(com|net|co|io|shop|store|xyz|org)$/i, '');

  // Try camelCase / PascalCase splitting
  let words = name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[\s\-_\.]+/);

  // Try known word boundary detection for concatenated words
  if (words.length === 1 && words[0].length > 4) {
    const expanded = expandConcatenatedWord(words[0]);
    if (expanded.length > 1) words = expanded;
  }

  return words.filter((w) => w.length > 0);
}

/**
 * Tries to split concatenated words using a dictionary approach
 */
function expandConcatenatedWord(word: string): string[] {
  const knownWords = [
    ...Object.keys(SLANG_DICTIONARY),
    ...CONTAINER_WORDS,
    ...Object.values(TONE_KEYWORDS).flat(),
    'shop', 'store', 'mart', 'buy', 'get', 'find', 'pick', 'best',
    'cool', 'hot', 'new', 'top', 'big', 'super', 'mega', 'ultra',
    'pro', 'max', 'mini', 'smart', 'fast', 'easy', 'good',
  ];

  // Try all possible splits
  for (let i = 2; i < word.length - 1; i++) {
    const left = word.slice(0, i);
    const right = word.slice(i);
    if (knownWords.includes(left) && (knownWords.includes(right) || right.length >= 3)) {
      return [left, right];
    }
  }

  // Try 3-way splits for longer words
  if (word.length >= 8) {
    for (let i = 2; i < word.length - 3; i++) {
      for (let j = i + 2; j < word.length - 1; j++) {
        const a = word.slice(0, i);
        const b = word.slice(i, j);
        const c = word.slice(j);
        if (knownWords.includes(a) && knownWords.includes(b)) {
          return [a, b, c];
        }
      }
    }
  }

  return [word];
}

/**
 * Detect slang terms and their signals
 */
function detectSlang(words: string[]): {
  detected: string[];
  ageGroup: string | null;
  vibes: string[];
  categoryBias: string[];
} {
  const detected: string[] = [];
  const vibes = new Set<string>();
  const categories = new Set<string>();
  const ageGroups = new Set<string>();

  for (const word of words) {
    const slangEntry = SLANG_DICTIONARY[word];
    if (slangEntry) {
      detected.push(word);
      ageGroups.add(slangEntry.ageGroup);
      slangEntry.vibe.forEach((v) => vibes.add(v));
      slangEntry.categories.forEach((c) => categories.add(c));
    }
  }

  // Check for container words (bucket, box, etc.) - suggest variety/curated
  for (const word of words) {
    if (CONTAINER_WORDS.includes(word)) {
      vibes.add('curated');
      vibes.add('variety');
      vibes.add('discovery');
    }
  }

  return {
    detected,
    ageGroup: ageGroups.size > 0 ? [...ageGroups][0] : null,
    vibes: [...vibes],
    categoryBias: [...categories],
  };
}

/**
 * Infer tone from domain words
 */
function inferTone(words: string[]): string[] {
  const tones: string[] = [];

  for (const [tone, keywords] of Object.entries(TONE_KEYWORDS)) {
    for (const word of words) {
      if (keywords.some((kw) => word.includes(kw))) {
        tones.push(tone);
        break;
      }
    }
  }

  return tones;
}

/**
 * Compute vibe scores (0-100) across dimensions
 */
function computeVibeScores(
  words: string[],
  slangData: ReturnType<typeof detectSlang>,
  tones: string[]
): DomainIntent['vibeScore'] {
  const scores = { youthful: 30, premium: 30, playful: 30, technical: 30, lifestyle: 30, social: 30 };

  // Slang boosts
  if (slangData.detected.length > 0) scores.youthful += 30;
  if (slangData.vibes.includes('cool') || slangData.vibes.includes('showing-off')) scores.social += 25;
  if (slangData.vibes.includes('aesthetic')) scores.lifestyle += 20;
  if (slangData.vibes.includes('youth')) scores.youthful += 15;

  // Tone boosts
  if (tones.includes('premium')) scores.premium += 30;
  if (tones.includes('playful')) scores.playful += 30;
  if (tones.includes('technical')) scores.technical += 30;
  if (tones.includes('lifestyle')) scores.lifestyle += 25;
  if (tones.includes('social')) { scores.social += 30; scores.youthful += 10; }

  // Container word = curated/fun
  if (words.some((w) => CONTAINER_WORDS.includes(w))) {
    scores.playful += 15;
    scores.lifestyle += 10;
  }

  // Clamp all to 0-100
  for (const key of Object.keys(scores) as (keyof typeof scores)[]) {
    scores[key] = Math.min(100, Math.max(0, scores[key]));
  }

  return scores;
}

// ── Main Analysis Function ─────────────────────

export async function analyzeDomain(domain: string): Promise<DomainIntent> {
  const words = splitDomainWords(domain);
  const slangData = detectSlang(words);
  const tones = inferTone(words);
  const vibeScores = computeVibeScores(words, slangData, tones);

  // Psychographic hints based on all signals
  const psychographicHints: string[] = [];
  if (vibeScores.youthful > 60) psychographicHints.push('trend-conscious', 'social-media-active');
  if (vibeScores.social > 60) psychographicHints.push('likes-to-show-off', 'content-creator');
  if (vibeScores.premium > 60) psychographicHints.push('quality-conscious', 'willing-to-pay-more');
  if (vibeScores.playful > 60) psychographicHints.push('fun-seeker', 'impulse-buyer');
  if (vibeScores.technical > 60) psychographicHints.push('early-adopter', 'tech-savvy');
  if (vibeScores.lifestyle > 60) psychographicHints.push('lifestyle-curator', 'aesthetic-focused');

  // Generate domain-fit keywords for scoring
  const domainFitKeywords = [
    ...slangData.vibes,
    ...slangData.categoryBias,
    ...tones,
    ...words.filter((w) => w.length > 2),
  ];

  return {
    domain,
    extractedWords: words,
    detectedSlang: slangData.detected,
    inferredTone: tones,
    inferredAgeGroup: slangData.ageGroup,
    psychographicHints,
    categoryBias: slangData.categoryBias,
    domainFitKeywords: [...new Set(domainFitKeywords)],
    vibeScore: vibeScores,
  };
}

/**
 * Persist domain analysis to database
 */
export async function analyzeDomainAndSave(shopId: string, domain: string): Promise<DomainIntent> {
  const analysis = await analyzeDomain(domain);

  await prisma.domainAnalysis.upsert({
    where: { shopId },
    create: {
      shopId,
      domain,
      extractedWords: analysis.extractedWords,
      detectedSlang: analysis.detectedSlang,
      inferredTone: analysis.inferredTone,
      inferredAgeGroup: analysis.inferredAgeGroup,
      psychographicHints: analysis.psychographicHints,
      categoryBias: analysis.categoryBias,
      domainFitKeywords: analysis.domainFitKeywords,
      vibeScore: analysis.vibeScore,
      semanticAnalysis: analysis,
    },
    update: {
      domain,
      extractedWords: analysis.extractedWords,
      detectedSlang: analysis.detectedSlang,
      inferredTone: analysis.inferredTone,
      inferredAgeGroup: analysis.inferredAgeGroup,
      psychographicHints: analysis.psychographicHints,
      categoryBias: analysis.categoryBias,
      domainFitKeywords: analysis.domainFitKeywords,
      vibeScore: analysis.vibeScore,
      semanticAnalysis: analysis,
      analyzedAt: new Date(),
    },
  });

  return analysis;
}

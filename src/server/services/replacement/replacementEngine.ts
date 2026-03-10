// ==============================================
// Replacement Decision Engine
// ==============================================
// Evaluates imported products for weakness,
// suggests replacements, and executes replacements
// based on the merchant's mode (manual/auto/hybrid).

import prisma from '../../utils/db';
import {
  createShopifyProduct,
  updateShopifyProductStatus,
  addProductImages,
  tagShopifyProduct,
} from '../shopify/shopifyClient';

interface WeakProductResult {
  importedProductId: string;
  shopifyProductId: string;
  title: string;
  reason: string;
  healthScore: number;
  daysTesting: number;
}

interface ReplacementCandidate {
  candidateId: string;
  title: string;
  finalScore: number;
  explanation: string;
}

/**
 * Evaluate all testing/active products for weakness
 */
export async function evaluateWeakProducts(shopId: string): Promise<WeakProductResult[]> {
  const settings = await prisma.merchantSettings.findUniqueOrThrow({
    where: { shopId },
  });

  const products = await prisma.importedProduct.findMany({
    where: {
      shopId,
      status: { in: ['TESTING', 'WINNER'] },
      isPinned: false,
    },
    include: { performance: true },
  });

  const weakProducts: WeakProductResult[] = [];

  for (const product of products) {
    const perf = product.performance;
    if (!perf) continue;

    const daysSinceLaunch = perf.daysSinceLaunch;

    // Must have been testing for minimum days
    if (daysSinceLaunch < settings.minTestDays) continue;

    // Must have minimum views
    if (perf.views < settings.minTestViews) continue;

    // Evaluate weakness
    const reasons: string[] = [];

    if (perf.conversionRate < 0.5) reasons.push('Very low conversion rate');
    if (perf.views > 100 && perf.conversions === 0) reasons.push('Zero conversions after 100+ views');
    if (perf.marginPercent < settings.minimumMarginPercent) reasons.push('Below minimum margin');
    if (perf.refunds > 0 && perf.conversions > 0 && (perf.refunds / perf.conversions) > 0.15) {
      reasons.push('High refund rate');
    }
    if (perf.healthScore < 30) reasons.push('Overall health score below threshold');

    if (reasons.length > 0) {
      weakProducts.push({
        importedProductId: product.id,
        shopifyProductId: product.shopifyProductId || '',
        title: product.importedTitle,
        reason: reasons.join('; '),
        healthScore: perf.healthScore,
        daysTesting: daysSinceLaunch,
      });

      // Update product status
      await prisma.importedProduct.update({
        where: { id: product.id },
        data: { status: 'WEAK' },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          shopId,
          action: 'PRODUCT_FLAGGED_WEAK',
          entityType: 'ImportedProduct',
          entityId: product.id,
          explanation: reasons.join('; '),
          details: {
            healthScore: perf.healthScore,
            conversionRate: perf.conversionRate,
            views: perf.views,
            conversions: perf.conversions,
            daysTesting: daysSinceLaunch,
          },
        },
      });
    }
  }

  return weakProducts;
}

/**
 * Find the best replacement candidate for a weak product
 */
export async function findReplacementCandidate(
  shopId: string,
  weakProductId: string
): Promise<ReplacementCandidate | null> {
  // Get the weak product's category for matching
  const weakProduct = await prisma.importedProduct.findUniqueOrThrow({
    where: { id: weakProductId },
    include: { candidate: { include: { score: true } } },
  });

  // Find top unused candidates
  const candidates = await prisma.candidateProduct.findMany({
    where: {
      shopId,
      status: 'CANDIDATE',
      importedProduct: null, // Not yet imported
    },
    include: { score: true },
    orderBy: { score: { finalScore: 'desc' } },
    take: 5,
  });

  if (candidates.length === 0) return null;

  const best = candidates[0];
  if (!best.score) return null;

  return {
    candidateId: best.id,
    title: best.title,
    finalScore: best.score.finalScore,
    explanation: best.score.explanation || 'Higher scoring candidate available',
  };
}

/**
 * Suggest a replacement (creates a ReplacementDecision record)
 */
export async function suggestReplacement(
  shopId: string,
  weakProductId: string,
  candidateId: string,
  confidence: number,
  reason: string,
  fitExplanation: string
): Promise<string> {
  const decision = await prisma.replacementDecision.create({
    data: {
      shopId,
      currentProductId: weakProductId,
      replacementCandidateId: candidateId,
      action: 'SUGGESTED',
      confidence,
      reason,
      fitExplanation,
    },
  });

  await prisma.importedProduct.update({
    where: { id: weakProductId },
    data: { status: 'REPLACEMENT_SUGGESTED' },
  });

  await prisma.auditLog.create({
    data: {
      shopId,
      action: 'REPLACEMENT_SUGGESTED',
      entityType: 'ImportedProduct',
      entityId: weakProductId,
      explanation: reason,
      details: { candidateId, confidence },
    },
  });

  return decision.id;
}

/**
 * Execute a replacement - import new product, archive old one
 */
export async function executeReplacement(
  shopId: string,
  decisionId: string
): Promise<void> {
  const decision = await prisma.replacementDecision.findUniqueOrThrow({
    where: { id: decisionId },
    include: {
      currentProduct: true,
      shop: true,
    },
  });

  if (!decision.replacementCandidateId) {
    throw new Error('No replacement candidate specified');
  }

  const candidate = await prisma.candidateProduct.findUniqueOrThrow({
    where: { id: decision.replacementCandidateId },
  });

  const shop = decision.shop;

  // Safety checks
  if (decision.currentProduct.isPinned) {
    throw new Error('Cannot replace a pinned product');
  }

  // Check revenue protection
  const settings = await prisma.merchantSettings.findUniqueOrThrow({
    where: { shopId },
  });

  const perf = await prisma.productPerformance.findUnique({
    where: { importedProductId: decision.currentProductId },
  });

  if (perf && perf.revenue > settings.revenueProtection) {
    if (settings.approveFirstReplace && decision.action !== 'APPROVED') {
      throw new Error('Revenue protection: this product exceeds the threshold and requires manual approval');
    }
  }

  // 1. Archive old product in Shopify
  if (decision.currentProduct.shopifyProductGid) {
    await updateShopifyProductStatus(
      shop.shopDomain,
      shop.accessToken,
      decision.currentProduct.shopifyProductGid,
      settings.autoArchiveOld ? 'ARCHIVED' : 'DRAFT'
    );
  }

  // 2. Import new product
  const cost = candidate.costPrice || 0;
  const price = candidate.suggestedPrice || cost * 2.5;

  const shopifyProduct = await createShopifyProduct(
    shop.shopDomain,
    shop.accessToken,
    {
      title: candidate.title,
      descriptionHtml: candidate.description || '',
      productType: candidate.category || '',
      tags: ['flexhunter', 'replacement', `batch:${candidate.researchBatchId}`],
      status: 'ACTIVE',
      variants: [{ price: price.toFixed(2) }],
    }
  );

  // Add images
  if (candidate.imageUrls.length > 0) {
    await addProductImages(shop.shopDomain, shop.accessToken, shopifyProduct.id, candidate.imageUrls);
  }

  // Tag for tracking
  await tagShopifyProduct(shop.shopDomain, shop.accessToken, shopifyProduct.id, [
    'flexhunter:testing',
    `replaced:${decision.currentProduct.shopifyProductId}`,
  ]);

  // 3. Create ImportedProduct record for the replacement
  await prisma.importedProduct.create({
    data: {
      shopId,
      candidateId: candidate.id,
      shopifyProductId: shopifyProduct.id.split('/').pop() || '',
      shopifyProductGid: shopifyProduct.id,
      shopifyHandle: shopifyProduct.handle,
      shopifyStatus: 'ACTIVE',
      importedTitle: candidate.title,
      importedDescription: candidate.description,
      importedTags: ['flexhunter', 'replacement'],
      importedPrice: price,
      publishedOnImport: true,
      testStartedAt: new Date(),
      status: 'TESTING',
    },
  });

  // 4. Update candidate status
  await prisma.candidateProduct.update({
    where: { id: candidate.id },
    data: { status: 'IMPORTING' },
  });

  // 5. Update old product status
  await prisma.importedProduct.update({
    where: { id: decision.currentProductId },
    data: { status: 'AUTO_REPLACED' },
  });

  // 6. Update decision
  await prisma.replacementDecision.update({
    where: { id: decisionId },
    data: { action: 'EXECUTED', executedAt: new Date() },
  });

  // 7. Audit
  await prisma.auditLog.create({
    data: {
      shopId,
      action: 'REPLACEMENT_EXECUTED',
      entityType: 'ImportedProduct',
      entityId: decision.currentProductId,
      explanation: `Replaced "${decision.currentProduct.importedTitle}" with "${candidate.title}"`,
      details: {
        decisionId,
        oldProductId: decision.currentProductId,
        newCandidateId: candidate.id,
        confidence: decision.confidence,
      },
    },
  });
}

/**
 * Process replacement decisions based on automation mode
 */
export async function processReplacements(shopId: string): Promise<void> {
  const settings = await prisma.merchantSettings.findUniqueOrThrow({
    where: { shopId },
  });

  // Find all pending suggested replacements
  const pending = await prisma.replacementDecision.findMany({
    where: { shopId, action: 'SUGGESTED' },
    include: { currentProduct: true },
  });

  for (const decision of pending) {
    const mode = settings.replacementMode;

    if (mode === 'MANUAL') {
      // Do nothing - wait for merchant approval
      continue;
    }

    if (mode === 'AUTOMATIC') {
      // Auto-execute if confidence meets threshold
      if (decision.confidence >= settings.confidenceThreshold) {
        if (decision.currentProduct.isPinned && settings.neverReplacePinned) continue;
        try {
          await executeReplacement(shopId, decision.id);
        } catch (err) {
          console.warn(`[Replacement] Auto-execution failed for ${decision.id}:`, err);
        }
      }
    }

    if (mode === 'HYBRID') {
      // High confidence → auto-execute
      // Low confidence → wait for approval
      if (decision.confidence >= settings.approvalThreshold) {
        if (decision.currentProduct.isPinned && settings.neverReplacePinned) continue;
        try {
          await executeReplacement(shopId, decision.id);
        } catch (err) {
          console.warn(`[Replacement] Hybrid auto-execution failed for ${decision.id}:`, err);
        }
      }
      // Below threshold: stays as SUGGESTED for manual review
    }
  }
}

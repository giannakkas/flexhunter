// ==============================================
// Shopify Admin API Client — GraphQL ONLY
// ==============================================
// Required for App Store submission (April 2025+)
// API Version: 2025-01

const API_VERSION = '2025-01';

interface ShopifyRequestOptions {
  shopDomain: string;
  accessToken: string;
}

export async function shopifyGraphQL<T = any>(
  { shopDomain, accessToken }: ShopifyRequestOptions,
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const url = `https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) { const text = await response.text(); throw new Error(`Shopify API error ${response.status}: ${text}`); }
  const json = await response.json();
  if (json.errors) throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors)}`);
  return json.data as T;
}

export async function fetchShopifyProducts(shopDomain: string, accessToken: string, limit = 50): Promise<any[]> {
  const query = `query ($first: Int!) { products(first: $first) { edges { node { id title handle status productType tags priceRangeV2 { minVariantPrice { amount currencyCode } } images(first: 1) { edges { node { url altText } } } variants(first: 5) { edges { node { id price compareAtPrice sku } } } } } } }`;
  const data = await shopifyGraphQL<any>({ shopDomain, accessToken }, query, { first: limit });
  return (data?.products?.edges || []).map((e: any) => ({
    id: e.node.id, title: e.node.title, handle: e.node.handle, status: e.node.status,
    productType: e.node.productType, tags: e.node.tags,
    image: e.node.images?.edges?.[0]?.node?.url || null,
    price: e.node.priceRangeV2?.minVariantPrice?.amount,
    variants: (e.node.variants?.edges || []).map((v: any) => v.node),
  }));
}

export async function fetchShopifyCollections(shopDomain: string, accessToken: string): Promise<any[]> {
  const query = `query { collections(first: 50) { edges { node { id title handle productsCount { count } } } } }`;
  const data = await shopifyGraphQL<any>({ shopDomain, accessToken }, query);
  return (data?.collections?.edges || []).map((e: any) => e.node);
}

export async function createShopifyProduct(
  shopDomain: string, accessToken: string,
  product: { title: string; descriptionHtml: string; productType?: string; tags?: string[]; status?: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'; variants?: { price: string; compareAtPrice?: string; sku?: string }[]; images?: { src: string; altText?: string }[] }
): Promise<{ id: string; handle: string }> {
  const mutation = `mutation productCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) { productCreate(product: $product, media: $media) { product { id handle } userErrors { field message } } }`;
  const productInput: any = { title: product.title, descriptionHtml: product.descriptionHtml, productType: product.productType || '', tags: product.tags || [], status: product.status || 'ACTIVE' };
  const media = (product.images || []).map(img => ({ originalSource: img.src, alt: img.altText || product.title, mediaContentType: 'IMAGE' }));
  console.log(`[Shopify] Creating product "${product.title}" on ${shopDomain} via GraphQL`);
  const data = await shopifyGraphQL<any>({ shopDomain, accessToken }, mutation, { product: productInput, media: media.length > 0 ? media : undefined });
  const result = data?.productCreate;
  if (result?.userErrors?.length > 0) throw new Error(`Shopify error: ${result.userErrors.map((e: any) => e.message).join(', ')}`);
  if (!result?.product?.id) throw new Error('Shopify returned no product ID');
  const productId = result.product.id;

  // Create variants if provided
  if (product.variants?.length) {
    const varMutation = `mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkCreate(productId: $productId, variants: $variants) { productVariants { id } userErrors { field message } } }`;
    try {
      await shopifyGraphQL({ shopDomain, accessToken }, varMutation, {
        productId, variants: product.variants.map(v => ({ price: v.price, compareAtPrice: v.compareAtPrice || null, sku: v.sku || '' })),
      });
    } catch (err: any) { console.warn(`[Shopify] Variant creation warning: ${err.message}`); }
  }

  console.log(`[Shopify] Created product ${productId}: "${product.title}"`);
  return { id: productId, handle: result.product.handle };
}

export async function updateShopifyProductStatus(shopDomain: string, accessToken: string, productGid: string, status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'): Promise<void> {
  const mutation = `mutation productUpdate($input: ProductInput!) { productUpdate(input: $input) { product { id status } userErrors { field message } } }`;
  await shopifyGraphQL({ shopDomain, accessToken }, mutation, { input: { id: productGid, status } });
}

export async function deleteShopifyProduct(shopDomain: string, accessToken: string, productGid: string): Promise<void> {
  const mutation = `mutation productDelete($input: ProductDeleteInput!) { productDelete(input: $input) { deletedProductId userErrors { field message } } }`;
  await shopifyGraphQL({ shopDomain, accessToken }, mutation, { input: { id: productGid } });
}

export async function fetchShopifyProduct(shopDomain: string, accessToken: string, productGid: string): Promise<any> {
  const query = `query ($id: ID!) { product(id: $id) { id title handle status totalInventory priceRangeV2 { minVariantPrice { amount } } } }`;
  const data = await shopifyGraphQL<any>({ shopDomain, accessToken }, query, { id: productGid });
  return data?.product || null;
}

export async function addProductImages(shopDomain: string, accessToken: string, productGid: string, imageUrls: string[]): Promise<void> {
  const mutation = `mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) { productCreateMedia(productId: $productId, media: $media) { media { id } mediaUserErrors { field message } } }`;
  const media = imageUrls.slice(0, 10).map(url => ({ originalSource: url, mediaContentType: 'IMAGE' }));
  try { await shopifyGraphQL({ shopDomain, accessToken }, mutation, { productId: productGid, media }); } catch (err) { console.warn(`[Shopify] Image upload warning:`, err); }
}

export async function tagShopifyProduct(shopDomain: string, accessToken: string, productGid: string, tags: string[]): Promise<void> {
  const mutation = `mutation tagsAdd($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { field message } } }`;
  await shopifyGraphQL({ shopDomain, accessToken }, mutation, { id: productGid, tags });
}

export async function fetchShopInfo(shopDomain: string, accessToken: string): Promise<{ name: string; email: string; currencyCode: string; plan: string }> {
  const query = `query { shop { name email currencyCode plan { displayName } } }`;
  const data = await shopifyGraphQL<any>({ shopDomain, accessToken }, query);
  return { name: data?.shop?.name || '', email: data?.shop?.email || '', currencyCode: data?.shop?.currencyCode || 'USD', plan: data?.shop?.plan?.displayName || 'unknown' };
}

// ==============================================
// Shopify Admin API Client (GraphQL + REST)
// ==============================================

interface ShopifyRequestOptions {
  shopDomain: string;
  accessToken: string;
}

/**
 * Execute a Shopify Admin GraphQL query
 */
export async function shopifyGraphQL<T = any>(
  { shopDomain, accessToken }: ShopifyRequestOptions,
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const url = `https://${shopDomain}/admin/api/2024-01/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify API error ${response.status}: ${text}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  return json.data as T;
}

/**
 * Fetch products from Shopify (REST for simplicity in V1)
 */
export async function fetchShopifyProducts(
  shopDomain: string,
  accessToken: string,
  limit = 50
): Promise<any[]> {
  const url = `https://${shopDomain}/admin/api/2024-01/products.json?limit=${limit}`;

  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  });

  if (!response.ok) throw new Error(`Failed to fetch products: ${response.status}`);
  const json = await response.json();
  return json.products || [];
}

/**
 * Fetch collections from Shopify
 */
export async function fetchShopifyCollections(
  shopDomain: string,
  accessToken: string
): Promise<any[]> {
  const url = `https://${shopDomain}/admin/api/2024-01/custom_collections.json?limit=50`;

  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  });

  if (!response.ok) return [];
  const json = await response.json();
  return json.custom_collections || [];
}

/**
 * Create a product in Shopify via REST API (most reliable method)
 */
export async function createShopifyProduct(
  shopDomain: string,
  accessToken: string,
  product: {
    title: string;
    descriptionHtml: string;
    productType?: string;
    tags?: string[];
    status?: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
    variants?: { price: string; compareAtPrice?: string; sku?: string }[];
    images?: { src: string; altText?: string }[];
  }
): Promise<{ id: string; handle: string }> {
  const url = `https://${shopDomain}/admin/api/2024-01/products.json`;

  const body: any = {
    product: {
      title: product.title,
      body_html: product.descriptionHtml,
      product_type: product.productType || '',
      tags: (product.tags || []).join(', '),
      status: (product.status || 'ACTIVE').toLowerCase(),
      variants: product.variants?.map(v => ({
        price: v.price,
        compare_at_price: v.compareAtPrice || null,
        sku: v.sku || '',
        inventory_management: null,
      })) || [{ price: '0.00' }],
    },
  };

  if (product.images?.length) {
    body.product.images = product.images.map(img => ({
      src: img.src,
      alt: img.altText || '',
    }));
  }

  console.log(`[Shopify] Creating product "${product.title}" on ${shopDomain}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[Shopify] REST API error ${response.status}:`, text);
    throw new Error(`Shopify API error ${response.status}: ${text.slice(0, 200)}`);
  }

  const json = await response.json();
  const created = json.product;

  if (!created) {
    throw new Error('Shopify returned empty product');
  }

  console.log(`[Shopify] Created product #${created.id}: "${created.title}"`);

  return {
    id: `gid://shopify/Product/${created.id}`,
    handle: created.handle,
  };
}

/**
 * Update product status (archive, draft, active)
 */
export async function updateShopifyProductStatus(
  shopDomain: string,
  accessToken: string,
  productGid: string,
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
): Promise<void> {
  const mutation = `
    mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id status }
        userErrors { field message }
      }
    }
  `;

  await shopifyGraphQL({ shopDomain, accessToken }, mutation, {
    input: { id: productGid, status },
  });
}

/**
 * Add images to a product
 */
export async function addProductImages(
  shopDomain: string,
  accessToken: string,
  productGid: string,
  imageUrls: string[]
): Promise<void> {
  for (const url of imageUrls.slice(0, 10)) {
    const mutation = `
      mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
        productCreateMedia(productId: $productId, media: $media) {
          media { id }
          mediaUserErrors { field message }
        }
      }
    `;

    try {
      await shopifyGraphQL({ shopDomain, accessToken }, mutation, {
        productId: productGid,
        media: [{ originalSource: url, mediaContentType: 'IMAGE' }],
      });
    } catch (err) {
      console.warn(`Failed to add image ${url}:`, err);
    }
  }
}

/**
 * Tag a product for testing/tracking
 */
export async function tagShopifyProduct(
  shopDomain: string,
  accessToken: string,
  productGid: string,
  tags: string[]
): Promise<void> {
  const mutation = `
    mutation tagsAdd($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        userErrors { field message }
      }
    }
  `;

  await shopifyGraphQL({ shopDomain, accessToken }, mutation, {
    id: productGid,
    tags,
  });
}

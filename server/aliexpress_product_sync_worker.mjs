/**
 * AliExpress Product Sync Worker
 * 
 * Fetches products from AliExpress API and syncs them to Supabase
 * Runs continuously every 30 minutes to pull new/different products
 * 
 * Usage: node server/aliexpress_product_sync_worker.mjs
 * 
 * Required env vars:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_KEY
 * - ALIEXPRESS_API_KEY
 * - ALIEXPRESS_API_SECRET
 * - SYNC_INTERVAL (optional, default: 1800000ms = 30 mins)
 */

import { createClient } from '@supabase/supabase-js';
import { AliExpressClient } from './integrations/aliexpress.mjs';
import logger from './logger.mjs';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ALIEXPRESS_API_KEY = process.env.ALIEXPRESS_API_KEY;
const ALIEXPRESS_API_SECRET = process.env.ALIEXPRESS_API_SECRET;
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL || '1800000'); // 30 minutes default

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ALIEXPRESS_API_KEY || !ALIEXPRESS_API_SECRET) {
  logger.error({
    msg: 'Missing required environment variables',
    supabaseUrl: !!SUPABASE_URL,
    supabaseKey: !!SUPABASE_SERVICE_KEY,
    aliexpressKey: !!ALIEXPRESS_API_KEY,
    aliexpressSecret: !!ALIEXPRESS_API_SECRET,
  });
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const aliExpress = new AliExpressClient(ALIEXPRESS_API_KEY, ALIEXPRESS_API_SECRET);

/**
 * Search keywords to fetch products from AliExpress
 * Customize these to match your store's niche
 * Multiple keywords per category ensure variety
 */
const CATEGORY_KEYWORDS = {
  'jewelry-watches': [
    'luxury watches',
    'diamond rings',
    'premium timepieces',
    'gold watches',
    'elegant jewelry',
    'silver jewelry',
    'custom rings',
    'bracelet watches',
  ],
  'bags-luggage': [
    'designer handbags',
    'luxury backpacks',
    'premium luggage',
    'leather bags',
    'travel suitcase',
    'crossbody bags',
    'vintage bags',
    'messenger bags',
  ],
  'accessories': [
    'luxury scarves',
    'designer belts',
    'premium wallets',
    'silk scarves',
    'fashion belts',
    'leather wallets',
    'designer hats',
    'sunglasses',
  ],
  'wigs-hair': [
    'premium hair extensions',
    'luxury wigs',
    'hair accessories',
    'human hair wigs',
    'lace wigs',
    'hair clips',
    'hair pins',
    'headbands',
  ],
  'audio-video': [
    'premium headphones',
    'luxury speakers',
    'professional cameras',
    'wireless earbuds',
    'studio headphones',
    'bluetooth speakers',
    'gaming headset',
    'video camera',
  ],
  'fashion': [
    'designer clothing',
    'premium shoes',
    'luxury fashion',
    'designer dresses',
    'fashion jackets',
    'casual wear',
    'formal wear',
    'sport wear',
  ],
  'smart-home': [
    'smart home devices',
    'luxury automation',
    'premium IoT',
    'smart lights',
    'security systems',
    'smart speakers',
    'climate control',
    'smart doorbells',
  ],
  'electronics': [
    'premium smartphones',
    'luxury tablets',
    'high end laptop',
    'gaming console',
    'portable charger',
    'phone accessories',
    'tech gadgets',
    'electronic devices',
  ],
  'beauty-health': [
    'luxury skincare',
    'premium makeup',
    'beauty devices',
    'facial masks',
    'wellness products',
    'anti-aging cream',
    'cosmetics set',
    'perfume',
  ],
  'sports-outdoors': [
    'fitness equipment',
    'sports gear',
    'outdoor equipment',
    'camping gear',
    'yoga mat',
    'weights set',
    'running shoes',
    'adventure gear',
  ],
};

/**
 * Normalize AliExpress product data to Supabase schema
 */
function normalizeProduct(aliexpressProduct, categoryId, supplierId) {
  const baseCost = parseFloat(aliexpressProduct.sale_price?.usd_price) || 10;
  const shippingCost = parseFloat(aliexpressProduct.logistics_fee?.usd_price) || 3;
  const profitMargin = 0.40; // 40% profit margin
  const bufferFee = (baseCost + shippingCost) * 0.05; // 5% buffer
  
  const customerPrice = baseCost + shippingCost + bufferFee + ((baseCost + shippingCost + bufferFee) * profitMargin);

  return {
    category_id: categoryId,
    supplier_id: supplierId,
    name: aliexpressProduct.product_title || 'Unknown Product',
    slug: `aliexpress-${aliexpressProduct.product_id}-${Date.now()}`,
    description: aliexpressProduct.product_desc || '',
    short_description: (aliexpressProduct.product_title || '').substring(0, 100),
    aliexpress_product_id: String(aliexpressProduct.product_id),
    aliexpress_url: aliexpressProduct.product_main_image_url ? 
      `https://www.aliexpress.com/item/${aliexpressProduct.product_id}.html` : 
      null,
    base_cost: baseCost,
    shipping_cost: shippingCost,
    buffer_fee: bufferFee,
    profit_margin: profitMargin,
    customer_price: parseFloat(customerPrice.toFixed(2)),
    cost_currency: 'USD',
    display_currency: 'NGN',
    stock_quantity: 100, // Default stock
    low_stock_threshold: 5,
    images: aliexpressProduct.product_main_image_url ? 
      [aliexpressProduct.product_main_image_url] : 
      [],
    thumbnail_url: aliexpressProduct.product_main_image_url || null,
    is_active: true,
    is_featured: Math.random() > 0.7, // 30% featured
    meta_title: aliexpressProduct.product_title || '',
    meta_description: (aliexpressProduct.product_desc || '').substring(0, 160),
  };
}

/**
 * Fetch products from AliExpress and sync to Supabase
 */
async function syncProducts() {
  logger.info({ msg: 'Starting AliExpress product sync', timestamp: new Date().toISOString() });

  try {
    // Get all categories from Supabase
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, slug, name')
      .eq('is_active', true);

    if (catError) {
      logger.error({ msg: 'Failed to fetch categories', error: catError });
      return;
    }

    // Get or create default supplier
    const { data: suppliers, error: supError } = await supabase
      .from('suppliers')
      .select('id')
      .eq('aliexpress_seller_id', 'aliexpress_default')
      .single();

    if (supError) {
      logger.error({ msg: 'Failed to fetch supplier', error: supError });
      return;
    }

    const supplierId = suppliers.id;
    let totalSynced = 0;
    let totalFailed = 0;

    // For each category, search and sync products with multiple keywords and offsets
    for (const category of categories) {
      const keywords = CATEGORY_KEYWORDS[category.slug] || [category.name];

      for (const keyword of keywords) {
        // Search multiple offsets (pages) per keyword to get different products
        for (let offset = 0; offset < 3; offset++) {
          logger.info({ 
            msg: 'Searching AliExpress', 
            category: category.slug, 
            keyword,
            offset,
            timestamp: new Date().toISOString(),
          });

          try {
            const searchResult = await aliExpress.searchProducts(keyword, {
              limit: 20, // 20 products per request
              offset: offset * 20,
              sortBy: 'total_tranpro_cask', // Popular products
            });

            if (searchResult.error) {
              logger.warn({ msg: 'AliExpress search failed', keyword, error: searchResult.error });
              continue;
            }

            // Insert/update products in Supabase
            for (const aliProduct of searchResult.items) {
              try {
                const normalizedProduct = normalizeProduct(aliProduct, category.id, supplierId);

                // Check if product already exists (by aliexpress_product_id AND category to allow duplicates in different categories)
                const { data: existing } = await supabase
                  .from('products')
                  .select('id')
                  .eq('aliexpress_product_id', normalizedProduct.aliexpress_product_id)
                  .eq('category_id', category.id)
                  .single();

                if (existing) {
                  // Update existing product
                  const { error: updateError } = await supabase
                    .from('products')
                    .update({
                      name: normalizedProduct.name,
                      description: normalizedProduct.description,
                      customer_price: normalizedProduct.customer_price,
                      base_cost: normalizedProduct.base_cost,
                      is_featured: normalizedProduct.is_featured,
                      images: normalizedProduct.images,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id);

                  if (updateError) {
                    logger.error({ msg: 'Failed to update product', error: updateError });
                    totalFailed++;
                  } else {
                    logger.debug({ msg: 'Product updated', productId: existing.id });
                    totalSynced++;
                  }
                } else {
                  // Insert new product
                  const { error: insertError } = await supabase
                    .from('products')
                    .insert([normalizedProduct]);

                  if (insertError) {
                    logger.error({ msg: 'Failed to insert product', error: insertError });
                    totalFailed++;
                  } else {
                    logger.debug({ msg: 'Product inserted', name: normalizedProduct.name });
                    totalSynced++;
                  }
                }

                // Rate limit: 500ms between API calls to avoid hitting limits
                await new Promise(resolve => setTimeout(resolve, 500));
              } catch (e) {
                logger.error({ msg: 'Error processing product', error: String(e) });
                totalFailed++;
              }
            }
          } catch (e) {
            logger.error({ msg: 'Error searching keyword', keyword, offset, error: String(e) });
          }

          // Delay between offset requests
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Delay between keywords
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    logger.info({
      msg: 'AliExpress product sync completed',
      totalSynced,
      totalFailed,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    logger.error({ msg: 'Fatal error in product sync', error: String(e) });
  }
}

/**
 * Run sync once on startup, then repeatedly at interval
 */
async function startScheduler() {
  logger.info({
    msg: 'Product sync scheduler started',
    interval_ms: SYNC_INTERVAL,
    interval_mins: SYNC_INTERVAL / 60000,
  });

  // Run immediately on startup
  await syncProducts();

  // Then run at regular intervals
  setInterval(async () => {
    await syncProducts();
  }, SYNC_INTERVAL);

  // Keep process running
  logger.info({ msg: 'Scheduler running. Press Ctrl+C to stop.' });
}

// Start scheduler if not in test mode
if (!process.env.TEST_MODE) {
  startScheduler().catch(e => {
    logger.error({ msg: 'Scheduler failed', error: String(e) });
    process.exit(1);
  });
}

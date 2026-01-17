/**
 * AliExpress Product Sync Worker (Official Dropshipping Edition)
 * 
 * Synchronizes products from AliExpress using official Dropshipper APIs.
 * Uses 'aliexpress.ds.recommend.feed.get' and 'aliexpress.ds.product.get'.
 */

import { createClient } from '@supabase/supabase-js';
import { AliExpressClient } from './integrations/aliexpress.mjs';
import logger from './logger.mjs';
import dotenv from 'dotenv';
dotenv.config();

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  ALIEXPRESS_APP_KEY,
  ALIEXPRESS_APP_SECRET,
  SYNC_INTERVAL = '1800000'
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ALIEXPRESS_APP_KEY || !ALIEXPRESS_APP_SECRET) {
  logger.error('Missing required environment variables for AliExpress sync.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const aliExpress = new AliExpressClient({
  appKey: ALIEXPRESS_APP_KEY,
  appSecret: ALIEXPRESS_APP_SECRET
});

/**
 * Maps Official DS API response to AuraCart Schema
 */
function normalizeProduct(aeProduct, categoryId, supplierId) {
  // Base info is in ae_item_base_info_dto
  const base = aeProduct.ae_item_base_info_dto;
  const skus = aeProduct.ae_item_sku_info_dtos || [];

  // Calculate pricing based on first SKU
  const baseCost = parseFloat(skus[0]?.sku_price || "0");
  const shippingCost = 0; // logistics calculated separately usually
  const profitMargin = 0.40;
  const customerPrice = baseCost + (baseCost * profitMargin);

  return {
    category_id: categoryId,
    supplier_id: supplierId,
    name: base.subject,
    slug: `ae-${base.product_id}-${Date.now()}`,
    description: base.subject,
    images: aeProduct.ae_multimedia_info_dto?.image_urls?.split(';') || [],
    customer_price: parseFloat(customerPrice.toFixed(2)),
    stock_quantity: parseInt(skus[0]?.ipm_sku_stock || "100"),
    is_active: true,
    metadata: {
      aliexpress_id: base.product_id,
      rating: base.avg_evaluation_rating,
      reviews: base.evaluation_count,
      store_id: aeProduct.ae_store_info_dto?.store_id
    }
  };
}

async function syncProducts() {
  logger.info('Starting official AliExpress Dropshipping sync...');

  try {
    // 1. Get Access Token
    const { data: tokenData } = await supabase.from('settings').select('value').eq('key', 'aliexpress_tokens').single();
    if (!tokenData?.value?.access_token) {
      logger.error('No AliExpress access token found in database. Skipping sync.');
      return;
    }

    // Initialize and Refresh if needed
    aliExpress.setToken(tokenData.value);
    await aliExpress.ensureValidToken(supabase);

    // 2. Get Categories
    const { data: categories } = await supabase.from('categories').select('*').eq('is_active', true);

    // 3. Get Supplier
    const { data: supplier } = await supabase.from('suppliers').select('id').limit(1).single();
    if (!supplier) throw new Error('No supplier record found to link products.');

    for (const cat of categories) {
      logger.info(`Processing category: ${cat.name}`);

      try {
        // Use Official Bestseller Feed
        const feed = await aliExpress.getBestsellerFeed({
          categoryId: cat.aliexpress_id,
          pageSize: 20
        });

        const candidates = feed.result?.products?.promotion_product_dto || [];

        for (const item of candidates) {
          try {
            // Get Full Details for high-fidelity sync
            const details = await aliExpress.getProduct(item.product_id);
            const normalized = normalizeProduct(details.result, cat.id, supplier.id);

            // Upsert based on aliexpress_id in metadata?
            // Safer to use a dedicated aliexpress_id column, but using slug for now as per previous logic
            const { error: upsertError } = await supabase
              .from('products')
              .upsert(normalized, { onConflict: 'slug' });

            if (upsertError) throw upsertError;

            logger.info(`Synced: ${normalized.name}`);

            // Respect QPS (Throttling)
            await new Promise(r => setTimeout(r, 1000));
          } catch (e) {
            logger.error(`Error syncing product ${item.product_id}: ${e.message}`);
          }
        }
      } catch (e) {
        logger.error(`Failed to fetch feed for category ${cat.name}: ${e.message}`);
      }
    }

  } catch (error) {
    logger.error(`Fatal error in sync: ${error.message}`);
  }
}

// Start Cycle
if (!process.env.TEST_MODE) {
  syncProducts();
  setInterval(syncProducts, parseInt(SYNC_INTERVAL));
}

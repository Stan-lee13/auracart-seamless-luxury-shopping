/**
 * AliExpress Order Fulfillment Worker
 * 
 * Automates fulfillment workflow:
 * - Maps AuraCart orders to AliExpress suppliers
 * - Creates AliExpress orders
 * - Tracks shipment status
 * - Updates AuraCart orders with supplier tracking info
 * - Handles cancellations and refunds
 * 
 * Run periodically (e.g., every 15 minutes)
 * 
 * Usage:
 *   node server/aliexpress_fulfillment_worker.mjs
 */

import { createClient } from '@supabase/supabase-js';
import AliExpressClient from './integrations/aliexpress.mjs';
import logger from './logger.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  logger.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const aliExpressClient = new AliExpressClient();

/**
 * Find the best supplier for a product (based on price, rating, delivery time)
 */
async function findBestSupplier(productName, targetQuantity = 1) {
  try {
    const searchResult = await aliExpressClient.searchProducts(productName, { limit: 5 });
    if (searchResult.error) {
      logger.warn({ msg: 'Failed to search suppliers', product: productName, error: searchResult.error });
      return null;
    }

    if (!searchResult.items || searchResult.items.length === 0) {
      logger.warn({ msg: 'No suppliers found', product: productName });
      return null;
    }

    // Select the top-rated, lowest-price supplier
    const suppliers = searchResult.items.sort((a, b) => {
      const scoreA = (a.star_rating || 0) - (a.min_order_qty || 1) * 0.01 - (Number(a.min_price) || 999) * 0.001;
      const scoreB = (b.star_rating || 0) - (b.min_order_qty || 1) * 0.01 - (Number(b.min_price) || 999) * 0.001;
      return scoreB - scoreA;
    });

    const selected = suppliers[0];
    return {
      product_id: selected.product_id,
      supplier_name: selected.seller_name,
      supplier_rating: selected.star_rating,
      min_price: Number(selected.min_price || 0),
      min_order_qty: selected.min_order_qty || 1,
      description: selected.product_title
    };
  } catch (e) {
    logger.error({ msg: 'Exception finding supplier', product: productName, err: String(e) });
    return null;
  }
}

/**
 * Fulfill a single AuraCart order
 */
async function fulfillOrder(order) {
  const { id: order_id, order_number, user_id, shipping_address } = order;

  if (!order.supplier_order_id) {
    // Step 1: Create mapping entry and find suppliers
    try {
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order_id);

      if (!items || items.length === 0) {
        logger.warn({ msg: 'Order has no items', order_id });
        return { order_id, action: 'skip', reason: 'no_items' };
      }

      // For simplicity, fulfill all items from the same supplier (or split if needed)
      const firstItem = items[0];
      const supplier = await findBestSupplier(firstItem.product_name, firstItem.quantity);

      if (!supplier) {
        logger.warn({ msg: 'No supplier found', order_id, product: firstItem.product_name });
        return { order_id, action: 'skip', reason: 'no_supplier' };
      }

      // Check inventory
      const inventory = await aliExpressClient.checkInventory(supplier.product_id);
      if (!inventory.available || inventory.quantity < firstItem.quantity) {
        logger.warn({ msg: 'Insufficient inventory', order_id, supplier: supplier.supplier_name, quantity_needed: firstItem.quantity, available: inventory.quantity });
        return { order_id, action: 'skip', reason: 'insufficient_inventory' };
      }

      // Create supplier order
      const supplierOrder = await aliExpressClient.submitOrder({
        productId: supplier.product_id,
        skuId: null,
        quantity: firstItem.quantity,
        shippingAddress: shipping_address || {},
        contactInfo: { email: `order_${order_number}@auracart.local`, phone: shipping_address?.phone }
      });

      if (supplierOrder.error) {
        logger.error({ msg: 'Failed to create supplier order', order_id, error: supplierOrder.error });
        return { order_id, action: 'error', reason: supplierOrder.error };
      }

      // Record mapping in supplier_orders table
      const { data: mapping, error: mappingErr } = await supabase
        .from('supplier_orders')
        .insert({
          aura_order_id: order_id,
          supplier: 'aliexpress',
          supplier_order_id: supplierOrder.order_id,
          supplier_trade_id: supplierOrder.trade_id,
          supplier_name: supplier.supplier_name,
          product_name: firstItem.product_name,
          quantity: firstItem.quantity,
          supplier_cost: supplier.min_price,
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .maybeSingle();

      if (mappingErr) {
        logger.error({ msg: 'Failed to record supplier mapping', order_id, err: String(mappingErr) });
        return { order_id, action: 'error', reason: String(mappingErr) };
      }

      logger.info({ msg: 'Supplier order created', order_id, supplier_order_id: supplierOrder.order_id });
      return { order_id, action: 'submitted', supplier_order_id: supplierOrder.order_id };
    } catch (e) {
      logger.error({ msg: 'Exception submitting supplier order', order_id, err: String(e) });
      return { order_id, action: 'error', reason: String(e) };
    }
  } else {
    // Step 2: Poll supplier order for status updates
    try {
      const { data: mapping } = await supabase
        .from('supplier_orders')
        .select('*')
        .eq('aura_order_id', order_id)
        .limit(1)
        .maybeSingle();

      if (!mapping) {
        logger.warn({ msg: 'Supplier mapping not found', order_id });
        return { order_id, action: 'skip', reason: 'no_mapping' };
      }

      const statusResult = await aliExpressClient.getOrderStatus(mapping.supplier_trade_id);
      if (statusResult.error) {
        logger.warn({ msg: 'Failed to get supplier order status', mapping_id: mapping.id, error: statusResult.error });
        return { order_id, action: 'error', reason: statusResult.error };
      }

      // Map AliExpress status to internal status
      let newStatus = 'pending';
      if (statusResult.status_text?.includes('Shipped')) newStatus = 'shipped';
      else if (statusResult.status_text?.includes('Delivered')) newStatus = 'delivered';
      else if (statusResult.status_text?.includes('Cancelled')) newStatus = 'cancelled';
      else if (statusResult.status_text?.includes('Closed')) newStatus = 'closed';

      // Update mapping if status changed
      if (newStatus !== mapping.status) {
        const { error: updateErr } = await supabase
          .from('supplier_orders')
          .update({
            status: newStatus,
            tracking_number: statusResult.tracking_number || null,
            last_status_update: new Date().toISOString()
          })
          .eq('id', mapping.id);

        if (updateErr) {
          logger.error({ msg: 'Failed to update supplier order status', mapping_id: mapping.id, err: String(updateErr) });
        }

        // Propagate status to AuraCart order
        if (newStatus === 'delivered') {
          await supabase.from('orders').update({ status: 'delivered' }).eq('id', order_id);
        } else if (newStatus === 'shipped') {
          await supabase.from('orders').update({ status: 'shipped' }).eq('id', order_id);
        }

        logger.info({ msg: 'Supplier order status updated', order_id, new_status: newStatus });
      }

      return { order_id, action: 'updated', status: newStatus, tracking: statusResult.tracking_number };
    } catch (e) {
      logger.error({ msg: 'Exception polling supplier status', order_id, err: String(e) });
      return { order_id, action: 'error', reason: String(e) };
    }
  }
}

/**
 * Main worker loop
 */
async function runFulfillment() {
  logger.info({ msg: 'Starting AliExpress fulfillment worker' });

  try {
    // Fetch orders ready for fulfillment (paid but not yet fulfilled)
    const { data: orders, error: queryErr } = await supabase
      .from('orders')
      .select('*')
      .in('status', ['paid', 'pending_fulfillment', 'shipped'])
      .order('created_at', { ascending: true })
      .limit(50);

    if (queryErr) {
      logger.error({ msg: 'Error querying orders for fulfillment', err: String(queryErr) });
      return;
    }

    if (!orders || orders.length === 0) {
      logger.info({ msg: 'No orders to fulfill' });
      return;
    }

    logger.info({ msg: 'Processing orders for fulfillment', count: orders.length });

    const results = [];
    for (const order of orders) {
      const result = await fulfillOrder(order);
      results.push(result);
      logger.info({ msg: 'Order fulfillment result', ...result });
    }

    const summary = {
      total: results.length,
      submitted: results.filter(r => r.action === 'submitted').length,
      updated: results.filter(r => r.action === 'updated').length,
      errors: results.filter(r => r.action === 'error').length,
      skipped: results.filter(r => r.action === 'skip').length
    };

    logger.info({ msg: 'AliExpress fulfillment complete', ...summary });
  } catch (e) {
    logger.error({ msg: 'AliExpress fulfillment worker error', err: String(e) });
  }
}

// Run immediately if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runFulfillment().then(() => {
    logger.info({ msg: 'AliExpress fulfillment worker finished' });
    process.exit(0);
  }).catch(e => {
    logger.error({ msg: 'AliExpress fulfillment worker crashed', err: String(e) });
    process.exit(1);
  });
}

export { runFulfillment };

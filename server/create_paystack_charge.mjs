import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import logger from './logger.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY; // secret for creating transactions

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  logger.error('Missing Supabase config');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

async function createCharge({ line_items = [], shipping = 0, tax = 0, discount = 0, currency = 'NGN', email, metadata = {}, reference, user_id = null }) {
  // Compute financial math from provided line_items
  // Each line_item: { product_id, variant_id, product_name, variant_name, unit_price, unit_cost, quantity, product_image }
  const items = Array.isArray(line_items) ? line_items : [];

  let subtotal = 0;
  let total_cost = 0;
  const orderItemsToInsert = [];

  for (const it of items) {
    const qty = Number(it.quantity || 1);
    const unit_price = Number(it.unit_price || 0);
    const unit_cost = Number(it.unit_cost || 0);
    const line_total = +(unit_price * qty).toFixed(2);
    const line_cost = +(unit_cost * qty).toFixed(2);
    const line_profit = +(line_total - line_cost).toFixed(2);

    subtotal += line_total;
    total_cost += line_cost;

    orderItemsToInsert.push({
      product_id: it.product_id || null,
      variant_id: it.variant_id || null,
      product_name: it.product_name || it.name || 'Item',
      variant_name: it.variant_name || null,
      product_image: it.product_image || null,
      quantity: qty,
      unit_price: unit_price,
      unit_cost: unit_cost,
      line_total: line_total,
      line_cost: line_cost,
      line_profit: line_profit
    });
  }

  subtotal = +subtotal.toFixed(2);
  total_cost = +total_cost.toFixed(2);
  const tax_total = +(Number(tax) || 0);
  const shipping_total = +(Number(shipping) || 0);
  const discount_total = +(Number(discount) || 0);
  const grand_total = +(subtotal + tax_total + shipping_total - discount_total).toFixed(2);
  const total_profit = +(grand_total - total_cost).toFixed(2);

    // Initialize transaction with Paystack (amount in kobo)
  let init = null;
  try {
    if (!PAYSTACK_SECRET_KEY) throw new Error('PAYSTACK_SECRET_KEY not set');
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirect = `${FRONTEND_URL}/order/${encodeURIComponent(reference)}`;
    const body = { amount: Math.round(grand_total * 100), currency, email, metadata, reference, redirect_url: redirect };
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    init = await res.json();
  } catch (e) {
    logger.warn('Paystack init failed (local/dev may skip):', e.message || e);
  }

    // Insert pending order and items into Supabase
  try {
    const order = {
      order_number: reference,
      grand_total: grand_total,
      subtotal: subtotal,
      total_cost: total_cost,
      total_profit: total_profit,
      tax_total: tax_total,
      shipping_total: shipping_total,
      discount_total: discount_total,
      currency: currency,
      status: 'pending',
        user_id: user_id || null,
      shipping_address: {},
      notes: null
    };

    const { data: insertedOrder, error: orderErr } = await supabase.from('orders').insert(order).select().maybeSingle();
    if (orderErr) {
      logger.error({ msg: 'Failed to insert pending order', err: String(orderErr) });
      throw orderErr;
    }

    // Insert order_items
    if (insertedOrder && orderItemsToInsert.length) {
      const itemsToDb = orderItemsToInsert.map(i => ({ order_id: insertedOrder.id, ...i }));
      const { error: itemsErr } = await supabase.from('order_items').insert(itemsToDb);
      if (itemsErr) logger.error({ msg: 'Failed to insert order_items', err: String(itemsErr) });
    }

    // Insert a pending transaction record (store provider reference, and snapshot of init)
    try {
      const txPayload = {
        order_id: insertedOrder.id,
        provider: 'paystack',
        provider_reference: reference,
        amount: grand_total,
        currency: currency,
        status: 'pending',
        provider_response: init || {}
      };
      const { data: txInserted, error: txErr } = await supabase.from('transactions').insert(txPayload).select().maybeSingle();
      if (txErr) logger.error({ msg: 'Failed to insert transaction record', err: String(txErr) });
      return { init, order: insertedOrder, transaction: txInserted };
    } catch (e) {
      logger.error({ msg: 'Transaction insert error', err: String(e) });
    }
  } catch (e) {
    logger.error({ msg: 'Error creating charge/order', err: String(e) });
    throw e;
  }
}

// CLI runner for quick creation
async function main() {
  const args = process.argv.slice(2);
  const amount = Number(args[0] || 1000); // NGN
  const email = args[1] || 'test@example.com';
  const reference = args[2] || `aura_${Date.now()}`;
  const sampleItems = [{ product_name: 'Test Item', unit_price: amount, unit_cost: 0, quantity: 1 }];

    try {
    const result = await createCharge({ line_items: sampleItems, amount, email, reference });
    logger.info({ msg: 'CLI createCharge result', result });
  } catch (e) {
    logger.error({ msg: 'CLI createCharge error', err: String(e) });
  }
}

if (require.main === module) main();

export { createCharge };

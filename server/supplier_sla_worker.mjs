/**
 * Supplier SLA Scoring Worker
 * 
 * Computes supplier performance metrics:
 * - Fulfillment rate (on-time vs. late deliveries)
 * - Cancellation rate
 * - Return rate
 * - Customer satisfaction score (based on disputes/chargebacks)
 * - Assigns supplier health scores (A, B, C, D)
 * 
 * Run periodically (e.g., daily at midnight)
 * 
 * Usage:
 *   node server/supplier_sla_worker.mjs
 */

import { createClient } from '@supabase/supabase-js';
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

/**
 * Compute supplier SLA score
 */
function computeSupplierScore(metrics) {
  const {
    fulfillment_rate = 0,
    on_time_delivery_rate = 0,
    cancellation_rate = 0,
    return_rate = 0,
    satisfaction_score = 0,
    dispute_count = 0,
    total_orders = 0
  } = metrics;

  // Weighted scoring:
  // - Fulfillment rate: 30%
  // - On-time delivery: 25%
  // - Cancellation rate: 20% (inverse)
  // - Return rate: 15% (inverse)
  // - Satisfaction: 10%

  const score =
    (fulfillment_rate * 0.30) +
    (on_time_delivery_rate * 0.25) +
    ((1 - cancellation_rate) * 0.20) +
    ((1 - return_rate) * 0.15) +
    (satisfaction_score * 0.10);

  // Assign grade
  let grade = 'F';
  if (score >= 0.9) grade = 'A';
  else if (score >= 0.8) grade = 'B';
  else if (score >= 0.7) grade = 'C';
  else if (score >= 0.6) grade = 'D';

  return { score: Math.round(score * 100), grade };
}

/**
 * Calculate metrics for a single supplier
 */
async function calculateSupplierMetrics(supplier_name, period_days = 30) {
  try {
    const since = new Date(Date.now() - period_days * 24 * 60 * 60 * 1000).toISOString();

    // Fetch supplier orders created in period
    const { data: supplierOrders } = await supabase
      .from('supplier_orders')
      .select('*')
      .eq('supplier_name', supplier_name)
      .gte('created_at', since);

    if (!supplierOrders || supplierOrders.length === 0) {
      return {
        supplier_name,
        period_days,
        total_orders: 0,
        fulfillment_rate: 0,
        on_time_delivery_rate: 0,
        cancellation_rate: 0,
        return_rate: 0,
        satisfaction_score: 0,
        dispute_count: 0
      };
    }

    const total_orders = supplierOrders.length;
    const fulfilled_orders = supplierOrders.filter(o => o.status === 'delivered').length;
    const cancelled_orders = supplierOrders.filter(o => o.status === 'cancelled').length;

    // Count on-time deliveries (within 14 days of order creation)
    let on_time_deliveries = 0;
    for (const order of supplierOrders) {
      if (order.status === 'delivered' && order.last_status_update) {
        const createdAt = new Date(order.created_at).getTime();
        const deliveredAt = new Date(order.last_status_update).getTime();
        const days = (deliveredAt - createdAt) / (24 * 60 * 60 * 1000);
        if (days <= 14) on_time_deliveries++;
      }
    }

    // Fetch related AuraCart orders to find disputes/returns
    const aura_order_ids = supplierOrders.map(o => o.aura_order_id);
    let dispute_count = 0;
    let return_count = 0;

    if (aura_order_ids.length > 0) {
      const { data: disputes } = await supabase
        .from('disputes')
        .select('id')
        .in('order_id', aura_order_ids);
      dispute_count = disputes?.length || 0;

      const { data: refunds } = await supabase
        .from('refunds')
        .select('id')
        .in('order_id', aura_order_ids)
        .eq('is_full_refund', true);
      return_count = refunds?.length || 0;
    }

    // Calculate rates
    const fulfillment_rate = total_orders > 0 ? fulfilled_orders / total_orders : 0;
    const on_time_delivery_rate = fulfilled_orders > 0 ? on_time_deliveries / fulfilled_orders : 0;
    const cancellation_rate = total_orders > 0 ? cancelled_orders / total_orders : 0;
    const return_rate = total_orders > 0 ? return_count / total_orders : 0;
    const satisfaction_score = Math.max(0, 1 - (dispute_count / total_orders) * 0.5); // disputes reduce satisfaction

    return {
      supplier_name,
      period_days,
      total_orders,
      fulfilled_orders,
      cancelled_orders,
      fulfillment_rate: Math.round(fulfillment_rate * 100) / 100,
      on_time_delivery_rate: Math.round(on_time_delivery_rate * 100) / 100,
      cancellation_rate: Math.round(cancellation_rate * 100) / 100,
      return_rate: Math.round(return_rate * 100) / 100,
      satisfaction_score: Math.round(satisfaction_score * 100) / 100,
      dispute_count,
      return_count
    };
  } catch (e) {
    logger.error({ msg: 'Error calculating supplier metrics', supplier_name, err: String(e) });
    return { error: String(e) };
  }
}

/**
 * Main worker loop
 */
async function runSupplierScoring() {
  logger.info({ msg: 'Starting supplier SLA scoring worker' });

  try {
    // Get unique suppliers from supplier_orders
    const { data: suppliers, error: suppliersErr } = await supabase
      .from('supplier_orders')
      .select('supplier_name', { distinct: true })
      .gt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (suppliersErr) {
      logger.error({ msg: 'Error fetching suppliers', err: String(suppliersErr) });
      return;
    }

    const uniqueSuppliers = [...new Set((suppliers || []).map(s => s.supplier_name))].filter(Boolean);
    if (uniqueSuppliers.length === 0) {
      logger.info({ msg: 'No suppliers found' });
      return;
    }

    logger.info({ msg: 'Scoring suppliers', count: uniqueSuppliers.length });

    const results = [];
    for (const supplier_name of uniqueSuppliers) {
      try {
        const metrics = await calculateSupplierMetrics(supplier_name, 30);
        if (metrics.error) {
          logger.error({ msg: 'Failed to calculate metrics for supplier', supplier: supplier_name, error: metrics.error });
          continue;
        }

        const { score, grade } = computeSupplierScore(metrics);

        // Upsert into supplier_metrics table
        const { data: existing } = await supabase
          .from('supplier_metrics')
          .select('id')
          .eq('supplier_name', supplier_name)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const metricPayload = {
          supplier_name: supplier_name,
          period_days: 30,
          total_orders: metrics.total_orders,
          fulfilled_orders: metrics.fulfilled_orders,
          cancelled_orders: metrics.cancelled_orders,
          fulfillment_rate: metrics.fulfillment_rate,
          on_time_delivery_rate: metrics.on_time_delivery_rate,
          cancellation_rate: metrics.cancellation_rate,
          return_rate: metrics.return_rate,
          satisfaction_score: metrics.satisfaction_score,
          dispute_count: metrics.dispute_count,
          return_count: metrics.return_count,
          sla_score: score,
          sla_grade: grade,
          calculated_at: new Date().toISOString()
        };

        const { data: inserted, error: insertErr } = await supabase
          .from('supplier_metrics')
          .insert(metricPayload)
          .select()
          .maybeSingle();

        if (insertErr) {
          logger.error({ msg: 'Failed to insert supplier metrics', supplier: supplier_name, err: String(insertErr) });
        } else {
          logger.info({ msg: 'Supplier metrics recorded', supplier: supplier_name, score, grade, fulfilled: metrics.fulfilled_orders, total: metrics.total_orders });
          results.push({ supplier_name, score, grade });
        }
      } catch (e) {
        logger.error({ msg: 'Exception scoring supplier', supplier: supplier_name, err: String(e) });
      }
    }

    const summary = {
      total_suppliers: uniqueSuppliers.length,
      scored: results.length,
      avg_score: results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0,
      grade_distribution: {
        A: results.filter(r => r.grade === 'A').length,
        B: results.filter(r => r.grade === 'B').length,
        C: results.filter(r => r.grade === 'C').length,
        D: results.filter(r => r.grade === 'D').length,
        F: results.filter(r => r.grade === 'F').length
      }
    };

    logger.info({ msg: 'Supplier SLA scoring complete', ...summary });
  } catch (e) {
    logger.error({ msg: 'Supplier SLA scoring worker error', err: String(e) });
  }
}

// Run immediately if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSupplierScoring().then(() => {
    logger.info({ msg: 'Supplier SLA scoring worker finished' });
    process.exit(0);
  }).catch(e => {
    logger.error({ msg: 'Supplier SLA scoring worker crashed', err: String(e) });
    process.exit(1);
  });
}

export { runSupplierScoring };

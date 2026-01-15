/**
 * Financial Reconciliation & Settlement Worker
 * 
 * Computes financial metrics:
 * - Provider fees (Paystack commission)
 * - Platform profit margin
 * - Supplier costs
 * - Daily/weekly settlement proposals
 * - Ledger entries for accounting
 * 
 * Run daily (e.g., at midnight UTC)
 * 
 * Usage:
 *   node server/financial_reconciliation_worker.mjs
 */

import { createClient } from '@supabase/supabase-js';
import logger from './logger.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Fee configuration
const PAYSTACK_COMMISSION_RATE = 0.0135; // 1.35% standard rate
const PLATFORM_COMMISSION_RATE = 0.15; // 15% platform commission on gross
const TAX_RATE = 0.075; // 7.5% VAT

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  logger.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

/**
 * Calculate financial breakdown for a single order
 */
async function calculateOrderFinancials(order) {
  const { id, grand_total, subtotal, tax_total, shipping_total, discount_total } = order;

  // Get supplier costs for this order
  let total_supplier_cost = 0;
  try {
    const { data: supplierOrders } = await supabase
      .from('supplier_orders')
      .select('supplier_cost, quantity')
      .eq('aura_order_id', id);

    if (supplierOrders && supplierOrders.length > 0) {
      total_supplier_cost = supplierOrders.reduce((sum, o) => sum + (o.supplier_cost * o.quantity), 0);
    }
  } catch (e) {
    logger.warn({ msg: 'Error fetching supplier costs', order_id: id, err: String(e) });
  }

  // Calculate fees
  const paystack_fee = grand_total * PAYSTACK_COMMISSION_RATE;
  const gross_profit = grand_total - total_supplier_cost;
  const platform_fee = gross_profit * PLATFORM_COMMISSION_RATE;
  const net_revenue = grand_total - paystack_fee - platform_fee;
  const supplier_payout = total_supplier_cost;
  const aura_net = net_revenue - supplier_payout;

  return {
    order_id: id,
    gross_total: grand_total,
    supplier_cost: total_supplier_cost,
    paystack_fee: Math.round(paystack_fee * 100) / 100,
    platform_fee: Math.round(platform_fee * 100) / 100,
    net_revenue: Math.round(net_revenue * 100) / 100,
    supplier_payout: Math.round(supplier_payout * 100) / 100,
    aura_net: Math.round(aura_net * 100) / 100
  };
}

/**
 * Create ledger entries for daily settlement
 */
async function createSettlementLedger(date, period_orders) {
  try {
    const ledgerEntries = [];
    let totals = {
      gross: 0,
      paystack_fees: 0,
      platform_fees: 0,
      supplier_costs: 0,
      net: 0
    };

    for (const order of period_orders) {
      const financials = await calculateOrderFinancials(order);
      totals.gross += financials.gross_total;
      totals.paystack_fees += financials.paystack_fee;
      totals.platform_fees += financials.platform_fee;
      totals.supplier_costs += financials.supplier_cost;
      totals.net += financials.aura_net;

      ledgerEntries.push({
        date: date,
        entry_type: 'order_revenue',
        order_id: order.id,
        description: `Revenue from order ${order.order_number}`,
        amount: financials.aura_net,
        category: 'revenue',
        currency: order.currency || 'NGN'
      });

      if (financials.paystack_fee > 0) {
        ledgerEntries.push({
          date: date,
          entry_type: 'payment_processor_fee',
          order_id: order.id,
          description: `Paystack fee for order ${order.order_number}`,
          amount: -financials.paystack_fee,
          category: 'expense',
          currency: order.currency || 'NGN'
        });
      }

      if (financials.platform_fee > 0) {
        ledgerEntries.push({
          date: date,
          entry_type: 'platform_commission',
          order_id: order.id,
          description: `Platform commission for order ${order.order_number}`,
          amount: financials.platform_fee,
          category: 'revenue',
          currency: order.currency || 'NGN'
        });
      }

      if (financials.supplier_payout > 0) {
        ledgerEntries.push({
          date: date,
          entry_type: 'supplier_payout',
          order_id: order.id,
          description: `Supplier cost for order ${order.order_number}`,
          amount: -financials.supplier_payout,
          category: 'expense',
          currency: order.currency || 'NGN'
        });
      }
    }

    // Insert ledger entries in batch
    if (ledgerEntries.length > 0) {
      const { error: insertErr } = await supabase
        .from('financial_ledger')
        .insert(ledgerEntries);

      if (insertErr) {
        logger.error({ msg: 'Failed to insert ledger entries', err: String(insertErr) });
        return { error: String(insertErr) };
      }
    }

    return { success: true, entries: ledgerEntries.length, totals };
  } catch (e) {
    logger.error({ msg: 'Error creating settlement ledger', err: String(e) });
    return { error: String(e) };
  }
}

/**
 * Generate settlement proposal for suppliers
 */
async function generateSupplierSettlement(date) {
  try {
    // Get all supplier orders settled in the period
    const period_start = new Date(date);
    const period_end = new Date(date);
    period_end.setDate(period_end.getDate() + 1);

    const { data: supplierOrders } = await supabase
      .from('supplier_orders')
      .select('*')
      .gte('last_status_update', period_start.toISOString())
      .lt('last_status_update', period_end.toISOString())
      .eq('status', 'delivered');

    if (!supplierOrders || supplierOrders.length === 0) {
      logger.info({ msg: 'No supplier orders settled in period', date });
      return { success: true, proposals: 0, amount: 0 };
    }

    // Group by supplier and calculate totals
    const bySupplier = {};
    for (const order of supplierOrders) {
      const supplier = order.supplier_name;
      if (!bySupplier[supplier]) {
        bySupplier[supplier] = { supplier_name: supplier, amount: 0, order_count: 0, orders: [] };
      }
      bySupplier[supplier].amount += order.supplier_cost * order.quantity;
      bySupplier[supplier].order_count += 1;
      bySupplier[supplier].orders.push(order.id);
    }

    // Create settlement proposals
    const proposals = Object.values(bySupplier).map(entry => ({
      settlement_date: date,
      supplier_name: entry.supplier_name,
      status: 'pending',
      total_amount: Math.round(entry.amount * 100) / 100,
      order_count: entry.order_count,
      details: JSON.stringify({ orders: entry.orders }),
      created_at: new Date().toISOString()
    }));

    const { error: insertErr } = await supabase
      .from('supplier_settlements')
      .insert(proposals);

    if (insertErr) {
      logger.error({ msg: 'Failed to create supplier settlements', err: String(insertErr) });
      return { error: String(insertErr) };
    }

    const totalAmount = proposals.reduce((sum, p) => sum + p.total_amount, 0);
    logger.info({ msg: 'Supplier settlements created', count: proposals.length, total_amount: totalAmount });

    return { success: true, proposals: proposals.length, amount: totalAmount };
  } catch (e) {
    logger.error({ msg: 'Error generating supplier settlements', err: String(e) });
    return { error: String(e) };
  }
}

/**
 * Generate daily reconciliation report
 */
async function generateDailyReport(date) {
  try {
    const dateStr = date.toISOString().split('T')[0];
    const dateStart = `${dateStr}T00:00:00Z`;
    const dateEnd = `${dateStr}T23:59:59Z`;

    // Get orders completed in the period
    const { data: completedOrders } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'paid')
      .gte('created_at', dateStart)
      .lt('created_at', dateEnd);

    if (!completedOrders || completedOrders.length === 0) {
      logger.info({ msg: 'No completed orders in period', date: dateStr });
      return { success: true, report: null };
    }

    // Create settlement ledger
    const ledgerResult = await createSettlementLedger(dateStr, completedOrders);
    if (ledgerResult.error) {
      return { error: ledgerResult.error };
    }

    // Generate supplier settlements
    const settlementResult = await generateSupplierSettlement(dateStr);

    const report = {
      report_date: dateStr,
      orders_count: completedOrders.length,
      ledger_entries: ledgerResult.entries || 0,
      supplier_settlements: settlementResult.proposals || 0,
      totals: ledgerResult.totals
    };

    logger.info({ msg: 'Daily financial report generated', ...report });
    return { success: true, report };
  } catch (e) {
    logger.error({ msg: 'Error generating daily report', err: String(e) });
    return { error: String(e) };
  }
}

/**
 * Main worker loop
 */
async function runFinancialReconciliation() {
  logger.info({ msg: 'Starting financial reconciliation worker' });

  try {
    // Generate report for yesterday (allows time for all orders to settle)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const reportResult = await generateDailyReport(yesterday);

    if (reportResult.error) {
      logger.error({ msg: 'Failed to generate daily report', error: reportResult.error });
    } else {
      logger.info({ msg: 'Financial reconciliation complete', report: reportResult.report });
    }
  } catch (e) {
    logger.error({ msg: 'Financial reconciliation worker error', err: String(e) });
  }
}

// Run immediately if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runFinancialReconciliation().then(() => {
    logger.info({ msg: 'Financial reconciliation worker finished' });
    process.exit(0);
  }).catch(e => {
    logger.error({ msg: 'Financial reconciliation worker crashed', err: String(e) });
    process.exit(1);
  });
}

export { runFinancialReconciliation, calculateOrderFinancials };

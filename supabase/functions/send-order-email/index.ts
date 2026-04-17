import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  orderId?: string;
  type?: 'confirmation' | 'shipped';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      // Soft-fail: log but don't break the order flow
      console.warn('RESEND_API_KEY not configured — email skipped');
      return new Response(JSON.stringify({ skipped: true, reason: 'email_not_configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { orderId, type = 'confirmation' }: Body = await req.json();
    if (!orderId) throw new Error('orderId required');

    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: order, error } = await sb
      .from('orders')
      .select('id, order_number, grand_total, status, shipping_address, tracking_number, carrier, user_id, currency, order_items(product_name, quantity, line_total)')
      .eq('id', orderId)
      .single();
    if (error || !order) throw new Error('Order not found');

    const addr = order.shipping_address as Record<string, string>;
    const customerEmail = (order.shipping_address as Record<string, string>)?.email;
    let toEmail = customerEmail;
    if (!toEmail && order.user_id) {
      const { data: profile } = await sb.from('profiles').select('email').eq('id', order.user_id).maybeSingle();
      toEmail = profile?.email;
    }
    if (!toEmail) throw new Error('No recipient email found');

    const items = (order.order_items || []).map(i =>
      `<tr><td style="padding:8px 0">${i.product_name} × ${i.quantity}</td><td style="text-align:right">${order.currency} ${Number(i.line_total).toLocaleString()}</td></tr>`
    ).join('');

    const subject = type === 'shipped'
      ? `Your AuraCart order ${order.order_number} has shipped`
      : `Order confirmed — ${order.order_number}`;

    const trackingBlock = type === 'shipped' && order.tracking_number
      ? `<p>Tracking: <strong>${order.tracking_number}</strong>${order.carrier ? ` (${order.carrier})` : ''}</p>`
      : '';

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#1a1a1a">
        <h1 style="font-family:Georgia,serif;color:#5C2C0E">AuraCart</h1>
        <h2>${subject}</h2>
        <p>Hi ${addr?.full_name || 'there'},</p>
        <p>${type === 'shipped' ? 'Great news — your order is on its way.' : 'Thank you for your order. We are preparing it now.'}</p>
        ${trackingBlock}
        <table style="width:100%;border-top:1px solid #eee;border-bottom:1px solid #eee;margin:16px 0">
          ${items}
        </table>
        <p style="text-align:right"><strong>Total: ${order.currency} ${Number(order.grand_total).toLocaleString()}</strong></p>
        <p style="color:#777;font-size:12px;margin-top:24px">Quiet luxury, delivered. — AuraCart</p>
      </div>
    `;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'AuraCart <noreply@auracart.com>',
        to: [toEmail],
        subject,
        html,
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Resend error: ${txt}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('send-order-email error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

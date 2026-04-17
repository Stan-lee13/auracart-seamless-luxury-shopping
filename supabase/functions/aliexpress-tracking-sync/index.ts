import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function md5Sign(params: Record<string, string>, secret: string) {
  const keys = Object.keys(params).sort();
  let q = secret;
  for (const k of keys) q += k + params[k];
  q += secret;
  const buf = await crypto.subtle.digest("MD5", new TextEncoder().encode(q));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function callTop(method: string, params: Record<string, string>, appKey: string, appSecret: string, session: string) {
  const ts = new Date().toISOString().replace('T', ' ').replace(/\..+/, '');
  const payload: Record<string, string> = { method, app_key: appKey, timestamp: ts, format: 'json', v: '2.0', sign_method: 'md5', session, ...params };
  payload.sign = await md5Sign(payload, appSecret);
  const r = await fetch("https://gw.api.taobao.com/router/rest", {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams(payload).toString(),
  });
  const data = await r.json();
  return data[method.replaceAll('.', '_') + '_response'] || data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: tokensRow } = await sb.from('settings').select('value').eq('key', 'aliexpress_tokens').maybeSingle();
    const { data: configRow } = await sb.from('settings').select('value').eq('key', 'aliexpress_config').maybeSingle();
    const tokens = tokensRow?.value as { access_token?: string } | null;
    const config = configRow?.value as { app_key?: string; app_secret?: string } | null;
    const accessToken = tokens?.access_token;
    const appKey = config?.app_key || Deno.env.get('ALIEXPRESS_APP_KEY');
    const appSecret = config?.app_secret || Deno.env.get('ALIEXPRESS_APP_SECRET');

    if (!accessToken || !appKey || !appSecret) {
      throw new Error('AliExpress not configured');
    }

    // Find orders that have an AliExpress order ID but no tracking number yet
    const { data: orders, error: ordersErr } = await sb
      .from('orders')
      .select('id, aliexpress_order_id, status')
      .not('aliexpress_order_id', 'is', null)
      .is('tracking_number', null)
      .in('status', ['sent_to_supplier', 'fulfilled']);

    if (ordersErr) throw ordersErr;

    const results: Array<{ order_id: string; tracking?: string; carrier?: string; error?: string }> = [];

    for (const order of orders || []) {
      const aliId = (order.aliexpress_order_id || '').split(',')[0].trim();
      if (!aliId) continue;
      try {
        const resp = await callTop('aliexpress.logistics.ds.trackinginfo.query', {
          ae_order_id: aliId,
          language: 'en_US',
        }, appKey, appSecret, accessToken);

        const r = resp as Record<string, unknown>;
        const result = r.result as { tracking_number?: string; logistics_no?: string; carrier_name?: string; official_website?: string } | undefined;
        const tracking = result?.tracking_number || result?.logistics_no;
        const carrier = result?.carrier_name;

        if (tracking) {
          await sb.from('orders').update({
            tracking_number: tracking,
            carrier: carrier || null,
            status: 'shipped',
            shipped_at: new Date().toISOString(),
          }).eq('id', order.id);
          results.push({ order_id: order.id, tracking, carrier });
        } else {
          results.push({ order_id: order.id, error: 'No tracking yet' });
        }
      } catch (err) {
        results.push({ order_id: order.id, error: err instanceof Error ? err.message : String(err) });
      }
      await new Promise(r => setTimeout(r, 200));
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

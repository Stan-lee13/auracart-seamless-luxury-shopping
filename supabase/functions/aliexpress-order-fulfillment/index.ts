import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * TOP Protocol Signer (MD5)
 */
async function generateTopSign(params: Record<string, string>, secret: string) {
    const keys = Object.keys(params).sort();
    let query = secret;
    for (const key of keys) {
        query += key + params[key];
    }
    query += secret;
    const msgUint8 = new TextEncoder().encode(query);
    const hashBuffer = await crypto.subtle.digest("MD5", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function executeAliApi(method: string, params: Record<string, string>, appKey: string, appSecret: string, session?: string) {
    const GATEWAY = "https://gw.api.taobao.com/router/rest";
    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const payload: Record<string, string> = { method, app_key: appKey, timestamp, format: "json", v: "2.0", sign_method: "md5", ...params };
    if (session) payload.session = session;
    payload.sign = await generateTopSign(payload, appSecret);
    const response = await fetch(GATEWAY, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: new URLSearchParams(payload).toString(),
    });
    const data = await response.json();
    return data[method.replaceAll(".", "_") + "_response"] || data;
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { orderId } = await req.json();

        // 1. Get Order and Tokens
        const { data: order, error: orderErr } = await supabaseClient
            .from('orders')
            .select('*, order_items(*)')
            .eq('id', orderId)
            .single();

        if (orderErr || !order) throw new Error("Order not found: " + (orderErr?.message || orderId));

        const { data: aliTokens } = await supabaseClient.from('settings').select('value').eq('key', 'aliexpress_tokens').single();
        const { data: aliConfig } = await supabaseClient.from('settings').select('value').eq('key', 'aliexpress_config').single();

        const tokenValue = aliTokens?.value as Record<string, unknown> | null;
        const configValue = aliConfig?.value as Record<string, unknown> | null;
        
        const accessToken = typeof tokenValue?.access_token === 'string' ? tokenValue.access_token : undefined;
        const appKey = (typeof configValue?.app_key === 'string' ? configValue.app_key : undefined) || Deno.env.get("ALIEXPRESS_APP_KEY");
        const appSecret = (typeof configValue?.app_secret === 'string' ? configValue.app_secret : undefined) || Deno.env.get("ALIEXPRESS_APP_SECRET");

        if (!accessToken || !appKey || !appSecret) throw new Error("AliExpress integration not configured. Missing tokens or keys.");

        const addr = order.shipping_address as Record<string, unknown>;

        // 2. Map Items using aliexpress_product_id from products table
        const productItems = [];
        for (const item of (order.order_items || [])) {
            if (!item.product_id) continue;
            
            const { data: product } = await supabaseClient
                .from('products')
                .select('aliexpress_product_id')
                .eq('id', item.product_id)
                .single();

            const aliId = product?.aliexpress_product_id;

            if (aliId) {
                productItems.push({
                    product_id: parseInt(aliId),
                    product_count: item.quantity,
                });
            }
        }

        if (productItems.length === 0) {
            return new Response(JSON.stringify({ message: "No AliExpress products in order." }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 3. Construct PlaceOrderRequest
        const orderRequest = {
            logistics_address: {
                contact_person: addr.full_name || '',
                address: addr.street_address || '',
                city: addr.city || '',
                province: addr.state || '',
                country: addr.country || 'NG',
                mobile_no: addr.phone || '',
                zip: addr.postal_code || ''
            },
            product_items: productItems
        };

        // 4. Place Order on AliExpress
        const result = await executeAliApi("aliexpress.trade.buy.placeorder", {
            param_place_order_request4_open_api_dto: JSON.stringify(orderRequest)
        }, appKey, appSecret, accessToken);

        if (result.is_success) {
            const aliOrderIds = result.order_list?.number_list || [];
            
            // Update order with AliExpress order ID
            await supabaseClient.from('orders').update({
                aliexpress_order_id: aliOrderIds.join(','),
                status: 'sent_to_supplier',
                sent_to_supplier_at: new Date().toISOString(),
            }).eq('id', orderId);

            // Kick off async tracking sync (non-blocking)
            supabaseClient.functions.invoke('aliexpress-tracking-sync', { body: {} })
              .catch(err => console.error('tracking sync trigger failed:', err));

            return new Response(JSON.stringify({ success: true, ali_orders: aliOrderIds }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        } else {
            throw new Error(`AliExpress Order Failed: ${result.error_msg || JSON.stringify(result)}`);
        }

    } catch (err: unknown) {
        console.error("Order Fulfillment Error:", err);
        const message = err instanceof Error ? err.message : "Unknown Error";
        return new Response(JSON.stringify({ error: message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});

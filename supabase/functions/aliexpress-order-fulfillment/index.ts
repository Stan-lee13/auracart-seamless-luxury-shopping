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
        const { data: order } = await supabaseClient.from('orders').select('*, order_items(*)').eq('id', orderId).single();
        const { data: aliTokens } = await supabaseClient.from('settings').select('value').eq('key', 'aliexpress_tokens').single();
        const { data: aliConfig } = await supabaseClient.from('settings').select('value').eq('key', 'aliexpress_config').single();

        const accessToken = aliTokens?.value?.access_token;
        const appKey = aliConfig?.value?.app_key || Deno.env.get("ALIEXPRESS_APP_KEY");
        const appSecret = aliConfig?.value?.app_secret || Deno.env.get("ALIEXPRESS_APP_SECRET");

        if (!order || !accessToken || !appKey) throw new Error("Order or Integration not found.");

        const addr = order.shipping_address;

        // 2. Map Items (We need the original aliexpress IDs stored in product metadata)
        const productItems = [];
        for (const item of order.order_items) {
            const { data: product } = await supabaseClient.from('products').select('metadata').eq('id', item.product_id).single();
            const aliId = product?.metadata?.aliexpress_id;

            if (aliId) {
                productItems.push({
                    product_id: parseInt(aliId),
                    product_count: item.quantity,
                    // Optional: logistics_service_name: "AliExpress Selection Standard"
                });
            }
        }

        if (productItems.length === 0) {
            return new Response(JSON.stringify({ message: "No AliExpress products in order." }), { headers: corsHeaders });
        }

        // 3. Construct PlaceOrderRequest4OpenApiDto
        const orderRequest = {
            logistics_address: {
                contact_person: addr.full_name,
                address: addr.street_address,
                city: addr.city,
                province: addr.state,
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
            // Store AliExpress Order IDs in our system
            await supabaseClient.from('orders').update({
                aliexpress_order_ids: result.order_list.number_list,
                fulfillment_status: 'fulfilled'
            }).eq('id', orderId);

            return new Response(JSON.stringify({ success: true, ali_orders: result.order_list.number_list }), { headers: corsHeaders });
        } else {
            throw new Error(`AliExpress Order Placement Failed: ${result.error_msg}`);
        }

    } catch (err: unknown) {
        console.error("Order Fulfillment Error:", err);
        const message = err instanceof Error ? err.message : "Unknown Error";
        return new Response(JSON.stringify({ error: message }), { headers: corsHeaders, status: 500 });
    }
});

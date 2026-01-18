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

/**
 * Execute AliExpress API call via TOP Gateway
 */
async function executeAliApi(method: string, params: Record<string, string>, appKey: string, appSecret: string, session?: string) {
    const GATEWAY = "https://gw.api.taobao.com/router/rest";
    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''); // yyyy-MM-dd HH:mm:ss

    const payload: Record<string, string> = {
        method,
        app_key: appKey,
        timestamp,
        format: "json",
        v: "2.0",
        sign_method: "md5",
        ...params
    };
    if (session) payload.session = session;

    payload.sign = await generateTopSign(payload, appSecret);

    const response = await fetch(GATEWAY, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: new URLSearchParams(payload).toString(),
    });

    const data = await response.json();
    const responseKey = method.replaceAll(".", "_") + "_response";

    if (data.error_response) {
        throw new Error(`AliExpress API Error: ${JSON.stringify(data.error_response)}`);
    }

    return data[responseKey] || data;
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 1. Get Integration Data
        const { data: aliTokens } = await supabaseClient.from('settings').select('value').eq('key', 'aliexpress_tokens').single();
        const { data: aliConfig } = await supabaseClient.from('settings').select('value').eq('key', 'aliexpress_config').single();

        const accessToken = aliTokens?.value?.access_token;
        const appKey = aliConfig?.value?.app_key || Deno.env.get("ALIEXPRESS_APP_KEY");
        const appSecret = aliConfig?.value?.app_secret || Deno.env.get("ALIEXPRESS_APP_SECRET");

        if (!accessToken || !appKey || !appSecret) {
            throw new Error("AliExpress not fully configured. Ensure App Key, Secret, and Connection are established.");
        }

        const { categoryId, limit = 20 } = await req.json();

        // 2. Determine Categories to sync
        let categories = [];
        if (categoryId) {
            const { data } = await supabaseClient.from('categories').select('*').eq('id', categoryId).single();
            if (data) categories = [data];
        } else {
            const { data } = await supabaseClient.from('categories').select('*').eq('is_active', true).limit(5);
            categories = data || [];
        }

        let totalImported = 0;

        // 3. Sync Logic using Dropshipper APIs
        for (const cat of categories) {
            console.log(`Pulling bestsellers for category: ${cat.name}`);

            // Use aliexpress.ds.recommend.feed.get for high quality dropshipping items
            const feedData = await executeAliApi("aliexpress.ds.recommend.feed.get", {
                feed_name: "DS bestseller",
                category_id: cat.aliexpress_id || "",
                page_size: Math.min(limit, 50).toString(),
                target_currency: "USD",
                target_language: "en"
            }, appKey, appSecret, accessToken);

            const productCandidates = feedData.result?.products?.promotion_product_dto || [];

            for (const candidate of productCandidates) {
                try {
                    // Fetch FULL details (Required for SKUs and better descriptions)
                    // Method: aliexpress.ds.product.get
                    const details = await executeAliApi("aliexpress.ds.product.get", {
                        product_id: candidate.product_id.toString(),
                        local_language: "en",
                        local_currency: "USD"
                    }, appKey, appSecret, accessToken);

                    const product = details.result;
                    if (!product) continue;

                    // Map to AuraCart Schema
                    const productToInsert = {
                        name: product.ae_item_base_info_dto.subject,
                        description: product.ae_item_base_info_dto.subject, // Full description involves more calls, subject is safe
                        customer_price: parseFloat(product.ae_item_sku_info_dtos[0]?.sku_price || "0"),
                        images: product.ae_multimedia_info_dto.image_urls.split(";"),
                        category_id: cat.id,
                        stock_quantity: parseInt(product.ae_item_sku_info_dtos[0]?.ipm_sku_stock || "50"),
                        is_active: true,
                        slug: `ae-${product.ae_item_base_info_dto.product_id}`,
                        metadata: {
                            aliexpress_id: product.ae_item_base_info_dto.product_id,
                            avg_rating: product.ae_item_base_info_dto.avg_evaluation_rating,
                            reviews_count: product.ae_item_base_info_dto.evaluation_count,
                            store_info: product.ae_store_info_dto
                        }
                    };

                    const { error } = await supabaseClient
                        .from('products')
                        .upsert(productToInsert, { onConflict: 'slug' });

                    if (!error) totalImported++;

                } catch (prodErr: unknown) {
                    const errMessage = prodErr instanceof Error ? prodErr.message : String(prodErr);
                    console.error(`Failed to import individual product ${candidate.product_id}:`, errMessage);
                }
            }
        }

        return new Response(JSON.stringify({
            success: true,
            imported: totalImported,
            categories: categories.length
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: any) {
        console.error("Import Products Error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500
        });
    }
});

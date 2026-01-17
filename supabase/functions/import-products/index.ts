import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 1. Get Tokens
        const { data: settings } = await supabaseClient
            .from('settings')
            .select('value')
            .eq('key', 'aliexpress_tokens')
            .single();

        if (!settings?.value?.access_token) {
            throw new Error("AliExpress not connected. Please connect via Admin > Suppliers.");
        }

        const { access_token } = settings.value;
        const { categoryId, limit = 20 } = await req.json();

        // 2. Fetch Categories
        let categoriesToImport = [];
        if (categoryId) {
            const { data: cat } = await supabaseClient.from('categories').select('*').eq('id', categoryId).single();
            if (cat) categoriesToImport = [cat];
        } else {
            const { data: cats } = await supabaseClient
                .from('categories')
                .select('*')
                .eq('is_active', true);
            categoriesToImport = cats || [];
        }

        let totalImported = 0;
        const appKey = Deno.env.get("ALIEXPRESS_APP_KEY");

        // 3. Iterate and Import using Real API
        for (const cat of categoriesToImport) {
            console.log(`Fetching real products for category: ${cat.name}`);

            // Real API Call (Affiliate Product Query)
            const response = await fetch("https://api-sg.aliexpress.com/sync", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                },
                body: new URLSearchParams({
                    method: "aliexpress.affiliate.product.query",
                    app_key: appKey ?? "",
                    session: access_token,
                    timestamp: new Date().toISOString().replace(/\.\d+Z$/, '+0000'),
                    sign_method: "sha256",
                    keywords: cat.name,
                    category_ids: cat.aliexpress_id || "",
                    target_currency: "USD",
                    target_language: "EN",
                    page_size: limit.toString(),
                }),
            });

            if (!response.ok) {
                console.error(`API Request failed for ${cat.name}: ${response.statusText}`);
                continue;
            }

            const data = await response.json();

            if (data.error_response) {
                console.error(`AliExpress API Error for ${cat.name}: ${JSON.stringify(data.error_response)}`);
                // We keep going for other categories instead of crashing entire process
                continue;
            }

            const products = data.resp_result?.result?.products?.product || [];

            for (const p of products) {
                // Map Real API Data to Our Schema
                const productData = {
                    name: p.product_title,
                    customer_price: parseFloat(p.target_sale_price || p.sale_price),
                    description: p.product_description || p.product_title,
                    images: [p.product_main_image_url, ...(p.product_small_image_urls?.string || [])],
                    category_id: cat.id,
                    is_active: true,
                    stock_quantity: 100, // Default for dropshipping
                    slug: `${cat.slug}-${p.product_id}`,
                    supplier_id: p.shop_id?.toString(),
                    metadata: {
                        aliexpress_id: p.product_id,
                        original_price: p.original_price,
                        discount: p.discount,
                        affiliate_url: p.promotion_link
                    }
                };

                const { error } = await supabaseClient
                    .from('products')
                    .upsert(productData, { onConflict: 'slug' });

                if (!error) totalImported++;
            }
        }

        return new Response(
            JSON.stringify({
                message: "Import execution completed",
                productsImported: totalImported,
                categoriesProcessed: categoriesToImport.length
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error?.message || 'Unknown Error' }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 500,
            }
        );
    }
});

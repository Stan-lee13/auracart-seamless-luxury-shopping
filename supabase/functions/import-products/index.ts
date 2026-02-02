import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  access_token_expires_at?: string;
  account?: string;
}

interface AliExpressConfig {
  app_key?: string;
  app_secret?: string;
}

/**
 * TOP Protocol Signer (MD5)
 */
async function generateTopSign(params: Record<string, string>, secret: string): Promise<string> {
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
async function executeAliApi(
  method: string, 
  params: Record<string, string>, 
  appKey: string, 
  appSecret: string, 
  session?: string
): Promise<Record<string, unknown>> {
  const GATEWAY = "https://gw.api.taobao.com/router/rest";
  const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

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

/**
 * Check and refresh token if needed
 */
async function ensureValidToken(supabaseClient: SupabaseClient): Promise<TokenData> {
  // Get current tokens
  const { data: tokenRow, error: tokenError } = await supabaseClient
    .from("settings")
    .select("value")
    .eq("key", "aliexpress_tokens")
    .maybeSingle();

  if (tokenError) {
    throw new Error(`Failed to fetch tokens: ${tokenError.message}`);
  }
  
  if (!tokenRow || !tokenRow.value) {
    throw new Error("No AliExpress tokens found. Please authorize first.");
  }

  const tokens = tokenRow.value as TokenData;
  
  // Check if token is close to expiry (within 30 minutes)
  const now = new Date();
  const expiresAt = tokens.access_token_expires_at 
    ? new Date(tokens.access_token_expires_at)
    : null;
  
  const thirtyMinutes = 30 * 60 * 1000;
  const needsRefresh = !expiresAt || (now.getTime() + thirtyMinutes) > expiresAt.getTime();

  if (needsRefresh && tokens.refresh_token) {
    console.log("Token is expiring soon, attempting refresh...");
    
    // Get config for refresh
    const { data: configRow } = await supabaseClient
      .from("settings")
      .select("value")
      .eq("key", "aliexpress_config")
      .maybeSingle();

    const config = (configRow?.value || null) as AliExpressConfig | null;
    const appKey = config?.app_key || Deno.env.get("ALIEXPRESS_APP_KEY");
    const appSecret = config?.app_secret || Deno.env.get("ALIEXPRESS_APP_SECRET");

    if (appKey && appSecret && tokens.refresh_token) {
      try {
        const refreshUrl = "https://api-sg.aliexpress.com/rest/2.0/auth/token/refresh";
        const refreshParams = new URLSearchParams({
          refresh_token: tokens.refresh_token,
          grant_type: "refresh_token",
          client_id: appKey,
          client_secret: appSecret,
        });

        const refreshResponse = await fetch(refreshUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: refreshParams.toString(),
        });

        const refreshData = await refreshResponse.json();

        if (refreshData.access_token) {
          const newExpiresAt = new Date(now.getTime() + (refreshData.expires_in * 1000));
          
          // Update tokens
          const updatedTokens: TokenData = {
            ...tokens,
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token || tokens.refresh_token,
            expires_in: refreshData.expires_in,
            access_token_expires_at: newExpiresAt.toISOString(),
          };

          await supabaseClient
            .from("settings")
            .update({ value: updatedTokens })
            .eq("key", "aliexpress_tokens");

          console.log("Token refreshed successfully!");
          return updatedTokens;
        }
      } catch (refreshErr) {
        console.error("Token refresh failed:", refreshErr);
        // Continue with existing token
      }
    }
  }

  return tokens;
}

serve(async (req: Request) => {
  console.log("=== Import AliExpress Products ===");
  console.log("Method:", req.method);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Ensure we have a valid token (with auto-refresh)
    const tokens = await ensureValidToken(supabaseClient);
    const accessToken = tokens.access_token;

    // Get AliExpress config
    const { data: aliConfig } = await supabaseClient
      .from('settings')
      .select('value')
      .eq('key', 'aliexpress_config')
      .maybeSingle();

    const config = (aliConfig?.value || null) as AliExpressConfig | null;
    const appKey = config?.app_key || Deno.env.get("ALIEXPRESS_APP_KEY");
    const appSecret = config?.app_secret || Deno.env.get("ALIEXPRESS_APP_SECRET");

    if (!accessToken || !appKey || !appSecret) {
      throw new Error("AliExpress not fully configured. Ensure App Key, Secret, and Connection are established.");
    }

    // Parse request body
    let categoryId: string | undefined;
    let limit = 20;
    
    try {
      const body = await req.json();
      categoryId = body.categoryId;
      limit = body.limit || 20;
    } catch {
      // No body or invalid JSON, use defaults
    }

    console.log("Import params:", { categoryId, limit });

    // Determine categories to sync
    interface Category {
      id: string;
      name: string;
      slug?: string;
      aliexpress_id?: string;
    }
    
    let categories: Category[] = [];
    
    if (categoryId) {
      const { data } = await supabaseClient
        .from('categories')
        .select('id, name, slug')
        .eq('id', categoryId)
        .single();
      if (data) {
        categories = [{ id: data.id, name: data.name, slug: data.slug }];
      }
    } else {
      const { data } = await supabaseClient
        .from('categories')
        .select('id, name, slug')
        .eq('is_active', true)
        .limit(5);
      categories = (data || []) as Category[];
    }

    let totalImported = 0;
    const errors: string[] = [];

    // Sync products from AliExpress
    for (const cat of categories) {
      console.log(`Pulling bestsellers for category: ${cat.name}`);

      try {
        // Use aliexpress.ds.recommend.feed.get for high quality dropshipping items
        const feedData = await executeAliApi("aliexpress.ds.recommend.feed.get", {
          feed_name: "DS bestseller",
          category_id: cat.aliexpress_id || "",
          page_size: Math.min(limit, 50).toString(),
          target_currency: "USD",
          target_language: "en"
        }, appKey, appSecret, accessToken);

        interface ProductCandidate {
          product_id: string;
        }
        
        interface FeedResult {
          products?: {
            promotion_product_dto?: ProductCandidate[];
          };
        }
        
        const result = feedData.result as FeedResult | undefined;
        const productCandidates = result?.products?.promotion_product_dto || [];

        console.log(`Found ${productCandidates.length} product candidates`);

        for (const candidate of productCandidates) {
          try {
            // Fetch full details
            const details = await executeAliApi("aliexpress.ds.product.get", {
              product_id: candidate.product_id.toString(),
              local_language: "en",
              local_currency: "USD"
            }, appKey, appSecret, accessToken);

            interface ProductResult {
              ae_item_base_info_dto?: {
                subject: string;
                product_id: string;
                avg_evaluation_rating?: number;
                evaluation_count?: number;
              };
              ae_item_sku_info_dtos?: Array<{
                sku_price?: string;
                ipm_sku_stock?: string;
              }>;
              ae_multimedia_info_dto?: {
                image_urls?: string;
              };
              ae_store_info_dto?: Record<string, unknown>;
            }
            
            const product = details.result as ProductResult | undefined;

            if (!product?.ae_item_base_info_dto) continue;

            const baseInfo = product.ae_item_base_info_dto;
            const skuInfo = product.ae_item_sku_info_dtos?.[0];
            const mediaInfo = product.ae_multimedia_info_dto;

            // Calculate pricing (30% margin)
            const baseCost = parseFloat(skuInfo?.sku_price || "0");
            const shippingCost = 0;
            const bufferFee = 0.5;
            const profitMargin = 0.30;
            const customerPrice = Math.ceil((baseCost + shippingCost + bufferFee) * (1 + profitMargin) * 100) / 100;

            // Map to schema
            const productToInsert = {
              name: baseInfo.subject,
              description: baseInfo.subject,
              base_cost: baseCost,
              shipping_cost: shippingCost,
              buffer_fee: bufferFee,
              profit_margin: profitMargin,
              customer_price: customerPrice,
              images: mediaInfo?.image_urls?.split(";") || [],
              category_id: cat.id,
              stock_quantity: parseInt(skuInfo?.ipm_sku_stock || "50"),
              is_active: true,
              slug: `ae-${baseInfo.product_id}`,
              aliexpress_product_id: baseInfo.product_id.toString(),
            };

            const { error } = await supabaseClient
              .from('products')
              .upsert(productToInsert, { onConflict: 'slug' });

            if (!error) {
              totalImported++;
              console.log(`Imported: ${productToInsert.name.substring(0, 50)}...`);
            } else {
              console.error(`Failed to upsert product:`, error);
            }

          } catch (prodErr: unknown) {
            const errMessage = prodErr instanceof Error ? prodErr.message : String(prodErr);
            console.error(`Failed to import product ${candidate.product_id}:`, errMessage);
            errors.push(`Product ${candidate.product_id}: ${errMessage}`);
          }

          // Rate limiting: wait 200ms between products to respect QPS limits
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (catErr: unknown) {
        const errMessage = catErr instanceof Error ? catErr.message : String(catErr);
        console.error(`Failed to process category ${cat.name}:`, errMessage);
        errors.push(`Category ${cat.name}: ${errMessage}`);
      }
    }

    console.log(`Import complete: ${totalImported} products imported`);

    return new Response(JSON.stringify({
      success: true,
      imported: totalImported,
      categories: categories.length,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("Import Products Error:", error.message);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});

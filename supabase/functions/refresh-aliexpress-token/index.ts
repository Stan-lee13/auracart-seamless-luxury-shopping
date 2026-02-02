import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  access_token_expires_at?: string;
  refresh_token_valid_time?: number;
  refresh_token_expires_at?: string;
  account?: string;
  account_id?: string;
  seller_id?: string;
  user_nick?: string;
  sp?: string;
  updated_at?: string;
}

serve(async (req: Request) => {
  console.log("=== Refresh AliExpress Token ===");
  console.log("Method:", req.method);

  // Handle CORS preflight
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

    // Get current tokens
    console.log("Fetching current tokens...");
    const { data: tokenRow, error: tokenError } = await supabaseClient
      .from("settings")
      .select("value")
      .eq("key", "aliexpress_tokens")
      .maybeSingle();

    if (tokenError) {
      throw new Error(`Failed to fetch tokens: ${tokenError.message}`);
    }

    if (!tokenRow?.value) {
      return new Response(
        JSON.stringify({ success: false, error: "No AliExpress tokens found. Please authorize first." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const tokens = tokenRow.value as TokenData;
    
    // Check if token needs refresh (within 30 minutes of expiry or already expired)
    const now = new Date();
    const expiresAt = tokens.access_token_expires_at 
      ? new Date(tokens.access_token_expires_at)
      : null;
    
    const thirtyMinutes = 30 * 60 * 1000;
    const needsRefresh = !expiresAt || (now.getTime() + thirtyMinutes) > expiresAt.getTime();

    if (!needsRefresh) {
      console.log("Token is still valid, no refresh needed");
      return new Response(
        JSON.stringify({ 
          success: true, 
          refreshed: false, 
          message: "Token is still valid",
          expires_at: tokens.access_token_expires_at 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log("Token needs refresh, proceeding...");

    // Get AliExpress config
    const { data: configRow, error: configError } = await supabaseClient
      .from("settings")
      .select("value")
      .eq("key", "aliexpress_config")
      .maybeSingle();

    if (configError) {
      throw new Error(`Failed to fetch config: ${configError.message}`);
    }

    const config = configRow?.value as { app_key?: string; app_secret?: string } | null;
    const appKey = config?.app_key || Deno.env.get("ALIEXPRESS_APP_KEY");
    const appSecret = config?.app_secret || Deno.env.get("ALIEXPRESS_APP_SECRET");

    if (!appKey || !appSecret) {
      throw new Error("Missing AliExpress credentials");
    }

    if (!tokens.refresh_token) {
      throw new Error("No refresh token available. Please re-authorize AliExpress.");
    }

    // Call AliExpress token refresh endpoint
    const refreshUrl = "https://api-sg.aliexpress.com/rest/2.0/auth/token/refresh";
    
    console.log("Calling AliExpress refresh endpoint...");
    
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

    const refreshText = await refreshResponse.text();
    console.log("Refresh response status:", refreshResponse.status);
    console.log("Refresh response:", refreshText);

    let refreshData;
    try {
      refreshData = JSON.parse(refreshText);
    } catch {
      throw new Error("Invalid response from AliExpress refresh endpoint");
    }

    // Check for errors
    if (refreshData.error_response || refreshData.error) {
      const errorMsg = refreshData.error_response 
        ? JSON.stringify(refreshData.error_response) 
        : (refreshData.error_description || refreshData.error);
      throw new Error(`Token refresh failed: ${errorMsg}`);
    }

    if (!refreshData.access_token) {
      throw new Error("No access token in refresh response");
    }

    console.log("New access token received!");

    // Calculate new expiry timestamps
    const newExpiresAt = new Date(now.getTime() + (refreshData.expires_in * 1000));
    const newRefreshExpiresAt = refreshData.refresh_token_valid_time 
      ? new Date(now.getTime() + (refreshData.refresh_token_valid_time * 1000))
      : tokens.refresh_token_expires_at;

    // Update tokens in database
    const updatedTokens: TokenData = {
      ...tokens,
      access_token: refreshData.access_token,
      refresh_token: refreshData.refresh_token || tokens.refresh_token,
      expires_in: refreshData.expires_in,
      access_token_expires_at: newExpiresAt.toISOString(),
      refresh_token_valid_time: refreshData.refresh_token_valid_time || tokens.refresh_token_valid_time,
      refresh_token_expires_at: typeof newRefreshExpiresAt === 'string' ? newRefreshExpiresAt : newRefreshExpiresAt?.toISOString(),
      updated_at: now.toISOString(),
    };

    const { error: updateError } = await supabaseClient
      .from("settings")
      .update({ 
        value: updatedTokens,
        description: `Refreshed at ${now.toISOString()}` 
      })
      .eq("key", "aliexpress_tokens");

    if (updateError) {
      throw new Error(`Failed to save refreshed tokens: ${updateError.message}`);
    }

    console.log("Tokens refreshed and saved successfully!");

    return new Response(
      JSON.stringify({ 
        success: true, 
        refreshed: true,
        message: "Token refreshed successfully",
        expires_at: newExpiresAt.toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err: unknown) {
    const error = err as Error;
    console.error("Refresh token error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

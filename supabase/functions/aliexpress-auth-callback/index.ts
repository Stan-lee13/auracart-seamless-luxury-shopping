import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  console.log("=== AliExpress Auth Callback Edge Function ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    console.log("Code:", code ? code.substring(0, 10) + "..." : "missing");
    console.log("State:", state);
    console.log("Error param:", errorParam);

    // Handle OAuth errors from AliExpress
    if (errorParam) {
      console.error("AliExpress returned error:", errorParam);
      return new Response(
        JSON.stringify({ success: false, error: `AliExpress Auth Error: ${errorParam}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Validate authorization code
    if (!code) {
      console.error("No authorization code provided");
      return new Response(
        JSON.stringify({ success: false, error: "No authorization code provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get AliExpress config from database
    console.log("Fetching AliExpress config from database...");
    const { data: aliConfig, error: configError } = await supabaseClient
      .from("settings")
      .select("value")
      .eq("key", "aliexpress_config")
      .maybeSingle();

    if (configError) {
      console.error("Error fetching config:", configError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch AliExpress config" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const config = aliConfig?.value as { app_key?: string; app_secret?: string } | null;
    const appKey = config?.app_key || Deno.env.get("ALIEXPRESS_APP_KEY");
    const appSecret = config?.app_secret || Deno.env.get("ALIEXPRESS_APP_SECRET");

    console.log("App Key:", appKey ? "present" : "missing");
    console.log("App Secret:", appSecret ? "present" : "missing");

    if (!appKey || !appSecret) {
      console.error("Missing AliExpress credentials");
      return new Response(
        JSON.stringify({ success: false, error: "AliExpress App Key or Secret not configured. Please save them in Admin → Suppliers first." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Exchange authorization code for access token
    // AliExpress OAuth token endpoint
    const tokenUrl = "https://api-sg.aliexpress.com/rest/2.0/auth/token/create";
    const redirectUri = "https://auracartcom.vercel.app/api/aliexpress/callback";

    console.log("Exchanging code for token at:", tokenUrl);
    console.log("Redirect URI:", redirectUri);

    const tokenParams = new URLSearchParams({
      code: code,
      grant_type: "authorization_code",
      app_key: appKey,
      app_secret: appSecret,
      redirect_uri: redirectUri,
    });

    console.log("Token request params:", {
      code: code.substring(0, 10) + "...",
      grant_type: "authorization_code",
      app_key: appKey.substring(0, 5) + "...",
      redirect_uri: redirectUri,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    const tokenText = await tokenResponse.text();
    console.log("Token response status:", tokenResponse.status);
    console.log("Token response body:", tokenText);

    let tokenData;
    try {
      tokenData = JSON.parse(tokenText);
    } catch (parseErr) {
      console.error("Failed to parse token response:", parseErr);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid response from AliExpress token endpoint" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Check for errors in token response
    if (tokenData.error_response || tokenData.error) {
      const errorMsg = tokenData.error_response 
        ? JSON.stringify(tokenData.error_response) 
        : tokenData.error;
      console.error("AliExpress token exchange failed:", errorMsg);
      return new Response(
        JSON.stringify({ success: false, error: `Token exchange failed: ${errorMsg}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Validate we got an access token
    if (!tokenData.access_token) {
      console.error("No access token in response:", tokenData);
      return new Response(
        JSON.stringify({ success: false, error: "No access token received from AliExpress" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Access token received successfully!");
    console.log("Account:", tokenData.account);
    console.log("Expires in:", tokenData.expires_in, "seconds");

    // Delete existing tokens first
    console.log("Removing existing tokens...");
    await supabaseClient.from("settings").delete().eq("key", "aliexpress_tokens");

    // Save new tokens to database
    console.log("Saving new tokens to database...");
    const { error: saveError } = await supabaseClient.from("settings").insert({
      key: "aliexpress_tokens",
      value: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        refresh_token_valid_time: tokenData.refresh_token_valid_time,
        account: tokenData.account,
        account_id: tokenData.account_id,
        seller_id: tokenData.seller_id,
        user_nick: tokenData.user_nick,
        updated_at: new Date().toISOString(),
      },
      description: `Connected to AliExpress Account: ${tokenData.account || tokenData.user_nick || "Unknown"}`,
    });

    if (saveError) {
      console.error("Failed to save tokens:", saveError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save tokens to database" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log("Tokens saved successfully!");

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        status: "connected",
        account: tokenData.account || tokenData.user_nick || "Connected",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err: unknown) {
    const error = err as Error;
    console.error("Critical error in OAuth callback:", error.message);
    console.error("Stack:", error.stack);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

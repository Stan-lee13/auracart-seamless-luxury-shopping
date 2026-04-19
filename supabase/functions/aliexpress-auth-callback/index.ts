import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Default redirect URI — overridden by the caller's `redirect_uri` body field.
// IMPORTANT: this must match the redirect_uri used during the initial authorize step.
const DEFAULT_REDIRECT_URI = "https://auracart-com.lovable.app/api/aliexpress/callback";

serve(async (req: Request) => {
  console.log("=== AliExpress Auth Callback Edge Function ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let code: string | null = null;
    let state: string | null = null;
    let redirectUri: string = DEFAULT_REDIRECT_URI;

    // Support both GET (query params) and POST (body)
    if (req.method === "GET") {
      const url = new URL(req.url);
      code = url.searchParams.get("code");
      state = url.searchParams.get("state");
      
      const errorParam = url.searchParams.get("error");
      if (errorParam) {
        console.error("AliExpress returned error:", errorParam);
        return new Response(
          JSON.stringify({ success: false, error: `AliExpress Auth Error: ${errorParam}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    } else if (req.method === "POST") {
      try {
        const body = await req.json();
        code = body.code;
        state = body.state;
        redirectUri = body.redirect_uri || DEFAULT_REDIRECT_URI;
        console.log("POST body received:", { code: code?.substring(0, 10) + "...", state, redirectUri });
      } catch (parseErr) {
        console.error("Failed to parse request body:", parseErr);
        return new Response(
          JSON.stringify({ success: false, error: "Invalid request body" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    console.log("Code:", code ? code.substring(0, 10) + "..." : "missing");
    console.log("State:", state);
    console.log("Redirect URI:", redirectUri);

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
        JSON.stringify({ success: false, error: "Server configuration error: Missing Supabase credentials" }),
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
        JSON.stringify({ success: false, error: "Failed to fetch AliExpress config from database" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const config = aliConfig?.value as { app_key?: string; app_secret?: string } | null;
    const appKey = config?.app_key || Deno.env.get("ALIEXPRESS_APP_KEY");
    const appSecret = config?.app_secret || Deno.env.get("ALIEXPRESS_APP_SECRET");

    console.log("App Key:", appKey ? `${appKey.substring(0, 5)}...` : "missing");
    console.log("App Secret:", appSecret ? "present" : "missing");

    if (!appKey || !appSecret) {
      console.error("Missing AliExpress credentials");
      return new Response(
        JSON.stringify({ success: false, error: "AliExpress App Key or Secret not configured. Please save them in Admin → Suppliers first." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Exchange authorization code for access token
    // AliExpress OAuth token endpoint (Singapore gateway)
    const tokenUrl = "https://api-sg.aliexpress.com/rest/2.0/auth/token/create";

    console.log("Exchanging code for token at:", tokenUrl);
    console.log("Using redirect URI:", redirectUri);

    // Build form-encoded body as per AliExpress spec
    const tokenParams = new URLSearchParams({
      code: code,
      grant_type: "authorization_code",
      client_id: appKey,
      client_secret: appSecret,
      redirect_uri: redirectUri,
    });

    console.log("Token request params:", {
      code: code.substring(0, 10) + "...",
      grant_type: "authorization_code",
      client_id: appKey.substring(0, 5) + "...",
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
        JSON.stringify({ success: false, error: "Invalid response from AliExpress token endpoint", raw: tokenText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Check for errors in token response
    if (tokenData.error_response || tokenData.error) {
      const errorMsg = tokenData.error_response 
        ? JSON.stringify(tokenData.error_response) 
        : (tokenData.error_description || tokenData.error);
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
        JSON.stringify({ success: false, error: "No access token received from AliExpress", response: tokenData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Access token received successfully!");
    console.log("Account:", tokenData.account || tokenData.user_nick);
    console.log("Expires in:", tokenData.expires_in, "seconds");
    console.log("Refresh token valid for:", tokenData.refresh_token_valid_time, "seconds");

    // Delete existing tokens first to avoid duplicates
    console.log("Removing existing tokens...");
    await supabaseClient.from("settings").delete().eq("key", "aliexpress_tokens");

    // Calculate expiry timestamps
    const now = new Date();
    const accessTokenExpiresAt = new Date(now.getTime() + (tokenData.expires_in * 1000));
    const refreshTokenExpiresAt = tokenData.refresh_token_valid_time 
      ? new Date(now.getTime() + (tokenData.refresh_token_valid_time * 1000))
      : null;

    // Save new tokens to database
    console.log("Saving new tokens to database...");
    const { error: saveError } = await supabaseClient.from("settings").insert({
      key: "aliexpress_tokens",
      value: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        access_token_expires_at: accessTokenExpiresAt.toISOString(),
        refresh_token_valid_time: tokenData.refresh_token_valid_time,
        refresh_token_expires_at: refreshTokenExpiresAt?.toISOString() || null,
        account: tokenData.account,
        account_id: tokenData.account_id,
        seller_id: tokenData.seller_id,
        user_nick: tokenData.user_nick,
        sp: tokenData.sp,
        updated_at: now.toISOString(),
      },
      description: `Connected to AliExpress Account: ${tokenData.account || tokenData.user_nick || "Unknown"}`,
    });

    if (saveError) {
      console.error("Failed to save tokens:", saveError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to save tokens to database: ${saveError.message}` }),
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
        expires_in: tokenData.expires_in,
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

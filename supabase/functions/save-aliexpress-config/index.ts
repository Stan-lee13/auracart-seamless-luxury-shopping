import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Admin whitelist - these users always have admin access
const ADMIN_EMAILS = ['stanleyvic13@gmail.com', 'stanleyvic14@gmail.com'];

serve(async (req: Request) => {
  console.log("=== Save AliExpress Config ===");
  console.log("Method:", req.method);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Create admin client for database operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No auth header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized: No authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Verify the token using getClaims
    const { data: claimsData, error: claimsError } = await adminClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("Token validation failed:", claimsError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;
    
    console.log("Authenticated user:", userEmail);

    // Check if user is admin
    const isWhitelisted = ADMIN_EMAILS.includes(userEmail?.toLowerCase() || "");

    if (isWhitelisted) {
      // Self-healing: Ensure whitelisted users have the admin role
      console.log(`User ${userEmail} is whitelisted. Ensuring admin role exists.`);
      await adminClient.from('user_roles').upsert(
        { user_id: userId, role: 'admin' }, 
        { onConflict: 'user_id,role' }
      );
    } else {
      // Check database role for non-whitelisted users
      const { data: roleData } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (!roleData) {
        console.error("User is not an admin:", userEmail);
        return new Response(
          JSON.stringify({ error: "Forbidden: Admin access required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      console.error("Invalid JSON body");
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { appKey, appSecret } = body;

    if (!appKey || !appSecret) {
      console.error("Missing appKey or appSecret");
      return new Response(
        JSON.stringify({ error: "App Key and Secret are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Saving config for app key:", appKey.substring(0, 5) + "...");

    // Upsert into settings table using service role (bypasses RLS)
    const { error: upsertError } = await adminClient
      .from('settings')
      .upsert({
        key: 'aliexpress_config',
        value: { app_key: appKey, app_secret: appSecret },
        description: `AliExpress API credentials for ${userEmail}`,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: `Database error: ${upsertError.message}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log(`Config saved successfully by ${userEmail}`);
    return new Response(
      JSON.stringify({ success: true, message: "Configuration saved successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("Save AliExpress Config Error:", error.message, error.stack);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

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
        const url = new URL(req.url);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const state = url.searchParams.get("state"); // Optional validation

        if (error) {
            throw new Error(`AliExpress Auth Error: ${error}`);
        }

        if (!code) {
            throw new Error("No authorization code returned from AliExpress");
        }

        // Exchange code for token
        const appKey = Deno.env.get("ALIEXPRESS_APP_KEY");
        const appSecret = Deno.env.get("ALIEXPRESS_APP_SECRET");
        const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/aliexpress-auth-callback`;

        if (!appKey || !appSecret) {
            throw new Error("Missing AliExpress App Key/Secret in environment variables");
        }

        // Real AliExpress Token Endpoint (Top/IOP)
        // Note: Use the official endpoint. Often it is https://api-sg.aliexpress.com/rest/2.0/auth/token/create or via IOP
        // For standard OAuth:
        const tokenResponse = await fetch("https://api-sg.aliexpress.com/oauth/access_token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                code,
                grant_type: "authorization_code",
                client_id: appKey,
                client_secret: appSecret,
                redirect_uri: redirectUri,
            }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error_response) {
            throw new Error(`Token Exchange Failed: ${JSON.stringify(tokenData.error_response)}`);
        }

        // Store tokens in Supabase
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Save to 'settings' table (key: aliexpress_tokens)
        const { error: dbError } = await supabaseClient
            .from('settings')
            .upsert({
                key: 'aliexpress_tokens',
                value: {
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token,
                    expires_in: tokenData.expires_in,
                    updated_at: new Date().toISOString()
                }
            });

        if (dbError) throw dbError;

        // Redirect to Admin Panel with success
        const adminUrl = "https://auracart-admin.vercel.app/admin/settings?status=success"; // Or localhost if dev
        // Better to use a dynamic Origin or Env var for frontend URL
        // For now, redirect to a generic success page or the known frontend

        return new Response(null, {
            status: 302,
            headers: {
                ...corsHeaders,
                Location: `${req.headers.get("origin") || "http://localhost:5173"}/admin/suppliers?aliexpress=connected`,
            },
        });

    } catch (error: any) {
        console.error("Auth Callback Error:", error);
        return new Response(JSON.stringify({ error: error?.message || 'Unknown Error' }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});

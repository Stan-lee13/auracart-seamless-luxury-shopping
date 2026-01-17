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

        if (error) {
            throw new Error(`AliExpress Auth Error: ${error}`);
        }

        if (!code) {
            throw new Error("No authorization code returned from AliExpress");
        }

        const appKey = Deno.env.get("ALIEXPRESS_APP_KEY");
        const appSecret = Deno.env.get("ALIEXPRESS_APP_SECRET");

        if (!appKey || !appSecret) {
            throw new Error("Missing AliExpress App Key/Secret in environment variables");
        }

        // Official AliExpress Token CREATE endpoint (System Interface)
        // Guidance: /auth/token/create via System Gateway
        const tokenUrl = "https://api-sg.aliexpress.com/rest/2.0/auth/token/create";

        const params = new URLSearchParams({
            code,
            grant_type: "authorization_code",
            client_id: appKey,
            client_secret: appSecret,
        });

        const tokenResponse = await fetch(tokenUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
        });

        const tokenData = await tokenResponse.json();

        // Handle errors in tokenData (AliExpress usually returns it within the body)
        if (tokenData.error_response || tokenData.error) {
            throw new Error(`Token Exchange Failed: ${JSON.stringify(tokenData.error_response || tokenData.error)}`);
        }

        /**
         * Standard Token Response:
         * {
         *   access_token: "...",
         *   refresh_token: "...",
         *   expires_in: 2592000,
         *   refresh_token_valid_time: 15768000000,
         *   account: "...",
         *   ...
         * }
         */

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Save tokens to 'settings' table
        const { error: dbError } = await supabaseClient
            .from('settings')
            .upsert({
                key: 'aliexpress_tokens',
                value: {
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token,
                    expires_in: tokenData.expires_in,
                    refresh_token_valid_time: tokenData.refresh_token_valid_time,
                    account: tokenData.account,
                    updated_at: new Date().toISOString()
                },
                description: 'Official AliExpress Dropshipping API Tokens'
            });

        if (dbError) throw dbError;

        // Success redirect back to the Admin Dashboard
        // Using dynamic origin for flexibility
        const origin = req.headers.get("origin") || "http://localhost:5173";

        return new Response(null, {
            status: 302,
            headers: {
                ...corsHeaders,
                Location: `${origin}/admin/suppliers?status=connected&service=aliexpress`,
            },
        });

    } catch (error: any) {
        console.error("AliExpress Auth Callback Error:", error);
        return new Response(JSON.stringify({
            error: error?.message || 'Unknown Error',
            details: "Please ensure your App Key and Secret are correct and your Redirect URI matches exactly."
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});

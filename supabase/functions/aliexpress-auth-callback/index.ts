import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    const url = new URL(req.url);
    const state = url.searchParams.get("state");
    const siteOrigin = state ? decodeURIComponent(state) : "http://localhost:5173";
    const redirectUrl = new URL(siteOrigin);
    redirectUrl.pathname = "/admin/suppliers";

    try {
        const code = url.searchParams.get("code");
        const errorParam = url.searchParams.get("error");

        if (errorParam) throw new Error(`AliExpress Auth Error: ${errorParam}`);
        if (!code) throw new Error("No authorization code returned from AliExpress");

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 1. Get API Credentials from database (Preferred over ENV since user saves them in UI)
        const { data: aliConfig } = await supabaseClient.from('settings').select('value').eq('key', 'aliexpress_config').maybeSingle();

        const appKey = (aliConfig?.value as any)?.app_key || Deno.env.get("ALIEXPRESS_APP_KEY");
        const appSecret = (aliConfig?.value as any)?.app_secret || Deno.env.get("ALIEXPRESS_APP_SECRET");

        if (!appKey || !appSecret) {
            throw new Error("AliExpress App Key or Secret not found. Please save them in the Admin Panel first.");
        }

        // 2. Exchange Code for Token
        const tokenUrl = "https://api-sg.aliexpress.com/rest/2.0/auth/token/create";
        const params = new URLSearchParams({
            code,
            grant_type: "authorization_code",
            client_id: appKey,
            client_secret: appSecret,
        });

        const tokenResponse = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error_response || tokenData.error) {
            const errDetail = tokenData.error_response ? JSON.stringify(tokenData.error_response) : tokenData.error;
            throw new Error(`Token Exchange Failed: ${errDetail}`);
        }

        // 3. Save tokens to 'settings' table (Using a delete-then-insert approach to be absolutely sure we don't hit duplicate keys)
        await supabaseClient.from('settings').delete().eq('key', 'aliexpress_tokens');

        const { error: dbError } = await supabaseClient
            .from('settings')
            .insert({
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

        // 4. Success Redirect
        redirectUrl.search = "status=connected&service=aliexpress";
        return Response.redirect(redirectUrl.toString(), 302);

    } catch (err: any) {
        console.error("AliExpress Auth Callback Error:", err);
        // Instead of showing a JSON error, we redirect back to the app so the user stays in the mobile UI
        redirectUrl.search = `status=error&error=${encodeURIComponent(err?.message || 'Unknown Error')}`;
        return Response.redirect(redirectUrl.toString(), 302);
    }
});

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
    // State should contain the original URL. Decode it once.
    const siteOrigin = state ? decodeURIComponent(state) : "http://localhost:5173";
    const redirectUrl = new URL(siteOrigin);
    redirectUrl.pathname = "/admin/suppliers";

    try {
        const code = url.searchParams.get("code");
        const errorParam = url.searchParams.get("error");

        if (errorParam) throw new Error(`AliExpress Auth Error: ${errorParam}`);
        if (!code) throw new Error("No authorization code (code) returned from AliExpress.");

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Get saved config
        const { data: aliConfig } = await supabaseClient.from('settings').select('value').eq('key', 'aliexpress_config').maybeSingle();

        const appKey = (aliConfig?.value as any)?.app_key || Deno.env.get("ALIEXPRESS_APP_KEY");
        const appSecret = (aliConfig?.value as any)?.app_secret || Deno.env.get("ALIEXPRESS_APP_SECRET");

        if (!appKey || !appSecret) {
            throw new Error("AliExpress App Key or Secret not found in settings. Please save them first.");
        }

        // Token Exchange
        // For AliExpress Global REST API, the token create endpoint often expects app_key and app_secret
        // instead of client_id/client_secret, and redirect_uri is mandatory if used in the authorize step.
        const tokenUrl = "https://api-sg.aliexpress.com/rest/2.0/auth/token/create";

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const redirectUri = "https://auracartcom.vercel.app/api/aliexpress/callback";

        const params = new URLSearchParams({
            code,
            grant_type: "authorization_code",
            app_key: appKey,
            app_secret: appSecret,
            redirect_uri: redirectUri,
        });

        const tokenResponse = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error_response || tokenData.error) {
            const err = tokenData.error_response ? JSON.stringify(tokenData.error_response) : tokenData.error;
            throw new Error(`AliExpress Token Exchange Failed: ${err}`);
        }

        // Clean up and Save
        console.log("Saving AliExpress tokens for account:", tokenData.account);
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
                description: `Connected to AliExpress Account: ${tokenData.account}`
            });

        if (dbError) throw dbError;

        redirectUrl.searchParams.set("status", "connected");
        return Response.redirect(redirectUrl.toString(), 302);

    } catch (err: any) {
        console.error("Critical Auth Error:", err.message);
        redirectUrl.searchParams.set("status", "error");
        redirectUrl.searchParams.set("error", err.message);
        return Response.redirect(redirectUrl.toString(), 302);
    }
});

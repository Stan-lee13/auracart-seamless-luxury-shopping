import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Verify user is an admin or whitelisted
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Unauthorized");

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
        if (authError || !user) throw new Error("Unauthorized");

        const ADMIN_EMAILS = ['stanleyvic13@gmail.com', 'stanleyvic14@gmail.com'];
        const isWhitelisted = ADMIN_EMAILS.includes(user.email?.toLowerCase() || "");

        // Check role too
        const { data: roleData } = await supabaseClient.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();

        if (!isWhitelisted && !roleData) {
            throw new Error("Unauthorized: Admin access required.");
        }

        const { appKey, appSecret } = await req.json();

        if (!appKey || !appSecret) {
            throw new Error("App Key and Secret are required.");
        }

        // Upsert into settings table using service role (bypasses RLS)
        const { error: upsertError } = await supabaseClient
            .from('settings')
            .upsert({
                key: 'aliexpress_config',
                value: { app_key: appKey, app_secret: appSecret },
                updated_at: new Date().toISOString()
            });

        if (upsertError) throw upsertError;

        return new Response(JSON.stringify({ success: true, message: "Configuration saved successfully" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: any) {
        console.error("Save Ali Config Error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400
        });
    }
});

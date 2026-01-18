import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Verify user is authenticated
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Unauthorized: No auth header" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 401
            });
        }

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
        
        if (authError || !user) {
            console.error("Auth error:", authError);
            return new Response(JSON.stringify({ error: "Unauthorized: Invalid token" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 401
            });
        }

        // Admin whitelist check
        const ADMIN_EMAILS = ['stanleyvic13@gmail.com', 'stanleyvic14@gmail.com'];
        const isWhitelisted = ADMIN_EMAILS.includes(user.email?.toLowerCase() || "");

        if (isWhitelisted) {
            // Self-healing: Ensure whitelisted users have the admin role
            console.log(`User ${user.email} is whitelisted. Ensuring admin role exists.`);
            await supabaseClient.from('user_roles').upsert(
                { user_id: user.id, role: 'admin' }, 
                { onConflict: 'user_id,role' }
            );
        } else {
            // Check database role for non-whitelisted users
            const { data: roleData } = await supabaseClient
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .eq('role', 'admin')
                .maybeSingle();
            
            if (!roleData) {
                return new Response(JSON.stringify({ error: "Unauthorized: Admin access required" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 403
                });
            }
        }

        // Parse request body
        let body;
        try {
            body = await req.json();
        } catch {
            return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400
            });
        }

        const { appKey, appSecret } = body;

        if (!appKey || !appSecret) {
            return new Response(JSON.stringify({ error: "App Key and Secret are required" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400
            });
        }

        // Upsert into settings table using service role (bypasses RLS)
        const { error: upsertError } = await supabaseClient
            .from('settings')
            .upsert({
                key: 'aliexpress_config',
                value: { app_key: appKey, app_secret: appSecret },
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

        if (upsertError) {
            console.error("Upsert error:", upsertError);
            return new Response(JSON.stringify({ error: upsertError.message }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 500
            });
        }

        console.log(`Config saved successfully by ${user.email}`);
        return new Response(JSON.stringify({ success: true, message: "Configuration saved successfully" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200
        });

    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("Save AliExpress Config Error:", error.message, error.stack);
        return new Response(JSON.stringify({
            error: error.message,
            context: "save-aliexpress-config"
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500
        });
    }
});

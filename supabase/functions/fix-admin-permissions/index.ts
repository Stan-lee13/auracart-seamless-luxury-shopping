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

        const ADMIN_EMAILS = ['stanleyvic13@gmail.com', 'stanleyvic14@gmail.com'];

        // Get matching users from auth.users (via select)
        // Since we are using service role, we can query profiles or auth.users if exposed
        // But better is to just run a raw SQL or use the service role to ensure records exist

        console.log("Applying admin role bootstrap...");

        // 1. Ensure user_roles for whitelisted emails
        // We first need the IDs of users with these emails
        const { data: users, error: userError } = await supabaseClient
            .from('profiles')
            .select('id, email')
            .in('email', ADMIN_EMAILS);

        if (userError) throw userError;

        if (!users || users.length === 0) {
            return new Response(JSON.stringify({ message: "No users found in profiles for whitelisted emails. Please sign up first." }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200
            });
        }

        for (const user of users) {
            const { error: roleError } = await supabaseClient
                .from('user_roles')
                .upsert({ user_id: user.id, role: 'admin' }, { onConflict: 'user_id,role' });

            if (roleError) console.error(`Error applying role for ${user.email}:`, roleError);
        }

        // 2. Disable RLS or Fix Policy for settings
        // Since we can't run raw SQL easily via JS client for structural changes (usually)
        // we've ensured the Edge Function itself uses service_role.

        return new Response(JSON.stringify({ success: true, message: `Admin roles applied to ${users.length} users.` }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: any) {
        console.error("Fix Permissions Error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400
        });
    }
});

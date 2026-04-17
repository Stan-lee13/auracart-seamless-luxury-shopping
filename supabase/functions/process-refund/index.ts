import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET) throw new Error("Paystack secret key not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Authenticate caller and require admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");
    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes.user) throw new Error("Unauthorized");

    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userRes.user.id,
      _role: "admin",
    });
    if (roleErr) throw new Error("Role check failed");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const { refund_id } = await req.json();
    if (!refund_id) throw new Error("refund_id is required");

    // Load refund + transaction
    const { data: refund, error: refundErr } = await supabase
      .from("refunds")
      .select("*, transaction:transactions(paystack_reference, amount, currency)")
      .eq("id", refund_id)
      .single();
    if (refundErr || !refund) throw new Error("Refund not found");
    if (refund.status === "completed") {
      return new Response(JSON.stringify({ error: "Refund already completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Find a successful transaction for the order if not linked
    let txReference: string | null = (refund.transaction as { paystack_reference?: string } | null)?.paystack_reference || null;
    if (!txReference) {
      const { data: tx } = await supabase
        .from("transactions")
        .select("paystack_reference")
        .eq("order_id", refund.order_id)
        .eq("status", "success")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      txReference = tx?.paystack_reference || null;
    }
    if (!txReference) throw new Error("No successful transaction found for this order");

    // Mark processing
    await supabase
      .from("refunds")
      .update({ status: "processing" })
      .eq("id", refund_id);

    // Paystack refund call (amount is in kobo)
    const amountKobo = Math.round(Number(refund.refund_amount) * 100);
    const paystackRes = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction: txReference,
        amount: amountKobo,
        merchant_note: refund.reason || "Customer refund",
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      await supabase
        .from("refunds")
        .update({
          status: "failed",
          admin_notes: JSON.stringify({ paystack_error: paystackData.message || paystackData }),
        })
        .eq("id", refund_id);
      throw new Error(paystackData.message || "Paystack refund failed");
    }

    // Mark completed
    await supabase
      .from("refunds")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
        admin_notes: JSON.stringify({ paystack_refund: paystackData.data }),
      })
      .eq("id", refund_id);

    // Update order status
    const isFull = !!refund.is_full_refund;
    await supabase
      .from("orders")
      .update({ status: isFull ? "refunded_full" : "refunded_partial" })
      .eq("id", refund.order_id);

    return new Response(
      JSON.stringify({ success: true, paystack: paystackData.data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    console.error("process-refund error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

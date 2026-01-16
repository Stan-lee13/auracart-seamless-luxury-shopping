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
    if (!PAYSTACK_SECRET) {
      throw new Error("Paystack secret key not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { reference } = await req.json();

    if (!reference) {
      throw new Error("Reference is required");
    }

    // Verify with Paystack
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
      }
    );

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      throw new Error(paystackData.message || "Verification failed");
    }

    const txData = paystackData.data;
    const isSuccess = txData.status === "success";

    // Update transaction record
    const { error: txError } = await supabaseClient
      .from("transactions")
      .update({
        status: isSuccess ? "success" : "failed",
        paystack_transaction_id: txData.id?.toString(),
        payment_method: txData.channel,
        payment_channel: txData.channel,
        bank: txData.authorization?.bank,
        card_type: txData.authorization?.card_type,
        last_four: txData.authorization?.last4,
        paystack_fees: txData.fees ? txData.fees / 100 : null,
        net_amount: txData.amount ? (txData.amount - (txData.fees || 0)) / 100 : null,
        ip_address: txData.ip_address,
        metadata: txData,
      })
      .eq("paystack_reference", reference);

    if (txError) {
      console.error("Transaction update error:", txError);
    }

    // Update order status if payment succeeded
    if (isSuccess) {
      const { error: orderError } = await supabaseClient
        .from("orders")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("order_number", reference);

      if (orderError) {
        console.error("Order update error:", orderError);
      }
    }

    // Get order details
    const { data: order } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("order_number", reference)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        verified: isSuccess,
        order,
        transaction: {
          reference: txData.reference,
          amount: txData.amount / 100,
          currency: txData.currency,
          status: txData.status,
          channel: txData.channel,
          paid_at: txData.paid_at,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Verify payment error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

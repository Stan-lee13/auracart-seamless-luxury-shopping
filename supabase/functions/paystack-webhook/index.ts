import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET) {
      throw new Error("Paystack secret key not configured");
    }

    // Verify webhook signature
    const signature = req.headers.get("x-paystack-signature");
    const body = await req.text();

    if (signature) {
      const hash = createHmac("sha512", PAYSTACK_SECRET)
        .update(body)
        .digest("hex");

      if (hash !== signature) {
        console.error("Invalid webhook signature");
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }
    }

    const event = JSON.parse(body);
    console.log("Received Paystack webhook:", event.event);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check for idempotency - prevent duplicate processing
    const { data: existingEvent } = await supabaseClient
      .from("webhook_events")
      .select("id")
      .eq("event_id", event.data?.id?.toString() || event.data?.reference)
      .single();

    if (existingEvent) {
      console.log("Webhook already processed:", event.data?.id);
      return new Response(
        JSON.stringify({ message: "Already processed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Log the event
    await supabaseClient.from("webhook_events").insert({
      event_id: event.data?.id?.toString() || event.data?.reference || crypto.randomUUID(),
      event_type: event.event,
      payload: event,
    });

    const txData = event.data;
    const reference = txData?.reference;

    switch (event.event) {
      case "charge.success": {
        // Update transaction record
        const { error: txError } = await supabaseClient
          .from("transactions")
          .update({
            status: "success",
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

        // Update order status
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

        // Trigger AliExpress Fulfillment
        try {
          // Fetch the order to get the UUID id (reference is the order_number)
          const { data: order } = await supabaseClient.from("orders").select("id").eq("order_number", reference).single();
          if (order) {
            console.log("Triggering AliExpress fulfillment for order:", order.id);
            await supabaseClient.functions.invoke('aliexpress-order-fulfillment', {
              body: { orderId: order.id }
            });
          }
        } catch (fulfillmentError) {
          console.error("Fulfillment trigger failed (non-fatal for webhook):", fulfillmentError);
        }

        console.log("Payment success processed:", reference);
        break;
      }

      case "charge.failed": {
        // Update transaction and order as failed
        await supabaseClient
          .from("transactions")
          .update({
            status: "failed",
            metadata: txData,
          })
          .eq("paystack_reference", reference);

        console.log("Payment failed processed:", reference);
        break;
      }

      case "transfer.success": {
        // Handle refund transfers
        const refundRef = txData.reference;
        if (refundRef?.startsWith("REFUND-")) {
          await supabaseClient
            .from("refunds")
            .update({
              status: "completed",
              processed_at: new Date().toISOString(),
            })
            .eq("id", refundRef.replace("REFUND-", ""));
        }
        console.log("Transfer success processed:", reference);
        break;
      }

      case "transfer.failed": {
        // Handle failed refund transfers
        const refundRef = txData.reference;
        if (refundRef?.startsWith("REFUND-")) {
          await supabaseClient
            .from("refunds")
            .update({
              status: "failed",
              admin_notes: `Transfer failed: ${txData.reason || "Unknown reason"}`,
            })
            .eq("id", refundRef.replace("REFUND-", ""));
        }
        console.log("Transfer failed processed:", reference);
        break;
      }

      case "dispute.create": {
        // Create dispute record
        const orderId = txData.metadata?.order_id;
        if (orderId) {
          await supabaseClient.from("disputes").insert({
            order_id: orderId,
            paystack_dispute_id: txData.id?.toString(),
            reason: txData.reason,
            customer_claim: txData.message,
            status: "open",
          });
        }
        console.log("Dispute created:", txData.id);
        break;
      }

      case "dispute.resolve": {
        // Update dispute as resolved
        await supabaseClient
          .from("disputes")
          .update({
            status: txData.status,
            resolution: txData.resolution,
            resolved_at: new Date().toISOString(),
            won: txData.status === "resolved" && txData.resolution === "merchant-accepted",
            amount_recovered: txData.status === "resolved" ? txData.amount / 100 : 0,
          })
          .eq("paystack_dispute_id", txData.id?.toString());

        console.log("Dispute resolved:", txData.id);
        break;
      }

      default:
        console.log("Unhandled webhook event:", event.event);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    console.error("Webhook error:", error);

    // Log failure for retry
    try {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const body = await req.clone().text().catch(() => "{}");
      const event = JSON.parse(body);

      await supabaseClient.from("webhook_failures").insert({
        event_id: event.data?.id?.toString() || crypto.randomUUID(),
        event_type: event.event || "unknown",
        payload: event,
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
    } catch (logError) {
      console.error("Failed to log webhook failure:", logError);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

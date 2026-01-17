import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LineItem {
  product_id: string;
  variant_id?: string;
  product_name: string;
  product_image?: string;
  variant_name?: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
}

interface ChargeRequest {
  line_items: LineItem[];
  shipping: number;
  tax: number;
  discount: number;
  currency: string;
  email: string;
  shipping_address: {
    full_name: string;
    street_address: string;
    city: string;
    state: string;
    postal_code?: string;
    country: string;
    phone: string;
  };
  callback_url?: string;
}

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

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
      }
    }

    const body: ChargeRequest = await req.json();
    const { line_items, shipping = 0, tax = 0, discount = 0, currency = "NGN", email, shipping_address, callback_url } = body;

    if (!line_items?.length) {
      throw new Error("No items in cart");
    }

    if (!email) {
      throw new Error("Email is required");
    }

    // Calculate totals
    let subtotal = 0;
    let totalCost = 0;
    
    const orderItems = line_items.map((item) => {
      const lineTotal = item.unit_price * item.quantity;
      const lineCost = item.unit_cost * item.quantity;
      const lineProfit = lineTotal - lineCost;
      
      subtotal += lineTotal;
      totalCost += lineCost;
      
      return {
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        product_name: item.product_name,
        product_image: item.product_image || null,
        variant_name: item.variant_name || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        unit_cost: item.unit_cost,
        line_total: lineTotal,
        line_cost: lineCost,
        line_profit: lineProfit,
      };
    });

    const grandTotal = subtotal + shipping + tax - discount;
    const totalProfit = grandTotal - totalCost - shipping;

    // Generate order number
    const { data: orderNumberData } = await supabaseClient.rpc("generate_order_number");
    const orderNumber = orderNumberData || `AC-${Date.now()}`;

    // Initialize Paystack transaction
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(grandTotal * 100), // Paystack expects kobo
        currency,
        reference: orderNumber,
        callback_url: callback_url || `${req.headers.get("origin")}/order/${orderNumber}`,
        metadata: {
          custom_fields: [
            { display_name: "Order Number", variable_name: "order_number", value: orderNumber },
            { display_name: "Customer", variable_name: "customer_name", value: shipping_address.full_name },
          ],
        },
      }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      throw new Error(paystackData.message || "Failed to initialize payment");
    }

    // Create order in database
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .insert({
        order_number: orderNumber,
        user_id: userId,
        status: "created",
        subtotal,
        shipping_total: shipping,
        tax_total: tax,
        discount_total: discount,
        grand_total: grandTotal,
        total_cost: totalCost,
        total_profit: totalProfit,
        currency,
        shipping_address,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Insert order items
    const itemsWithOrderId = orderItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabaseClient
      .from("order_items")
      .insert(itemsWithOrderId);

    if (itemsError) throw itemsError;

    // Create transaction record
    const { error: transactionError } = await supabaseClient
      .from("transactions")
      .insert({
        order_id: order.id,
        user_id: userId,
        paystack_reference: paystackData.data.reference,
        amount: grandTotal,
        currency,
        status: "pending",
        metadata: {
          paystack_init: paystackData.data,
        },
      });

    if (transactionError) {
      console.error("Transaction insert error:", transactionError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        order,
        authorization_url: paystackData.data.authorization_url,
        reference: paystackData.data.reference,
        access_code: paystackData.data.access_code,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Create charge error:", error);
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClientLineItem {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
}

interface ChargeRequest {
  line_items: ClientLineItem[];
  currency?: string;
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
    if (!PAYSTACK_SECRET) throw new Error("Paystack secret key not configured");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      if (!authError && user) userId = user.id;
    }

    const body: ChargeRequest = await req.json();
    const { line_items, currency = "NGN", email, shipping_address, callback_url } = body;

    if (!line_items?.length) throw new Error("No items in cart");
    if (!email) throw new Error("Email is required");
    if (!shipping_address?.full_name || !shipping_address?.street_address) {
      throw new Error("Shipping address is incomplete");
    }

    // === SERVER-SIDE PRICING (source of truth) ===
    const productIds = [...new Set(line_items.map((i) => i.product_id))];
    const variantIds = [...new Set(line_items.map((i) => i.variant_id).filter(Boolean) as string[])];

    const { data: products, error: productError } = await supabaseClient
      .from("products")
      .select("id, name, customer_price, base_cost, shipping_cost, buffer_fee, thumbnail_url, images, is_active")
      .in("id", productIds);

    if (productError) throw productError;
    if (!products || products.length !== productIds.length) {
      throw new Error("One or more products not found");
    }

    const variantMap = new Map<string, { id: string; name: string; customer_price: number; base_cost: number; shipping_cost: number; buffer_fee: number; product_id: string; is_active: boolean | null }>();
    if (variantIds.length > 0) {
      const { data: variants, error: variantError } = await supabaseClient
        .from("product_variants")
        .select("id, name, customer_price, base_cost, shipping_cost, buffer_fee, product_id, is_active")
        .in("id", variantIds);
      if (variantError) throw variantError;
      (variants || []).forEach((v) => variantMap.set(v.id, v));
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    let totalCost = 0;

    const orderItems = line_items.map((item) => {
      if (!item.quantity || item.quantity < 1) {
        throw new Error("Invalid quantity in cart");
      }
      const product = productMap.get(item.product_id);
      if (!product || product.is_active === false) {
        throw new Error(`Product ${item.product_id} unavailable`);
      }

      let unitPrice: number;
      let unitCost: number;
      let variantName: string | null = null;

      if (item.variant_id) {
        const variant = variantMap.get(item.variant_id);
        if (!variant || variant.is_active === false || variant.product_id !== product.id) {
          throw new Error(`Variant ${item.variant_id} unavailable`);
        }
        unitPrice = Number(variant.customer_price);
        unitCost = Number(variant.base_cost) + Number(variant.shipping_cost) + Number(variant.buffer_fee);
        variantName = variant.name;
      } else {
        unitPrice = Number(product.customer_price);
        unitCost = Number(product.base_cost) + Number(product.shipping_cost) + Number(product.buffer_fee);
      }

      const lineTotal = unitPrice * item.quantity;
      const lineCost = unitCost * item.quantity;
      const lineProfit = lineTotal - lineCost;

      subtotal += lineTotal;
      totalCost += lineCost;

      return {
        product_id: product.id,
        variant_id: item.variant_id || null,
        product_name: product.name,
        product_image: product.thumbnail_url || product.images?.[0] || null,
        variant_name: variantName,
        quantity: item.quantity,
        unit_price: unitPrice,
        unit_cost: unitCost,
        line_total: lineTotal,
        line_cost: lineCost,
        line_profit: lineProfit,
      };
    });

    // Server-determined shipping/tax/discount (no client trust)
    const shipping = subtotal > 50000 ? 0 : 2500;
    const tax = 0;
    const discount = 0;
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
        amount: Math.round(grandTotal * 100),
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

    // Create order
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

    const itemsWithOrderId = orderItems.map((item) => ({ ...item, order_id: order.id }));
    const { error: itemsError } = await supabaseClient
      .from("order_items")
      .insert(itemsWithOrderId);
    if (itemsError) throw itemsError;

    const { error: transactionError } = await supabaseClient
      .from("transactions")
      .insert({
        order_id: order.id,
        user_id: userId,
        paystack_reference: paystackData.data.reference,
        amount: grandTotal,
        currency,
        status: "pending",
        metadata: { paystack_init: paystackData.data },
      });

    if (transactionError) console.error("Transaction insert error:", transactionError);

    return new Response(
      JSON.stringify({
        success: true,
        order,
        authorization_url: paystackData.data.authorization_url,
        reference: paystackData.data.reference,
        access_code: paystackData.data.access_code,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    console.error("Create charge error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    // IMPORTANT: return 200 with structured error so the client receives the real message
    // (supabase.functions.invoke discards body on non-2xx and surfaces a generic FunctionsHttpError).
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const url = new URL(req.url);
    const query = url.searchParams.get("q") || "";
    const category = url.searchParams.get("category") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const sort = url.searchParams.get("sort") || "newest";

    const offset = (page - 1) * limit;

    let dbQuery = supabaseClient
      .from("products")
      .select(`
        *,
        category:categories(*),
        variants:product_variants(*)
      `, { count: "exact" })
      .eq("is_active", true)
      .range(offset, offset + limit - 1);

    // Apply search
    if (query) {
      dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    }

    // Apply category filter
    if (category) {
      const { data: categoryData } = await supabaseClient
        .from("categories")
        .select("id")
        .eq("slug", category)
        .single();
      
      if (categoryData) {
        dbQuery = dbQuery.eq("category_id", categoryData.id);
      }
    }

    // Apply sorting
    switch (sort) {
      case "price-asc":
        dbQuery = dbQuery.order("customer_price", { ascending: true });
        break;
      case "price-desc":
        dbQuery = dbQuery.order("customer_price", { ascending: false });
        break;
      case "name":
        dbQuery = dbQuery.order("name", { ascending: true });
        break;
      default:
        dbQuery = dbQuery.order("created_at", { ascending: false });
    }

    const { data: products, error, count } = await dbQuery;

    if (error) throw error;

    return new Response(
      JSON.stringify({
        products,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          hasNextPage: offset + limit < (count || 0),
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Search error:", error);
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

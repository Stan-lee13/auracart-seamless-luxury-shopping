import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Product = Tables<'products'> & {
  category?: Tables<'categories'> | null;
  variants?: Tables<'product_variants'>[];
};

const PAGE_SIZE = 20;

export function useInfiniteProducts(options?: {
  categorySlug?: string;
  featured?: boolean;
  search?: string;
  sortBy?: 'newest' | 'price-asc' | 'price-desc' | 'name';
}) {
  return useInfiniteQuery({
    queryKey: ['products-infinite', options],
    queryFn: async ({ pageParam = 0 }) => {
<<<<<<< HEAD
      // Use !inner join when filtering by category to ensure we can filter by the joined table
      // and only get products that belong to the category
      const selectQuery = options?.categorySlug
        ? `
          *,
          category:categories!inner(*),
          variants:product_variants(*)
        `
        : `
          *,
          category:categories(*),
          variants:product_variants(*)
        `;

      let query = supabase
        .from('products')
        .select(selectQuery, { count: 'exact' })
=======
      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          variants:product_variants(*)
        `, { count: 'exact' })
>>>>>>> d29cb800a0e23ebba2ad870c7716bda306c9b698
        .eq('is_active', true)
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      // Apply sorting
      switch (options?.sortBy) {
        case 'price-asc':
          query = query.order('customer_price', { ascending: true });
          break;
        case 'price-desc':
          query = query.order('customer_price', { ascending: false });
          break;
        case 'name':
          query = query.order('name', { ascending: true });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      if (options?.featured) {
        query = query.eq('is_featured', true);
      }

      if (options?.categorySlug) {
<<<<<<< HEAD
        // Filter by category slug using the inner joined table
        query = query.eq('category.slug', options.categorySlug);
=======
        // Need to filter by category slug after fetching
        query = query.not('category_id', 'is', null);
>>>>>>> d29cb800a0e23ebba2ad870c7716bda306c9b698
      }

      if (options?.search) {
        query = query.or(`name.ilike.%${options.search}%,description.ilike.%${options.search}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

<<<<<<< HEAD
      return {
        products: data as Product[],
        nextPage: (data?.length || 0) === PAGE_SIZE ? pageParam + 1 : undefined,
        totalCount: count || 0,
      };
    },
    getNextPageParam: (lastPage: { nextPage: number | undefined }) => lastPage.nextPage,
=======
      // Filter by category slug client-side if needed
      let filteredData = data as Product[];
      if (options?.categorySlug) {
        filteredData = filteredData.filter(
          p => p.category?.slug === options.categorySlug
        );
      }

      return {
        products: filteredData,
        nextPage: filteredData.length === PAGE_SIZE ? pageParam + 1 : undefined,
        totalCount: count || 0,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
>>>>>>> d29cb800a0e23ebba2ad870c7716bda306c9b698
    initialPageParam: 0,
  });
}

// Hook for fetching trending products (most viewed/purchased)
export function useTrendingProducts(limit: number = 8) {
  return useInfiniteQuery({
    queryKey: ['products-trending', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          variants:product_variants(*)
        `)
        .eq('is_active', true)
        .eq('is_featured', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { products: data as Product[], nextPage: undefined, totalCount: data?.length || 0 };
    },
    getNextPageParam: () => undefined,
    initialPageParam: 0,
  });
}

// Hook for new arrivals
export function useNewArrivals(limit: number = 8) {
  return useInfiniteQuery({
    queryKey: ['products-new-arrivals', limit],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          variants:product_variants(*)
        `)
        .eq('is_active', true)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { products: data as Product[], nextPage: undefined, totalCount: data?.length || 0 };
    },
    getNextPageParam: () => undefined,
    initialPageParam: 0,
  });
}

// Hook for recommended products based on user interactions
export function useRecommendedProducts(
  categoryIds: string[],
  excludeProductIds: string[] = [],
  limit: number = 8
) {
  return useInfiniteQuery({
    queryKey: ['products-recommended', categoryIds, excludeProductIds, limit],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          variants:product_variants(*)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (categoryIds.length > 0) {
        query = query.in('category_id', categoryIds);
      }

      if (excludeProductIds.length > 0) {
        query = query.not('id', 'in', `(${excludeProductIds.join(',')})`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { products: data as Product[], nextPage: undefined, totalCount: data?.length || 0 };
    },
    getNextPageParam: () => undefined,
    initialPageParam: 0,
    enabled: true,
  });
}

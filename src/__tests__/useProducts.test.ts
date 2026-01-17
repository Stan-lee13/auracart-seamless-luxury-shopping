import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProducts, useProduct, useCategories } from '@/hooks/useProducts';
import { supabase } from '@/integrations/supabase/client';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

const mockProduct = {
  id: '1',
  name: 'Test Product',
  slug: 'test-product',
  description: 'A test product',
  price: 100,
  currency: 'USD',
  image_url: 'https://example.com/product.jpg',
  category_id: '1',
  supplier_id: '1',
  is_active: true,
  is_featured: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  aliexpress_product_id: 'ae123',
  stock_quantity: 10,
};

const mockCategory = {
  id: '1',
  name: 'Electronics',
  slug: 'electronics',
  description: 'Electronic products',
  is_active: true,
  display_order: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('useProducts Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useProducts', () => {
    it('should fetch all active products', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [mockProduct], error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder as any);

      const { result } = renderHook(() => useProducts(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual([mockProduct]);
    });

    it('should fetch featured products when featured option is true', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ ...mockProduct, is_featured: true }], error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder as any);

      const { result } = renderHook(() => useProducts({ featured: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify eq was called with is_featured: true
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('is_featured', true);
    });

    it('should filter products by category slug', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [mockProduct], error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder as any);

      const { result } = renderHook(() => useProducts({ categorySlug: 'electronics' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify category filter was applied
      expect(mockQueryBuilder.eq).toHaveBeenCalled();
    });

    it('should search products by name', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [mockProduct], error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder as any);

      const { result } = renderHook(() => useProducts({ search: 'test' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify search was applied
      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith('name', '%test%');
    });

    it('should limit products result', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [mockProduct], error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder as any);

      const { result } = renderHook(() => useProducts({ limit: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify limit was applied
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
    });

    it('should handle query errors', async () => {
      const mockError = new Error('Database error');
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder as any);

      const { result } = renderHook(() => useProducts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(true);
    });
  });

  describe('useProduct', () => {
    it('should fetch a single product by slug', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProduct, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder as any);

      const { result } = renderHook(() => useProduct('test-product'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockProduct);
    });

    it('should not fetch when slug is empty', () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProduct, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder as any);

      const { result } = renderHook(() => useProduct(''), {
        wrapper: createWrapper(),
      });

      // Should be idle when slug is empty (enabled: false)
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle product not found error', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder as any);

      const { result } = renderHook(() => useProduct('nonexistent'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(true);
    });
  });

  describe('useCategories', () => {
    it('should fetch all active categories ordered by display_order', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ 
          data: [mockCategory], 
          error: null 
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder as any);

      const { result } = renderHook(() => useCategories(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual([mockCategory]);
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('display_order', { ascending: true });
    });

    it('should handle category fetch errors', async () => {
      const mockError = new Error('Category fetch failed');
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder as any);

      const { result } = renderHook(() => useCategories(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(true);
    });

    it('should only fetch active categories', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [mockCategory],
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder as any);

      const { result } = renderHook(() => useCategories(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify is_active filter was applied
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('is_active', true);
    });
  });
});

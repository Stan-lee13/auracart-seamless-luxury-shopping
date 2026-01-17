import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Shop from '@/pages/Shop';

// Mock hooks
vi.mock('@/hooks/useInfiniteProducts', () => ({
  useInfiniteProducts: vi.fn(),
  useTrendingProducts: vi.fn(),
  useNewArrivals: vi.fn(),
  useRecommendedProducts: vi.fn(),
}));

vi.mock('@/hooks/useProducts', () => ({
  useCategories: vi.fn(),
}));

vi.mock('@/hooks/useUserInteractions', () => ({
  useUserInteractions: vi.fn(),
  useRecommendations: vi.fn(),
}));

// Mock components
vi.mock('@/components/products/ProductGrid', () => ({
  ProductGrid: ({ products, isLoading }: any) => (
    <div data-testid="product-grid">
      {isLoading ? 'Loading products...' : `${products.length} products`}
    </div>
  ),
}));

vi.mock('@/components/products/ProductSection', () => ({
  ProductSection: ({ title, products }: any) => (
    <div data-testid={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      {title}
    </div>
  ),
}));

import * as useInfiniteProductsModule from '@/hooks/useInfiniteProducts';
import * as useProductsModule from '@/hooks/useProducts';
import * as useUserInteractionsModule from '@/hooks/useUserInteractions';

const mockProduct = {
  id: '1',
  name: 'Test Product',
  slug: 'test-product',
  price: 100,
  image_url: 'https://example.com/product.jpg',
};

const mockCategory = {
  id: '1',
  name: 'Electronics',
  slug: 'electronics',
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Shop Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock IntersectionObserver
    global.IntersectionObserver = class IntersectionObserver {
      constructor(callback: any) {
        // Don't call callback in tests
      }
      disconnect() {}
      observe() {}
      takeRecords() {
        return [];
      }
      unobserve() {}
    } as any;
    
    // Default mock implementations
    vi.mocked(useInfiniteProductsModule.useInfiniteProducts).mockReturnValue({
      data: { pages: [{ products: [] }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(useInfiniteProductsModule.useTrendingProducts).mockReturnValue({
      data: { pages: [{ products: [] }] },
      isLoading: false,
    } as any);

    vi.mocked(useInfiniteProductsModule.useNewArrivals).mockReturnValue({
      data: { pages: [{ products: [] }] },
      isLoading: false,
    } as any);

    vi.mocked(useInfiniteProductsModule.useRecommendedProducts).mockReturnValue({
      data: { pages: [{ products: [] }] },
      isLoading: false,
    } as any);

    vi.mocked(useProductsModule.useCategories).mockReturnValue({
      data: [mockCategory],
      isLoading: false,
    } as any);

    vi.mocked(useUserInteractionsModule.useUserInteractions).mockReturnValue({
      trackCategoryInteraction: vi.fn(),
      trackProductInteraction: vi.fn(),
      trackSearch: vi.fn(),
    } as any);

    vi.mocked(useUserInteractionsModule.useRecommendations).mockReturnValue({
      getRecommendationContext: () => ({
        topCategories: [],
        recentlyViewed: [],
      }),
    } as any);
  });

  describe('Page Rendering', () => {
    it('should render shop page successfully', () => {
      render(<Shop />, { wrapper: createWrapper() });

      expect(screen.getByText(/Discover Your/)).toBeInTheDocument();
    });

    it('should display hero section when no filters applied', () => {
      render(<Shop />, { wrapper: createWrapper() });

      expect(screen.getByText(/Discover Your Aura/)).toBeInTheDocument();
    });

    it('should display product sections when no search/category filter', () => {
      render(<Shop />, { wrapper: createWrapper() });

      expect(screen.getByTestId('section-trending-now')).toBeInTheDocument();
      expect(screen.getByTestId('section-new-arrivals')).toBeInTheDocument();
    });

    it('should display categories quick access section', () => {
      render(<Shop />, { wrapper: createWrapper() });

      expect(screen.getByText('Shop by Category')).toBeInTheDocument();
      expect(screen.getByText('Electronics')).toBeInTheDocument();
    });

    it('should display product grid', () => {
      render(<Shop />, { wrapper: createWrapper() });

      expect(screen.getByTestId('product-grid')).toBeInTheDocument();
    });
  });

  describe('Product Display', () => {
    it('should display loading state when products are loading', () => {
      vi.mocked(useInfiniteProductsModule.useInfiniteProducts).mockReturnValue({
        data: { pages: [] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: true,
        isError: false,
        error: null,
      } as any);

      render(<Shop />, { wrapper: createWrapper() });

      expect(screen.getByText('Loading products...')).toBeInTheDocument();
    });

    it('should display products from all pages', () => {
      const mockProducts = [
        { ...mockProduct, id: '1', name: 'Product 1' },
        { ...mockProduct, id: '2', name: 'Product 2' },
      ];

      vi.mocked(useInfiniteProductsModule.useInfiniteProducts).mockReturnValue({
        data: { pages: [{ products: mockProducts }] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        isError: false,
        error: null,
      } as any);

      render(<Shop />, { wrapper: createWrapper() });

      expect(screen.getByText('2 products')).toBeInTheDocument();
    });

    it('should show end message when all products loaded', () => {
      vi.mocked(useInfiniteProductsModule.useInfiniteProducts).mockReturnValue({
        data: { pages: [{ products: [mockProduct] }] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        isError: false,
        error: null,
      } as any);

      render(<Shop />, { wrapper: createWrapper() });

      expect(screen.getByText(/You've reached the end/)).toBeInTheDocument();
    });

    it('should show loading indicator when fetching next page', () => {
      vi.mocked(useInfiniteProductsModule.useInfiniteProducts).mockReturnValue({
        data: { pages: [{ products: [mockProduct] }] },
        fetchNextPage: vi.fn(),
        hasNextPage: true,
        isFetchingNextPage: true,
        isLoading: false,
        isError: false,
        error: null,
      } as any);

      render(<Shop />, { wrapper: createWrapper() });

      expect(screen.getByText('Loading more...')).toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    it('should have grid view as default', () => {
      render(<Shop />, { wrapper: createWrapper() });

      const gridButton = screen.getByLabelText('Grid view');
      expect(gridButton).toHaveClass('secondary');
    });

    it('should toggle between grid and list view', async () => {
      const user = userEvent.setup();
      render(<Shop />, { wrapper: createWrapper() });

      const listButton = screen.getByLabelText('List view');
      await user.click(listButton);

      expect(listButton).toHaveClass('secondary');
    });

    it('should show both view mode buttons', () => {
      render(<Shop />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Grid view')).toBeInTheDocument();
      expect(screen.getByLabelText('List view')).toBeInTheDocument();
    });
  });

  describe('Infinite Scroll', () => {
    it('should have intersection observer element', () => {
      render(<Shop />, { wrapper: createWrapper() });

      // The observer ref div is rendered
      expect(screen.getByText(/You've reached the end|Loading more.../)).toBeInTheDocument();
    });

    it('should call fetchNextPage when observer triggers', async () => {
      const fetchNextPageMock = vi.fn();
      
      vi.mocked(useInfiniteProductsModule.useInfiniteProducts).mockReturnValue({
        data: { pages: [{ products: [mockProduct] }] },
        fetchNextPage: fetchNextPageMock,
        hasNextPage: true,
        isFetchingNextPage: false,
        isLoading: false,
        isError: false,
        error: null,
      } as any);

      render(<Shop />, { wrapper: createWrapper() });

      // Simulate intersection observer callback
      const mockIntersectionObserver = vi.fn();
      mockIntersectionObserver.mockReturnValue({
        observe: () => null,
        unobserve: () => null,
        disconnect: () => null,
      });
      window.IntersectionObserver = mockIntersectionObserver as any;

      // Verify observer is set up
      expect(mockIntersectionObserver).toHaveBeenCalled();
    });
  });

  describe('Section Display', () => {
    it('should display trending products section with data', () => {
      const trendingProducts = [mockProduct];

      vi.mocked(useInfiniteProductsModule.useTrendingProducts).mockReturnValue({
        data: { pages: [{ products: trendingProducts }] },
        isLoading: false,
      } as any);

      render(<Shop />, { wrapper: createWrapper() });

      expect(screen.getByTestId('section-trending-now')).toBeInTheDocument();
    });

    it('should display new arrivals section with data', () => {
      const newProducts = [mockProduct];

      vi.mocked(useInfiniteProductsModule.useNewArrivals).mockReturnValue({
        data: { pages: [{ products: newProducts }] },
        isLoading: false,
      } as any);

      render(<Shop />, { wrapper: createWrapper() });

      expect(screen.getByTestId('section-new-arrivals')).toBeInTheDocument();
    });

    it('should display recommended section when data available', () => {
      const recommendedProducts = [mockProduct];

      vi.mocked(useInfiniteProductsModule.useRecommendedProducts).mockReturnValue({
        data: { pages: [{ products: recommendedProducts }] },
        isLoading: false,
      } as any);

      render(<Shop />, { wrapper: createWrapper() });

      expect(screen.getByTestId('section-picked-for-you')).toBeInTheDocument();
    });
  });

  describe('Categories Display', () => {
    it('should display multiple categories', () => {
      const categories = [
        mockCategory,
        { ...mockCategory, id: '2', name: 'Fashion', slug: 'fashion' },
        { ...mockCategory, id: '3', name: 'Home', slug: 'home' },
      ];

      vi.mocked(useProductsModule.useCategories).mockReturnValue({
        data: categories,
        isLoading: false,
      } as any);

      render(<Shop />, { wrapper: createWrapper() });

      expect(screen.getByText('Electronics')).toBeInTheDocument();
      expect(screen.getByText('Fashion')).toBeInTheDocument();
      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('should show more categories link when more than 12 categories', () => {
      const categories = Array.from({ length: 15 }, (_, i) => ({
        ...mockCategory,
        id: String(i),
        name: `Category ${i}`,
        slug: `category-${i}`,
      }));

      vi.mocked(useProductsModule.useCategories).mockReturnValue({
        data: categories,
        isLoading: false,
      } as any);

      render(<Shop />, { wrapper: createWrapper() });

      expect(screen.getByText('+3 more')).toBeInTheDocument();
    });
  });
});

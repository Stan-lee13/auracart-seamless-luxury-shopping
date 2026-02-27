import type React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Shop from '@/pages/Shop';

vi.mock('@/hooks/useInfiniteProducts', () => ({
  useInfiniteProducts: vi.fn(),
  useTrendingProducts: vi.fn(),
  useNewArrivals: vi.fn(),
  useRecommendedProducts: vi.fn(),
}));

vi.mock('@/hooks/useProducts', () => ({
  useProducts: vi.fn(),
  useCategories: vi.fn(),
}));

vi.mock('@/hooks/useUserInteractions', () => ({
  useUserInteractions: vi.fn(),
  useRecommendations: vi.fn(),
}));

vi.mock('@/components/products/ProductGrid', () => ({
  ProductGrid: ({ products, isLoading }: { products: unknown[]; isLoading: boolean }) => (
    <div data-testid="product-grid">{isLoading ? 'Loading products...' : `${products.length} products`}</div>
  ),
}));

vi.mock('@/components/products/ProductSection', () => ({
  ProductSection: ({ title }: { title: string }) => <div data-testid={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>{title}</div>,
}));

import * as useInfiniteProductsModule from '@/hooks/useInfiniteProducts';
import * as useProductsModule from '@/hooks/useProducts';
import * as useUserInteractionsModule from '@/hooks/useUserInteractions';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Shop Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    global.IntersectionObserver = class IntersectionObserver {
      constructor() {}
      disconnect() {}
      observe() {}
      takeRecords() {
        return [];
      }
      unobserve() {}
    } as typeof IntersectionObserver;

    vi.mocked(useInfiniteProductsModule.useInfiniteProducts).mockReturnValue({
      data: { pages: [{ products: [] }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
    } as never);

    vi.mocked(useInfiniteProductsModule.useTrendingProducts).mockReturnValue({
      data: { pages: [{ products: [] }] },
      isLoading: false,
    } as never);

    vi.mocked(useInfiniteProductsModule.useNewArrivals).mockReturnValue({
      data: { pages: [{ products: [] }] },
      isLoading: false,
    } as never);

    vi.mocked(useInfiniteProductsModule.useRecommendedProducts).mockReturnValue({
      data: { pages: [{ products: [] }] },
      isLoading: false,
    } as never);

    vi.mocked(useProductsModule.useProducts).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);

    vi.mocked(useProductsModule.useCategories).mockReturnValue({
      data: [{ id: '1', name: 'Electronics', slug: 'electronics' }],
      isLoading: false,
    } as never);

    vi.mocked(useUserInteractionsModule.useUserInteractions).mockReturnValue({
      trackCategoryInteraction: vi.fn(),
    } as never);

    vi.mocked(useUserInteractionsModule.useRecommendations).mockReturnValue({
      getRecommendationContext: () => ({ topCategories: [], recentlyViewed: [] }),
    } as never);
  });

  it('renders collection header and product grid', () => {
    render(<Shop />, { wrapper: createWrapper() });
    expect(screen.getByText('The Collection')).toBeInTheDocument();
    expect(screen.getByTestId('product-grid')).toBeInTheDocument();
  });

  it('renders curated sections', () => {
    render(<Shop />, { wrapper: createWrapper() });
    expect(screen.getByTestId('section-trending-now')).toBeInTheDocument();
    expect(screen.getByTestId('section-new-arrivals')).toBeInTheDocument();
  });

  it('shows end-of-list message when no next page', () => {
    vi.mocked(useInfiniteProductsModule.useInfiniteProducts).mockReturnValue({
      data: { pages: [{ products: [{ id: '1' }] }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
    } as never);
    render(<Shop />, { wrapper: createWrapper() });
    expect(screen.getByText('You have seen our entire collection.')).toBeInTheDocument();
  });

  it('supports view mode toggle controls', async () => {
    const user = userEvent.setup();
    render(<Shop />, { wrapper: createWrapper() });
    const listButton = screen.getByLabelText('List view');
    await user.click(listButton);
    expect(screen.getByLabelText('Grid view')).toBeInTheDocument();
  });
});

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Grid3X3, List, Loader2, Sparkles } from 'lucide-react';
import { useInfiniteProducts, useTrendingProducts, useNewArrivals, useRecommendedProducts } from '@/hooks/useInfiniteProducts';
import { useProducts, useCategories } from '@/hooks/useProducts';
import { useUserInteractions, useRecommendations } from '@/hooks/useUserInteractions';
import { ProductGrid } from '@/components/products/ProductGrid';
import { ProductSection } from '@/components/products/ProductSection';
import { ShopSidebar } from '@/components/shop/ShopSidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'name';

export default function Shop() {
  const [searchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const observerRef = useRef<HTMLDivElement>(null);

  const categorySlug = searchParams.get('category') || undefined;
  const searchQuery = searchParams.get('search') || undefined;

  const { trackCategoryInteraction } = useUserInteractions();
  const { getRecommendationContext } = useRecommendations();
  const recommendationContext = getRecommendationContext();

  // Infinite scroll products (Main Grid "For Your Aura")
  const {
    data: productsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingProducts,
  } = useInfiniteProducts({
    categorySlug,
    search: searchQuery,
    sortBy,
  });

  // Sections data
  const { data: featuredData, isLoading: isLoadingFeatured } = useProducts({ featured: true, limit: 4 });
  const { data: trendingData, isLoading: isLoadingTrending } = useTrendingProducts(4);
  const { data: newArrivalsData, isLoading: isLoadingNew } = useNewArrivals(4);
  const { data: recommendedData, isLoading: isLoadingRecommended } = useRecommendedProducts(
    recommendationContext.topCategories,
    recommendationContext.recentlyViewed,
    4
  );

  const { data: categories = [] } = useCategories();

  // Track category interactions
  useEffect(() => {
    if (categorySlug) {
      const category = categories.find(c => c.slug === categorySlug);
      if (category?.id) {
        trackCategoryInteraction(category.id);
      }
    }
  }, [categorySlug, categories, trackCategoryInteraction]);

  // Infinite scroll observer
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const element = observerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
      rootMargin: '100px',
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [handleObserver]);

  // Flatten products from all pages
  const allProducts = productsData?.pages.flatMap(page => page.products) || [];

  // Section data extractions
  const featuredList = featuredData || [];

  const trendingList = trendingData?.pages.flatMap(page => page.products) || [];
  const newArrivalsList = newArrivalsData?.pages.flatMap(page => page.products) || [];
  const recommendedList = recommendedData?.pages.flatMap(page => page.products) || [];

  const showSections = !searchQuery && !categorySlug; // Only show curated sections on "All Products" main landing of shop

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container-luxury mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">

        {/* Sidebar - Desktop Only */}
        <ShopSidebar currentCategory={categorySlug} />

        {/* Main Content */}
        <div className="flex-1 min-w-0">

          {/* Header & Controls */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="font-serif text-3xl md:text-4xl font-bold">
                {categorySlug
                  ? categories.find(c => c.slug === categorySlug)?.name || 'Collection'
                  : searchQuery
                    ? `Results for "${searchQuery}"`
                    : 'The Collection'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {categorySlug ? 'Curated for your specific taste.' : 'Explore our premium selection aligned with your aura.'}
              </p>
            </div>

            {/* View Mode & Sort (Simplified for now) */}
            <div className="flex items-center gap-2 self-end md:self-auto">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className="hidden sm:flex"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
                className="hidden sm:flex"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Curated Sections (Only when not filtering) */}
          {showSections && (
            <div className="space-y-16 mb-16">
              {/* 1. Featured */}
              {isLoadingFeatured ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-48" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="aspect-[3/4] rounded-lg" />)}
                  </div>
                </div>
              ) : featuredList.length > 0 && (
                <ProductSection
                  title="Featured Selections"
                  subtitle="Hand-picked for excellence"
                  products={featuredList}
                  isLoading={isLoadingFeatured}
                  icon="star"
                />
              )}

              {/* 2. Trending */}
              <ProductSection
                title="Trending Now"
                subtitle="The pieces everyone is talking about"
                products={trendingList}
                isLoading={isLoadingTrending}
                icon="trending"
              />

              {/* 3. New Arrivals */}
              <ProductSection
                title="New Arrivals"
                subtitle="Fresh drops to elevate your style"
                products={newArrivalsList}
                isLoading={isLoadingNew}
                icon="new"
              />

              {/* 4. Recommended */}
              {recommendedList.length > 0 && (
                <ProductSection
                  title="Recommended For You"
                  subtitle="Curated to complement your aura"
                  products={recommendedList}
                  isLoading={isLoadingRecommended}
                  icon="recommended"
                />
              )}
            </div>
          )}

          {/* Infinite Scroll Grid */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-serif text-2xl font-bold">
                {showSections ? 'For Your Aura' : 'Products'}
              </h2>
            </div>

            <ProductGrid
              products={allProducts}
              isLoading={isLoadingProducts}
              className={cn(viewMode === 'list' ? 'grid-cols-1' : undefined)}
              columns={viewMode === 'list' ? 2 : 3}
            />

            {/* Loading/End States */}
            <div ref={observerRef} className="py-12 flex justify-center">
              {isFetchingNextPage && (
                <div className="flex flex-col items-center gap-2 text-muted-foreground animate-pulse">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm font-medium">Discovering more...</span>
                </div>
              )}
              {!hasNextPage && allProducts.length > 0 && (
                <div className="text-center text-muted-foreground">
                  <p className="text-sm">You have seen our entire collection.</p>
                  <p className="text-xs mt-1 opacity-70">Elevate your aura with what speaks to you.</p>
                </div>
              )}
              {!isLoadingProducts && allProducts.length === 0 && (
                <div className="text-center py-12 bg-muted/20 rounded-lg">
                  <p className="text-muted-foreground">No products found matching your criteria.</p>
                  <Button variant="link" onClick={() => setSortBy('newest')} className="mt-2">
                    Clear filters
                  </Button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

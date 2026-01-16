import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Grid3X3, List, Loader2 } from 'lucide-react';
import { useInfiniteProducts, useTrendingProducts, useNewArrivals, useRecommendedProducts } from '@/hooks/useInfiniteProducts';
import { useCategories } from '@/hooks/useProducts';
import { useUserInteractions, useRecommendations } from '@/hooks/useUserInteractions';
import { ProductGrid } from '@/components/products/ProductGrid';
import { ProductSection } from '@/components/products/ProductSection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

  // Infinite scroll products
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
  const { data: trendingData, isLoading: isLoadingTrending } = useTrendingProducts(8);
  const { data: newArrivalsData, isLoading: isLoadingNew } = useNewArrivals(8);
  const { data: recommendedData, isLoading: isLoadingRecommended } = useRecommendedProducts(
    recommendationContext.topCategories,
    recommendationContext.recentlyViewed,
    8
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
  const trendingProducts = trendingData?.pages.flatMap(page => page.products) || [];
  const newArrivals = newArrivalsData?.pages.flatMap(page => page.products) || [];
  const recommendedProducts = recommendedData?.pages.flatMap(page => page.products) || [];

  const hasFilters = categorySlug || searchQuery;
  const showSections = !hasFilters && !searchQuery;

  return (
    <div className="min-h-screen">
      {/* Hero Section - only show when no filters */}
      {!hasFilters && (
        <section className="relative py-12 bg-gradient-to-b from-muted/50 to-background">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-2xl mx-auto"
            >
              <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4">
                Discover Your <span className="text-primary">Aura</span>
              </h1>
              <p className="text-muted-foreground text-lg">
                Premium products curated with care, delivered worldwide.
              </p>
            </motion.div>
          </div>
        </section>
      )}

      <div className="container mx-auto px-4 py-6">
        {/* Show sections only when not filtering/searching */}
        {showSections && (
          <>
            {/* Trending Section */}
            <ProductSection
              title="Trending Now"
              subtitle="Hot picks everyone's loving"
              products={trendingProducts}
              isLoading={isLoadingTrending}
              icon="trending"
              viewAllLink="/shop?filter=trending"
            />

            {/* New Arrivals Section */}
            <ProductSection
              title="New Arrivals"
              subtitle="Fresh drops just for you"
              products={newArrivals}
              isLoading={isLoadingNew}
              icon="new"
              viewAllLink="/shop?filter=new"
            />

            {/* AI Recommendations Section */}
            {recommendedProducts.length > 0 && (
              <ProductSection
                title="Picked For You"
                subtitle="Based on your style"
                products={recommendedProducts}
                isLoading={isLoadingRecommended}
                icon="recommended"
              />
            )}

            {/* Categories Quick Access */}
            <section className="py-8">
              <h2 className="font-serif text-2xl font-bold mb-6">Shop by Category</h2>
              <div className="flex flex-wrap gap-2">
                {categories.slice(0, 12).map((category) => (
                  <Link
                    key={category.id}
                    to={`/shop?category=${category.slug}`}
                    className="group"
                  >
                    <Badge
                      variant="outline"
                      className="px-4 py-2 text-sm hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                    >
                      {category.name}
                    </Badge>
                  </Link>
                ))}
                {categories.length > 12 && (
                  <Link to="/categories">
                    <Badge variant="secondary" className="px-4 py-2 text-sm">
                      +{categories.length - 12} more
                    </Badge>
                  </Link>
                )}
              </div>
            </section>

            {/* All Products Header */}
            <div className="flex items-center justify-between py-6 border-t border-border">
              <h2 className="font-serif text-2xl font-bold">All Products</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Filtered/Search Results Header */}
        {hasFilters && (
          <div className="py-6">
            <h1 className="font-serif text-2xl font-bold mb-2">
              {categorySlug
                ? categories.find(c => c.slug === categorySlug)?.name || 'Products'
                : searchQuery
                ? `Results for "${searchQuery}"`
                : 'All Products'}
            </h1>
            <p className="text-muted-foreground">
              {allProducts.length} {allProducts.length === 1 ? 'product' : 'products'} found
            </p>
          </div>
        )}

        {/* Products Grid with Infinite Scroll */}
        <ProductGrid
          products={allProducts}
          isLoading={isLoadingProducts}
          className={cn(viewMode === 'list' && 'grid-cols-1 md:grid-cols-2')}
        />

        {/* Infinite scroll trigger */}
        <div ref={observerRef} className="py-8 flex justify-center">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading more...</span>
            </div>
          )}
          {!hasNextPage && allProducts.length > 0 && (
            <p className="text-muted-foreground text-sm">
              You've reached the end ✨
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

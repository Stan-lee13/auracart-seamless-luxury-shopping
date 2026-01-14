import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useProducts, useCategories } from '@/hooks/useProducts';
import { ProductGrid } from '@/components/products/ProductGrid';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState('newest');
  
  const categorySlug = searchParams.get('category') || undefined;
  
  const { data: products = [], isLoading } = useProducts({
    categorySlug,
    search: searchQuery || undefined,
  });

  const { data: categories = [] } = useCategories();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery) {
      searchParams.set('search', searchQuery);
    } else {
      searchParams.delete('search');
    }
    setSearchParams(searchParams);
  };

  const handleCategoryFilter = (slug: string | null) => {
    if (slug) {
      searchParams.set('category', slug);
    } else {
      searchParams.delete('category');
    }
    setSearchParams(searchParams);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSearchParams({});
  };

  const sortedProducts = [...products].sort((a, b) => {
    switch (sortBy) {
      case 'price-asc':
        return a.customer_price - b.customer_price;
      case 'price-desc':
        return b.customer_price - a.customer_price;
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const hasFilters = categorySlug || searchQuery;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-16 bg-gradient-to-b from-muted/50 to-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl mx-auto"
          >
            <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4">
              Our Collection
            </h1>
            <p className="text-muted-foreground text-lg">
              Discover curated pieces that blend timeless elegance with modern sophistication.
            </p>
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        {/* Filters Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </form>

          <div className="flex gap-2">
            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price-asc">Price: Low to High</SelectItem>
                <SelectItem value="price-desc">Price: High to Low</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>

            {/* Mobile Filters */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="md:hidden">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Categories</h3>
                    <div className="space-y-2">
                      <Button
                        variant={!categorySlug ? 'default' : 'ghost'}
                        className="w-full justify-start"
                        onClick={() => handleCategoryFilter(null)}
                      >
                        All Products
                      </Button>
                      {categories.map((cat) => (
                        <Button
                          key={cat.id}
                          variant={categorySlug === cat.slug ? 'default' : 'ghost'}
                          className="w-full justify-start"
                          onClick={() => handleCategoryFilter(cat.slug)}
                        >
                          {cat.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden md:block w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-6">
              <div>
                <h3 className="font-serif text-lg font-medium mb-4">Categories</h3>
                <div className="space-y-1">
                  <Button
                    variant={!categorySlug ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => handleCategoryFilter(null)}
                  >
                    All Products
                  </Button>
                  {categories.map((cat) => (
                    <Button
                      key={cat.id}
                      variant={categorySlug === cat.slug ? 'secondary' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => handleCategoryFilter(cat.slug)}
                    >
                      {cat.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Products */}
          <div className="flex-1">
            {/* Active Filters */}
            {hasFilters && (
              <div className="flex items-center gap-2 mb-6 flex-wrap">
                <span className="text-sm text-muted-foreground">Active filters:</span>
                {categorySlug && (
                  <Badge variant="secondary" className="gap-1">
                    {categories.find(c => c.slug === categorySlug)?.name}
                    <button onClick={() => handleCategoryFilter(null)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {searchQuery && (
                  <Badge variant="secondary" className="gap-1">
                    Search: {searchQuery}
                    <button onClick={() => {
                      setSearchQuery('');
                      searchParams.delete('search');
                      setSearchParams(searchParams);
                    }}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear all
                </Button>
              </div>
            )}

            {/* Results count */}
            <p className="text-sm text-muted-foreground mb-6">
              {sortedProducts.length} {sortedProducts.length === 1 ? 'product' : 'products'}
            </p>

            <ProductGrid products={sortedProducts} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </div>
  );
}

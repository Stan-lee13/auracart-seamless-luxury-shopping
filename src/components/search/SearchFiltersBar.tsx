import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCategories } from '@/hooks/useProducts';
import { useUserInteractions } from '@/hooks/useUserInteractions';
import { useAuth } from '@/contexts/AuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface SearchFiltersBarProps {
  onSearch?: (query: string) => void;
  onCategoryChange?: (category: string | null) => void;
  onSortChange?: (sort: string) => void;
  className?: string;
}

export function SearchFiltersBar({ 
  onSearch, 
  onCategoryChange, 
  onSortChange,
  className 
}: SearchFiltersBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const { data: categories = [] } = useCategories();
  const { trackSearch } = useUserInteractions();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const categorySlug = searchParams.get('category') || '';
  const sortBy = searchParams.get('sort') || 'newest';

  // Don't show on landing page for logged-out users
  if (location.pathname === '/' && !user) {
    return null;
  }

  // Only show on shop-related pages
  const showOnPaths = ['/shop', '/search', '/categories', '/'];
  if (!showOnPaths.some(p => location.pathname.startsWith(p)) && location.pathname !== '/') {
    return null;
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      trackSearch(searchQuery);
      searchParams.set('search', searchQuery);
    } else {
      searchParams.delete('search');
    }
    
    // Navigate to shop if not already there
    if (location.pathname !== '/shop' && location.pathname !== '/search') {
      navigate(`/shop?${searchParams.toString()}`);
    } else {
      setSearchParams(searchParams);
    }
    
    onSearch?.(searchQuery);
  };

  const handleCategoryChange = (value: string) => {
    if (value === 'all') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', value);
    }
    setSearchParams(searchParams);
    onCategoryChange?.(value === 'all' ? null : value);
  };

  const handleSortChange = (value: string) => {
    searchParams.set('sort', value);
    setSearchParams(searchParams);
    onSortChange?.(value);
  };

  const clearSearch = () => {
    setSearchQuery('');
    searchParams.delete('search');
    setSearchParams(searchParams);
    onSearch?.('');
  };

  return (
    <div className={cn('sticky top-16 md:top-20 z-40 bg-background/95 backdrop-blur-lg border-b border-border/50', className)}>
      <div className="container mx-auto px-4 py-3">
        {/* Main search row */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 bg-muted/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {/* Mobile filters toggle */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="md:hidden shrink-0"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          {/* Desktop filters inline */}
          <div className="hidden md:flex gap-2">
            <Select value={categorySlug || 'all'} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-[140px] bg-muted/50">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.slug}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[140px] bg-muted/50">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price-asc">Price: Low-High</SelectItem>
                <SelectItem value="price-desc">Price: High-Low</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </form>

        {/* Mobile collapsible filters */}
        <AnimatePresence>
          {isFiltersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden"
            >
              <div className="flex gap-2 pt-3">
                <Select value={categorySlug || 'all'} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="flex-1 bg-muted/50">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.slug}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={handleSortChange}>
                  <SelectTrigger className="flex-1 bg-muted/50">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="price-asc">Price: Low-High</SelectItem>
                    <SelectItem value="price-desc">Price: High-Low</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active filters display */}
        {(categorySlug || searchParams.get('search')) && (
          <div className="flex items-center gap-2 pt-2 flex-wrap">
            {categorySlug && (
              <Badge variant="secondary" className="gap-1">
                {categories.find(c => c.slug === categorySlug)?.name || categorySlug}
                <button onClick={() => handleCategoryChange('all')}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {searchParams.get('search') && (
              <Badge variant="secondary" className="gap-1">
                "{searchParams.get('search')}"
                <button onClick={clearSearch}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

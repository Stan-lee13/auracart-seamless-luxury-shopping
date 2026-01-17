import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Heart, Minus, Plus, ShoppingBag, Truck, Shield, RotateCcw, Image as ImageIcon } from 'lucide-react';
import { useProduct, useProducts } from '@/hooks/useProducts';
import { useCart } from '@/contexts/CartContext';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductGrid } from '@/components/products/ProductGrid';

export default function Product() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, error } = useProduct(slug || '');
  const { data: relatedProducts = [] } = useProducts({ limit: 4 });
  const { addItem } = useCart();

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          <div className="space-y-4">
            <Skeleton className="aspect-square rounded-lg" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="w-20 h-20 rounded-md" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="font-serif text-2xl mb-4">Product not found</h1>
        <p className="text-muted-foreground mb-6">The product you're looking for doesn't exist.</p>
        <Button asChild>
          <Link to="/shop">Back to Shop</Link>
        </Button>
      </div>
    );
  }

  const images = product.images?.length ? product.images : (product.thumbnail_url ? [product.thumbnail_url] : []);
  const currentVariant = product.variants?.find(v => v.id === selectedVariant);
  const displayPrice = currentVariant?.customer_price || product.customer_price;
  const inStock = (product.stock_quantity ?? 0) > 0;

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      variantId: selectedVariant || undefined,
      name: product.name,
      variantName: currentVariant?.name,
      price: displayPrice,
      image: currentVariant?.image_url || images[0] || '',
      quantity,
    });
  };

  const nextImage = () => setSelectedImage((prev) => (prev + 1) % images.length);
  const prevImage = () => setSelectedImage((prev) => (prev - 1 + images.length) % images.length);

  return (
    <div className="min-h-screen">
      {/* Breadcrumb */}
      <div className="container mx-auto px-4 py-4">
        <nav className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/shop" className="hover:text-foreground">Shop</Link>
          {product.category && (
            <>
              <span className="mx-2">/</span>
              <Link to={`/shop?category=${product.category.slug}`} className="hover:text-foreground">
                {product.category.name}
              </Link>
            </>
          )}
          <span className="mx-2">/</span>
          <span className="text-foreground truncate max-w-[200px] inline-block align-bottom">{product.name}</span>
        </nav>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted group">
              {images.length > 0 ? (
                <img
                  src={images[selectedImage]}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <ImageIcon className="h-20 w-20 text-muted-foreground/20" />
                </div>
              )}

              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={cn(
                      "relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all",
                      selectedImage === i ? "border-primary" : "border-transparent opacity-70"
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            <div className="mb-6">
              <Badge variant="outline" className="mb-2">{product.category?.name || 'Shop'}</Badge>
              <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2">{product.name}</h1>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-semibold text-primary">
                  {formatCurrency(displayPrice)}
                </span>
                {inStock ? (
                  <Badge variant="success" className="bg-green-100 text-green-800 border-green-200">In Stock</Badge>
                ) : (
                  <Badge variant="destructive">Out of Stock</Badge>
                )}
              </div>
            </div>

            <div className="prose prose-sm max-w-none text-muted-foreground mb-8">
              <p>{product.description}</p>
            </div>

            {/* Variants */}
            {product.variants && product.variants.length > 0 && (
              <div className="space-y-4 mb-8">
                <h3 className="font-medium">Options</h3>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v.id)}
                      className={cn(
                        "px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all",
                        selectedVariant === v.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-muted-foreground/30"
                      )}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-4 mb-10 pt-4 border-t border-border mt-auto">
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-border rounded-lg bg-muted/30">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-3 hover:text-primary transition-colors border-r border-border"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center font-medium">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="p-3 hover:text-primary transition-colors border-l border-border"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  onClick={handleAddToCart}
                  disabled={!inStock}
                  className="flex-1 btn-luxury h-12 text-lg cta-glow"
                >
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  Add to Cart
                </Button>
                <button
                  onClick={() => setIsWishlisted(!isWishlisted)}
                  className={cn(
                    "p-3 rounded-lg border border-border transition-all",
                    isWishlisted ? "bg-red-50 text-red-500 border-red-100" : "hover:bg-muted"
                  )}
                >
                  <Heart className={cn("h-6 w-6", isWishlisted && "fill-current")} />
                </button>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-6 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="p-2 rounded-full bg-primary/5">
                  <Truck className="h-4 w-4 text-primary" />
                </div>
                <span>Global Shipping</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="p-2 rounded-full bg-primary/5">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <span>Secure Checkout</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="p-2 rounded-full bg-primary/5">
                  <RotateCcw className="h-4 w-4 text-primary" />
                </div>
                <span>Easy Returns</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details Tabs */}
        <div className="mt-16">
          <Tabs defaultValue="description" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent h-auto p-0 mb-8 space-x-8">
              <TabsTrigger
                value="description"
                className="rounded-none border-b-2 border-transparent px-0 pb-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Description
              </TabsTrigger>
              <TabsTrigger
                value="details"
                className="rounded-none border-b-2 border-transparent px-0 pb-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Specifications
              </TabsTrigger>
              <TabsTrigger
                value="shipping"
                className="rounded-none border-b-2 border-transparent px-0 pb-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Shipping & Returns
              </TabsTrigger>
            </TabsList>
            <TabsContent value="description" className="prose prose-sm max-w-none text-muted-foreground pb-8">
              <h3 className="text-lg font-semibold text-foreground mb-4">Product Overview</h3>
              <p>{product.description}</p>
              <p>Experience the perfect blend of style and luxury with our {product.name}. Each piece is carefully curated to meet our high standards of quality and aura.</p>
            </TabsContent>
            <TabsContent value="details" className="pb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
                {Object.entries(product.metadata || {}).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground capitalize">{key.replace('_', ' ')}</span>
                    <span className="font-medium">{String(value)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Brand</span>
                  <span className="font-medium">AuraCart Premium</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Material</span>
                  <span className="font-medium">High Quality Collection</span>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="shipping" className="prose prose-sm max-w-none text-muted-foreground pb-8">
              <h3 className="text-lg font-semibold text-foreground mb-4">Fast & Reliable Shipping</h3>
              <p>We offer worldwide shipping to ensure you can experience our products wherever you are. All orders are processed within 24-48 hours.</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Free shipping on orders over ₦50,000</li>
                <li>Standard international shipping: 7-14 business days</li>
                <li>Express shipping available for selected regions</li>
                <li>All packages are tracked and insured</li>
              </ul>
            </TabsContent>
          </Tabs>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-20">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-serif text-2xl font-bold">You May Also Like</h2>
              <Button variant="ghost" asChild>
                <Link to="/shop">View All</Link>
              </Button>
            </div>
            <ProductGrid products={relatedProducts} />
          </div>
        )}
      </div>
    </div>
  );
}

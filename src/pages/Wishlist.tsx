import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BackButton } from '@/components/navigation/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProductGrid } from '@/components/products/ProductGrid';
import type { Product } from '@/hooks/useProducts';

export default function Wishlist() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      try {
        const { data: wishlistItems } = await supabase
          .from('wishlist_items')
          .select('product_id')
          .eq('user_id', user.id);

        if (!wishlistItems?.length) { setProducts([]); setLoading(false); return; }

        const productIds = wishlistItems.map(w => w.product_id);
        const { data } = await supabase
          .from('products')
          .select('*, category:categories(*), variants:product_variants(*)')
          .in('id', productIds)
          .eq('is_active', true);

        setProducts((data || []) as Product[]);
      } catch (err) {
        console.error('Failed to load wishlist', err);
      } finally { setLoading(false); }
    })();
  }, [user]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="container-luxury py-8">
      <BackButton />
      <h1 className="text-3xl font-semibold flex items-center gap-3 mt-6 mb-8">
        <Heart className="h-8 w-8 text-primary" /> My Wishlist
      </h1>

      {!user ? (
        <Card className="glass-card"><CardContent className="py-16 text-center">
          <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign in to see your wishlist</h2>
          <p className="text-muted-foreground mb-6">Save items you love by creating an account.</p>
          <Button asChild className="btn-luxury"><Link to="/auth">Sign In</Link></Button>
        </CardContent></Card>
      ) : products.length === 0 ? (
        <Card className="glass-card"><CardContent className="py-16 text-center">
          <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Your wishlist is empty</h2>
          <p className="text-muted-foreground mb-6">Browse products and click the heart icon to save items.</p>
          <Button asChild className="btn-luxury"><Link to="/shop">Browse Products</Link></Button>
        </CardContent></Card>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}

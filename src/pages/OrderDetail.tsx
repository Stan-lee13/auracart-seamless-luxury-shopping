import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BackButton } from '@/components/navigation/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, Package, Truck, CheckCircle2, ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export default function OrderDetail() {
  const { id } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const [order, setOrder] = React.useState<Tables<'orders'> | null>(null);
  const [items, setItems] = React.useState<Tables<'order_items'>[]>([]);
  const [tx, setTx] = React.useState<Pick<Tables<'transactions'>, 'status' | 'payment_method' | 'created_at' | 'payment_channel'> | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!id || !user) return;
    (async () => {
      try {
        const ref = decodeURIComponent(id);
        
        // Fetch order by order_number
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('order_number', ref)
          .single();

        if (orderError || !orderData) {
          setLoading(false);
          return;
        }

        setOrder(orderData);

        // Fetch order items
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', orderData.id);

        setItems(itemsData || []);

        // Fetch transaction
        const { data: txData } = await supabase
          .from('transactions')
          .select('status, payment_method, created_at, payment_channel')
          .eq('order_id', orderData.id)
          .maybeSingle();

        setTx(txData);
      } catch (error) {
        console.error('Error loading order:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!order) {
    return (
      <div className="container-luxury py-8">
        <BackButton />
        <Card className="glass-card mt-6">
          <CardContent className="py-16 text-center">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Order not found</h2>
            <p className="text-muted-foreground">We couldn't find this order.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const shippingAddress = (order.shipping_address as Record<string, string> | null) ?? null;

  const getStatusColor = (status?: string) => {
    const colors: Record<string, string> = {
      'created': 'bg-muted text-muted-foreground',
      'paid': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'sent_to_supplier': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'fulfilled': 'bg-primary/20 text-primary',
      'shipped': 'bg-accent/20 text-accent-foreground',
      'delivered': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    };
    return colors[status || ''] || 'bg-muted text-muted-foreground';
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'shipped': return <Truck className="h-5 w-5 text-primary" />;
      case 'paid': case 'fulfilled': return <Package className="h-5 w-5 text-primary" />;
      default: return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="container-luxury py-8">
      <BackButton />
      <div className="mt-6 mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Order #{order.order_number}</h1>
            <p className="text-muted-foreground mt-1">
              Placed on {order.created_at ? new Date(order.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(order.status)}
            <Badge className={getStatusColor(order.status)}>{order.status?.replace(/_/g, ' ')}</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-lg">Order Items</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
                    <div className="w-20 h-20 bg-muted flex items-center justify-center rounded-lg overflow-hidden flex-shrink-0">
                      {item.product_image ? (
                        <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground opacity-20" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{item.product_name}</p>
                      {item.variant_name && <p className="text-sm text-muted-foreground">{item.variant_name}</p>}
                      <div className="flex justify-between items-end mt-2">
                        <p className="text-sm text-muted-foreground">Qty: {item.quantity} × ₦{Number(item.unit_price || 0).toLocaleString()}</p>
                        <p className="price-display">₦{Number(item.line_total || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {shippingAddress && (
            <Card className="glass-card mt-6">
              <CardHeader><CardTitle className="text-lg">Shipping Address</CardTitle></CardHeader>
              <CardContent>
                <p className="font-medium">{shippingAddress.full_name}</p>
                <p className="text-muted-foreground">{shippingAddress.street_address}</p>
                <p className="text-muted-foreground">{shippingAddress.city}, {shippingAddress.state}</p>
                <p className="text-muted-foreground">{shippingAddress.phone}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1">
          <Card className="glass-card sticky top-24">
            <CardHeader><CardTitle className="text-lg">Order Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₦{Number(order.subtotal || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>₦{Number(order.shipping_total || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>₦{Number(order.tax_total || 0).toLocaleString()}</span></div>
                {Number(order.discount_total || 0) > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400"><span>Discount</span><span>-₦{Number(order.discount_total || 0).toLocaleString()}</span></div>
                )}
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total</span>
                <span className="price-display text-xl">₦{Number(order.grand_total || 0).toLocaleString()}</span>
              </div>
              {tx && (
                <>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">Payment</p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={tx.status === 'success' ? 'default' : 'secondary'}>{tx.status}</Badge>
                    </div>
                    {tx.payment_method && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span>{tx.payment_method}</span></div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

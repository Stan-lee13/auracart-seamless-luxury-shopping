import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { BackButton } from '@/components/navigation/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, RefreshCw, Eye, ShoppingBag } from 'lucide-react';

type Order = { 
  id?: string; 
  order_number?: string; 
  grand_total?: number | string; 
  status?: string; 
  created_at?: string 
};

export default function Orders() {
  const { user, isLoading, session } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);

  async function load() {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      const res = await fetch('/api/orders', { headers });
      const j = await res.json();
      setOrders(j.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (user) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const getStatusColor = (status?: string) => {
    const colors: Record<string, string> = {
      'created': 'bg-muted text-muted-foreground',
      'paid': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'sent_to_supplier': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'fulfilled': 'bg-primary/20 text-primary',
      'shipped': 'bg-accent/20 text-accent-foreground',
      'delivered': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'refunded_partial': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      'refunded_full': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      'disputed': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[status || ''] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="container-luxury py-8">
      <BackButton />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-6 mb-8">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            Your Orders
          </h1>
          <p className="text-muted-foreground mt-1">
            Track and manage your orders
          </p>
        </div>
        <Button onClick={load} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {orders.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-16 text-center">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
            <p className="text-muted-foreground mb-6">
              Start shopping to see your orders here
            </p>
            <Button onClick={() => navigate('/shop')} className="btn-luxury">
              Browse Products
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card 
              key={order.id} 
              className="glass-card hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/order/${order.order_number}`)}
            >
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-mono text-sm text-muted-foreground">
                      Order #{order.order_number}
                    </p>
                    <p className="price-display text-xl">
                      ₦{Number(order.grand_total || 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {order.created_at 
                        ? new Date(order.created_at).toLocaleDateString('en-NG', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={getStatusColor(order.status)}>
                      {order.status?.replace(/_/g, ' ')}
                    </Badge>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

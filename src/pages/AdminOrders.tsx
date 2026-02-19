import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Package, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, grand_total, status, created_at, currency, user_id')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Orders Overview
          </h2>
          <p className="text-muted-foreground mt-1">Manage all customer orders</p>
        </div>
        <Button onClick={load} disabled={loading} className="btn-luxury">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle>Recent Orders</CardTitle></CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No orders to display</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm font-medium">{order.order_number}</TableCell>
                      <TableCell className="price-display">₦{Number(order.grand_total || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(order.status)}>{order.status?.replace(/_/g, ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {order.created_at ? new Date(order.created_at).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/order/${order.order_number}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

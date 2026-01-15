import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Package, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Refund = { id?: string; order_id?: string; refund_amount?: number; status?: string };
type Dispute = { id?: string; order_id?: string; provider_ref?: string; status?: string };
type Order = { id?: string; order_number?: string; grand_total?: number | string; status?: string; created_at?: string };

export default function AdminOrders() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [refunds, setRefunds] = React.useState<Refund[]>([]);
  const [disputes, setDisputes] = React.useState<Dispute[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);

  async function load() {
    setLoading(true);
    try {
      const headers = session?.access_token 
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};
      
      const [r0, r1, r2] = await Promise.all([
        fetch('/api/admin/orders', { headers }),
        fetch('/api/admin/refunds', { headers }),
        fetch('/api/admin/disputes', { headers }),
      ]);
      
      const [j0, j1, j2] = await Promise.all([r0.json(), r1.json(), r2.json()]);
      
      setOrders(j0.data || []);
      setRefunds(j1.data || []);
      setDisputes(j2.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function issueRefund(refundAmount: number, orderId: string) {
    try {
      const res = await fetch('/api/admin/refunds/issue', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` })
        },
        body: JSON.stringify({ order_id: orderId, refund_amount: refundAmount }),
      });
      const j = await res.json();
      console.log('refund issued', j);
      load();
    } catch (error) {
      console.error(error);
    }
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
      'requested': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    };
    return colors[status || ''] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Orders Overview
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage orders, refunds, and disputes
          </p>
        </div>
        <Button 
          onClick={load} 
          disabled={loading}
          className="btn-luxury"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Orders Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
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
                      <TableCell className="font-mono text-sm font-medium">
                        {order.order_number}
                      </TableCell>
                      <TableCell className="price-display">
                        ₦{Number(order.grand_total || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status?.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {order.created_at ? new Date(order.created_at).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/order/${order.order_number}`)}
                        >
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

      {/* Refunds Section */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Pending Refunds</CardTitle>
        </CardHeader>
        <CardContent>
          {refunds.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No refunds to display</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refunds.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {r.order_id?.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="price-display">
                        ₦{Number(r.refund_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(r.status)}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.status === 'requested' ? (
                          <Button 
                            size="sm" 
                            onClick={() => issueRefund(r.refund_amount || 0, r.order_id || '')}
                            className="btn-luxury"
                          >
                            Issue Refund
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disputes Section */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Active Disputes</CardTitle>
        </CardHeader>
        <CardContent>
          {disputes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No disputes to display</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Provider Ref</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disputes.map((d) => (
                    <TableRow key={d.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {d.order_id?.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {d.provider_ref?.slice(0, 12)}...
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(d.status)}>
                          {d.status}
                        </Badge>
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

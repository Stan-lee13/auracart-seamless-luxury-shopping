import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Truck, X, TrendingUp, TrendingDown } from 'lucide-react';
import logger from '@/lib/logger';

type Supplier = { 
  id?: string; 
  supplier_name?: string; 
  sla_score?: number; 
  sla_grade?: string; 
  total_orders?: number; 
  fulfillment_rate?: number; 
  on_time_delivery_rate?: number; 
  fulfilled_orders?: number; 
  cancellation_rate?: number; 
  return_rate?: number; 
  dispute_count?: number; 
  return_count?: number 
};

type SupplierOrder = {
  id?: string;
  aura_order_id?: string;
  status?: string;
  quantity?: number;
  created_at?: string;
};

type SupplierDetail = {
  orders?: SupplierOrder[];
};

export default function AdminSuppliers() {
  const { session } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierDetail, setSupplierDetail] = useState<SupplierDetail | null>(null);

  useEffect(() => {
    fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function fetchSuppliers() {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/suppliers', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      setSuppliers(data.data || []);
    } catch (e) {
      logger.error('Failed to fetch suppliers', e);
    } finally {
      setLoading(false);
    }
  }

  async function selectSupplier(supplier: Supplier) {
    if (!session?.access_token) return;
    setSelectedSupplier(supplier);
    try {
      const res = await fetch(`/api/admin/suppliers/${encodeURIComponent(supplier.supplier_name || '')}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      setSupplierDetail(data);
    } catch (e) {
      logger.error('Failed to fetch supplier details', e);
    }
  }

  const getGradeColor = (grade?: string) => {
    const colors: Record<string, string> = {
      'A': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'B': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'C': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      'D': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      'F': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return colors[grade || ''] || 'bg-muted text-muted-foreground';
  };

  const formatPercent = (value?: number) => {
    if (value === undefined || value === null) return '—';
    return `${Math.round(value * 100)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            Supplier Management
          </h2>
          <p className="text-muted-foreground mt-1">
            Monitor supplier performance and SLA scores
          </p>
        </div>
        <Button onClick={fetchSuppliers} disabled={loading} className="btn-luxury">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {/* Suppliers Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Suppliers & Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No suppliers to display</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>SLA Score</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Fulfillment</TableHead>
                    <TableHead>On-Time</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="hover:bg-muted/50">
                      <TableCell className="font-semibold">
                        {supplier.supplier_name}
                      </TableCell>
                      <TableCell className="font-bold text-lg">
                        {supplier.sla_score}%
                      </TableCell>
                      <TableCell>
                        <Badge className={getGradeColor(supplier.sla_grade)}>
                          {supplier.sla_grade}
                        </Badge>
                      </TableCell>
                      <TableCell>{supplier.total_orders}</TableCell>
                      <TableCell>{formatPercent(supplier.fulfillment_rate)}</TableCell>
                      <TableCell>{formatPercent(supplier.on_time_delivery_rate)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => selectSupplier(supplier)}
                        >
                          View
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

      {/* Supplier Details */}
      {selectedSupplier && supplierDetail && (
        <Card className="glass-card border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{selectedSupplier.supplier_name} - Performance</CardTitle>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSelectedSupplier(null)}
              aria-label="Close details"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass-card p-4 text-center">
                <p className="text-sm text-muted-foreground">SLA Score</p>
                <p className="text-3xl font-bold text-primary">{selectedSupplier.sla_score}%</p>
                <Badge className={getGradeColor(selectedSupplier.sla_grade)}>
                  Grade {selectedSupplier.sla_grade}
                </Badge>
              </div>
              <div className="glass-card p-4 text-center">
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-3xl font-bold">{selectedSupplier.total_orders}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedSupplier.fulfilled_orders} fulfilled
                </p>
              </div>
              <div className="glass-card p-4 text-center">
                <p className="text-sm text-muted-foreground">Fulfillment Rate</p>
                <p className="text-3xl font-bold flex items-center justify-center gap-1">
                  {formatPercent(selectedSupplier.fulfillment_rate)}
                  {(selectedSupplier.fulfillment_rate || 0) >= 0.9 
                    ? <TrendingUp className="h-5 w-5 text-green-500" />
                    : <TrendingDown className="h-5 w-5 text-red-500" />
                  }
                </p>
              </div>
              <div className="glass-card p-4 text-center">
                <p className="text-sm text-muted-foreground">On-Time Delivery</p>
                <p className="text-3xl font-bold flex items-center justify-center gap-1">
                  {formatPercent(selectedSupplier.on_time_delivery_rate)}
                  {(selectedSupplier.on_time_delivery_rate || 0) >= 0.9 
                    ? <TrendingUp className="h-5 w-5 text-green-500" />
                    : <TrendingDown className="h-5 w-5 text-red-500" />
                  }
                </p>
              </div>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 border border-border rounded-lg">
                <p className="text-sm text-muted-foreground">Cancellation Rate</p>
                <p className="text-xl font-semibold">{formatPercent(selectedSupplier.cancellation_rate)}</p>
              </div>
              <div className="p-3 border border-border rounded-lg">
                <p className="text-sm text-muted-foreground">Return Rate</p>
                <p className="text-xl font-semibold">{formatPercent(selectedSupplier.return_rate)}</p>
              </div>
              <div className="p-3 border border-border rounded-lg">
                <p className="text-sm text-muted-foreground">Disputes</p>
                <p className="text-xl font-semibold">{selectedSupplier.dispute_count}</p>
              </div>
              <div className="p-3 border border-border rounded-lg">
                <p className="text-sm text-muted-foreground">Returns</p>
                <p className="text-xl font-semibold">{selectedSupplier.return_count}</p>
              </div>
            </div>

            {/* Recent Orders */}
            {supplierDetail.orders && supplierDetail.orders.length > 0 && (
              <div className="border-t border-border pt-6">
                <h3 className="font-semibold mb-4">Recent Orders</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>AuraCart Order</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierDetail.orders.slice(0, 10).map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">
                            {order.aura_order_id?.slice(0, 8)}...
                          </TableCell>
                          <TableCell>{order.status}</TableCell>
                          <TableCell>{order.quantity}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {order.created_at 
                              ? new Date(order.created_at).toLocaleDateString() 
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

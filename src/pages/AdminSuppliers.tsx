import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import logger from '@/lib/logger';

export default function AdminSuppliers() {
  const { user, session } = useAuth();
  type Supplier = { id?: string; supplier_name?: string; sla_score?: number; sla_grade?: string; total_orders?: number; fulfillment_rate?: number; on_time_delivery_rate?: number; fulfilled_orders?: number; cancellation_rate?: number; return_rate?: number; dispute_count?: number; return_count?: number };

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierDetail, setSupplierDetail] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!user || !session) return;
    fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, session]);

  async function fetchSuppliers() {
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
    setSelectedSupplier(supplier);
    try {
      const res = await fetch(`/api/admin/suppliers/${encodeURIComponent(supplier.supplier_name)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      setSupplierDetail(data);
    } catch (e) {
      logger.error('Failed to fetch supplier details', e);
    }
  }

  const getGradeColor = (grade) => {
    const colors = {
      'A': 'bg-green-100 text-green-800',
      'B': 'bg-blue-100 text-blue-800',
      'C': 'bg-yellow-100 text-yellow-800',
      'D': 'bg-orange-100 text-orange-800',
      'F': 'bg-red-100 text-red-800'
    };
    return colors[grade] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Supplier Management</h1>
        <Button onClick={fetchSuppliers} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Suppliers & Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <p className="text-gray-500">No suppliers to display</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier Name</TableHead>
                    <TableHead>SLA Score</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Fulfillment Rate</TableHead>
                    <TableHead>On-Time Delivery</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-semibold">{supplier.supplier_name}</TableCell>
                      <TableCell className="font-bold">{supplier.sla_score}%</TableCell>
                      <TableCell>
                        <Badge className={getGradeColor(supplier.sla_grade)}>
                          {supplier.sla_grade}
                        </Badge>
                      </TableCell>
                      <TableCell>{supplier.total_orders}</TableCell>
                      <TableCell>{Math.round(supplier.fulfillment_rate * 100)}%</TableCell>
                      <TableCell>{Math.round(supplier.on_time_delivery_rate * 100)}%</TableCell>
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

      {selectedSupplier && supplierDetail && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle>{selectedSupplier.supplier_name} - Performance Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-600">SLA Score</p>
                <p className="text-2xl font-bold">{selectedSupplier.sla_score}%</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Grade</p>
                <Badge className={getGradeColor(selectedSupplier.sla_grade)} style={{fontSize: '16px', padding: '8px'}}>
                  {selectedSupplier.sla_grade}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Total Orders</p>
                <p className="text-xl">{selectedSupplier.total_orders}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Fulfilled</p>
                <p className="text-xl">{selectedSupplier.fulfilled_orders}/{selectedSupplier.total_orders}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Fulfillment Rate</p>
                <p className="text-xl font-semibold">{Math.round(selectedSupplier.fulfillment_rate * 100)}%</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">On-Time Delivery</p>
                <p className="text-xl font-semibold">{Math.round(selectedSupplier.on_time_delivery_rate * 100)}%</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Cancellation Rate</p>
                <p className="text-xl">{Math.round(selectedSupplier.cancellation_rate * 100)}%</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Return Rate</p>
                <p className="text-xl">{Math.round(selectedSupplier.return_rate * 100)}%</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Disputes</p>
                <p className="text-xl">{selectedSupplier.dispute_count}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Returns</p>
                <p className="text-xl">{selectedSupplier.return_count}</p>
              </div>
            </div>

            {supplierDetail.orders && supplierDetail.orders.length > 0 && (
              <div className="border-t pt-6">
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
                          <TableCell className="font-mono text-sm">{order.aura_order_id?.slice(0, 8)}</TableCell>
                          <TableCell>{order.status}</TableCell>
                          <TableCell>{order.quantity}</TableCell>
                          <TableCell className="text-sm">
                            {new Date(order.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <Button onClick={() => setSelectedSupplier(null)}>Close</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

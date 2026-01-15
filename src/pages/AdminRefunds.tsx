import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import logger from '@/lib/logger';

export default function AdminRefunds() {
  const { user, session } = useAuth();
  type Refund = { id?: string; order_id?: string; refund_amount?: number; currency?: string; status?: string; reason?: string; created_at?: string; admin_notes?: string };

  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);

  useEffect(() => {
    if (!user || !session) return;
    fetchRefunds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, session]);

  async function fetchRefunds() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/refunds', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      setRefunds(data.data || []);
    } catch (e) {
      logger.error('Failed to fetch refunds', e);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'requested': 'bg-blue-100 text-blue-800',
      'processing': 'bg-orange-100 text-orange-800',
      'completed': 'bg-green-100 text-green-800',
      'failed': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Refunds Management</h1>
        <Button onClick={fetchRefunds} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Refund Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {refunds.length === 0 ? (
            <p className="text-gray-500">No refunds to display</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Requested At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refunds.map((refund) => (
                    <TableRow key={refund.id}>
                      <TableCell className="font-mono text-sm">{refund.order_id?.slice(0, 8)}</TableCell>
                      <TableCell>{refund.refund_amount} {refund.currency || 'NGN'}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(refund.status)}>
                          {refund.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{refund.reason || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(refund.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedRefund(refund)}
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

      {selectedRefund && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle>Refund Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-600">Refund ID</p>
                <p className="font-mono">{selectedRefund.id}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Order ID</p>
                <p className="font-mono">{selectedRefund.order_id}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Amount</p>
                <p>{selectedRefund.refund_amount} {selectedRefund.currency || 'NGN'}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Status</p>
                <Badge className={getStatusColor(selectedRefund.status)}>
                  {selectedRefund.status}
                </Badge>
              </div>
              <div className="col-span-2">
                <p className="text-sm font-semibold text-gray-600">Reason</p>
                <p>{selectedRefund.reason || 'No reason provided'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm font-semibold text-gray-600">Admin Notes</p>
                <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-40">
                  {selectedRefund.admin_notes ? JSON.stringify(JSON.parse(selectedRefund.admin_notes), null, 2) : 'None'}
                </pre>
              </div>
            </div>
            <Button onClick={() => setSelectedRefund(null)}>Close</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

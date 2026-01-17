import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, RefreshCcw, X } from 'lucide-react';
import logger from '@/lib/logger';

type Refund = { 
  id?: string; 
  order_id?: string; 
  refund_amount?: number; 
  currency?: string; 
  status?: string; 
  reason?: string; 
  created_at?: string; 
  admin_notes?: string 
};

export default function AdminRefunds() {
  const { session } = useAuth();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);

  useEffect(() => {
    fetchRefunds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function fetchRefunds() {
    if (!session?.access_token) return;
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

  const getStatusColor = (status?: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      'requested': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'processing': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      'completed': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'failed': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return colors[status || ''] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <RefreshCcw className="h-6 w-6 text-primary" />
            Refunds Management
          </h2>
          <p className="text-muted-foreground mt-1">
            Process and track customer refund requests
          </p>
        </div>
        <Button onClick={fetchRefunds} disabled={loading} className="btn-luxury">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {/* Refunds Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Refund Requests</CardTitle>
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
                    <TableHead>Reason</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refunds.map((refund) => (
                    <TableRow key={refund.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {refund.order_id?.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="price-display">
                        ₦{Number(refund.refund_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(refund.status)}>
                          {refund.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {refund.reason || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {refund.created_at 
                          ? new Date(refund.created_at).toLocaleDateString() 
                          : '-'}
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

      {/* Refund Details Modal */}
      {selectedRefund && (
        <Card className="glass-card border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Refund Details</CardTitle>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSelectedRefund(null)}
              aria-label="Close details"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Refund ID</p>
                <p className="font-mono text-sm">{selectedRefund.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Order ID</p>
                <p className="font-mono text-sm">{selectedRefund.order_id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Amount</p>
                <p className="price-display text-lg">
                  ₦{Number(selectedRefund.refund_amount || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge className={getStatusColor(selectedRefund.status)}>
                  {selectedRefund.status}
                </Badge>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Reason</p>
                <p className="text-sm">{selectedRefund.reason || 'No reason provided'}</p>
              </div>
              {selectedRefund.admin_notes && (
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">Admin Notes</p>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto max-h-40">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedRefund.admin_notes), null, 2);
                      } catch {
                        return selectedRefund.admin_notes;
                      }
                    })()}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { RefreshCw, AlertTriangle, X, Send } from 'lucide-react';
import logger from '@/lib/logger';

type Dispute = { 
  id?: string; 
  order_id?: string; 
  provider_ref?: string; 
  status?: string; 
  created_at?: string; 
  details?: Record<string, unknown> | null; 
  evidence_submitted?: boolean 
};

type Evidence = { 
  id?: string; 
  description?: string; 
  uploaded_at?: string 
};

export default function AdminDisputes() {
  const { session } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [newEvidenceDesc, setNewEvidenceDesc] = useState('');
  const [submittingEvidence, setSubmittingEvidence] = useState(false);

  useEffect(() => {
    fetchDisputes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function fetchDisputes() {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/disputes', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      setDisputes(data.data || []);
    } catch (e) {
      logger.error('Failed to fetch disputes', e);
    } finally {
      setLoading(false);
    }
  }

  async function selectDispute(dispute: Dispute) {
    if (!session?.access_token) return;
    setSelectedDispute(dispute);
    try {
      const res = await fetch(`/api/admin/disputes/${dispute.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      setEvidence(data.evidence || []);
    } catch (e) {
      logger.error('Failed to fetch dispute details', e);
    }
  }

  async function submitEvidence() {
    if (!selectedDispute || !newEvidenceDesc.trim() || !session?.access_token) return;

    setSubmittingEvidence(true);
    try {
      const res = await fetch(`/api/admin/disputes/${selectedDispute.id}/evidence`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: newEvidenceDesc,
          evidence_type: 'document'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setEvidence((prev) => [...prev, data.data]);
        setNewEvidenceDesc('');
      } else {
        logger.error('Failed to submit evidence', data);
      }
    } catch (e) {
      logger.error('Failed to submit evidence', e);
    } finally {
      setSubmittingEvidence(false);
    }
  }

  const getStatusColor = (status?: string) => {
    const colors: Record<string, string> = {
      'open': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'submitted': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'under_review': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      'escalated': 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-300',
      'won': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'lost': 'bg-muted text-muted-foreground',
      'resolved': 'bg-green-200 text-green-900 dark:bg-green-900/50 dark:text-green-300'
    };
    return colors[status || ''] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-primary" />
            Disputes & Chargebacks
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage payment disputes and submit evidence
          </p>
        </div>
        <Button onClick={fetchDisputes} disabled={loading} className="btn-luxury">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {/* Disputes Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Open Disputes</CardTitle>
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
                    <TableHead>Status</TableHead>
                    <TableHead>Provider Ref</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disputes.map((dispute) => (
                    <TableRow key={dispute.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {dispute.order_id?.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(dispute.status)}>
                          {dispute.status?.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {dispute.provider_ref?.slice(0, 12)}...
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {dispute.created_at 
                          ? new Date(dispute.created_at).toLocaleDateString() 
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => selectDispute(dispute)}
                        >
                          Manage
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

      {/* Dispute Details */}
      {selectedDispute && (
        <Card className="glass-card border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Dispute Details</CardTitle>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSelectedDispute(null)}
              aria-label="Close details"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Dispute ID</p>
                <p className="font-mono text-sm">{selectedDispute.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Order ID</p>
                <p className="font-mono text-sm">{selectedDispute.order_id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge className={getStatusColor(selectedDispute.status)}>
                  {selectedDispute.status?.replace(/_/g, ' ')}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Evidence Submitted</p>
                <p className="text-sm">{selectedDispute.evidence_submitted ? 'Yes' : 'No'}</p>
              </div>
              {selectedDispute.details && (
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">Details</p>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedDispute.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Evidence Section */}
            <div className="border-t border-border pt-6">
              <h3 className="font-semibold mb-4">Evidence</h3>
              {evidence.length > 0 && (
                <div className="space-y-2 mb-6">
                  {evidence.map((ev) => (
                    <div key={ev.id} className="border border-border rounded-lg p-3 bg-muted/50">
                      <p className="text-sm">{ev.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ev.uploaded_at 
                          ? new Date(ev.uploaded_at).toLocaleString() 
                          : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                <Textarea
                  placeholder="Add evidence description..."
                  value={newEvidenceDesc}
                  onChange={(e) => setNewEvidenceDesc(e.target.value)}
                  rows={3}
                  className="bg-background"
                />
                <Button
                  onClick={submitEvidence}
                  disabled={submittingEvidence || !newEvidenceDesc.trim()}
                  className="btn-luxury"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {submittingEvidence ? 'Submitting...' : 'Add Evidence'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

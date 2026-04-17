import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { RefreshCw, AlertTriangle, X, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState<Tables<'disputes'>[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Tables<'disputes'> | null>(null);
  const [newEvidence, setNewEvidence] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function fetchDisputes() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('disputes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setDisputes(data || []);
    } catch (e) {
      console.error('Failed to fetch disputes', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchDisputes(); }, []);

  async function submitEvidence() {
    if (!selectedDispute || !newEvidence.trim()) return;
    setSubmitting(true);
    try {
      const raw = selectedDispute.evidence_compiled;
      const existingEvidence: Record<string, unknown> =
        raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
      const prevEntries = Array.isArray(existingEvidence.entries)
        ? (existingEvidence.entries as Array<{ description?: string; submitted_at?: string }>)
        : [];
      const entries = [...prevEntries, { description: newEvidence, submitted_at: new Date().toISOString() }];
      const updated = { ...existingEvidence, entries };

      const { error } = await supabase
        .from('disputes')
        .update({
          evidence_compiled: updated,
          evidence_submitted_at: new Date().toISOString(),
        })
        .eq('id', selectedDispute.id);

      if (error) throw error;
      toast.success('Evidence added successfully');
      setNewEvidence('');
      setSelectedDispute({ ...selectedDispute, evidence_compiled: updated });
      fetchDisputes();
    } catch (e) {
      console.error('Failed to submit evidence', e);
      toast.error('Failed to submit evidence');
    } finally {
      setSubmitting(false);
    }
  }

  const getStatusColor = (status?: string) => {
    const colors: Record<string, string> = {
      'open': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'submitted': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'under_review': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      'resolved': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    };
    return colors[status || ''] || 'bg-muted text-muted-foreground';
  };

  const evidenceRaw = selectedDispute?.evidence_compiled;
  const evidenceObj: Record<string, unknown> =
    evidenceRaw && typeof evidenceRaw === 'object' && !Array.isArray(evidenceRaw)
      ? (evidenceRaw as Record<string, unknown>)
      : {};
  const evidenceEntries = Array.isArray(evidenceObj.entries)
    ? (evidenceObj.entries as Array<{ description?: string; submitted_at?: string }>)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-primary" />
            Disputes & Chargebacks
          </h2>
          <p className="text-muted-foreground mt-1">Manage payment disputes and submit evidence</p>
        </div>
        <Button onClick={fetchDisputes} disabled={loading} className="btn-luxury">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle>Open Disputes</CardTitle></CardHeader>
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
                    <TableHead>Reason</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disputes.map((dispute) => (
                    <TableRow key={dispute.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">{dispute.order_id?.slice(0, 8)}...</TableCell>
                      <TableCell><Badge className={getStatusColor(dispute.status)}>{dispute.status?.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{dispute.reason || '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {dispute.created_at ? new Date(dispute.created_at).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => setSelectedDispute(dispute)}>Manage</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDispute && (
        <Card className="glass-card border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Dispute Details</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setSelectedDispute(null)} aria-label="Close"><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><p className="text-sm font-medium text-muted-foreground">Dispute ID</p><p className="font-mono text-sm">{selectedDispute.id}</p></div>
              <div><p className="text-sm font-medium text-muted-foreground">Order ID</p><p className="font-mono text-sm">{selectedDispute.order_id}</p></div>
              <div><p className="text-sm font-medium text-muted-foreground">Status</p><Badge className={getStatusColor(selectedDispute.status)}>{selectedDispute.status?.replace(/_/g, ' ')}</Badge></div>
              <div><p className="text-sm font-medium text-muted-foreground">Reason</p><p className="text-sm">{selectedDispute.reason || '-'}</p></div>
              {selectedDispute.customer_claim && (
                <div className="sm:col-span-2"><p className="text-sm font-medium text-muted-foreground">Customer Claim</p><p className="text-sm">{selectedDispute.customer_claim}</p></div>
              )}
            </div>

            <div className="border-t border-border pt-6">
              <h3 className="font-semibold mb-4">Evidence</h3>
              {evidenceEntries.length > 0 && (
                <div className="space-y-2 mb-6">
                  {evidenceEntries.map((ev: { description?: string; submitted_at?: string }, i: number) => (
                    <div key={i} className="border border-border rounded-lg p-3 bg-muted/50">
                      <p className="text-sm">{ev.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{ev.submitted_at ? new Date(ev.submitted_at).toLocaleString() : ''}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-3">
                <Textarea placeholder="Add evidence description..." value={newEvidence} onChange={(e) => setNewEvidence(e.target.value)} rows={3} className="bg-background" />
                <Button onClick={submitEvidence} disabled={submitting || !newEvidence.trim()} className="btn-luxury">
                  <Send className="h-4 w-4 mr-2" />
                  {submitting ? 'Submitting...' : 'Add Evidence'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

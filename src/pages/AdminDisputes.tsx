import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import logger from '@/lib/logger';

export default function AdminDisputes() {
  const { user, session } = useAuth();
  type Dispute = { id?: string; order_id?: string; provider_ref?: string; status?: string; created_at?: string; details?: Record<string, unknown> | null; evidence_submitted?: boolean };
  type Evidence = { id?: string; description?: string; uploaded_at?: string };

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [newEvidenceDesc, setNewEvidenceDesc] = useState('');
  const [submittingEvidence, setSubmittingEvidence] = useState(false);

  useEffect(() => {
    if (!user || !session) return;
    fetchDisputes();
    // include fetchDisputes in deps if it's memoized
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, session]);

  async function fetchDisputes() {
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
    if (!selectedDispute || !newEvidenceDesc.trim()) return;

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

  const getStatusColor = (status) => {
    const colors = {
      'open': 'bg-red-100 text-red-800',
      'submitted': 'bg-blue-100 text-blue-800',
      'under_review': 'bg-orange-100 text-orange-800',
      'escalated': 'bg-red-200 text-red-900',
      'won': 'bg-green-100 text-green-800',
      'lost': 'bg-gray-100 text-gray-800',
      'resolved': 'bg-green-200 text-green-900'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Disputes & Chargebacks</h1>
        <Button onClick={fetchDisputes} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open Disputes</CardTitle>
        </CardHeader>
        <CardContent>
          {disputes.length === 0 ? (
            <p className="text-gray-500">No disputes to display</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provider Ref</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disputes.map((dispute) => (
                    <TableRow key={dispute.id}>
                      <TableCell className="font-mono text-sm">{dispute.order_id?.slice(0, 8)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(dispute.status)}>
                          {dispute.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{dispute.provider_ref?.slice(0, 12)}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(dispute.created_at).toLocaleDateString()}
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

      {selectedDispute && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle>Dispute Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-600">Dispute ID</p>
                <p className="font-mono">{selectedDispute.id}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Order ID</p>
                <p className="font-mono">{selectedDispute.order_id}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Status</p>
                <Badge className={getStatusColor(selectedDispute.status)}>
                  {selectedDispute.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Evidence Submitted</p>
                <p>{selectedDispute.evidence_submitted ? 'Yes' : 'No'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm font-semibold text-gray-600">Details</p>
                <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(selectedDispute.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4">Evidence</h3>
              {evidence.length > 0 && (
                <div className="space-y-2 mb-6">
                  {evidence.map((ev) => (
                    <div key={ev.id} className="border rounded p-3 bg-gray-50">
                      <p className="font-mono text-sm">{ev.description}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(ev.uploaded_at).toLocaleString()}
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
                />
                <Button
                  onClick={submitEvidence}
                  disabled={submittingEvidence || !newEvidenceDesc.trim()}
                >
                  {submittingEvidence ? 'Submitting...' : 'Add Evidence'}
                </Button>
              </div>
            </div>

            <Button onClick={() => setSelectedDispute(null)}>Close</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

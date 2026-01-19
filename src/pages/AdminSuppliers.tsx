import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Truck, X, TrendingUp, TrendingDown, ExternalLink, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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

  // AliExpress Integration State
  const [isAliConnected, setIsAliConnected] = useState<boolean | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [aliConfig, setAliConfig] = useState<{ appKey: string; appSecret: string }>({ appKey: '', appSecret: '' });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const fetchAliConfig = React.useCallback(async () => {
    try {
      const { data } = await supabase.from('settings').select('value').eq('key', 'aliexpress_config').maybeSingle();
      if (data?.value && typeof data.value === 'object' && !Array.isArray(data.value)) {
        const value = data.value as Record<string, unknown>;
        setAliConfig({
          appKey: typeof value.app_key === 'string' ? value.app_key : '',
          appSecret: typeof value.app_secret === 'string' ? value.app_secret : '',
        });
      }
    } catch (err) {
      console.error('Error fetching Ali config:', err);
    }
  }, []);

  const handleSaveConfig = async () => {
    if (!aliConfig.appKey || !aliConfig.appSecret) {
      toast.error('App Key and Secret are required');
      return;
    }
    setIsSavingConfig(true);
    try {
      const { data, error } = await supabase.functions.invoke('save-aliexpress-config', {
        body: { appKey: aliConfig.appKey, appSecret: aliConfig.appSecret }
      });

      if (error) {
        console.error('Edge Function error object:', error);
        throw error;
      }
      if (data?.error) throw new Error(data.error);

      toast.success('AliExpress credentials saved successfully!');
    } catch (err: unknown) {
      console.error('Full Save config error:', err);
      const message = err instanceof Error ? err.message : 'Failed to save configuration';
      toast.error(message);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const checkAliConnection = React.useCallback(async () => {
    console.info('[AliExpress] Checking connection status...');
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'aliexpress_tokens')
        .maybeSingle();

      if (error) throw error;

      const val = data?.value as Record<string, unknown> | null;
      if (val && typeof val.access_token === 'string') {
        console.info('[AliExpress] Connection found for account:', val.account || 'Authenticated');
        setIsAliConnected(true);
      } else {
        console.info('[AliExpress] No valid connection tokens found.');
        setIsAliConnected(false);
      }
    } catch (err) {
      console.error('[AliExpress] Error checking connection:', err);
      setIsAliConnected(false);
    }
  }, []);

  const fetchSuppliers = React.useCallback(async () => {
    setLoading(true);
    try {
      // Try to fetch from Node server first (for metrics)
      const res = await fetch('/api/admin/suppliers', {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });

      if (!res.ok) {
        // Fallback to direct Supabase if Node server is down
        const { data: metricsData } = await (supabase.from('supplier_metrics' as unknown as 'suppliers')
          .select('*').limit(50));
        setSuppliers(metricsData as Supplier[] || []);
      } else {
        const data = await res.json();
        setSuppliers(data.data || []);
      }
    } catch (e) {
      logger.error('Failed to fetch suppliers', e);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchSuppliers();
    checkAliConnection();
    fetchAliConfig();

    // Check URL parameters for status or direct code from AliExpress
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const errorParam = params.get('error');
    const directCode = params.get('code'); // Handle direct AliExpress redirect

    if (status === 'connected') {
      toast.success('AliExpress account connected successfully!');
      // Give the database a moment to propagate the new tokens
      console.info('[AliExpress] Redirect detected: connected. Triggering re-validation in 1.5s...');
      setTimeout(() => {
        checkAliConnection();
      }, 1500);
      // Use replace to clear URL parameters completely
      window.location.replace('/admin/suppliers');
    } else if (status === 'error') {
      console.error('[AliExpress] Redirect detected: error.', errorParam);
      toast.error(`Connection failed: ${errorParam || 'Unknown error'}`);
      // Use replace to clear URL parameters completely
      window.location.replace('/admin/suppliers');
    }
  }, [fetchSuppliers, checkAliConnection, fetchAliConfig]);

  // Handle direct code from AliExpress (when it ignores callback URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const directCode = params.get('code');
    
    if (directCode && !isAliConnected) {
      console.log('Direct code detected, processing OAuth...');
      const handleDirectOAuthCode = async (code: string) => {
        try {
          const { data: aliConfig } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'aliexpress_config')
            .maybeSingle();

          const config = aliConfig?.value as { app_key: string; app_secret: string };
          if (!config?.app_key || !config?.app_secret) {
            toast.error('Please save your AliExpress App Key first.');
            return;
          }

          // Call edge function directly with code
          const { data, error } = await supabase.functions.invoke('aliexpress-auth-callback', {
            body: { code, state: window.location.origin }
          });

          if (error) {
            toast.error(`OAuth failed: ${error.message}`);
            return;
          }

          if (data?.success) {
            toast.success('AliExpress account connected successfully!');
            setTimeout(() => {
              checkAliConnection();
            }, 1500);
            // Clean URL
            window.location.replace('/admin/suppliers');
          } else {
            toast.error('Connection failed');
          }
        } catch (err) {
          console.error('Direct OAuth error:', err);
          toast.error('OAuth failed');
        }
      };

      handleDirectOAuthCode(directCode);
    }
  }, [isAliConnected, checkAliConnection]);

  const handleConnectAliExpress = () => {
    if (!aliConfig.appKey) {
      toast.error('Please save your AliExpress App Key first.');
      return;
    }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const redirectUri = `${window.location.origin}/api/aliexpress/callback`;

    // Using official AliExpress Auth URL from guide with state for dynamic redirect
    // Removing view=web to let AliExpress decide the best view (mobile/desktop)
    const state = encodeURIComponent(window.location.origin);
    const authUrl = `https://api-sg.aliexpress.com/oauth/authorize?response_type=code&client_id=${aliConfig.appKey}&redirect_uri=${encodeURIComponent(redirectUri)}&sp=ae&state=${state}`;

    // Use same-tab redirect for better state management on mobile/tablets
    window.location.href = authUrl;
  };

  const handleImportProducts = async () => {
    setIsImporting(true);
    toast.info('Starting AliExpress product import...');

    try {
      const { error } = await supabase.functions.invoke('import-products', {
        body: { limit: 20 }
      });

      if (error) throw error;
      toast.success('Successfully imported real AliExpress products!');
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Failed to import products. Check edge function logs.');
    } finally {
      setIsImporting(false);
    }
  };

  async function selectSupplier(supplier: Supplier) {
    setSelectedSupplier(supplier);
    try {
      const res = await fetch(`/api/admin/suppliers/${encodeURIComponent(supplier.supplier_name || '')}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
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

  const currentRedirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aliexpress-auth-callback`;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            Supplier Management
          </h2>
          <p className="text-muted-foreground mt-1">
            Monitor supplier performance and AliExpress integration
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSuppliers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* AliExpress Integration Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass-card border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">AliExpress Connection</CardTitle>
                <CardDescription>Authorize Auracart to access AliExpress API</CardDescription>
              </div>
              <div className="h-10 w-10 rounded-full bg-white/50 flex items-center justify-center overflow-hidden">
                <img src="/lovable-uploads/c7b64081-3069-450f-90e9-b690d5656910.png" alt="AliExpress" className="h-8 w-8 object-contain" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-white/40 rounded-xl border border-white/60 mb-4">
              <div className="flex items-center gap-3">
                {isAliConnected ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                )}
                <div>
                  <p className="font-medium text-sm">Status</p>
                  <p className="text-xs text-muted-foreground">
                    {isAliConnected ? 'Connected & Optimized' : 'Not Connected'}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={isAliConnected ? "bg-green-100 text-green-800 border-green-200" : "bg-amber-100 text-amber-800 border-amber-200"}>
                {isAliConnected ? 'ACTIVE' : 'INACTIVE'}
              </Badge>
            </div>

            <div className="space-y-4">
              <Button
                onClick={handleConnectAliExpress}
                className="w-full btn-luxury"
                variant={isAliConnected ? "outline" : "default"}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {isAliConnected ? 'Reconnect Account' : 'Connect AliExpress'}
              </Button>

              <div className="p-3 bg-muted/30 rounded-lg text-[10px] font-mono break-all border border-border">
                <p className="text-muted-foreground mb-1 uppercase tracking-tighter">Redirect URI (Save this in AliExpress Console):</p>
                <p className="select-all">{currentRedirectUri}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">API Configuration</CardTitle>
            <CardDescription>Enter your Application Keys</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <label className="font-medium block">App Key (client_id)</label>
              <input
                type="text"
                value={aliConfig.appKey}
                onChange={(e) => setAliConfig(prev => ({ ...prev, appKey: e.target.value }))}
                placeholder="AliExpress App Key"
                className="w-full p-2 rounded-md border border-input bg-background text-foreground text-sm"
              />
            </div>
            <div className="space-y-2 text-sm">
              <label className="font-medium block">App Secret (client_secret)</label>
              <input
                type="password"
                value={aliConfig.appSecret}
                onChange={(e) => setAliConfig(prev => ({ ...prev, appSecret: e.target.value }))}
                placeholder="AliExpress App Secret"
                className="w-full p-2 rounded-md border border-input bg-background text-foreground text-sm"
              />
            </div>
            <Button onClick={handleSaveConfig} disabled={isSavingConfig} className="w-full" variant="outline">
              {isSavingConfig ? 'Saving...' : 'Save Configuration'}
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card border-accent/20 bg-accent/5">
          <CardHeader>
            <CardTitle className="text-lg">Global Catalog</CardTitle>
            <CardDescription>Synchronize real products</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-white/40 rounded-xl border border-white/60 mb-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span>Sync Priority</span>
                <span className="font-medium">High</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Auto-Optimization</span>
                <span className="font-medium text-green-600">Enabled</span>
              </div>
            </div>

            <Button
              onClick={handleImportProducts}
              disabled={!isAliConnected || isImporting}
              className="w-full"
              variant="secondary"
            >
              {isImporting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isImporting ? 'Importing...' : 'Sync Catalog'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Suppliers Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Supplier Performance (SLA)</CardTitle>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Truck className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No supplier metrics available yet</p>
              <p className="text-xs text-muted-foreground mt-1">Connect AliExpress to start tracking performance</p>
            </div>
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => selectSupplier(supplier)}>
                      <TableCell className="font-semibold">
                        {supplier.supplier_name}
                      </TableCell>
                      <TableCell className="font-bold text-lg">
                        {supplier.sla_score}%
                      </TableCell>
                      <TableCell>
                        <Badge className={getGradeColor(supplier.sla_grade)}>
                          Grade {supplier.sla_grade}
                        </Badge>
                      </TableCell>
                      <TableCell>{supplier.total_orders}</TableCell>
                      <TableCell>{formatPercent(supplier.fulfillment_rate)}</TableCell>
                      <TableCell>{formatPercent(supplier.on_time_delivery_rate)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                        >
                          Details
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
        <Card className="glass-card border-primary/20 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{selectedSupplier.supplier_name}</CardTitle>
              <CardDescription>Detailed fulfillment performance analysis</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedSupplier(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white/40 p-4 rounded-xl border border-white/60 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Fulfillment</p>
                <p className="text-2xl font-bold">{formatPercent(selectedSupplier.fulfillment_rate)}</p>
              </div>
              <div className="bg-white/40 p-4 rounded-xl border border-white/60 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">On-Time</p>
                <p className="text-2xl font-bold">{formatPercent(selectedSupplier.on_time_delivery_rate)}</p>
              </div>
              <div className="bg-white/40 p-4 rounded-xl border border-white/60 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Cancellation</p>
                <p className="text-2xl font-bold">{formatPercent(selectedSupplier.cancellation_rate)}</p>
              </div>
              <div className="bg-white/40 p-4 rounded-xl border border-white/60 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Returns</p>
                <p className="text-2xl font-bold">{formatPercent(selectedSupplier.return_rate)}</p>
              </div>
            </div>

            {supplierDetail.orders && supplierDetail.orders.length > 0 && (
              <div className="pt-4">
                <h3 className="text-sm font-semibold mb-3">Recent Traceable Orders</h3>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierDetail.orders.slice(0, 5).map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-xs">
                            {order.aura_order_id?.slice(0, 8)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] h-5 uppercase">
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{order.quantity}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString() : '-'}
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

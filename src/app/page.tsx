'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CspReport {
  id: string;
  documentUri: string;
  referrer?: string;
  violatedDirective: string;
  effectiveDirective: string;
  originalPolicy: string;
  disposition: string;
  blockedUri?: string;
  lineNumber?: number;
  columnNumber?: number;
  sourceFile?: string;
  statusCode?: number;
  scriptSample?: string;
  userAgent?: string;
  rawReport: string;
  timestamp: string;
  endpoint: {
    id: string;
    name: string;
  };
}

interface Endpoint {
  id: string;
  name: string;
  _count: {
    reports: number;
  };
}

export default function Home() {
  const [reports, setReports] = useState<CspReport[]>([]);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<CspReport | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showEndpointManager, setShowEndpointManager] = useState(false);
  const [newEndpointName, setNewEndpointName] = useState('');
  const [isCreatingEndpoint, setIsCreatingEndpoint] = useState(false);
  const [endpointError, setEndpointError] = useState<string | null>(null);

  useEffect(() => {
    fetchEndpoints();
    fetchReports();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [selectedEndpoint]);

  const fetchEndpoints = async () => {
    try {
      const response = await fetch('/api/endpoints');
      if (!response.ok) {
        throw new Error('Failed to fetch endpoints');
      }
      const data = await response.json();
      setEndpoints(data);
    } catch (err) {
      console.error('Error fetching endpoints:', err);
    }
  };

  const fetchReports = async () => {
    try {
      const url = selectedEndpoint 
        ? `/api/reports?endpoint=${encodeURIComponent(selectedEndpoint)}`
        : '/api/reports';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }
      const data = await response.json();
      setReports(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getDispositionColor = (disposition: string) => {
    return disposition === 'enforce' ? 'destructive' : 'secondary';
  };

  const handleRowClick = (report: CspReport) => {
    setSelectedReport(report);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedReport(null);
  };

  const createEndpoint = async () => {
    if (!newEndpointName.trim()) {
      setEndpointError('Endpoint name is required');
      return;
    }

    setIsCreatingEndpoint(true);
    setEndpointError(null);

    try {
      const response = await fetch('/api/endpoints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newEndpointName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create endpoint');
      }

      setNewEndpointName('');
      await fetchEndpoints();
    } catch (err) {
      setEndpointError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsCreatingEndpoint(false);
    }
  };

  const deleteEndpoint = async (endpointId: string, endpointName: string) => {
    if (!confirm(`Are you sure you want to delete the endpoint "${endpointName}"? This will also delete all associated reports.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/endpoints?id=${endpointId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete endpoint');
      }

      // If the deleted endpoint was selected, clear the selection
      if (selectedEndpoint === endpointName) {
        setSelectedEndpoint('');
      }

      await fetchEndpoints();
      await fetchReports();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading CSP reports...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-red-600">Error: {error}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">CSP Violation Reports</h1>
          <p className="text-muted-foreground mt-2">
            Monitor and analyze Content Security Policy violations
          </p>
        </div>
        <button
          onClick={() => setShowEndpointManager(!showEndpointManager)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          {showEndpointManager ? 'Hide' : 'Manage'} Endpoints
        </button>
      </div>

      {showEndpointManager && (
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Endpoint Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Create and manage CSP reporting endpoints. Each endpoint gets its own unique API path.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Create New Endpoint */}
              <div>
                <h3 className="font-semibold mb-3">Create New Endpoint</h3>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Enter endpoint name (e.g., my-app, frontend, api)"
                      value={newEndpointName}
                      onChange={(e) => setNewEndpointName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && createEndpoint()}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      disabled={isCreatingEndpoint}
                    />
                    {endpointError && (
                      <p className="text-sm text-red-600 mt-1">{endpointError}</p>
                    )}
                  </div>
                  <button
                    onClick={createEndpoint}
                    disabled={isCreatingEndpoint || !newEndpointName.trim()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isCreatingEndpoint ? 'Creating...' : 'Create'}
                  </button>
                </div>
                {newEndpointName.trim() && (
                  <p className="text-sm text-muted-foreground mt-2">
                    API URL: <code className="bg-muted px-1 py-0.5 rounded text-xs">
                      POST /api/report/{newEndpointName.trim()}
                    </code>
                  </p>
                )}
              </div>

              {/* Existing Endpoints */}
              {endpoints.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Existing Endpoints</h3>
                  <div className="space-y-2">
                    {endpoints.map((endpoint) => (
                      <div
                        key={endpoint.id}
                        className="flex items-center justify-between p-3 border rounded-md bg-card"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="font-mono">
                              {endpoint.name}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {endpoint._count.reports} report{endpoint._count.reports !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            <code>POST /api/report/{endpoint.name}</code>
                          </p>
                        </div>
                        <button
                          onClick={() => deleteEndpoint(endpoint.id, endpoint.name)}
                          className="px-3 py-1 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {endpoints.length > 0 && (
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filter by Endpoint</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedEndpoint('')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedEndpoint === ''
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  All Endpoints ({endpoints.reduce((sum, e) => sum + e._count.reports, 0)})
                </button>
                {endpoints.map((endpoint) => (
                  <button
                    key={endpoint.id}
                    onClick={() => setSelectedEndpoint(endpoint.name)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      selectedEndpoint === endpoint.name
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {endpoint.name} ({endpoint._count.reports})
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enforced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.filter(r => r.disposition === 'enforce').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Report Only</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.filter(r => r.disposition === 'report').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Violations</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Click on any row to view detailed report information
          </p>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No CSP violations reported yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Document URI</TableHead>
                  <TableHead>Violated Directive</TableHead>
                  <TableHead>Blocked URI</TableHead>
                  <TableHead>Disposition</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow 
                    key={report.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(report)}
                  >
                    <TableCell className="font-mono text-sm">
                      {formatTimestamp(report.timestamp)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {report.endpoint.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {report.documentUri}
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {report.violatedDirective}
                      </code>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {report.blockedUri || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getDispositionColor(report.disposition)}>
                        {report.disposition}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>CSP Violation Report Details</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">BASIC INFORMATION</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Timestamp</label>
                      <p className="font-mono text-sm">{formatTimestamp(selectedReport.timestamp)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Endpoint</label>
                      <div className="mt-1">
                        <Badge variant="outline" className="font-mono">
                          {selectedReport.endpoint.name}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Disposition</label>
                      <div className="mt-1">
                        <Badge variant={getDispositionColor(selectedReport.disposition)}>
                          {selectedReport.disposition}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Document URI</label>
                      <p className="text-sm break-all">{selectedReport.documentUri}</p>
                    </div>
                    {selectedReport.referrer && (
                      <div>
                        <label className="text-sm font-medium">Referrer</label>
                        <p className="text-sm break-all">{selectedReport.referrer}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">VIOLATION DETAILS</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Violated Directive</label>
                      <code className="block bg-muted px-2 py-1 rounded text-sm mt-1">
                        {selectedReport.violatedDirective}
                      </code>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Effective Directive</label>
                      <code className="block bg-muted px-2 py-1 rounded text-sm mt-1">
                        {selectedReport.effectiveDirective}
                      </code>
                    </div>
                    {selectedReport.blockedUri && (
                      <div>
                        <label className="text-sm font-medium">Blocked URI</label>
                        <p className="text-sm break-all">{selectedReport.blockedUri}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">POLICY</h3>
                <div>
                  <label className="text-sm font-medium">Original Policy</label>
                  <code className="block bg-muted px-3 py-2 rounded text-sm mt-1 whitespace-pre-wrap">
                    {selectedReport.originalPolicy}
                  </code>
                </div>
              </div>

              {(selectedReport.sourceFile || selectedReport.lineNumber || selectedReport.columnNumber || selectedReport.scriptSample) && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">SOURCE INFORMATION</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {selectedReport.sourceFile && (
                      <div>
                        <label className="text-sm font-medium">Source File</label>
                        <p className="text-sm break-all">{selectedReport.sourceFile}</p>
                      </div>
                    )}
                    <div className="flex gap-4">
                      {selectedReport.lineNumber && (
                        <div>
                          <label className="text-sm font-medium">Line</label>
                          <p className="text-sm">{selectedReport.lineNumber}</p>
                        </div>
                      )}
                      {selectedReport.columnNumber && (
                        <div>
                          <label className="text-sm font-medium">Column</label>
                          <p className="text-sm">{selectedReport.columnNumber}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {selectedReport.scriptSample && (
                    <div className="mt-3">
                      <label className="text-sm font-medium">Script Sample</label>
                      <code className="block bg-muted px-3 py-2 rounded text-sm mt-1">
                        {selectedReport.scriptSample}
                      </code>
                    </div>
                  )}
                </div>
              )}

              {(selectedReport.statusCode || selectedReport.userAgent) && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">ADDITIONAL INFORMATION</h3>
                  <div className="space-y-3">
                    {selectedReport.statusCode && (
                      <div>
                        <label className="text-sm font-medium">Status Code</label>
                        <p className="text-sm">{selectedReport.statusCode}</p>
                      </div>
                    )}
                    {selectedReport.userAgent && (
                      <div>
                        <label className="text-sm font-medium">User Agent</label>
                        <p className="text-sm break-all font-mono">{selectedReport.userAgent}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">RAW REPORT (DEBUG)</h3>
                <div>
                  <label className="text-sm font-medium">Complete Raw CSP Report</label>
                  <pre className="block bg-muted px-3 py-2 rounded text-xs mt-1 whitespace-pre-wrap overflow-x-auto max-h-60 border">
                    {selectedReport.rawReport}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

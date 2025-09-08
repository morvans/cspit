'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
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
  reportType: string;
  source: string;
  endpoint: {
    id: string;
    token: string;
    label: string;
  };
}

interface GenericReport {
  id: string;
  type: string;
  url: string;
  userAgent?: string;
  body: unknown;
  age?: number;
  timestamp: string;
  reportType: string;
  source: string;
  endpoint: {
    id: string;
    token: string;
    label: string;
  };
}

type Report = CspReport | GenericReport;

interface Endpoint {
  id: string;
  token: string;
  label: string;
  _count: {
    reports: number;
  };
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [reportStats, setReportStats] = useState({ totalCount: 0, cspCount: 0, genericCount: 0 });
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('');
  const [selectedReportType, setSelectedReportType] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showEndpointManager, setShowEndpointManager] = useState(false);
  const [newEndpointName, setNewEndpointName] = useState('');
  const [isCreatingEndpoint, setIsCreatingEndpoint] = useState(false);
  const [endpointError, setEndpointError] = useState<string | null>(null);
  
  // Pagination and filtering state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [timeRange, setTimeRange] = useState('last_1h');
  const [totalPages, setTotalPages] = useState(0);

  const fetchEndpoints = useCallback(async () => {
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
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedEndpoint) {
        params.append('endpoint', selectedEndpoint);
      }
      if (selectedReportType !== 'all') {
        params.append('type', selectedReportType);
      }
      
      // Add pagination and time filter parameters
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());
      params.append('timeRange', timeRange);
      
      const url = `/api/reports?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }
      const data = await response.json();
      
      // Handle both old format (array) and new format (object with reports array)
      if (Array.isArray(data)) {
        setReports(data);
        setReportStats({ totalCount: data.length, cspCount: data.length, genericCount: 0 });
        setTotalPages(1);
      } else {
        setReports(data.reports || []);
        setReportStats({
          totalCount: data.totalCount || 0,
          cspCount: data.cspCount || 0,
          genericCount: data.genericCount || 0
        });
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [selectedEndpoint, selectedReportType, currentPage, itemsPerPage, timeRange]);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (status === 'loading') return; // Still loading
    if (!session) {
      router.push('/auth/signin');
      return;
    }
  }, [session, status, router]);

  // Fetch data when component mounts and user is authenticated
  useEffect(() => {
    if (session) {
      fetchEndpoints();
      fetchReports();
    }
  }, [session, fetchEndpoints, fetchReports]);

  // Fetch reports when selected endpoint or report type changes
  useEffect(() => {
    if (session) {
      fetchReports();
    }
  }, [fetchReports, session]);

  // Show loading while session is being checked
  if (status === 'loading') {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Checking authentication...</div>
        </div>
      </div>
    );
  }

  // Show loading while redirecting
  if (!session) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Redirecting to sign-in...</div>
        </div>
      </div>
    );
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getDispositionColor = (disposition: string) => {
    return disposition === 'enforce' ? 'destructive' : 'secondary';
  };

  const handleRowClick = (report: Report) => {
    setSelectedReport(report);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedReport(null);
  };

  const isCSPReport = (report: Report): report is CspReport => {
    return report.source === 'legacy' || 'violatedDirective' in report;
  };

  const getReportTypeColor = (reportType: string) => {
    switch (reportType) {
      case 'csp-violation':
        return 'destructive';
      case 'deprecation':
        return 'secondary';
      case 'intervention':
        return 'default';
      default:
        return 'outline';
    }
  };

  const formatBlockedUri = (blockedUri?: string) => {
    if (!blockedUri) return '-';
    
    // Check if it's a regular URL
    try {
      const url = new URL(blockedUri);
      return url.hostname;
    } catch {
      // If it's not a valid URL (e.g., 'inline-script', 'eval', etc.), return the full URI
      return blockedUri;
    }
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
        body: JSON.stringify({ label: newEndpointName.trim() }),
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
          <h1 className="text-3xl font-bold">Security Reports Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Monitor and analyze security reports from the Reporting API
          </p>
        </div>
        <div className="flex items-center gap-4">
          {session?.user && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium">{session.user.name}</p>
                <p className="text-xs text-muted-foreground">{session.user.email}</p>
              </div>
              {session.user.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <button
                onClick={() => signOut()}
                className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
          <button
            onClick={() => setShowEndpointManager(!showEndpointManager)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            {showEndpointManager ? 'Hide' : 'Manage'} Endpoints
          </button>
        </div>
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
                              {endpoint.label}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {endpoint._count.reports} report{endpoint._count.reports !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            <code>POST /api/report/{endpoint.token}</code>
                          </p>
                        </div>
                        <button
                          onClick={() => deleteEndpoint(endpoint.id, endpoint.label)}
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
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Endpoint Filter */}
              <div>
                <h3 className="font-medium mb-2">Filter by Endpoint</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setSelectedEndpoint('');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      selectedEndpoint === ''
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    All Endpoints ({reportStats.totalCount})
                  </button>
                  {endpoints.map((endpoint) => (
                    <button
                      key={endpoint.id}
                      onClick={() => {
                        setSelectedEndpoint(endpoint.token);
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        selectedEndpoint === endpoint.token
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {endpoint.label} ({endpoint._count.reports})
                    </button>
                  ))}
                </div>
              </div>

              {/* Report Type Filter */}
              <div>
                <h3 className="font-medium mb-2">Filter by Report Type</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setSelectedReportType('all');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      selectedReportType === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    All Types ({reportStats.totalCount})
                  </button>
                  <button
                    onClick={() => {
                      setSelectedReportType('csp');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      selectedReportType === 'csp'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    CSP Reports ({reportStats.cspCount})
                  </button>
                  <button
                    onClick={() => {
                      setSelectedReportType('generic');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      selectedReportType === 'generic'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    Generic Reports ({reportStats.genericCount})
                  </button>
                </div>
              </div>

              {/* Time Range Filter */}
              <div>
                <h3 className="font-medium mb-2">Filter by Time Range</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setTimeRange('last_30m');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      timeRange === 'last_30m'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    Last 30 min
                  </button>
                  <button
                    onClick={() => {
                      setTimeRange('last_1h');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      timeRange === 'last_1h'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    Last 1 hour
                  </button>
                  <button
                    onClick={() => {
                      setTimeRange('last_24h');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      timeRange === 'last_24h'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    Last 24 hours
                  </button>
                  <button
                    onClick={() => {
                      setTimeRange('last_7d');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      timeRange === 'last_7d'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    Last 7 days
                  </button>
                  <button
                    onClick={() => {
                      setTimeRange('last_30d');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      timeRange === 'last_30d'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    Last 30 days
                  </button>
                  <button
                    onClick={() => {
                      setTimeRange('all');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      timeRange === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    All time
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportStats.totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CSP Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportStats.cspCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Generic Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportStats.genericCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CSP Enforced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.filter(r => isCSPReport(r) && r.disposition === 'enforce').length}
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
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>URL/Document</TableHead>
                    <TableHead>Blocked URI</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Status</TableHead>
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
                        <Badge variant={getReportTypeColor(report.reportType)}>
                          {report.reportType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {report.endpoint.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {isCSPReport(report) ? report.documentUri : report.url}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {isCSPReport(report) ? formatBlockedUri(report.blockedUri) : '-'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {isCSPReport(report) 
                          ? report.violatedDirective 
                          : (report.body ? JSON.stringify(report.body).substring(0, 50) + '...' : '-')
                        }
                      </TableCell>
                      <TableCell>
                        {isCSPReport(report) ? (
                          <Badge variant={getDispositionColor(report.disposition)}>
                            {report.disposition}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            {report.source}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination and Items Per Page Controls */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Items per page:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                    </select>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, reportStats.totalCount)} of {reportStats.totalCount} results
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                    className="px-3 py-1 text-sm border border-input rounded-md bg-background text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {/* Show page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 text-sm border border-input rounded-md transition-colors ${
                            currentPage === pageNum
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1 text-sm border border-input rounded-md bg-background text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-6xl w-[90vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedReport && isCSPReport(selectedReport) ? 'CSP Violation Report Details' : 'Report Details'}
            </DialogTitle>
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
                      <label className="text-sm font-medium">Report Type</label>
                      <div className="mt-1">
                        <Badge variant={getReportTypeColor(selectedReport.reportType)}>
                          {selectedReport.reportType}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Endpoint</label>
                      <div className="mt-1">
                        <Badge variant="outline" className="font-mono">
                          {selectedReport.endpoint.label}
                        </Badge>
                      </div>
                    </div>
                    {isCSPReport(selectedReport) && (
                      <div>
                        <label className="text-sm font-medium">Disposition</label>
                        <div className="mt-1">
                          <Badge variant={getDispositionColor(selectedReport.disposition)}>
                            {selectedReport.disposition}
                          </Badge>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium">{isCSPReport(selectedReport) ? 'Document URI' : 'URL'}</label>
                      <p className="text-sm break-all">
                        {isCSPReport(selectedReport) ? selectedReport.documentUri : selectedReport.url}
                      </p>
                    </div>
                    {isCSPReport(selectedReport) && selectedReport.referrer && (
                      <div>
                        <label className="text-sm font-medium">Referrer</label>
                        <p className="text-sm break-all">{selectedReport.referrer}</p>
                      </div>
                    )}
                    {!isCSPReport(selectedReport) && selectedReport.age && (
                      <div>
                        <label className="text-sm font-medium">Age (ms)</label>
                        <p className="text-sm">{selectedReport.age}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                    {isCSPReport(selectedReport) ? 'VIOLATION DETAILS' : 'REPORT DETAILS'}
                  </h3>
                  <div className="space-y-3">
                    {isCSPReport(selectedReport) ? (
                      <>
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
                      </>
                    ) : (
                      <div>
                        <label className="text-sm font-medium">Report Body</label>
                        <pre className="block bg-muted px-3 py-2 rounded text-sm mt-1 whitespace-pre-wrap overflow-x-auto max-h-40 border">
                          {selectedReport.body ? JSON.stringify(selectedReport.body, null, 2) : 'No body data'}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isCSPReport(selectedReport) && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">POLICY</h3>
                  <div>
                    <label className="text-sm font-medium">Original Policy</label>
                    <code className="block bg-muted px-3 py-2 rounded text-sm mt-1 whitespace-pre-wrap">
                      {selectedReport.originalPolicy}
                    </code>
                  </div>
                </div>
              )}

              {isCSPReport(selectedReport) && (selectedReport.sourceFile || selectedReport.lineNumber || selectedReport.columnNumber || selectedReport.scriptSample) && (
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

              {((isCSPReport(selectedReport) && selectedReport.statusCode) || selectedReport.userAgent) && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">ADDITIONAL INFORMATION</h3>
                  <div className="space-y-3">
                    {isCSPReport(selectedReport) && selectedReport.statusCode && (
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
                  <label className="text-sm font-medium">
                    {isCSPReport(selectedReport) ? 'Complete Raw CSP Report' : 'Complete Report Data'}
                  </label>
                  <pre className="block bg-muted px-3 py-2 rounded text-xs mt-1 whitespace-pre-wrap overflow-x-auto max-h-60 border">
                    {isCSPReport(selectedReport) 
                      ? selectedReport.rawReport 
                      : JSON.stringify(selectedReport, null, 2)
                    }
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

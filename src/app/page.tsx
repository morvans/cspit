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
  timestamp: string;
}

export default function Home() {
  const [reports, setReports] = useState<CspReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/reports');
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold">CSP Violation Reports</h1>
        <p className="text-muted-foreground mt-2">
          Monitor and analyze Content Security Policy violations
        </p>
      </div>

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
                  <TableHead>Document URI</TableHead>
                  <TableHead>Violated Directive</TableHead>
                  <TableHead>Blocked URI</TableHead>
                  <TableHead>Disposition</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-mono text-sm">
                      {formatTimestamp(report.timestamp)}
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
    </div>
  );
}

'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  Download, 
  Users, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  FileText,
  Zap
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Lead {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  title?: string;
  publicIdentifier?: string;
}

interface EnrichmentResult {
  totalLeads: number;
  enrichedCount: number;
  failedCount: number;
  enrichmentRate: string;
  results: Array<Lead & { enriched: boolean; error?: string; linkedInData?: any }>;
}

export function LinkedInLeadEnrichment() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [enrichmentResult, setEnrichmentResult] = useState<EnrichmentResult | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv') {
      toast.error('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const parsedLeads: Lead[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const values = line.split(',').map(v => v.trim());
          const lead: Lead = {
            id: `lead_${i}`,
          };

          headers.forEach((header, index) => {
            const value = values[index] || '';
            switch (header) {
              case 'firstname':
              case 'first_name':
                lead.firstName = value;
                break;
              case 'lastname':
              case 'last_name':
                lead.lastName = value;
                break;
              case 'email':
                lead.email = value;
                break;
              case 'company':
                lead.company = value;
                break;
              case 'title':
              case 'position':
                lead.title = value;
                break;
              case 'linkedin':
              case 'public_identifier':
                lead.publicIdentifier = value;
                break;
            }
          });

          if (lead.firstName || lead.lastName || lead.email) {
            parsedLeads.push(lead);
          }
        }

        setLeads(parsedLeads);
        toast.success(`Imported ${parsedLeads.length} leads`);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast.error('Error parsing CSV file');
      }
    };

    reader.readAsText(file);
  };

  const enrichLeads = async () => {
    if (leads.length === 0) {
      toast.error('No leads to enrich');
      return;
    }

    try {
      setIsEnriching(true);
      setProgress(0);

      const response = await fetch('/api/linkedin/enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leads }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to enrich leads');
      }

      const data = await response.json();
      setEnrichmentResult({
        totalLeads: data.statistics.totalLeads,
        enrichedCount: data.statistics.enrichedCount,
        failedCount: data.statistics.failedCount,
        enrichmentRate: data.statistics.enrichmentRate,
        results: data.enrichedLeads,
      });

      toast.success(`Enriched ${data.statistics.enrichedCount} out of ${data.statistics.totalLeads} leads`);
    } catch (error) {
      console.error('Error enriching leads:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to enrich leads');
    } finally {
      setIsEnriching(false);
      setProgress(100);
    }
  };

  const exportResults = () => {
    if (!enrichmentResult) return;

    const csvContent = [
      // Header
      'id,firstName,lastName,email,company,title,enriched,linkedInId,linkedInName,linkedInHeadline,linkedInProfileUrl',
      // Data
      ...enrichmentResult.results.map(lead => {
        const linkedInData = lead.linkedInData || {};
        return [
          lead.id,
          lead.firstName || '',
          lead.lastName || '',
          lead.email || '',
          lead.company || '',
          lead.title || '',
          lead.enriched ? 'Yes' : 'No',
          linkedInData.id || '',
          linkedInData.localizedFirstName && linkedInData.localizedLastName 
            ? `${linkedInData.localizedFirstName} ${linkedInData.localizedLastName}`
            : '',
          linkedInData.headline || '',
          linkedInData.profileUrl || ''
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin-enrichment-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Leads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">Upload CSV File</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="bg-zinc-900/50 border-zinc-700"
            />
            <p className="text-sm text-zinc-400">
              CSV should contain columns: firstName, lastName, email, company, title, publicIdentifier
            </p>
          </div>

          {leads.length > 0 && (
            <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-700">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-green-400" />
                <span className="text-white font-medium">
                  {leads.length} leads imported
                </span>
              </div>
              <div className="text-sm text-zinc-400">
                Sample: {leads[0]?.firstName} {leads[0]?.lastName} - {leads[0]?.company}
              </div>
            </div>
          )}

          <Button
            onClick={enrichLeads}
            disabled={isEnriching || leads.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Zap className="w-4 h-4 mr-2" />
            {isEnriching ? 'Enriching...' : 'Start Enrichment'}
          </Button>
        </CardContent>
      </Card>

      {/* Progress */}
      {isEnriching && (
        <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Enriching leads...</span>
                <span className="text-zinc-400">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {enrichmentResult && (
        <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Enrichment Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {enrichmentResult.totalLeads}
                </div>
                <div className="text-sm text-zinc-400">Total Leads</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">
                  {enrichmentResult.enrichedCount}
                </div>
                <div className="text-sm text-zinc-400">Enriched</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">
                  {enrichmentResult.failedCount}
                </div>
                <div className="text-sm text-zinc-400">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {enrichmentResult.enrichmentRate}
                </div>
                <div className="text-sm text-zinc-400">Success Rate</div>
              </div>
            </div>

            {/* Results List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {enrichmentResult.results.map((result, index) => (
                <div
                  key={result.id}
                  className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-700"
                >
                  <div className="flex items-center gap-3">
                    {result.enriched ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                    <div>
                      <div className="text-white font-medium">
                        {result.firstName} {result.lastName}
                      </div>
                      <div className="text-sm text-zinc-400">
                        {result.email} {result.company && `• ${result.company}`}
                      </div>
                      {result.error && (
                        <div className="text-sm text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {result.error}
                        </div>
                      )}
                    </div>
                  </div>
                  {result.enriched && result.linkedInData && (
                    <div className="text-right">
                      <div className="text-sm text-zinc-400">
                        LinkedIn Profile Found
                      </div>
                      <div className="text-xs text-zinc-500">
                        {result.linkedInData.localizedFirstName} {result.linkedInData.localizedLastName}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Export Button */}
            <Button
              onClick={exportResults}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Results
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
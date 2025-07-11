'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Search, UserPlus, Filter, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function CandidatesPage() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Users className="w-8 h-8 text-purple-500" />
              Candidates
            </h1>
            <p className="text-zinc-400 mt-2">
              Manage and track all candidates in your pipeline
            </p>
          </div>
          
          <Button className="bg-purple-600 hover:bg-purple-700">
            <UserPlus className="w-4 h-4 mr-2" />
            Add Candidate
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search candidates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-zinc-900/50 border-zinc-700 text-white placeholder-zinc-500"
            />
          </div>
          <Button variant="outline" className="border-zinc-700">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button variant="outline" className="border-zinc-700">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="bg-zinc-900/50 border border-zinc-800">
            <TabsTrigger value="all">All Candidates</TabsTrigger>
            <TabsTrigger value="active">Active Pipeline</TabsTrigger>
            <TabsTrigger value="new">New Applications</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
              <CardContent className="p-6">
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No candidates yet</h3>
                  <p className="text-zinc-400 mb-6">
                    Start by adding candidates or importing from your ATS
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Button variant="outline">Import from ATS</Button>
                    <Button className="bg-purple-600 hover:bg-purple-700">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add First Candidate
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="active">
            <p className="text-zinc-400 text-center py-8">No active candidates in the pipeline</p>
          </TabsContent>

          <TabsContent value="new">
            <p className="text-zinc-400 text-center py-8">No new applications</p>
          </TabsContent>

          <TabsContent value="archived">
            <p className="text-zinc-400 text-center py-8">No archived candidates</p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
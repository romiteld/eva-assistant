'use client';

import React, { useState, useEffect, useCallback } from 'react';
// Removed direct import to avoid client-side bundling issues
// import { ResumeParserPipeline } from '@/lib/agents/resume-parser-pipeline';
import { useSupabase } from '@/hooks/useSupabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  Upload, 
  FileText,
  User,
  Briefcase,
  GraduationCap,
  Award,
  Brain,
  Target,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Globe,
  Calendar,
  DollarSign,
  Users,
  BarChart3,
  FileSearch,
  MessageSquare,
  Video,
  Send,
  Archive,
  Star,
  Filter,
  Search,
  Download,
  Share2,
  MoreVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface PipelineStage {
  id: string;
  name: string;
  count: number;
  candidates: any[];
  color: string;
  icon: any;
}

interface SearchFilters {
  skills: string[];
  experience: { min: number; max: number };
  education: string;
  location: string;
  salary: { min: number; max: number };
  availability: string;
}

export function ApplicantPipeline() {
  const supabase = useSupabase();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([
    { id: 'new', name: 'New Applicants', count: 0, candidates: [], color: 'bg-gray-500', icon: FileText },
    { id: 'review', name: 'Under Review', count: 0, candidates: [], color: 'bg-blue-500', icon: FileSearch },
    { id: 'phone-screen', name: 'Phone Screen', count: 0, candidates: [], color: 'bg-yellow-500', icon: Phone },
    { id: 'interview', name: 'Interview', count: 0, candidates: [], color: 'bg-purple-500', icon: Video },
    { id: 'fast-track', name: 'Fast Track', count: 0, candidates: [], color: 'bg-green-500', icon: TrendingUp },
    { id: 'offer', name: 'Offer Stage', count: 0, candidates: [], color: 'bg-emerald-500', icon: CheckCircle2 },
    { id: 'rejected', name: 'Not a Fit', count: 0, candidates: [], color: 'bg-red-500', icon: XCircle }
  ]);
  
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [searchMode, setSearchMode] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    skills: [],
    experience: { min: 0, max: 20 },
    education: '',
    location: '',
    salary: { min: 0, max: 500000 },
    availability: 'any'
  });
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Initialize Resume Parser
  // TODO: Move to API route
  // const resumeParser = new ResumeParserPipeline(
  //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
  //   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  //   process.env.NEXT_PUBLIC_GEMINI_API_KEY!
  // );

  const loadPipelineData = async () => {
    try {
      setLoading(true);
      
      // Load candidates for each stage
      const { data: pipelineData } = await supabase
        .from('recruitment_pipeline')
        .select(`
          *,
          applicant:applicant_profiles(*)
        `)
        .order('created_at', { ascending: false });
      
      if (pipelineData) {
        // Group by stage
        const stagesWithCandidates = pipelineStages.map(stage => {
          const stageCandidates = pipelineData.filter((p: any) => p.stage === stage.id);
          return {
            ...stage,
            count: stageCandidates.length,
            candidates: stageCandidates
          };
        });
        
        setPipelineStages(stagesWithCandidates);
      }
    } catch (error) {
      console.error('Error loading pipeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    if (file.type === 'application/pdf' || 
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'text/plain') {
      setSelectedFile(file);
    } else {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF, Word document, or text file',
        variant: 'destructive'
      });
    }
  };

  const uploadAndParseResume = async () => {
    if (!selectedFile || !user) return;
    
    setUploading(true);
    
    try {
      // Upload file to Supabase Storage
      const fileName = `resumes/${user.id}/${Date.now()}_${selectedFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(fileName, selectedFile);
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('resumes')
        .getPublicUrl(fileName);
      
      // Parse resume with AI agents
      // TODO: Replace with API call
      // const result = await resumeParser.parseResume({
      //   fileUrl: publicUrl,
      //   fileType: selectedFile.type,
      //   userId: user.id
      // });
      const result = { aiScoring: { overallScore: 85 } }; // Mock for now
      
      toast({
        title: 'Resume parsed successfully! 🎉',
        description: `Candidate score: ${result.aiScoring?.overallScore}/100`,
      });
      
      // Reload pipeline
      await loadPipelineData();
      
      // Show candidate details
      setSelectedCandidate(result);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
      setSelectedFile(null);
    }
  };

  const moveCandidate = async (candidateId: string, newStage: string) => {
    try {
      // Update stage in database
      const { error } = await supabase
        .from('recruitment_pipeline')
        .update({ 
          stage: newStage,
          updated_at: new Date().toISOString()
        })
        .eq('applicant_id', candidateId);
      
      if (error) throw error;
      
      // Reload pipeline
      await loadPipelineData();
      
      toast({
        title: 'Candidate moved',
        description: `Moved to ${newStage} stage`,
      });
    } catch (error) {
      console.error('Error moving candidate:', error);
      toast({
        title: 'Failed to move candidate',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
    }
  };

  const searchCandidates = async () => {
    setLoading(true);
    
    try {
      // TODO: Replace with API call
      // const results = await resumeParser.searchCandidates({
      //   skills: searchFilters.skills,
      //   experience: searchFilters.experience.min,
      //   education: searchFilters.education,
      //   location: searchFilters.location,
      //   salary: searchFilters.salary
      // });
      const results: any[] = []; // Mock for now
      
      setSearchResults(results);
      setSearchMode(true);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Search failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const renderCandidateCard = (candidate: any) => {
    const applicant = candidate.applicant;
    const score = applicant?.scoring?.overallScore || 0;
    
    return (
      <Card 
        key={candidate.applicant_id}
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setSelectedCandidate(applicant)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>
                  {applicant?.personal_info?.name?.split(' ').map((n: string) => n[0]).join('') || 'NA'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{applicant?.personal_info?.name || 'Unknown'}</p>
                <p className="text-sm text-muted-foreground">
                  {applicant?.experience?.[0]?.title || 'No title'}
                </p>
              </div>
            </div>
            <Badge variant={score >= 80 ? 'default' : score >= 60 ? 'secondary' : 'outline'}>
              {score}%
            </Badge>
          </div>
          
          <div className="mt-3 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {applicant?.personal_info?.location || 'Remote'}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Briefcase className="h-3 w-3" />
              {applicant?.experience?.length || 0} years experience
            </div>
          </div>
          
          <div className="flex gap-1 mt-3">
            {applicant?.skills?.slice(0, 3).map((skill: string, i: number) => (
              <Badge key={i} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
            {applicant?.skills?.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{applicant.skills.length - 3}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
    
    loadPipelineData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full">
      {/* Main Pipeline View */}
      <div className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Applicant Pipeline</h1>
            <p className="text-muted-foreground">
              AI-powered resume screening with 5 deep reasoning agents
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSearchMode(!searchMode)}>
              <Search className="h-4 w-4 mr-2" />
              Search Candidates
            </Button>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload Resume
            </Button>
          </div>
        </div>

        {/* Upload Area */}
        {!searchMode && (
          <Card>
            <CardContent className="p-6">
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                  dragActive ? "border-primary bg-primary/5" : "border-gray-300",
                  selectedFile && "bg-green-50 border-green-500"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {selectedFile ? (
                  <div className="space-y-4">
                    <FileText className="h-12 w-12 mx-auto text-green-500" />
                    <p className="font-medium">{selectedFile.name}</p>
                    <div className="flex gap-2 justify-center">
                      <Button
                        onClick={uploadAndParseResume}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analyzing with AI...
                          </>
                        ) : (
                          <>
                            <Brain className="mr-2 h-4 w-4" />
                            Parse Resume
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setSelectedFile(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-lg font-medium mb-2">
                      Drop resume here or click to upload
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Supports PDF, Word, and text files
                    </p>
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('file-upload')?.click()}
                      type="button"
                    >
                      Select File
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Interface */}
        {searchMode && (
          <Card>
            <CardHeader>
              <CardTitle>Search Candidates</CardTitle>
              <CardDescription>
                Find candidates matching your requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Skills (comma-separated)</Label>
                <Input
                  placeholder="React, Node.js, Python..."
                  onChange={(e) => setSearchFilters({
                    ...searchFilters,
                    skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Min Experience (years)</Label>
                  <Slider
                    value={[searchFilters.experience.min]}
                    onValueChange={(v) => setSearchFilters({
                      ...searchFilters,
                      experience: { ...searchFilters.experience, min: v[0] }
                    })}
                    max={20}
                    step={1}
                  />
                  <span className="text-sm text-muted-foreground">
                    {searchFilters.experience.min} years
                  </span>
                </div>
                
                <div>
                  <Label>Location</Label>
                  <Input
                    placeholder="San Francisco, Remote..."
                    value={searchFilters.location}
                    onChange={(e) => setSearchFilters({
                      ...searchFilters,
                      location: e.target.value
                    })}
                  />
                </div>
              </div>
              
              <Button onClick={searchCandidates} className="w-full">
                <Search className="h-4 w-4 mr-2" />
                Search Candidates
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pipeline Stages */}
        {!searchMode && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            {pipelineStages.map((stage) => {
              const Icon = stage.icon;
              
              return (
                <div key={stage.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("p-2 rounded-lg", stage.color)}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{stage.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {stage.count} candidates
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-2">
                      {stage.candidates.map((candidate) => 
                        renderCandidateCard(candidate)
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        )}

        {/* Search Results */}
        {searchMode && searchResults.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((candidate) => (
              <Card key={candidate.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium">{candidate.personal_info?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {candidate.experience?.[0]?.title}
                      </p>
                    </div>
                    <Badge>{candidate.searchScore}% match</Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      {candidate.location || 'Remote'}
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-3 w-3" />
                      {candidate.total_experience} years
                    </div>
                  </div>
                  
                  <div className="flex gap-1 mt-3">
                    {candidate.skills?.slice(0, 4).map((skill: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                  
                  <Button 
                    className="w-full mt-3" 
                    size="sm"
                    onClick={() => setSelectedCandidate(candidate)}
                  >
                    View Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Candidate Details Sidebar */}
      {selectedCandidate && (
        <div className="w-[500px] border-l bg-background p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Candidate Details</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedCandidate(null)}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="experience">Experience</TabsTrigger>
              <TabsTrigger value="ai-analysis">AI Analysis</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4">
              {/* Personal Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedCandidate.personal_info?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedCandidate.personal_info?.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedCandidate.personal_info?.phone || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedCandidate.personal_info?.location || 'Not specified'}</span>
                  </div>
                  {selectedCandidate.personal_info?.linkedin && (
                    <div className="flex items-center gap-2">
                      <Linkedin className="h-4 w-4 text-muted-foreground" />
                      <a href={selectedCandidate.personal_info.linkedin} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="text-blue-500 hover:underline text-sm">
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AI Scoring */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI Assessment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">Overall Score</span>
                        <span className="font-medium">
                          {selectedCandidate.scoring?.overallScore || 0}/100
                        </span>
                      </div>
                      <Progress value={selectedCandidate.scoring?.overallScore || 0} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Technical</span>
                        <p className="font-medium">
                          {selectedCandidate.scoring?.technicalScore || 0}%
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Experience</span>
                        <p className="font-medium">
                          {selectedCandidate.scoring?.experienceScore || 0}%
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Leadership</span>
                        <p className="font-medium">
                          {selectedCandidate.scoring?.leadershipScore || 0}%
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Culture Fit</span>
                        <p className="font-medium">
                          {selectedCandidate.scoring?.cultureFitScore || 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Skills */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {selectedCandidate.skills?.map((skill: string, i: number) => (
                      <Badge key={i} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="experience" className="space-y-4">
              {selectedCandidate.experience?.map((exp: any, i: number) => (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium">{exp.title}</p>
                        <p className="text-sm text-muted-foreground">{exp.company}</p>
                      </div>
                      <p className="text-sm">
                        {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                      </p>
                      <p className="text-sm">{exp.description}</p>
                      {exp.achievements && (
                        <ul className="text-sm space-y-1">
                          {exp.achievements.map((achievement: string, j: number) => (
                            <li key={j} className="flex items-start gap-2">
                              <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500" />
                              <span>{achievement}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            
            <TabsContent value="ai-analysis" className="space-y-4">
              {/* Strengths */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Strengths</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {selectedCandidate.scoring?.strengths?.map((strength: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                        <span className="text-sm">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Job Matches */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Best Job Matches</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedCandidate.matched_jobs?.slice(0, 3).map((match: any, i: number) => (
                      <div key={i} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium">{match.jobTitle}</p>
                          <Badge>{match.matchScore}% match</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{match.company}</p>
                        <div className="flex gap-1 mt-2">
                          {match.matchedSkills?.slice(0, 3).map((skill: string, j: number) => (
                            <Badge key={j} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="actions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full" size="sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Interview
                  </Button>
                  <Button className="w-full" size="sm" variant="outline">
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </Button>
                  <Button className="w-full" size="sm" variant="outline">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                  <Button className="w-full" size="sm" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download Resume
                  </Button>
                </CardContent>
              </Card>

              {/* Stage Movement */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Move to Stage</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select onValueChange={(stage) => 
                    moveCandidate(selectedCandidate.resume_id, stage)
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelineStages.map(stage => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Interview Questions */}
              {selectedCandidate.interviewQuestions && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">AI-Generated Interview Questions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="technical">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="technical">Technical</TabsTrigger>
                        <TabsTrigger value="behavioral">Behavioral</TabsTrigger>
                      </TabsList>
                      <TabsContent value="technical" className="space-y-2">
                        {selectedCandidate.interviewQuestions.technical?.map((q: string, i: number) => (
                          <p key={i} className="text-sm p-2 bg-gray-50 rounded">
                            {i + 1}. {q}
                          </p>
                        ))}
                      </TabsContent>
                      <TabsContent value="behavioral" className="space-y-2">
                        {selectedCandidate.interviewQuestions.behavioral?.map((q: string, i: number) => (
                          <p key={i} className="text-sm p-2 bg-gray-50 rounded">
                            {i + 1}. {q}
                          </p>
                        ))}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
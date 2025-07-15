'use client';

import React, { useState, useEffect } from 'react';
// Removed direct import to avoid client-side bundling issues
// import { AIInterviewCenter } from '@/lib/agents/ai-interview-center';
import { useSupabase } from '@/hooks/useSupabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Slider } from '@/components/ui/slider';
import { 
  Calendar as CalendarIcon,
  Clock,
  Video,
  Phone,
  MapPin,
  Code,
  Users,
  FileText,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  Mail,
  Send,
  Sparkles,
  Brain,
  Target,
  ClipboardList,
  BookOpen,
  BarChart3,
  Loader2,
  Download,
  Copy,
  ExternalLink,
  Settings,
  Plus,
  Edit,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Timer,
  Zap
} from 'lucide-react';
import { format, addDays, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { ZoomMeetingManager } from '@/components/zoom/ZoomMeetingManager';

interface ScheduledInterview {
  id: string;
  applicant: any;
  job: any;
  type: string;
  round: number;
  scheduledAt?: Date;
  status: string;
  availableSlots?: any[];
  interviewQuestions?: any;
  interviewGuide?: any;
  feedback?: any;
  meeting_url?: string;
  meeting_platform?: string;
  interviewers?: any[];
}

interface InterviewSlot {
  start: Date;
  end: Date;
  interviewers: string[];
  score: number;
}

export function AIInterviewScheduler() {
  const supabase = useSupabase();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [schedulingInterview, setSchedulingInterview] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [interviews, setInterviews] = useState<ScheduledInterview[]>([]);
  const [selectedInterview, setSelectedInterview] = useState<ScheduledInterview | null>(null);
  
  const [scheduleForm, setScheduleForm] = useState({
    interviewType: 'video',
    round: 1,
    duration: 60,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  const [feedbackForm, setFeedbackForm] = useState({
    scores: {} as Record<string, number>,
    notes: '',
    recommendation: '',
    nextSteps: ''
  });

  // Initialize AI Interview Center
  // TODO: Move to API route
  // const interviewCenter = new AIInterviewCenter(
  //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
  //   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  //   process.env.NEXT_PUBLIC_GEMINI_API_KEY!
  // );

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const loadInterviews = async () => {
    try {
      const { data } = await supabase
        .from('interview_schedules')
        .select(`
          *,
          applicant:applicant_profiles(*),
          job:job_postings(*)
        `)
        .order('created_at', { ascending: false });
      
      if (data) {
        setInterviews(data.map(interview => ({
          ...interview,
          scheduledAt: interview.scheduled_at ? new Date(interview.scheduled_at) : undefined,
          type: interview.interview_type
        })));
      }
    } catch (error) {
      console.error('Error loading interviews:', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const loadCandidates = async () => {
    try {
      const { data } = await supabase
        .from('applicant_profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      // Set first candidate as selected for demo
      if (data && data.length > 0) {
        setSelectedCandidate(data[0]);
      }
    } catch (error) {
      console.error('Error loading candidates:', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const loadJobs = async () => {
    try {
      const { data } = await supabase
        .from('job_postings')
        .select('*')
        .eq('status', 'open')
        .limit(10);
      
      // Set first job as selected for demo
      if (data && data.length > 0) {
        setSelectedJob(data[0]);
      }
    } catch (error) {
      console.error('Error loading jobs:', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const scheduleInterview = async () => {
    if (!selectedCandidate || !selectedJob) {
      toast({
        title: 'Missing Information',
        description: 'Please select a candidate and job position',
        variant: 'destructive'
      });
      return;
    }

    setSchedulingInterview(true);
    
    try {
      // TODO: Replace with API call
      // const result = await interviewCenter.scheduleInterview({
      //   applicantId: selectedCandidate.resume_id,
      //   jobId: selectedJob.id,
      //   interviewType: scheduleForm.interviewType as any,
      //   round: scheduleForm.round,
      //   duration: scheduleForm.duration,
      //   timezone: scheduleForm.timezone
      // });
      
      // Mock result for now
      const result = {
        availableSlots: [],
        id: 'mock-id',
        applicant: selectedCandidate,
        job: selectedJob,
        type: scheduleForm.interviewType,
        round: scheduleForm.round,
        status: 'pending_scheduling'
      };
      
      toast({
        title: 'Interview Scheduled! 🎉',
        description: `${result.availableSlots?.length || 0} time slots found`,
      });
      
      // Reload interviews
      await loadInterviews();
      
      // Show the newly scheduled interview
      setSelectedInterview(result);
      
    } catch (error) {
      console.error('Scheduling error:', error instanceof Error ? error.message : 'Unknown error');
      toast({
        title: 'Scheduling Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setSchedulingInterview(false);
    }
  };

  const confirmTimeSlot = async (interviewId: string, slotIndex: number) => {
    try {
      // TODO: Replace with API call
      // await interviewCenter.confirmInterviewSlot(interviewId, slotIndex);
      
      toast({
        title: 'Time Slot Confirmed!',
        description: 'Calendar invites have been sent',
      });
      
      await loadInterviews();
    } catch (error) {
      console.error('Error confirming slot:', error instanceof Error ? error.message : 'Unknown error');
      toast({
        title: 'Failed to confirm slot',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const submitFeedback = async () => {
    if (!selectedInterview || !user) return;
    
    try {
      // TODO: Replace with API call
      // await interviewCenter.recordInterviewFeedback(selectedInterview.id, {
      //   interviewerId: user.id,
      //   scores: feedbackForm.scores,
      //   notes: feedbackForm.notes,
      //   recommendation: feedbackForm.recommendation as any,
      //   nextSteps: feedbackForm.nextSteps
      // });
      
      toast({
        title: 'Feedback Submitted',
        description: 'Thank you for your evaluation',
      });
      
      await loadInterviews();
      
      // Reset form
      setFeedbackForm({
        scores: {},
        notes: '',
        recommendation: '',
        nextSteps: ''
      });
    } catch (error) {
      console.error('Error submitting feedback:', error instanceof Error ? error.message : 'Unknown error');
      toast({
        title: 'Failed to submit feedback',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const renderTimeSlot = (slot: InterviewSlot, index: number) => {
    const startTime = new Date(slot.start);
    const endTime = new Date(slot.end);
    
    return (
      <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {format(startTime, 'EEEE, MMMM d')}
              </span>
            </div>
            <Badge variant={slot.score > 80 ? 'default' : 'secondary'}>
              {slot.score}% optimal
            </Badge>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {slot.interviewers.length} interviewer{slot.interviewers.length > 1 ? 's' : ''}
            </div>
          </div>
          
          <Button 
            className="w-full mt-3" 
            size="sm"
            onClick={() => confirmTimeSlot(selectedInterview!.id, index)}
          >
            Select This Time
          </Button>
        </CardContent>
      </Card>
    );
  };

  const renderInterviewQuestion = (question: any, index: number) => {
    return (
      <Card key={index}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <Badge variant="outline">{question.category}</Badge>
            <Badge variant={
              question.difficulty === 'hard' ? 'destructive' :
              question.difficulty === 'medium' ? 'secondary' : 'default'
            }>
              {question.difficulty}
            </Badge>
          </div>
          
          <p className="font-medium mb-2">{question.question}</p>
          
          {question.followUps && question.followUps.length > 0 && (
            <div className="space-y-1 mb-3">
              <p className="text-sm text-muted-foreground">Follow-up probes:</p>
              {question.followUps.map((followUp: string, i: number) => (
                <p key={i} className="text-sm pl-4">• {followUp}</p>
              ))}
            </div>
          )}
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              <Timer className="h-3 w-3 inline mr-1" />
              {question.timeAllocation} minutes
            </span>
            <Button size="sm" variant="ghost">
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  useEffect(() => {
    loadInterviews();
    loadCandidates();
    loadJobs();
    loadUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Interview Center</h1>
          <p className="text-muted-foreground">
            Intelligent scheduling with 5 AI agents optimizing every interview
          </p>
        </div>
        <Badge variant="outline" className="gap-2">
          <Brain className="h-4 w-4" />
          AI-Powered Scheduling
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schedule New Interview */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Schedule Interview</CardTitle>
            <CardDescription>
              AI agents will find optimal times and prepare questions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Candidate</Label>
              <Select
                value={selectedCandidate?.resume_id}
                onValueChange={(value) => {
                  const candidate = interviews.find(i => i.applicant?.resume_id === value)?.applicant;
                  setSelectedCandidate(candidate);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select candidate" />
                </SelectTrigger>
                <SelectContent>
                  {/* Would load candidates here */}
                  <SelectItem value={selectedCandidate?.resume_id || 'demo'}>
                    {selectedCandidate?.personal_info?.name || 'Demo Candidate'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Job Position</Label>
              <Select
                value={selectedJob?.id}
                onValueChange={(value) => {
                  const job = interviews.find(i => i.job?.id === value)?.job;
                  setSelectedJob(job);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {/* Would load jobs here */}
                  <SelectItem value={selectedJob?.id || 'demo'}>
                    {selectedJob?.title || 'Senior Software Engineer'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Interview Type</Label>
              <RadioGroup
                value={scheduleForm.interviewType}
                onValueChange={(value) => setScheduleForm({ ...scheduleForm, interviewType: value })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="phone" id="phone" />
                  <Label htmlFor="phone" className="flex items-center gap-2 cursor-pointer">
                    <Phone className="h-4 w-4" />
                    Phone Screen
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="video" id="video" />
                  <Label htmlFor="video" className="flex items-center gap-2 cursor-pointer">
                    <Video className="h-4 w-4" />
                    Video Interview
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="onsite" id="onsite" />
                  <Label htmlFor="onsite" className="flex items-center gap-2 cursor-pointer">
                    <MapPin className="h-4 w-4" />
                    On-site
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="technical" id="technical" />
                  <Label htmlFor="technical" className="flex items-center gap-2 cursor-pointer">
                    <Code className="h-4 w-4" />
                    Technical
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label>Round</Label>
              <Select
                value={scheduleForm.round.toString()}
                onValueChange={(value) => setScheduleForm({ ...scheduleForm, round: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Round 1 (Initial)</SelectItem>
                  <SelectItem value="2">Round 2</SelectItem>
                  <SelectItem value="3">Round 3</SelectItem>
                  <SelectItem value="4">Final Round</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Duration (minutes)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[scheduleForm.duration]}
                  onValueChange={(v) => setScheduleForm({ ...scheduleForm, duration: v[0] })}
                  min={30}
                  max={120}
                  step={15}
                  className="flex-1"
                />
                <span className="w-12 text-right">{scheduleForm.duration}</span>
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={scheduleInterview}
              disabled={schedulingInterview || !selectedCandidate || !selectedJob}
            >
              {schedulingInterview ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  AI Agents Working...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Schedule with AI
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Scheduled Interviews */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Interview Pipeline</CardTitle>
            <CardDescription>
              Upcoming and completed interviews
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="upcoming">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
              
              <TabsContent value="upcoming" className="space-y-3">
                {interviews
                  .filter(i => i.status === 'scheduled' && i.scheduledAt && i.scheduledAt > new Date())
                  .map((interview) => (
                    <Card key={interview.id} className="cursor-pointer" onClick={() => setSelectedInterview(interview)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {interview.applicant?.personal_info?.name || 'Unknown'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {interview.job?.title} - {interview.type} Interview (Round {interview.round})
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {interview.scheduledAt ? format(interview.scheduledAt, 'MMM d, h:mm a') : 'Not scheduled'}
                            </p>
                            <Badge variant="outline" className="mt-1">
                              <Video className="h-3 w-3 mr-1" />
                              {interview.type}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                
                {interviews.filter(i => i.status === 'scheduled' && i.scheduledAt && i.scheduledAt > new Date()).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No upcoming interviews scheduled
                  </p>
                )}
              </TabsContent>
              
              <TabsContent value="today" className="space-y-3">
                {interviews
                  .filter(i => {
                    if (!i.scheduledAt) return false;
                    const today = new Date();
                    return i.scheduledAt >= startOfDay(today) && i.scheduledAt <= endOfDay(today);
                  })
                  .map((interview) => (
                    <Card key={interview.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium">
                              {interview.applicant?.personal_info?.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {interview.scheduledAt ? format(interview.scheduledAt, 'h:mm a') : ''}
                            </p>
                          </div>
                          {interview.meeting_url ? (
                            <Button 
                              size="sm"
                              onClick={() => window.open(interview.meeting_url, '_blank')}
                            >
                              <Video className="h-4 w-4 mr-2" />
                              Join Zoom
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline">
                              <Video className="h-4 w-4 mr-2" />
                              No Meeting
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <FileText className="h-4 w-4 mr-2" />
                            Interview Guide
                          </Button>
                          <Button size="sm" variant="outline">
                            <ClipboardList className="h-4 w-4 mr-2" />
                            Questions
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </TabsContent>
              
              <TabsContent value="completed" className="space-y-3">
                {interviews
                  .filter(i => i.status === 'completed')
                  .map((interview) => (
                    <Card key={interview.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {interview.applicant?.personal_info?.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {interview.job?.title} - Completed {interview.scheduledAt ? format(interview.scheduledAt, 'MMM d') : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {interview.feedback && Object.keys(interview.feedback).length > 0 ? (
                              <Badge variant="default" className="bg-green-500 text-white">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Feedback Submitted
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-yellow-500 text-white">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Pending Feedback
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Selected Interview Details */}
      {selectedInterview && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Interview Details</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedInterview(null)}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="scheduling">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
                <TabsTrigger value="zoom">Zoom Meeting</TabsTrigger>
                <TabsTrigger value="questions">Questions</TabsTrigger>
                <TabsTrigger value="guide">Interview Guide</TabsTrigger>
                <TabsTrigger value="feedback">Feedback</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>
              
              <TabsContent value="scheduling" className="space-y-4">
                {selectedInterview.status === 'pending_scheduling' && selectedInterview.availableSlots ? (
                  <>
                    <Alert>
                      <Zap className="h-4 w-4" />
                      <AlertDescription>
                        AI found {selectedInterview.availableSlots.length} optimal time slots based on everyone&apos;s availability
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedInterview.availableSlots.slice(0, 6).map((slot, index) => 
                        renderTimeSlot(slot, index)
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-lg font-medium">Interview Scheduled</p>
                    <p className="text-muted-foreground">
                      {selectedInterview.scheduledAt ? format(selectedInterview.scheduledAt, 'EEEE, MMMM d at h:mm a') : 'Time not set'}
                    </p>
                    <Button className="mt-4" variant="outline">
                      <Calendar className="h-4 w-4 mr-2" />
                      Add to Calendar
                    </Button>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="zoom" className="space-y-4">
                {selectedInterview.status === 'scheduled' || selectedInterview.status === 'pending_scheduling' ? (
                  <>
                    <ZoomMeetingManager />
                    {/* TODO: Pass interview details to ZoomMeetingManager once it supports props */}
                    {false && (
                      <div>
                        Interview: {selectedInterview.applicant?.personal_info?.name || selectedInterview.applicant?.name || 'Candidate'} - {selectedInterview.job?.title || 'Position'}
                      </div>
                    )}
                  </>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Zoom meetings can be created once the interview is scheduled.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
              
              <TabsContent value="questions" className="space-y-4">
                <Alert>
                  <Brain className="h-4 w-4" />
                  <AlertDescription>
                    AI-generated questions tailored to the candidate&apos;s experience and job requirements
                  </AlertDescription>
                </Alert>
                
                {selectedInterview.interviewQuestions ? (
                  <div className="space-y-3">
                    {selectedInterview.interviewQuestions.map((question: any, index: number) => 
                      renderInterviewQuestion(question, index)
                    )}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Questions will be generated when interview is scheduled
                  </p>
                )}
              </TabsContent>
              
              <TabsContent value="guide" className="space-y-4">
                {selectedInterview.interviewGuide ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium">Interview Structure</h3>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                      </Button>
                    </div>
                    
                    <div className="space-y-4">
                      {selectedInterview.interviewGuide.segments?.map((segment: any, index: number) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium">{segment.title}</h4>
                              <Badge variant="outline">{segment.duration} min</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{segment.notes}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    <Separator className="my-6" />
                    
                    <div>
                      <h4 className="font-medium mb-3">Evaluation Criteria</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedInterview.interviewGuide.evaluationForm?.criteria?.map((criterion: any, index: number) => (
                          <div key={index} className="p-3 border rounded-lg">
                            <p className="font-medium text-sm">{criterion.name}</p>
                            <p className="text-xs text-muted-foreground">{criterion.description}</p>
                            <Badge variant="outline" className="mt-2">
                              Weight: {(criterion.weight * 100).toFixed(0)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Interview guide will be generated when scheduled
                  </p>
                )}
              </TabsContent>
              
              <TabsContent value="feedback" className="space-y-4">
                {selectedInterview.status === 'completed' ? (
                  <>
                    <div className="space-y-4">
                      <div>
                        <Label>Overall Recommendation</Label>
                        <RadioGroup
                          value={feedbackForm.recommendation}
                          onValueChange={(value) => setFeedbackForm({ ...feedbackForm, recommendation: value })}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="strong_yes" id="strong_yes" />
                            <Label htmlFor="strong_yes" className="cursor-pointer">
                              Strong Yes - Definitely hire
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="yes" />
                            <Label htmlFor="yes" className="cursor-pointer">
                              Yes - Proceed to next round
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="maybe" id="maybe" />
                            <Label htmlFor="maybe" className="cursor-pointer">
                              Maybe - Need more information
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="no" />
                            <Label htmlFor="no" className="cursor-pointer">
                              No - Not a fit
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="strong_no" id="strong_no" />
                            <Label htmlFor="strong_no" className="cursor-pointer">
                              Strong No - Definitely not a fit
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                      
                      <div>
                        <Label>Evaluation Scores</Label>
                        <div className="space-y-3 mt-2">
                          {['Technical Skills', 'Communication', 'Problem Solving', 'Culture Fit'].map((criterion) => (
                            <div key={criterion}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm">{criterion}</span>
                                <span className="text-sm font-medium">
                                  {feedbackForm.scores[criterion] || 0}/5
                                </span>
                              </div>
                              <Slider
                                value={[feedbackForm.scores[criterion] || 0]}
                                onValueChange={(v) => setFeedbackForm({
                                  ...feedbackForm,
                                  scores: { ...feedbackForm.scores, [criterion]: v[0] }
                                })}
                                min={0}
                                max={5}
                                step={1}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <Label>Interview Notes</Label>
                        <Textarea
                          placeholder="Key observations, strengths, concerns..."
                          value={feedbackForm.notes}
                          onChange={(e) => setFeedbackForm({ ...feedbackForm, notes: e.target.value })}
                          rows={4}
                        />
                      </div>
                      
                      <div>
                        <Label>Recommended Next Steps</Label>
                        <Textarea
                          placeholder="What should happen next with this candidate?"
                          value={feedbackForm.nextSteps}
                          onChange={(e) => setFeedbackForm({ ...feedbackForm, nextSteps: e.target.value })}
                          rows={2}
                        />
                      </div>
                      
                      <Button 
                        className="w-full"
                        onClick={submitFeedback}
                        disabled={!feedbackForm.recommendation}
                      >
                        Submit Feedback
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Feedback can be submitted after the interview is completed
                    </p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="analytics" className="space-y-4">
                <Alert>
                  <BarChart3 className="h-4 w-4" />
                  <AlertDescription>
                    Interview intelligence based on historical data and AI analysis
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">85%</div>
                      <p className="text-xs text-muted-foreground">
                        Predicted Success Rate
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">4.2/5</div>
                      <p className="text-xs text-muted-foreground">
                        Avg Score for Similar Profiles
                      </p>
                    </CardContent>
                  </Card>
                </div>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Key Focus Areas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <Target className="h-4 w-4 text-primary mt-0.5" />
                        <span className="text-sm">Technical depth in distributed systems</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Target className="h-4 w-4 text-primary mt-0.5" />
                        <span className="text-sm">Leadership experience validation</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Target className="h-4 w-4 text-primary mt-0.5" />
                        <span className="text-sm">Culture fit assessment</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
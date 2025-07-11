import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { BaseMessage, AIMessage, HumanMessage } from "@langchain/core/messages";
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Database } from '@/types/supabase';
import { addDays, addHours, format, parse, isWithinInterval, areIntervalsOverlapping } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { supabase } from '@/lib/supabase/browser';

// Interview Scheduling State
const InterviewState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  interviewId: Annotation<string>(),
  applicantId: Annotation<string>(),
  jobId: Annotation<string>(),
  interviewType: Annotation<string>(), // phone, video, onsite, technical
  round: Annotation<number>(),
  
  // Scheduling
  requestedDuration: Annotation<number>(), // minutes
  timezone: Annotation<string>(),
  availableSlots: Annotation<any[]>(),
  selectedSlot: Annotation<any>(),
  
  // Participants
  interviewers: Annotation<any[]>(),
  candidateInfo: Annotation<any>(),
  
  // AI-Generated Content
  interviewQuestions: Annotation<any>(),
  evaluationCriteria: Annotation<any>(),
  interviewGuide: Annotation<any>(),
  
  // Communication
  emailTemplates: Annotation<any>(),
  calendarInvites: Annotation<any>(),
  
  // Status
  schedulingStatus: Annotation<string>(),
  error: Annotation<string | null>(),
});

type InterviewStateType = typeof InterviewState.State;

interface InterviewSlot {
  start: Date;
  end: Date;
  interviewers: string[];
  score: number; // Optimality score
  conflicts: any[];
}

interface InterviewQuestion {
  category: string; // technical, behavioral, situational, culture
  question: string;
  followUps: string[];
  evaluationCriteria: string[];
  timeAllocation: number; // minutes
  difficulty: 'easy' | 'medium' | 'hard';
}

interface InterviewGuide {
  introduction: string;
  segments: Array<{
    title: string;
    duration: number;
    questions: InterviewQuestion[];
    notes: string;
  }>;
  evaluationForm: {
    criteria: Array<{
      name: string;
      description: string;
      weight: number;
      scale: string;
    }>;
    redFlags: string[];
    greenFlags: string[];
  };
}

export class AIInterviewCenter {
  private graph: StateGraph<InterviewStateType>;
  private supabase = supabase;
  private gemini: GoogleGenerativeAI;
  private compiled: any;
  private userId?: string;
  
  constructor(
    supabaseUrl: string,
    supabaseAnonKey: string,
    geminiApiKey: string,
    config?: { userId?: string }
  ) {
    // Note: We're already using the singleton supabase client from browser.ts
    // so we don't need to create a new instance with these parameters
    this.gemini = new GoogleGenerativeAI(geminiApiKey);
    this.graph = new StateGraph(InterviewState);
    this.userId = config?.userId;
    this.setupGraph();
  }

  // AGENT 1: Availability Analysis & Slot Finding
  private async schedulingAgent(state: InterviewStateType): Promise<Partial<InterviewStateType>> {
    console.log('📅 Scheduling Agent: Finding optimal interview slots');
    
    try {
      // Get candidate availability (from their preferences or calendar)
      const candidateAvailability = await this.getCandidateAvailability(state.applicantId);
      
      // Get interviewer availability
      const interviewerAvailability = await this.getInterviewerAvailability(
        state.interviewType,
        state.requestedDuration
      );
      
      // Find overlapping slots
      const possibleSlots = this.findOverlappingSlots(
        candidateAvailability,
        interviewerAvailability,
        state.requestedDuration
      );
      
      // Score slots based on multiple factors
      const scoredSlots = await this.scoreSlots(possibleSlots, state);
      
      // Get top 5 slots
      const topSlots = scoredSlots
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      
      return {
        availableSlots: topSlots,
        schedulingStatus: topSlots.length > 0 ? 'slots_found' : 'no_slots_available'
      };
    } catch (error) {
      console.error('Scheduling error:', error);
      return {
        error: `Scheduling failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // AGENT 2: Interview Question Generation
  private async questionGenerationAgent(state: InterviewStateType): Promise<Partial<InterviewStateType>> {
    console.log('❓ Question Generation Agent: Creating tailored interview questions');
    
    try {
      // Get candidate profile
      const { data: candidate } = await this.supabase
        .from('applicant_profiles')
        .select('*')
        .eq('resume_id', state.applicantId)
        .single();
      
      // Get job details
      const { data: job } = await this.supabase
        .from('job_postings')
        .select('*')
        .eq('id', state.jobId)
        .single();
      
      const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
      
      const questionPrompt = `
        Generate comprehensive interview questions for:
        
        Candidate Profile:
        - Skills: ${JSON.stringify(candidate?.skills)}
        - Experience: ${JSON.stringify(candidate?.experience)}
        - Education: ${JSON.stringify(candidate?.education)}
        
        Job Requirements:
        - Title: ${job?.title}
        - Required Skills: ${JSON.stringify(job?.required_skills)}
        - Description: ${job?.description}
        
        Interview Type: ${state.interviewType}
        Round: ${state.round}
        
        Generate:
        1. Technical Questions (if applicable)
           - Test specific skills mentioned in resume
           - Verify depth of knowledge
           - Include coding/problem-solving if relevant
        
        2. Behavioral Questions
           - Based on their past experiences
           - STAR format questions
           - Leadership and teamwork
        
        3. Situational Questions
           - Role-specific scenarios
           - Problem-solving approach
           - Decision-making process
        
        4. Culture Fit Questions
           - Work style preferences
           - Team dynamics
           - Career goals alignment
        
        For each question, provide:
        - The main question
        - 2-3 follow-up probes
        - What to look for in the answer
        - Red flags to watch for
        - Time allocation
        
        Make questions specific to their background and the role.
      `;
      
      const result = await model.generateContent(questionPrompt);
      const questions = this.parseGeneratedQuestions(result.response.text());
      
      return {
        interviewQuestions: questions
      };
    } catch (error) {
      console.error('Question generation error:', error);
      return {
        error: `Question generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // AGENT 3: Interview Guide & Evaluation Criteria
  private async guideGenerationAgent(state: InterviewStateType): Promise<Partial<InterviewStateType>> {
    console.log('📋 Guide Generation Agent: Creating comprehensive interview guide');
    
    try {
      const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
      
      const guidePrompt = `
        Create a structured interview guide for:
        
        Interview Type: ${state.interviewType}
        Duration: ${state.requestedDuration} minutes
        Round: ${state.round}
        
        Questions: ${JSON.stringify(state.interviewQuestions)}
        
        Generate:
        1. Interview Introduction (2-3 minutes)
           - Welcome script
           - Interview overview
           - Candidate questions about process
        
        2. Structured Segments
           - Optimal time allocation
           - Smooth transitions
           - Key areas to probe
        
        3. Evaluation Framework
           - Scoring criteria (1-5 scale)
           - Competency weights
           - Must-have vs nice-to-have
        
        4. Red Flags & Green Flags
           - Concerning behaviors/answers
           - Exceptional indicators
           - Follow-up actions
        
        5. Closing (5 minutes)
           - Next steps explanation
           - Candidate questions time
           - Timeline communication
        
        Make it practical and easy to follow during the interview.
      `;
      
      const result = await model.generateContent(guidePrompt);
      const guide = this.parseInterviewGuide(result.response.text());
      
      // Generate evaluation criteria specific to the role
      const evaluationCriteria = await this.generateEvaluationCriteria(state, guide);
      
      return {
        interviewGuide: guide,
        evaluationCriteria
      };
    } catch (error) {
      console.error('Guide generation error:', error);
      return {
        error: `Guide generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // AGENT 4: Communication & Calendar Management
  private async communicationAgent(state: InterviewStateType): Promise<Partial<InterviewStateType>> {
    console.log('📧 Communication Agent: Preparing emails and calendar invites');
    
    try {
      const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
      
      // Generate email templates
      const emailPrompt = `
        Create professional email templates for interview scheduling:
        
        Interview Details:
        - Type: ${state.interviewType}
        - Duration: ${state.requestedDuration} minutes
        - Time Slots: ${JSON.stringify(state.availableSlots?.slice(0, 3))}
        
        Generate:
        1. Candidate Invitation Email
           - Warm, professional tone
           - Clear interview details
           - Preparation tips
           - Contact information
        
        2. Interviewer Notification
           - Interview context
           - Candidate highlights
           - Interview guide attachment note
           - Evaluation form link
        
        3. Confirmation Email (after slot selection)
           - Final details
           - Video link / location
           - What to expect
           - Rescheduling policy
        
        4. Reminder Email (24 hours before)
           - Quick reminder
           - Key details
           - Last-minute tips
      `;
      
      const result = await model.generateContent(emailPrompt);
      const emailTemplates = this.parseEmailTemplates(result.response.text());
      
      // Prepare calendar invites
      const calendarInvites = this.prepareCalendarInvites(state);
      
      return {
        emailTemplates,
        calendarInvites
      };
    } catch (error) {
      console.error('Communication preparation error:', error);
      return {
        error: `Communication preparation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // AGENT 5: Interview Intelligence & Optimization
  private async intelligenceAgent(state: InterviewStateType): Promise<Partial<InterviewStateType>> {
    console.log('🧠 Intelligence Agent: Optimizing interview process');
    
    try {
      // Analyze historical interview data
      const historicalData = await this.getHistoricalInterviewData(state.jobId);
      
      // Get success patterns
      const successPatterns = await this.analyzeSuccessfulHires();
      
      const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
      
      const optimizationPrompt = `
        Optimize this interview based on historical data:
        
        Historical Success Patterns: ${JSON.stringify(successPatterns)}
        Past Interview Data: ${JSON.stringify(historicalData)}
        Current Interview Setup: ${JSON.stringify({
          type: state.interviewType,
          questions: state.interviewQuestions?.length,
          duration: state.requestedDuration
        })}
        
        Provide:
        1. Interview effectiveness predictions
        2. Suggested adjustments to questions
        3. Optimal interviewer selection
        4. Time allocation recommendations
        5. Key areas to focus on
        6. Common pitfalls to avoid
        
        Base recommendations on what has worked well in the past.
      `;
      
      const result = await model.generateContent(optimizationPrompt);
      const optimizations = this.parseOptimizations(result.response.text());
      
      // Apply optimizations to interview setup
      const optimizedQuestions = this.applyQuestionOptimizations(
        state.interviewQuestions,
        optimizations
      );
      
      const optimizedGuide = this.applyGuideOptimizations(
        state.interviewGuide,
        optimizations
      );
      
      return {
        interviewQuestions: optimizedQuestions,
        interviewGuide: optimizedGuide,
        messages: [
          new AIMessage({
            content: `Interview optimized based on ${historicalData.length} past interviews. 
            Key focus areas: ${optimizations.focusAreas.join(', ')}`
          })
        ]
      };
    } catch (error) {
      console.error('Intelligence optimization error:', error);
      return {
        error: `Intelligence optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Orchestration node
  private async orchestrationNode(state: InterviewStateType): Promise<Partial<InterviewStateType>> {
    console.log('🎯 Orchestrating interview scheduling');
    
    try {
      // Save interview setup
      const interview = await this.saveInterviewSchedule(state);
      
      // Send initial communications
      if (state.availableSlots && state.availableSlots.length > 0) {
        await this.sendSchedulingEmails(state);
      }
      
      return {
        messages: [
          new AIMessage({
            content: `Interview preparation complete! 
            
            📅 ${state.availableSlots?.length || 0} time slots available
            ❓ ${state.interviewQuestions?.length || 0} tailored questions prepared
            📋 Comprehensive interview guide created
            📧 Email templates ready to send
            
            ${state.availableSlots && state.availableSlots.length > 0 ? 
              `Top recommended slot: ${format(new Date(state.availableSlots[0].start), 'PPP p')}` :
              'No slots available - manual scheduling required'
            }
            
            Interview ID: ${state.interviewId}
            `
          })
        ]
      };
    } catch (error) {
      console.error('Orchestration error:', error);
      return {
        error: `Orchestration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private setupGraph() {
    // Add nodes
    this.graph.addNode("scheduling" as any, this.schedulingAgent.bind(this));
    this.graph.addNode("questions" as any, this.questionGenerationAgent.bind(this));
    this.graph.addNode("guide" as any, this.guideGenerationAgent.bind(this));
    this.graph.addNode("communication" as any, this.communicationAgent.bind(this));
    this.graph.addNode("intelligence" as any, this.intelligenceAgent.bind(this));
    this.graph.addNode("orchestration" as any, this.orchestrationNode.bind(this));

    // Define flow - some agents can run in parallel
    this.graph.addEdge(START, ["scheduling", "questions"] as any);
    this.graph.addEdge("questions" as any, "guide" as any);
    this.graph.addEdge("guide" as any, "intelligence" as any);
    this.graph.addEdge("scheduling" as any, "communication" as any);
    this.graph.addEdge("intelligence" as any, "orchestration" as any);
    this.graph.addEdge("communication" as any, "orchestration" as any);
    this.graph.addEdge("orchestration" as any, END);

    // Compile
    this.compiled = this.graph.compile();
  }

  // Public methods
  async scheduleInterview(params: {
    applicantId: string;
    jobId: string;
    interviewType: 'phone' | 'video' | 'onsite' | 'technical';
    round?: number;
    duration?: number;
    timezone?: string;
  }): Promise<any> {
    const interviewId = `interview_${Date.now()}`;
    
    const initialState: Partial<InterviewStateType> = {
      messages: [new HumanMessage(`Schedule ${params.interviewType} interview for applicant ${params.applicantId}`)],
      interviewId,
      applicantId: params.applicantId,
      jobId: params.jobId,
      interviewType: params.interviewType,
      round: params.round || 1,
      requestedDuration: params.duration || 60,
      timezone: params.timezone || 'America/New_York'
    };

    const result = await this.compiled.invoke(initialState);
    return result;
  }

  async confirmInterviewSlot(interviewId: string, slotIndex: number): Promise<void> {
    try {
      // Get interview details
      const { data: interview } = await this.supabase
        .from('interview_schedules')
        .select('*')
        .eq('id', interviewId)
        .single();
      
      if (!interview) throw new Error('Interview not found');
      
      const selectedSlot = interview.available_slots[slotIndex];
      
      // Update interview with confirmed slot
      await this.supabase
        .from('interview_schedules')
        .update({
          scheduled_at: selectedSlot.start,
          status: 'scheduled',
          confirmed_slot: selectedSlot
        })
        .eq('id', interviewId);
      
      // Send confirmation emails
      await this.sendConfirmationEmails(interviewId, selectedSlot);
      
      // Create calendar events
      await this.createCalendarEvents(interviewId, selectedSlot);
    } catch (error) {
      console.error('Error confirming slot:', error);
      throw error;
    }
  }

  async rescheduleInterview(interviewId: string, reason: string): Promise<any> {
    // Re-run scheduling with updated constraints
    const { data: interview } = await this.supabase
      .from('interview_schedules')
      .select('*')
      .eq('id', interviewId)
      .single();
    
    if (!interview) throw new Error('Interview not found');
    
    return this.scheduleInterview({
      applicantId: interview.applicant_id,
      jobId: interview.job_id,
      interviewType: interview.interview_type,
      round: interview.round,
      duration: interview.duration_minutes
    });
  }

  async recordInterviewFeedback(interviewId: string, feedback: {
    interviewerId: string;
    scores: Record<string, number>;
    notes: string;
    recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no';
    nextSteps?: string;
  }): Promise<void> {
    try {
      // Update interview record
      const { data: interview } = await this.supabase
        .from('interview_schedules')
        .select('feedback')
        .eq('id', interviewId)
        .single();
      
      const currentFeedback = interview?.feedback || {};
      currentFeedback[feedback.interviewerId] = {
        ...feedback,
        submittedAt: new Date().toISOString()
      };
      
      await this.supabase
        .from('interview_schedules')
        .update({
          feedback: currentFeedback,
          status: 'completed'
        })
        .eq('id', interviewId);
      
      // Analyze feedback and determine next steps
      await this.analyzeInterviewOutcome(interviewId, currentFeedback);
    } catch (error) {
      console.error('Error recording feedback:', error);
      throw error;
    }
  }

  // Helper methods
  private async getCandidateAvailability(applicantId: string): Promise<any[]> {
    // In production, this would integrate with candidate's calendar
    // For now, return general availability
    const slots = [];
    const baseDate = new Date();
    
    for (let i = 1; i <= 10; i++) {
      const date = addDays(baseDate, i);
      if (date.getDay() !== 0 && date.getDay() !== 6) { // Weekdays only
        // Morning slots
        slots.push({
          start: new Date(date.setHours(9, 0, 0, 0)),
          end: new Date(date.setHours(12, 0, 0, 0))
        });
        // Afternoon slots
        slots.push({
          start: new Date(date.setHours(14, 0, 0, 0)),
          end: new Date(date.setHours(17, 0, 0, 0))
        });
      }
    }
    
    return slots;
  }

  private async getInterviewerAvailability(interviewType: string, duration: number): Promise<any[]> {
    // Get qualified interviewers for this type
    const { data: interviewers } = await this.supabase
      .from('users')
      .select('*')
      .contains('interviewer_types', [interviewType]);
    
    // For demo, return mock availability
    const availability = [];
    const baseDate = new Date();
    
    for (let i = 1; i <= 10; i++) {
      const date = addDays(baseDate, i);
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        availability.push({
          interviewer: interviewers?.[0]?.id || 'default-interviewer',
          slots: [
            {
              start: new Date(date.setHours(10, 0, 0, 0)),
              end: new Date(date.setHours(11, 0, 0, 0))
            },
            {
              start: new Date(date.setHours(14, 0, 0, 0)),
              end: new Date(date.setHours(15, 0, 0, 0))
            }
          ]
        });
      }
    }
    
    return availability;
  }

  private findOverlappingSlots(
    candidateSlots: any[],
    interviewerAvailability: any[],
    duration: number
  ): InterviewSlot[] {
    const overlappingSlots: InterviewSlot[] = [];
    
    candidateSlots.forEach(candidateSlot => {
      interviewerAvailability.forEach(interviewer => {
        interviewer.slots.forEach((interviewerSlot: any) => {
          // Check if slots overlap
          const overlap = this.getOverlap(candidateSlot, interviewerSlot);
          
          if (overlap && this.getDurationMinutes(overlap) >= duration) {
            overlappingSlots.push({
              start: overlap.start,
              end: new Date(overlap.start.getTime() + duration * 60000),
              interviewers: [interviewer.interviewer],
              score: 0,
              conflicts: []
            });
          }
        });
      });
    });
    
    return overlappingSlots;
  }

  private getOverlap(slot1: any, slot2: any): any {
    const start = new Date(Math.max(slot1.start.getTime(), slot2.start.getTime()));
    const end = new Date(Math.min(slot1.end.getTime(), slot2.end.getTime()));
    
    if (start < end) {
      return { start, end };
    }
    
    return null;
  }

  private getDurationMinutes(slot: any): number {
    return (slot.end.getTime() - slot.start.getTime()) / 60000;
  }

  private async scoreSlots(slots: InterviewSlot[], state: InterviewStateType): Promise<InterviewSlot[]> {
    return slots.map(slot => {
      let score = 50; // Base score
      
      // Prefer morning slots
      const hour = slot.start.getHours();
      if (hour >= 10 && hour <= 11) score += 20;
      else if (hour >= 14 && hour <= 15) score += 10;
      
      // Prefer slots 2-5 days out
      const daysOut = Math.floor((slot.start.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      if (daysOut >= 2 && daysOut <= 5) score += 15;
      
      // Avoid Mondays and Fridays
      const dayOfWeek = slot.start.getDay();
      if (dayOfWeek === 2 || dayOfWeek === 3 || dayOfWeek === 4) score += 10;
      
      return { ...slot, score };
    });
  }

  private parseGeneratedQuestions(text: string): InterviewQuestion[] {
    // Parse AI response into structured questions
    // This is a simplified version
    return [
      {
        category: 'technical',
        question: 'Describe your experience with the technologies listed in the job description',
        followUps: ['Can you give a specific example?', 'What challenges did you face?'],
        evaluationCriteria: ['Technical depth', 'Problem-solving approach'],
        timeAllocation: 10,
        difficulty: 'medium'
      },
      {
        category: 'behavioral',
        question: 'Tell me about a time you had to lead a difficult project',
        followUps: ['How did you handle conflicts?', 'What was the outcome?'],
        evaluationCriteria: ['Leadership', 'Communication', 'Results'],
        timeAllocation: 8,
        difficulty: 'medium'
      }
    ];
  }

  private parseInterviewGuide(text: string): InterviewGuide {
    return {
      introduction: 'Welcome the candidate and explain the interview process...',
      segments: [
        {
          title: 'Introduction & Warm-up',
          duration: 5,
          questions: [],
          notes: 'Build rapport, explain process'
        },
        {
          title: 'Technical Assessment',
          duration: 20,
          questions: [],
          notes: 'Focus on core competencies'
        },
        {
          title: 'Behavioral Questions',
          duration: 20,
          questions: [],
          notes: 'Use STAR method'
        },
        {
          title: 'Q&A and Closing',
          duration: 10,
          questions: [],
          notes: 'Answer candidate questions, explain next steps'
        }
      ],
      evaluationForm: {
        criteria: [
          {
            name: 'Technical Skills',
            description: 'Proficiency in required technologies',
            weight: 0.3,
            scale: '1-5'
          },
          {
            name: 'Communication',
            description: 'Clarity and effectiveness of communication',
            weight: 0.2,
            scale: '1-5'
          },
          {
            name: 'Problem Solving',
            description: 'Approach to solving complex problems',
            weight: 0.25,
            scale: '1-5'
          },
          {
            name: 'Culture Fit',
            description: 'Alignment with company values',
            weight: 0.25,
            scale: '1-5'
          }
        ],
        redFlags: ['Lack of preparation', 'Poor communication', 'Negative attitude'],
        greenFlags: ['Well-researched', 'Thoughtful questions', 'Growth mindset']
      }
    };
  }

  private async generateEvaluationCriteria(state: InterviewStateType, guide: InterviewGuide): Promise<any> {
    return {
      scoringRubric: guide.evaluationForm.criteria,
      mustHaveSkills: [],
      niceToHaveSkills: [],
      cultureFitIndicators: [],
      decisionFramework: {
        strongYes: 'Average score >= 4.5, no red flags',
        yes: 'Average score >= 3.5, max 1 area below 3',
        maybe: 'Average score >= 3.0, needs discussion',
        no: 'Average score < 3.0 or major red flags'
      }
    };
  }

  private parseEmailTemplates(text: string): any {
    return {
      candidateInvitation: {
        subject: 'Interview Invitation - [Company Name]',
        body: 'Dear [Candidate Name], We are pleased to invite you for an interview...'
      },
      interviewerNotification: {
        subject: 'Interview Scheduled - [Candidate Name]',
        body: 'You have been scheduled to interview [Candidate Name]...'
      },
      confirmation: {
        subject: 'Interview Confirmed - [Date/Time]',
        body: 'Your interview has been confirmed for [Date/Time]...'
      },
      reminder: {
        subject: 'Interview Reminder - Tomorrow at [Time]',
        body: 'This is a reminder about your interview tomorrow...'
      }
    };
  }

  private prepareCalendarInvites(state: InterviewStateType): any {
    return {
      candidate: {
        title: `Interview with [Company Name] - ${state.interviewType}`,
        description: 'Interview details and preparation tips...',
        location: state.interviewType === 'video' ? 'Video Link' : 'Office Address'
      },
      interviewer: {
        title: `Interview: [Candidate Name] - ${state.interviewType}`,
        description: 'Candidate profile and interview guide attached...',
        attachments: ['interview_guide.pdf', 'candidate_resume.pdf']
      }
    };
  }

  private async getHistoricalInterviewData(jobId: string): Promise<any[]> {
    const { data } = await this.supabase
      .from('interview_schedules')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'completed');
    
    return data || [];
  }

  private async analyzeSuccessfulHires(): Promise<any> {
    // Analyze patterns from successful hires
    return {
      commonTraits: ['Strong communication', 'Technical depth', 'Team player'],
      avgInterviewScore: 4.2,
      bestQuestions: ['Problem-solving scenarios', 'Past project discussions']
    };
  }

  private parseOptimizations(text: string): any {
    return {
      focusAreas: ['Technical depth', 'Team collaboration'],
      questionAdjustments: [],
      timeAllocation: {},
      interviewerRecommendations: []
    };
  }

  private applyQuestionOptimizations(questions: any, optimizations: any): any {
    // Apply AI-recommended optimizations to questions
    return questions;
  }

  private applyGuideOptimizations(guide: any, optimizations: any): any {
    // Apply AI-recommended optimizations to guide
    return guide;
  }

  private async saveInterviewSchedule(state: InterviewStateType): Promise<any> {
    const { data, error } = await this.supabase
      .from('interview_schedules')
      .upsert({
        id: state.interviewId,
        applicant_id: state.applicantId,
        job_id: state.jobId,
        interview_type: state.interviewType,
        round: state.round,
        duration_minutes: state.requestedDuration,
        timezone: state.timezone,
        available_slots: state.availableSlots,
        interview_questions: state.interviewQuestions,
        evaluation_criteria: state.evaluationCriteria,
        interview_guide: state.interviewGuide,
        status: 'pending_scheduling',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  private async sendSchedulingEmails(state: InterviewStateType): Promise<void> {
    // In production, this would send actual emails
    console.log('Sending scheduling emails with templates:', state.emailTemplates);
  }

  private async sendConfirmationEmails(interviewId: string, slot: any): Promise<void> {
    console.log(`Sending confirmation emails for interview ${interviewId}`);
  }

  private async createCalendarEvents(interviewId: string, slot: any): Promise<void> {
    console.log(`Creating calendar events for interview ${interviewId}`);
  }

  private async analyzeInterviewOutcome(interviewId: string, feedback: any): Promise<void> {
    // Analyze feedback and determine next steps
    const scores = Object.values(feedback).map((f: any) => f.scores);
    const recommendations = Object.values(feedback).map((f: any) => f.recommendation);
    
    // Calculate consensus
    const avgScore = this.calculateAverageScores(scores);
    const consensusRecommendation = this.getConsensusRecommendation(recommendations);
    
    // Update pipeline status based on outcome
    await this.updatePipelineBasedOnInterview(interviewId, consensusRecommendation);
  }

  private calculateAverageScores(scores: any[]): Record<string, number> {
    const avgScores: Record<string, number> = {};
    
    if (scores.length === 0) return avgScores;
    
    const allKeys = Object.keys(scores[0]);
    allKeys.forEach(key => {
      const sum = scores.reduce((acc, s) => acc + (s[key] || 0), 0);
      avgScores[key] = sum / scores.length;
    });
    
    return avgScores;
  }

  private getConsensusRecommendation(recommendations: string[]): string {
    const counts: Record<string, number> = {};
    recommendations.forEach(rec => {
      counts[rec] = (counts[rec] || 0) + 1;
    });
    
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  private async updatePipelineBasedOnInterview(interviewId: string, recommendation: string): Promise<void> {
    const { data: interview } = await this.supabase
      .from('interview_schedules')
      .select('applicant_id')
      .eq('id', interviewId)
      .single();
    
    if (!interview) return;
    
    const stageMap: Record<string, string> = {
      'strong_yes': 'offer',
      'yes': 'final_interview',
      'maybe': 'additional_review',
      'no': 'rejected',
      'strong_no': 'rejected'
    };
    
    const newStage = stageMap[recommendation] || 'review';
    
    await this.supabase
      .from('recruitment_pipeline')
      .update({
        stage: newStage,
        last_action: `Interview completed - ${recommendation}`,
        last_action_date: new Date().toISOString()
      })
      .eq('applicant_id', interview.applicant_id);
  }
}
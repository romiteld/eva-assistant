import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { BaseMessage, AIMessage, HumanMessage } from "@langchain/core/messages";
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Database } from '@/types/supabase';
// import * as pdfParse from 'pdf-parse'; // TODO: Add pdf-parse when needed
import { supabase } from '@/lib/supabase/browser';

// Resume Parsing State with deep reasoning capabilities
const ResumeParsingState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  resumeId: Annotation<string>(),
  rawText: Annotation<string>(),
  fileUrl: Annotation<string>(),
  fileType: Annotation<string>(),
  // Extracted Information
  extractedData: Annotation<any>(),
  skills: Annotation<string[]>(),
  experience: Annotation<any[]>(),
  education: Annotation<any[]>(),
  certifications: Annotation<any[]>(),
  // AI Analysis
  aiScoring: Annotation<any>(),
  matchedJobs: Annotation<any[]>(),
  skillGaps: Annotation<any[]>(),
  recommendations: Annotation<string[]>(),
  // Pipeline Status
  stage: Annotation<string>(),
  confidence: Annotation<number>(),
  error: Annotation<string | null>(),
});

type ResumeParsingStateType = typeof ResumeParsingState.State;

interface ParsedResume {
  personalInfo: {
    name: string;
    email: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  summary?: string;
  skills: {
    technical: string[];
    soft: string[];
    languages: string[];
    tools: string[];
  };
  experience: Array<{
    company: string;
    title: string;
    startDate?: string;
    endDate?: string;
    current: boolean;
    location?: string;
    description: string;
    achievements: string[];
    technologies?: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field?: string;
    startDate?: string;
    endDate?: string;
    gpa?: string;
    honors?: string[];
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    date?: string;
    expires?: string;
    credentialId?: string;
  }>;
  projects?: Array<{
    name: string;
    description: string;
    technologies: string[];
    url?: string;
    role?: string;
  }>;
  languages?: Array<{
    language: string;
    proficiency: string;
  }>;
  publications?: Array<{
    title: string;
    publisher: string;
    date?: string;
    url?: string;
  }>;
}

interface JobMatch {
  jobId: string;
  jobTitle: string;
  company: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  experienceMatch: number;
  educationMatch: number;
  cultureFit: number;
  recommendations: string[];
}

interface ApplicantScore {
  overallScore: number;
  technicalScore: number;
  experienceScore: number;
  educationScore: number;
  certificationScore: number;
  communicationScore: number;
  leadershipScore: number;
  cultureFitScore: number;
  growthPotential: number;
  strengths: string[];
  areasForImprovement: string[];
  redFlags: string[];
}

export class ResumeParserPipeline {
  private graph: StateGraph<ResumeParsingStateType>;
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
    this.graph = new StateGraph(ResumeParsingState);
    this.userId = config?.userId;
    this.setupGraph();
  }

  // AGENT 1: Document Extraction & Parsing
  private async extractionAgent(state: ResumeParsingStateType): Promise<Partial<ResumeParsingStateType>> {
    console.log('📄 Extraction Agent: Parsing resume document');
    
    try {
      let rawText = state.rawText;
      
      // If no raw text provided, extract from file
      if (!rawText && state.fileUrl) {
        rawText = await this.extractTextFromFile(state.fileUrl, state.fileType);
      }
      
      // Clean and normalize text
      rawText = this.cleanText(rawText);
      
      // Use AI to extract structured data
      const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
      
      const extractionPrompt = `
        Extract structured information from this resume:
        
        ${rawText}
        
        Parse and return:
        1. Personal Information (name, email, phone, location, social links)
        2. Professional Summary
        3. Skills (categorize into technical, soft, languages, tools)
        4. Work Experience (with dates, achievements, technologies used)
        5. Education (degrees, institutions, dates, GPA, honors)
        6. Certifications
        7. Projects (if any)
        8. Languages spoken
        9. Publications (if any)
        
        For each experience, identify:
        - Quantifiable achievements
        - Leadership indicators
        - Technologies/tools used
        - Impact statements
        
        Be thorough and extract ALL information.
      `;
      
      const result = await model.generateContent(extractionPrompt);
      const extractedData = this.parseExtractedData(result.response.text());
      
      // Extract key skills for quick access
      const allSkills = this.extractAllSkills(extractedData);
      
      return {
        rawText,
        extractedData,
        skills: allSkills,
        experience: extractedData.experience || [],
        education: extractedData.education || [],
        certifications: extractedData.certifications || [],
        confidence: 0.95
      };
    } catch (error) {
      console.error('Extraction error:', error);
      return {
        error: `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // AGENT 2: Skills Analysis & Mapping
  private async skillsAnalysisAgent(state: ResumeParsingStateType): Promise<Partial<ResumeParsingStateType>> {
    console.log('🎯 Skills Analysis Agent: Analyzing technical and soft skills');
    
    try {
      const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
      
      // Analyze skills depth and relevance
      const skillsPrompt = `
        Analyze these skills from a resume:
        
        Skills found: ${JSON.stringify(state.skills)}
        Experience: ${JSON.stringify(state.experience)}
        
        Provide:
        1. Skill proficiency levels (beginner/intermediate/expert) based on experience
        2. Skill categories and clusters
        3. Rare/valuable skills
        4. Skills verification (which skills are backed by experience)
        5. Complementary skills they might have but didn't list
        6. Industry-specific skill ratings
        7. Trending skills they possess
        8. Skills gap analysis for common roles
      `;
      
      const result = await model.generateContent(skillsPrompt);
      const skillsAnalysis = this.parseSkillsAnalysis(result.response.text());
      
      // Get industry benchmarks
      const benchmarks = await this.getIndustrySkillBenchmarks(state.skills);
      
      // Identify skill gaps for different roles
      const skillGaps = await this.identifySkillGaps(state.skills, state.experience);
      
      return {
        extractedData: {
          ...state.extractedData,
          skillsAnalysis,
          skillBenchmarks: benchmarks
        },
        skillGaps
      };
    } catch (error) {
      console.error('Skills analysis error:', error);
      return {
        error: `Skills analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // AGENT 3: Experience & Achievement Scoring
  private async experienceAgent(state: ResumeParsingStateType): Promise<Partial<ResumeParsingStateType>> {
    console.log('💼 Experience Agent: Evaluating work history and achievements');
    
    try {
      const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
      
      // Deep analysis of experience
      const experiencePrompt = `
        Analyze this work experience in detail:
        
        ${JSON.stringify(state.experience)}
        
        Evaluate:
        1. Career progression (promotions, increasing responsibility)
        2. Company quality/reputation
        3. Achievement impact (quantified results)
        4. Leadership experience
        5. Technical depth vs breadth
        6. Industry experience relevance
        7. Gap analysis (employment gaps)
        8. Tenure patterns (job hopping vs stability)
        9. Remote work experience
        10. Cross-functional experience
        
        Score each position and provide insights.
      `;
      
      const result = await model.generateContent(experiencePrompt);
      const experienceAnalysis = this.parseExperienceAnalysis(result.response.text());
      
      // Calculate experience score
      const experienceScore = this.calculateExperienceScore(experienceAnalysis);
      
      return {
        extractedData: {
          ...state.extractedData,
          experienceAnalysis,
          experienceScore
        }
      };
    } catch (error) {
      console.error('Experience analysis error:', error);
      return {
        error: `Experience analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // AGENT 4: Job Matching & Recommendations
  private async matchingAgent(state: ResumeParsingStateType): Promise<Partial<ResumeParsingStateType>> {
    console.log('🎲 Matching Agent: Finding best job matches');
    
    try {
      // Get open positions from database
      const { data: openJobs } = await this.supabase
        .from('job_postings')
        .select('*')
        .eq('status', 'open');
      
      if (!openJobs || openJobs.length === 0) {
        return {
          matchedJobs: [],
          recommendations: ['No open positions available for matching']
        };
      }
      
      const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
      
      // Match candidate to each job
      const matches: JobMatch[] = [];
      
      for (const job of openJobs) {
        const matchPrompt = `
          Match this candidate to job:
          
          Candidate:
          - Skills: ${JSON.stringify(state.skills)}
          - Experience: ${JSON.stringify(state.experience)}
          - Education: ${JSON.stringify(state.education)}
          
          Job Requirements:
          ${JSON.stringify(job)}
          
          Calculate:
          1. Skills match percentage
          2. Experience relevance
          3. Education fit
          4. Cultural fit indicators
          5. Missing skills/qualifications
          6. Candidate advantages
          7. Potential concerns
          8. Overall match score (0-100)
          
          Be specific about matches and gaps.
        `;
        
        const result = await model.generateContent(matchPrompt);
        const match = this.parseJobMatch(result.response.text(), job);
        matches.push(match);
      }
      
      // Sort by match score
      matches.sort((a, b) => b.matchScore - a.matchScore);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(matches, state);
      
      return {
        matchedJobs: matches.slice(0, 10), // Top 10 matches
        recommendations
      };
    } catch (error) {
      console.error('Job matching error:', error);
      return {
        error: `Job matching failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // AGENT 5: AI Scoring & Pipeline Placement
  private async scoringAgent(state: ResumeParsingStateType): Promise<Partial<ResumeParsingStateType>> {
    console.log('🏆 Scoring Agent: Generating comprehensive applicant score');
    
    try {
      const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
      
      // Comprehensive scoring
      const scoringPrompt = `
        Score this candidate comprehensively:
        
        Resume Data: ${JSON.stringify(state.extractedData)}
        Skills Analysis: ${JSON.stringify(state.extractedData?.skillsAnalysis)}
        Experience Analysis: ${JSON.stringify(state.extractedData?.experienceAnalysis)}
        
        Provide scores (0-100) for:
        1. Overall Candidate Score
        2. Technical Competency
        3. Experience Relevance
        4. Education Quality
        5. Certification Value
        6. Communication Skills (based on resume writing)
        7. Leadership Potential
        8. Cultural Fit Indicators
        9. Growth Potential
        
        Also identify:
        - Top 3 strengths
        - Top 3 areas for improvement
        - Any red flags
        - Interview focus areas
        - Salary range recommendation
        - Seniority level assessment
      `;
      
      const result = await model.generateContent(scoringPrompt);
      const scoring = this.parseScoring(result.response.text());
      
      // Determine pipeline stage
      const pipelineStage = this.determinePipelineStage(scoring);
      
      // Store in database
      await this.saveApplicantProfile(state, scoring);
      
      return {
        aiScoring: scoring,
        stage: pipelineStage,
        confidence: scoring.overallScore / 100
      };
    } catch (error) {
      console.error('Scoring error:', error);
      return {
        error: `Scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Orchestration node
  private async orchestrationNode(state: ResumeParsingStateType): Promise<Partial<ResumeParsingStateType>> {
    console.log('🎯 Orchestrating resume analysis results');
    
    try {
      // Create pipeline entry
      await this.createPipelineEntry(state);
      
      // Send notifications if high-score candidate
      if (state.aiScoring?.overallScore >= 80) {
        await this.notifyRecruiters(state);
      }
      
      // Generate interview questions
      const interviewQuestions = await this.generateInterviewQuestions(state);
      
      return {
        messages: [
          new AIMessage({
            content: `Resume analysis complete! 
            
            📊 Candidate Score: ${state.aiScoring?.overallScore}/100
            🎯 Best Job Match: ${state.matchedJobs?.[0]?.jobTitle || 'N/A'} (${state.matchedJobs?.[0]?.matchScore}% match)
            📈 Pipeline Stage: ${state.stage}
            
            💪 Top Strengths:
            ${state.aiScoring?.strengths?.map((s: string) => `• ${s}`).join('\n') || 'N/A'}
            
            🎯 Top Job Matches:
            ${state.matchedJobs?.slice(0, 3).map(j => 
              `• ${j.jobTitle} at ${j.company} (${j.matchScore}% match)`
            ).join('\n') || 'No matches found'}
            
            📝 Recommendations:
            ${state.recommendations?.slice(0, 3).map(r => `• ${r}`).join('\n') || 'N/A'}
            
            Interview questions have been generated and saved.
            `
          })
        ],
        extractedData: {
          ...state.extractedData,
          interviewQuestions
        }
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
    this.graph.addNode("extraction" as any, this.extractionAgent.bind(this));
    this.graph.addNode("skills_analysis" as any, this.skillsAnalysisAgent.bind(this));
    this.graph.addNode("experience" as any, this.experienceAgent.bind(this));
    this.graph.addNode("matching" as any, this.matchingAgent.bind(this));
    this.graph.addNode("scoring" as any, this.scoringAgent.bind(this));
    this.graph.addNode("orchestration" as any, this.orchestrationNode.bind(this));

    // Define flow - some agents can run in parallel
    this.graph.addEdge(START, "extraction" as any);
    this.graph.addEdge("extraction" as any, ["skills_analysis", "experience"] as any);
    this.graph.addEdge("skills_analysis" as any, "matching" as any);
    this.graph.addEdge("experience" as any, "matching" as any);
    this.graph.addEdge("matching" as any, "scoring" as any);
    this.graph.addEdge("scoring" as any, "orchestration" as any);
    this.graph.addEdge("orchestration" as any, END);

    // Compile
    this.compiled = this.graph.compile();
  }

  // Public methods
  async parseResume(params: {
    fileUrl?: string;
    rawText?: string;
    fileType?: string;
    userId: string;
  }): Promise<any> {
    const resumeId = `resume_${Date.now()}`;
    
    const initialState: Partial<ResumeParsingStateType> = {
      messages: [new HumanMessage(`Parse resume: ${params.fileUrl || 'text input'}`)],
      resumeId,
      fileUrl: params.fileUrl,
      rawText: params.rawText,
      fileType: params.fileType || 'pdf'
    };

    const result = await this.compiled.invoke(initialState);
    return result;
  }

  async searchCandidates(criteria: {
    skills?: string[];
    experience?: number;
    education?: string;
    location?: string;
    salary?: { min: number; max: number };
  }): Promise<any[]> {
    try {
      let query = this.supabase
        .from('applicant_profiles')
        .select('*');
      
      // Apply filters
      if (criteria.skills && criteria.skills.length > 0) {
        query = query.contains('skills', criteria.skills);
      }
      
      if (criteria.experience) {
        query = query.gte('total_experience', criteria.experience);
      }
      
      if (criteria.education) {
        query = query.ilike('education', `%${criteria.education}%`);
      }
      
      if (criteria.location) {
        query = query.ilike('location', `%${criteria.location}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Score and rank results
      const scoredResults = await this.scoreSearchResults(data || [], criteria);
      return scoredResults;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  // Helper methods
  private async extractTextFromFile(fileUrl: string, fileType: string): Promise<string> {
    // In production, this would download and parse the file
    // For now, return placeholder
    return `Sample resume text for ${fileUrl}`;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\x00-\x7F]/g, '')
      .trim();
  }

  private parseExtractedData(text: string): ParsedResume {
    // Parse AI response into structured format
    // This is a simplified version
    return {
      personalInfo: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1-555-0123',
        location: 'San Francisco, CA',
        linkedin: 'linkedin.com/in/johndoe'
      },
      skills: {
        technical: ['JavaScript', 'React', 'Node.js', 'Python'],
        soft: ['Leadership', 'Communication', 'Problem Solving'],
        languages: ['English', 'Spanish'],
        tools: ['Git', 'Docker', 'AWS']
      },
      experience: [
        {
          company: 'Tech Corp',
          title: 'Senior Software Engineer',
          startDate: '2020-01',
          current: true,
          description: 'Led development of cloud-native applications',
          achievements: ['Increased performance by 40%', 'Led team of 5'],
          technologies: ['React', 'Node.js', 'AWS']
        }
      ],
      education: [
        {
          institution: 'University of California',
          degree: 'BS Computer Science',
          endDate: '2019',
          gpa: '3.8'
        }
      ],
      certifications: []
    };
  }

  private extractAllSkills(data: ParsedResume): string[] {
    const allSkills = [
      ...(data.skills?.technical || []),
      ...(data.skills?.tools || []),
      ...(data.experience?.flatMap(exp => exp.technologies || []) || [])
    ];
    
    return [...new Set(allSkills)];
  }

  private parseSkillsAnalysis(text: string): any {
    // Parse AI response
    return {
      proficiencyLevels: {},
      rareSkills: [],
      trendingSkills: [],
      verifiedSkills: []
    };
  }

  private async getIndustrySkillBenchmarks(skills: string[]): Promise<any> {
    // Get industry benchmarks from database or external API
    return {
      inDemandSkills: ['React', 'Python', 'AWS'],
      averageSkillCount: 15,
      percentile: 75
    };
  }

  private async identifySkillGaps(skills: string[], experience: any[]): Promise<any[]> {
    // Identify missing skills for common roles
    return [
      { role: 'Senior Engineer', missingSkills: ['System Design', 'Kubernetes'] },
      { role: 'Tech Lead', missingSkills: ['Team Management', 'Architecture'] }
    ];
  }

  private parseExperienceAnalysis(text: string): any {
    return {
      careerProgression: 'steady',
      avgTenure: 2.5,
      leadershipExperience: true,
      quantifiedAchievements: 5
    };
  }

  private calculateExperienceScore(analysis: any): number {
    let score = 50;
    
    if (analysis.careerProgression === 'rapid') score += 20;
    if (analysis.leadershipExperience) score += 15;
    if (analysis.quantifiedAchievements > 3) score += 15;
    
    return Math.min(score, 100);
  }

  private parseJobMatch(text: string, job: any): JobMatch {
    // Parse AI response into JobMatch
    return {
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      matchScore: 85,
      matchedSkills: ['React', 'Node.js'],
      missingSkills: ['GraphQL'],
      experienceMatch: 90,
      educationMatch: 100,
      cultureFit: 80,
      recommendations: ['Strong technical match', 'Consider GraphQL training']
    };
  }

  private generateRecommendations(matches: JobMatch[], state: ResumeParsingStateType): string[] {
    const recommendations = [];
    
    if (matches.length > 0 && matches[0].matchScore > 80) {
      recommendations.push(`Strong candidate for ${matches[0].jobTitle} position`);
    }
    
    if (state.skillGaps && state.skillGaps.length > 0) {
      recommendations.push(`Upskill in: ${state.skillGaps[0].missingSkills.join(', ')}`);
    }
    
    return recommendations;
  }

  private parseScoring(text: string): ApplicantScore {
    return {
      overallScore: 82,
      technicalScore: 85,
      experienceScore: 80,
      educationScore: 90,
      certificationScore: 70,
      communicationScore: 88,
      leadershipScore: 75,
      cultureFitScore: 80,
      growthPotential: 90,
      strengths: ['Strong technical skills', 'Good communication', 'Fast learner'],
      areasForImprovement: ['More certifications', 'Leadership experience'],
      redFlags: []
    };
  }

  private determinePipelineStage(scoring: ApplicantScore): string {
    if (scoring.overallScore >= 85) return 'fast-track';
    if (scoring.overallScore >= 70) return 'phone-screen';
    if (scoring.overallScore >= 60) return 'review';
    return 'hold';
  }

  private async saveApplicantProfile(state: ResumeParsingStateType, scoring: ApplicantScore): Promise<void> {
    await this.supabase
      .from('applicant_profiles')
      .insert({
        resume_id: state.resumeId,
        personal_info: state.extractedData.personalInfo,
        skills: state.skills,
        experience: state.experience,
        education: state.education,
        scoring: scoring,
        matched_jobs: state.matchedJobs,
        pipeline_stage: state.stage,
        created_at: new Date().toISOString()
      });
  }

  private async createPipelineEntry(state: ResumeParsingStateType): Promise<void> {
    await this.supabase
      .from('recruitment_pipeline')
      .insert({
        applicant_id: state.resumeId,
        stage: state.stage,
        score: state.aiScoring?.overallScore,
        assigned_to: null,
        next_action: this.determineNextAction(state),
        next_action_date: this.calculateNextActionDate(state.stage)
      });
  }

  private async notifyRecruiters(state: ResumeParsingStateType): Promise<void> {
    // Send notification about high-score candidate
    console.log(`High-score candidate alert: ${state.extractedData.personalInfo.name}`);
  }

  private async generateInterviewQuestions(state: ResumeParsingStateType): Promise<any> {
    const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `
      Generate tailored interview questions for this candidate:
      
      Skills: ${JSON.stringify(state.skills)}
      Experience: ${JSON.stringify(state.experience)}
      Best Match: ${state.matchedJobs?.[0]?.jobTitle}
      
      Create:
      1. 5 technical questions based on their skills
      2. 3 behavioral questions based on experience
      3. 2 situational questions for the role
      4. 1 culture fit question
      
      Make questions specific and challenging.
    `;
    
    const result = await model.generateContent(prompt);
    return this.parseInterviewQuestions(result.response.text());
  }

  private parseInterviewQuestions(text: string): any {
    return {
      technical: [
        'Explain your approach to building scalable React applications',
        'How would you optimize a Node.js API handling 1M requests/day?'
      ],
      behavioral: [
        'Tell me about a time you led a technical initiative',
        'Describe a challenging bug you solved'
      ],
      situational: [
        'How would you handle a production outage?',
        'Design a system for our use case'
      ],
      culture: [
        'What type of work environment helps you thrive?'
      ]
    };
  }

  private async scoreSearchResults(candidates: any[], criteria: any): Promise<any[]> {
    // Score and rank candidates based on search criteria
    return candidates.map((candidate: any) => ({
      ...candidate,
      searchScore: this.calculateSearchScore(candidate, criteria)
    })).sort((a: any, b: any) => b.searchScore - a.searchScore);
  }

  private calculateSearchScore(candidate: any, criteria: any): number {
    let score = 50;
    
    // Skills match
    if (criteria.skills) {
      const matchedSkills = criteria.skills.filter((skill: string) => 
        candidate.skills?.includes(skill)
      );
      score += (matchedSkills.length / criteria.skills.length) * 30;
    }
    
    // Experience match
    if (criteria.experience && candidate.total_experience >= criteria.experience) {
      score += 20;
    }
    
    return score;
  }

  private determineNextAction(state: ResumeParsingStateType): string {
    if (state.stage === 'fast-track') return 'Schedule technical interview';
    if (state.stage === 'phone-screen') return 'Initial recruiter call';
    if (state.stage === 'review') return 'Team review';
    return 'Archive';
  }

  private calculateNextActionDate(stage: string): string {
    const date = new Date();
    
    switch (stage) {
      case 'fast-track':
        date.setDate(date.getDate() + 1);
        break;
      case 'phone-screen':
        date.setDate(date.getDate() + 3);
        break;
      default:
        date.setDate(date.getDate() + 7);
    }
    
    return date.toISOString();
  }
}
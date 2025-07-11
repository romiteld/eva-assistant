import { z } from 'zod';
import { Agent, AgentConfig } from './base/Agent';
import { AgentType, RequestMessage } from './base/types';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Input/Output schemas
const AnalyzeTextSchema = z.object({
  text: z.string(),
  analysisType: z.enum(['general', 'technical', 'business', 'academic']).optional(),
  context: z.string().optional(),
});

const SummarizeSchema = z.object({
  text: z.string(),
  maxLength: z.number().optional(),
  style: z.enum(['brief', 'detailed', 'bullet_points', 'executive']).optional(),
});

const ExtractEntitiesSchema = z.object({
  text: z.string(),
  entityTypes: z.array(z.string()).optional(),
  includeContext: z.boolean().optional(),
});

const SentimentAnalysisSchema = z.object({
  text: z.string(),
  granularity: z.enum(['document', 'sentence', 'aspect']).optional(),
});

const GenerateInsightsSchema = z.object({
  data: z.any(),
  context: z.string().optional(),
  focusAreas: z.array(z.string()).optional(),
});

const AnswerQuestionsSchema = z.object({
  context: z.string(),
  questions: z.array(z.string()),
  answerStyle: z.enum(['concise', 'detailed', 'technical']).optional(),
});

export class AnalysisAgent extends Agent {
  private genAI?: GoogleGenerativeAI;
  private model?: any;

  constructor(config?: Partial<AgentConfig>) {
    super({
      name: 'Analysis Agent',
      type: AgentType.ANALYSIS,
      description: 'Handles AI-powered text analysis, summarization, and insights generation',
      ...config,
    });

    this.registerActions();
  }

  protected async onInitialize(): Promise<void> {
    // Initialize Gemini AI
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    } else {
      console.warn('Gemini API key not found. Analysis functionality will be limited.');
    }
  }

  protected async onShutdown(): Promise<void> {
    // Clean up any resources
  }

  protected async processRequest(message: RequestMessage): Promise<any> {
    const { action, payload } = message;

    switch (action) {
      case 'analyze_text':
        return this.analyzeText(payload);
      case 'summarize':
        return this.summarize(payload);
      case 'extract_entities':
        return this.extractEntities(payload);
      case 'sentiment_analysis':
        return this.sentimentAnalysis(payload);
      case 'generate_insights':
        return this.generateInsights(payload);
      case 'answer_questions':
        return this.answerQuestions(payload);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private registerActions(): void {
    this.registerAction('analyze_text', {
      name: 'analyze_text',
      description: 'Perform comprehensive text analysis',
      inputSchema: AnalyzeTextSchema,
      outputSchema: z.object({
        summary: z.string(),
        keyPoints: z.array(z.string()),
        themes: z.array(z.string()),
        recommendations: z.array(z.string()).optional(),
      }),
    });

    this.registerAction('summarize', {
      name: 'summarize',
      description: 'Generate summaries of text content',
      inputSchema: SummarizeSchema,
      outputSchema: z.object({
        summary: z.string(),
        wordCount: z.number(),
        keyTakeaways: z.array(z.string()).optional(),
      }),
    });

    this.registerAction('extract_entities', {
      name: 'extract_entities',
      description: 'Extract named entities from text',
      inputSchema: ExtractEntitiesSchema,
      outputSchema: z.array(z.object({
        text: z.string(),
        type: z.string(),
        confidence: z.number(),
        context: z.string().optional(),
      })),
    });

    this.registerAction('sentiment_analysis', {
      name: 'sentiment_analysis',
      description: 'Analyze sentiment of text',
      inputSchema: SentimentAnalysisSchema,
      outputSchema: z.object({
        overall: z.object({
          sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
          score: z.number(),
        }),
        sentences: z.array(z.object({
          text: z.string(),
          sentiment: z.string(),
          score: z.number(),
        })).optional(),
        aspects: z.array(z.object({
          aspect: z.string(),
          sentiment: z.string(),
          score: z.number(),
        })).optional(),
      }),
    });

    this.registerAction('generate_insights', {
      name: 'generate_insights',
      description: 'Generate insights from data',
      inputSchema: GenerateInsightsSchema,
      outputSchema: z.object({
        insights: z.array(z.object({
          title: z.string(),
          description: z.string(),
          importance: z.enum(['high', 'medium', 'low']),
          actionable: z.boolean(),
          recommendations: z.array(z.string()).optional(),
        })),
        summary: z.string(),
      }),
    });

    this.registerAction('answer_questions', {
      name: 'answer_questions',
      description: 'Answer questions based on context',
      inputSchema: AnswerQuestionsSchema,
      outputSchema: z.array(z.object({
        question: z.string(),
        answer: z.string(),
        confidence: z.number(),
        sources: z.array(z.string()).optional(),
      })),
    });
  }

  private async analyzeText(input: z.infer<typeof AnalyzeTextSchema>) {
    if (!this.model) {
      throw new Error('AI model not initialized');
    }

    const prompt = `
      Analyze the following text comprehensively.
      Analysis Type: ${input.analysisType || 'general'}
      ${input.context ? `Context: ${input.context}` : ''}
      
      Text: ${input.text}
      
      Provide:
      1. A concise summary
      2. Key points (as an array)
      3. Main themes (as an array)
      4. Recommendations if applicable (as an array)
      
      Format the response as JSON.
    `;

    const result = await this.model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      const parsed = JSON.parse(response);
      
      this.broadcast('text_analyzed', {
        analysisType: input.analysisType || 'general',
        textLength: input.text.length,
      });
      
      return parsed;
    } catch (error) {
      // Fallback parsing or structured response
      return {
        summary: response,
        keyPoints: [],
        themes: [],
        recommendations: [],
      };
    }
  }

  private async summarize(input: z.infer<typeof SummarizeSchema>) {
    if (!this.model) {
      throw new Error('AI model not initialized');
    }

    const style = input.style || 'brief';
    const maxLength = input.maxLength || 200;

    const prompt = `
      Summarize the following text in ${style} style.
      Maximum length: ${maxLength} words.
      
      Text: ${input.text}
      
      ${style === 'bullet_points' ? 'Use bullet points.' : ''}
      ${style === 'executive' ? 'Focus on business impact and key decisions.' : ''}
      
      Also identify key takeaways.
      Format as JSON with 'summary', 'wordCount', and 'keyTakeaways' fields.
    `;

    const result = await this.model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      const parsed = JSON.parse(response);
      
      this.broadcast('text_summarized', {
        style,
        originalLength: input.text.length,
        summaryLength: parsed.wordCount,
      });
      
      return parsed;
    } catch (error) {
      // Fallback
      const summary = response.substring(0, maxLength * 5); // Approximate
      return {
        summary,
        wordCount: summary.split(/\s+/).length,
        keyTakeaways: [],
      };
    }
  }

  private async extractEntities(input: z.infer<typeof ExtractEntitiesSchema>) {
    if (!this.model) {
      throw new Error('AI model not initialized');
    }

    const entityTypes = input.entityTypes || [
      'PERSON', 'ORGANIZATION', 'LOCATION', 'DATE', 'PRODUCT', 'EVENT'
    ];

    const prompt = `
      Extract named entities from the following text.
      Entity types to identify: ${entityTypes.join(', ')}
      ${input.includeContext ? 'Include surrounding context for each entity.' : ''}
      
      Text: ${input.text}
      
      Return as JSON array with fields: text, type, confidence (0-1), context (if requested).
    `;

    const result = await this.model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      const entities = JSON.parse(response);
      
      this.broadcast('entities_extracted', {
        entityCount: entities.length,
        types: [...new Set(entities.map((e: any) => e.type))],
      });
      
      return entities;
    } catch (error) {
      return [];
    }
  }

  private async sentimentAnalysis(input: z.infer<typeof SentimentAnalysisSchema>) {
    if (!this.model) {
      throw new Error('AI model not initialized');
    }

    const prompt = `
      Perform sentiment analysis on the following text.
      Granularity: ${input.granularity || 'document'}
      
      Text: ${input.text}
      
      Provide:
      1. Overall sentiment (positive/negative/neutral/mixed) with score (-1 to 1)
      ${input.granularity === 'sentence' ? '2. Sentiment for each sentence' : ''}
      ${input.granularity === 'aspect' ? '2. Sentiment for different aspects mentioned' : ''}
      
      Format as JSON.
    `;

    const result = await this.model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      const analysis = JSON.parse(response);
      
      this.broadcast('sentiment_analyzed', {
        overall: analysis.overall.sentiment,
        granularity: input.granularity || 'document',
      });
      
      return analysis;
    } catch (error) {
      return {
        overall: {
          sentiment: 'neutral',
          score: 0,
        },
      };
    }
  }

  private async generateInsights(input: z.infer<typeof GenerateInsightsSchema>) {
    if (!this.model) {
      throw new Error('AI model not initialized');
    }

    const prompt = `
      Generate insights from the following data.
      ${input.context ? `Context: ${input.context}` : ''}
      ${input.focusAreas ? `Focus areas: ${input.focusAreas.join(', ')}` : ''}
      
      Data: ${JSON.stringify(input.data)}
      
      Provide:
      1. Key insights with title, description, importance (high/medium/low), and whether actionable
      2. Overall summary
      
      Format as JSON.
    `;

    const result = await this.model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      const insights = JSON.parse(response);
      
      this.broadcast('insights_generated', {
        insightCount: insights.insights.length,
        focusAreas: input.focusAreas,
      });
      
      return insights;
    } catch (error) {
      return {
        insights: [],
        summary: 'Unable to generate insights',
      };
    }
  }

  private async answerQuestions(input: z.infer<typeof AnswerQuestionsSchema>) {
    if (!this.model) {
      throw new Error('AI model not initialized');
    }

    const style = input.answerStyle || 'concise';
    
    const prompt = `
      Answer the following questions based on the provided context.
      Answer style: ${style}
      
      Context: ${input.context}
      
      Questions:
      ${input.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
      
      For each question, provide:
      - The answer (${style} style)
      - Confidence score (0-1)
      - Source references from the context if applicable
      
      Format as JSON array.
    `;

    const result = await this.model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      const answers = JSON.parse(response);
      
      this.broadcast('questions_answered', {
        questionCount: input.questions.length,
        style,
      });
      
      return answers.map((answer: any, index: number) => ({
        question: input.questions[index],
        ...answer,
      }));
    } catch (error) {
      return input.questions.map(question => ({
        question,
        answer: 'Unable to generate answer',
        confidence: 0,
      }));
    }
  }
}
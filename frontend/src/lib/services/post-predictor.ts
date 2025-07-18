import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase/browser';
import type { 
  PostPrediction, 
  PostPredictorRequest, 
  PostPredictorResponse,
  SocialPlatform,
  PlatformConfig,
  ContentOptimization 
} from '@/types/post-predictor';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

export class PostPredictorService {
  private supabase;
  private model;

  constructor() {
    this.supabase = supabase;
    this.model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 4096,
      }
    });
  }

  // Platform configurations
  private platformConfigs: Record<SocialPlatform, PlatformConfig> = {
    linkedin: {
      id: 'linkedin',
      name: 'LinkedIn',
      characterLimit: 3000,
      features: {
        hashtags: true,
        mentions: true,
        images: true,
        videos: true,
        polls: true,
        links: true
      },
      optimal_length: {
        min: 150,
        max: 1500,
        ideal: 600
      }
    },
    twitter: {
      id: 'twitter',
      name: 'Twitter/X',
      characterLimit: 280,
      features: {
        hashtags: true,
        mentions: true,
        images: true,
        videos: true,
        polls: true,
        links: true
      },
      optimal_length: {
        min: 50,
        max: 280,
        ideal: 200
      }
    },
    facebook: {
      id: 'facebook',
      name: 'Facebook',
      characterLimit: 63206,
      features: {
        hashtags: true,
        mentions: true,
        images: true,
        videos: true,
        polls: false,
        links: true
      },
      optimal_length: {
        min: 40,
        max: 400,
        ideal: 150
      }
    }
  };

  async predictEngagement(request: PostPredictorRequest): Promise<PostPredictorResponse> {
    try {
      // Get user context
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Analyze content with Gemini
      const analysis = await this.analyzeContent(request);
      
      // Generate predictions based on analysis
      const predictions = await this.generatePredictions(request, analysis);
      
      // Get optimization suggestions
      const optimization = await this.optimizeContent(request, analysis);
      
      // Get similar posts for comparison
      const similarPosts = await this.findSimilarPosts(request);

      // Create prediction record
      const prediction: PostPrediction = {
        id: crypto.randomUUID(),
        content: request.content,
        platform: request.platform,
        predictions,
        optimal_timing: await this.calculateOptimalTiming(request.platform, request.target_audience),
        content_analysis: analysis,
        suggestions: await this.generateSuggestions(request, analysis, predictions),
        platform_insights: await this.getPlatformInsights(request.platform, request.industry),
        created_at: new Date().toISOString(),
        user_id: user.id
      };

      // Store prediction history
      await this.storePrediction(prediction);

      return {
        prediction,
        optimization,
        similar_posts: similarPosts
      };
    } catch (error) {
      console.error('Error predicting engagement:', error);
      throw error;
    }
  }

  private async analyzeContent(request: PostPredictorRequest) {
    const prompt = `
      Analyze this social media post for ${request.platform}:
      
      Content: ${request.content}
      Target Audience: ${request.target_audience || 'general'}
      Industry: ${request.industry || 'general'}
      
      Provide analysis in this JSON format:
      {
        "sentiment": "positive/negative/neutral",
        "readability_score": <0-100>,
        "keywords": ["keyword1", "keyword2"],
        "hashtags": ["#hashtag1", "#hashtag2"],
        "mentions": ["@mention1", "@mention2"],
        "tone": "professional/casual/humorous/informative/inspirational",
        "emotions": [
          {"emotion": "joy", "score": 0.8},
          {"emotion": "trust", "score": 0.6}
        ]
      }
    `;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Error parsing analysis:', e);
    }

    // Default response if parsing fails
    return {
      sentiment: 'neutral',
      readability_score: 70,
      keywords: this.extractKeywords(request.content),
      hashtags: this.extractHashtags(request.content),
      mentions: this.extractMentions(request.content),
      tone: 'professional',
      emotions: [{ emotion: 'neutral', score: 0.5 }]
    };
  }

  private async generatePredictions(request: PostPredictorRequest, analysis: any) {
    const platformConfig = this.platformConfigs[request.platform];
    const contentLength = request.content.length;
    const optimalLength = platformConfig.optimal_length;
    
    // Base engagement rates by platform
    const baseRates = {
      linkedin: { likes: 0.02, shares: 0.005, comments: 0.003 },
      twitter: { likes: 0.015, shares: 0.01, comments: 0.002 },
      facebook: { likes: 0.03, shares: 0.008, comments: 0.004 }
    };

    const base = baseRates[request.platform];
    
    // Engagement multipliers based on analysis
    let multiplier = 1;
    
    // Sentiment multiplier
    if (analysis.sentiment === 'positive') multiplier *= 1.3;
    else if (analysis.sentiment === 'negative') multiplier *= 0.7;
    
    // Content length multiplier
    if (contentLength >= optimalLength.min && contentLength <= optimalLength.max) {
      if (contentLength >= optimalLength.ideal - 50 && contentLength <= optimalLength.ideal + 50) {
        multiplier *= 1.5;
      } else {
        multiplier *= 1.2;
      }
    } else {
      multiplier *= 0.8;
    }
    
    // Hashtag multiplier
    if (analysis.hashtags.length > 0 && analysis.hashtags.length <= 5) {
      multiplier *= 1.2;
    }
    
    // Readability multiplier
    multiplier *= (analysis.readability_score / 100) + 0.5;

    // Calculate reach based on typical follower counts
    const estimatedFollowers = 1000; // This could be fetched from user profile
    const reach = Math.floor(estimatedFollowers * (0.1 + Math.random() * 0.3) * multiplier);
    
    return {
      likes: Math.floor(reach * base.likes * multiplier),
      shares: Math.floor(reach * base.shares * multiplier),
      comments: Math.floor(reach * base.comments * multiplier),
      engagement_rate: ((base.likes + base.shares + base.comments) * multiplier * 100),
      reach: reach,
      impressions: Math.floor(reach * (1.5 + Math.random() * 0.5))
    };
  }

  private async optimizeContent(request: PostPredictorRequest, analysis: any): Promise<ContentOptimization> {
    const prompt = `
      Optimize this ${request.platform} post for maximum engagement:
      
      Original: ${request.content}
      Current Analysis: ${JSON.stringify(analysis)}
      
      Provide specific improvements for engagement. Return in JSON format:
      {
        "optimized_content": "improved version",
        "changes": [
          {
            "type": "hashtag",
            "description": "Added trending hashtags",
            "before": "text",
            "after": "text #trending"
          }
        ],
        "score_improvement": 25
      }
    `;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return {
          original_content: request.content,
          ...JSON.parse(jsonMatch[0])
        };
      }
    } catch (e) {
      console.error('Error parsing optimization:', e);
    }

    return {
      original_content: request.content,
      optimized_content: request.content,
      changes: [],
      score_improvement: 0
    };
  }

  private async calculateOptimalTiming(platform: SocialPlatform, targetAudience?: string) {
    // Platform-specific optimal times (could be enhanced with real data)
    const optimalTimes = {
      linkedin: {
        best_time: '09:00',
        best_day: 'Tuesday',
        timezone: 'America/New_York',
        peak_hours: [8, 9, 12, 17, 18]
      },
      twitter: {
        best_time: '15:00',
        best_day: 'Wednesday',
        timezone: 'America/New_York',
        peak_hours: [9, 12, 15, 17, 20, 21]
      },
      facebook: {
        best_time: '13:00',
        best_day: 'Thursday',
        timezone: 'America/New_York',
        peak_hours: [7, 13, 16, 20, 21]
      }
    };

    const timing = optimalTimes[platform];
    
    // Generate hourly engagement data
    const hourlyEngagement = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      engagement: timing.peak_hours.includes(hour) ? 
        80 + Math.random() * 20 : 
        20 + Math.random() * 40
    }));

    return {
      best_time: timing.best_time,
      best_day: timing.best_day,
      timezone: timing.timezone,
      hourly_engagement: hourlyEngagement
    };
  }

  private async generateSuggestions(request: PostPredictorRequest, analysis: any, predictions: any) {
    const suggestions: Array<{
      type: 'content' | 'timing' | 'hashtag' | 'format' | 'length';
      priority: 'high' | 'medium' | 'low';
      description: string;
      impact: number;
    }> = [];
    const config = this.platformConfigs[request.platform];

    // Content length suggestion
    if (request.content.length < config.optimal_length.min) {
      suggestions.push({
        type: 'length' as const,
        priority: 'high' as const,
        description: `Your post is too short. Add ${config.optimal_length.min - request.content.length} more characters for better engagement.`,
        impact: 30
      });
    } else if (request.content.length > config.optimal_length.max) {
      suggestions.push({
        type: 'length' as const,
        priority: 'medium' as const,
        description: `Consider shortening your post by ${request.content.length - config.optimal_length.max} characters.`,
        impact: 20
      });
    }

    // Hashtag suggestions
    if (analysis.hashtags.length === 0 && config.features.hashtags) {
      suggestions.push({
        type: 'hashtag' as const,
        priority: 'high' as const,
        description: 'Add 2-3 relevant hashtags to increase discoverability.',
        impact: 25
      });
    }

    // Engagement suggestions based on sentiment
    if (analysis.sentiment === 'neutral') {
      suggestions.push({
        type: 'content' as const,
        priority: 'medium' as const,
        description: 'Add more emotional appeal or a clear call-to-action to boost engagement.',
        impact: 15
      });
    }

    // Timing suggestion
    suggestions.push({
      type: 'timing' as const,
      priority: 'high' as const,
      description: `Post during peak hours for 40% more engagement.`,
      impact: 40
    });

    return suggestions;
  }

  private async getPlatformInsights(platform: SocialPlatform, industry?: string) {
    // This would ideally fetch real-time data
    const insights = {
      linkedin: {
        trending_topics: ['AI', 'remote work', 'leadership', 'career growth', 'innovation'],
        competitor_activity: [
          { topic: 'AI in recruitment', engagement: 85 },
          { topic: 'Future of work', engagement: 72 }
        ],
        audience_preferences: {
          content_types: ['educational', 'industry insights', 'success stories'],
          posting_frequency: '2-3 times per week',
          engagement_patterns: 'Higher engagement on weekday mornings'
        }
      },
      twitter: {
        trending_topics: ['tech news', 'AI updates', 'productivity', 'startups'],
        competitor_activity: [
          { topic: 'AI tools', engagement: 90 },
          { topic: 'Tech trends', engagement: 78 }
        ],
        audience_preferences: {
          content_types: ['quick tips', 'news', 'threads'],
          posting_frequency: '3-5 times per day',
          engagement_patterns: 'Peak engagement during lunch and evening'
        }
      },
      facebook: {
        trending_topics: ['community', 'inspiration', 'how-to', 'behind-the-scenes'],
        competitor_activity: [
          { topic: 'Team culture', engagement: 82 },
          { topic: 'Success stories', engagement: 75 }
        ],
        audience_preferences: {
          content_types: ['visual content', 'stories', 'live videos'],
          posting_frequency: '1-2 times per day',
          engagement_patterns: 'Higher engagement on evenings and weekends'
        }
      }
    };

    return insights[platform];
  }

  private async findSimilarPosts(request: PostPredictorRequest) {
    // This would search for similar posts in the database
    // For now, returning mock data
    return [
      {
        content: 'Similar post example with great engagement...',
        engagement: 1250,
        posted_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        content: 'Another similar post that performed well...',
        engagement: 980,
        posted_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  }

  private async storePrediction(prediction: PostPrediction) {
    try {
      const { error } = await this.supabase
        .from('post_predictions')
        .insert({
          id: prediction.id,
          user_id: prediction.user_id,
          content: prediction.content,
          platform: prediction.platform,
          predictions: prediction.predictions,
          optimal_timing: prediction.optimal_timing,
          content_analysis: prediction.content_analysis,
          suggestions: prediction.suggestions,
          platform_insights: prediction.platform_insights,
          created_at: prediction.created_at
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error storing prediction:', error);
      // Don't throw, just log - this is not critical for the prediction to work
    }
  }

  async getPredictionHistory(userId: string, limit = 10) {
    try {
      const { data, error } = await this.supabase
        .from('post_predictions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching prediction history:', error);
      return [];
    }
  }

  async getAnalytics(userId: string, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await this.supabase
        .from('post_predictions')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Calculate analytics
      const analytics = {
        totalPredictions: data.length,
        averageEngagementRate: 0,
        platformBreakdown: {} as Record<string, number>,
        sentimentBreakdown: {} as Record<string, number>,
        topKeywords: [] as string[],
        engagementTrends: [] as Array<{ date: string; engagement: number }>,
        bestPerformingPlatform: '',
        improvementSuggestions: [] as string[]
      };

      if (data.length === 0) return analytics;

      // Calculate averages and breakdowns
      let totalEngagement = 0;
      const keywordCounts = new Map<string, number>();
      const dailyEngagement = new Map<string, number[]>();

      data.forEach(prediction => {
        const engagement = prediction.predictions.engagement_rate;
        totalEngagement += engagement;
        
        // Platform breakdown
        analytics.platformBreakdown[prediction.platform] = 
          (analytics.platformBreakdown[prediction.platform] || 0) + 1;
        
        // Sentiment breakdown
        const sentiment = prediction.content_analysis.sentiment;
        analytics.sentimentBreakdown[sentiment] = 
          (analytics.sentimentBreakdown[sentiment] || 0) + 1;
        
        // Keywords
        prediction.content_analysis.keywords.forEach((keyword: string) => {
          keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
        });
        
        // Daily engagement
        const date = new Date(prediction.created_at).toISOString().split('T')[0];
        if (!dailyEngagement.has(date)) {
          dailyEngagement.set(date, []);
        }
        dailyEngagement.get(date)!.push(engagement);
      });

      analytics.averageEngagementRate = totalEngagement / data.length;

      // Top keywords
      const sortedKeywords = Array.from(keywordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      analytics.topKeywords = sortedKeywords.map(([keyword]) => keyword);

      // Engagement trends
      analytics.engagementTrends = Array.from(dailyEngagement.entries())
        .map(([date, engagements]) => ({
          date,
          engagement: engagements.reduce((sum, e) => sum + e, 0) / engagements.length
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Best performing platform
      const platformEngagement = {} as Record<string, number[]>;
      data.forEach(prediction => {
        if (!platformEngagement[prediction.platform]) {
          platformEngagement[prediction.platform] = [];
        }
        platformEngagement[prediction.platform].push(prediction.predictions.engagement_rate);
      });

      let bestPlatform = '';
      let bestAverage = 0;
      Object.entries(platformEngagement).forEach(([platform, engagements]) => {
        const average = engagements.reduce((sum, e) => sum + e, 0) / engagements.length;
        if (average > bestAverage) {
          bestAverage = average;
          bestPlatform = platform;
        }
      });
      analytics.bestPerformingPlatform = bestPlatform;

      // Improvement suggestions
      const suggestions = [];
      if (analytics.averageEngagementRate < 2) {
        suggestions.push('Consider using more emotional language in your posts');
      }
      if (analytics.sentimentBreakdown.negative > (analytics.sentimentBreakdown.positive || 0)) {
        suggestions.push('Try to maintain a more positive tone in your content');
      }
      if (analytics.platformBreakdown.linkedin && analytics.platformBreakdown.linkedin > 5) {
        suggestions.push('LinkedIn posts perform well - consider posting more frequently');
      }
      analytics.improvementSuggestions = suggestions;

      return analytics;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return {
        totalPredictions: 0,
        averageEngagementRate: 0,
        platformBreakdown: {},
        sentimentBreakdown: {},
        topKeywords: [],
        engagementTrends: [],
        bestPerformingPlatform: '',
        improvementSuggestions: []
      };
    }
  }

  async getBenchmarks(platform: SocialPlatform, industry?: string) {
    // Industry benchmarks for engagement rates
    const benchmarks = {
      linkedin: {
        technology: { likes: 0.025, shares: 0.008, comments: 0.005 },
        finance: { likes: 0.018, shares: 0.006, comments: 0.004 },
        healthcare: { likes: 0.022, shares: 0.007, comments: 0.005 },
        general: { likes: 0.020, shares: 0.007, comments: 0.004 }
      },
      twitter: {
        technology: { likes: 0.020, shares: 0.012, comments: 0.003 },
        finance: { likes: 0.015, shares: 0.009, comments: 0.002 },
        healthcare: { likes: 0.018, shares: 0.010, comments: 0.003 },
        general: { likes: 0.015, shares: 0.010, comments: 0.002 }
      },
      facebook: {
        technology: { likes: 0.035, shares: 0.010, comments: 0.006 },
        finance: { likes: 0.025, shares: 0.008, comments: 0.004 },
        healthcare: { likes: 0.030, shares: 0.009, comments: 0.005 },
        general: { likes: 0.030, shares: 0.008, comments: 0.004 }
      }
    };

    const industryKey = industry?.toLowerCase() || 'general';
    const platformBenchmarks = benchmarks[platform];
    
    return platformBenchmarks[industryKey as keyof typeof platformBenchmarks] || 
           platformBenchmarks.general;
  }

  // Helper methods
  private extractHashtags(content: string): string[] {
    const regex = /#[a-zA-Z0-9_]+/g;
    return content.match(regex) || [];
  }

  private extractMentions(content: string): string[] {
    const regex = /@[a-zA-Z0-9_]+/g;
    return content.match(regex) || [];
  }

  private extractKeywords(content: string): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    const words = content.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were', 'to', 'in', 'for', 'of', 'with'];
    return words
      .filter(word => word.length > 3 && !stopWords.includes(word))
      .slice(0, 10);
  }
}
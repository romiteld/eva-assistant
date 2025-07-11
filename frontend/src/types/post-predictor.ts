export interface PostPrediction {
  id: string;
  content: string;
  platform: SocialPlatform;
  predictions: {
    likes: number;
    shares: number;
    comments: number;
    engagement_rate: number;
    reach: number;
    impressions: number;
  };
  optimal_timing: {
    best_time: string;
    best_day: string;
    timezone: string;
    hourly_engagement: Array<{
      hour: number;
      engagement: number;
    }>;
  };
  content_analysis: {
    sentiment: 'positive' | 'negative' | 'neutral';
    readability_score: number;
    keywords: string[];
    hashtags: string[];
    mentions: string[];
    tone: string;
    emotions: Array<{
      emotion: string;
      score: number;
    }>;
  };
  suggestions: Array<{
    type: 'content' | 'timing' | 'hashtag' | 'format' | 'length';
    priority: 'high' | 'medium' | 'low';
    description: string;
    impact: number;
  }>;
  platform_insights: {
    trending_topics: string[];
    competitor_activity: Array<{
      topic: string;
      engagement: number;
    }>;
    audience_preferences: {
      content_types: string[];
      posting_frequency: string;
      engagement_patterns: string;
    };
  };
  created_at: string;
  user_id: string;
}

export type SocialPlatform = 'linkedin' | 'twitter' | 'facebook';

export interface PlatformConfig {
  id: SocialPlatform;
  name: string;
  characterLimit: number;
  features: {
    hashtags: boolean;
    mentions: boolean;
    images: boolean;
    videos: boolean;
    polls: boolean;
    links: boolean;
  };
  optimal_length: {
    min: number;
    max: number;
    ideal: number;
  };
}

export interface ContentOptimization {
  original_content: string;
  optimized_content: string;
  changes: Array<{
    type: string;
    description: string;
    before: string;
    after: string;
  }>;
  score_improvement: number;
}

export interface PostPredictorRequest {
  content: string;
  platform: SocialPlatform;
  target_audience?: string;
  industry?: string;
  post_type?: 'text' | 'image' | 'video' | 'link';
  scheduled_time?: string;
}

export interface PostPredictorResponse {
  prediction: PostPrediction;
  optimization?: ContentOptimization;
  similar_posts?: Array<{
    content: string;
    engagement: number;
    posted_at: string;
  }>;
}

export interface EngagementHistory {
  date: string;
  platform: SocialPlatform;
  metrics: {
    likes: number;
    shares: number;
    comments: number;
    reach: number;
  };
}

export interface PostingSchedule {
  platform: SocialPlatform;
  schedule: Array<{
    day: string;
    times: string[];
    engagement_score: number;
  }>;
}
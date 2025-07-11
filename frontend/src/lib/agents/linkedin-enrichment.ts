import { createLinkedInService, LinkedInService } from '@/lib/services/linkedin';
import { getTokenManager } from '@/lib/auth/token-manager';

export interface LinkedInEnrichmentData {
  profile: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    headline?: string;
    summary?: string;
    location?: string;
    industry?: string;
    profileUrl: string;
    profilePicture?: string;
  };
  company?: {
    id: string;
    name: string;
    industry?: string;
    size?: string;
    website?: string;
    description?: string;
  };
  connections?: number;
  isOpenToWork?: boolean;
  skills?: string[];
  experience?: Array<{
    title: string;
    company: string;
    startDate: string;
    endDate?: string;
    current: boolean;
    description?: string;
  }>;
}

export class LinkedInEnrichmentAgent {
  private linkedInService: LinkedInService;

  constructor(
    userId: string,
    encryptionKey: string,
    refreshConfigs: Parameters<typeof getTokenManager>[1]
  ) {
    this.linkedInService = createLinkedInService(userId, encryptionKey, refreshConfigs);
  }

  /**
   * Enrich lead data using LinkedIn profile information
   */
  async enrichLeadFromLinkedIn(linkedInUrl: string): Promise<LinkedInEnrichmentData | null> {
    try {
      // Extract LinkedIn username from URL
      const username = this.extractLinkedInUsername(linkedInUrl);
      if (!username) {
        console.error('Invalid LinkedIn URL');
        return null;
      }

      // Get profile by public identifier
      const profile = await this.linkedInService.getProfileByPublicIdentifier(username);
      
      // Transform LinkedIn data to enrichment format
      const enrichmentData: LinkedInEnrichmentData = {
        profile: {
          id: profile.id,
          firstName: profile.localizedFirstName,
          lastName: profile.localizedLastName,
          headline: profile.headline?.localized?.en_US,
          summary: profile.summary?.localized?.en_US,
          location: profile.location?.basicLocation?.countryCode,
          industry: profile.industry?.localized?.en_US,
          profileUrl: linkedInUrl,
          profilePicture: profile.profilePicture?.displayImage
        }
      };

      // Try to get company information if available
      if (profile.positions?.values?.length > 0) {
        const currentPosition = profile.positions.values.find((pos: any) => pos.current);
        if (currentPosition?.company) {
          try {
            const companyInfo = await this.linkedInService.getCompanyInfo(currentPosition.company);
            enrichmentData.company = {
              id: companyInfo.id,
              name: companyInfo.localizedName,
              industry: companyInfo.industries?.[0]?.localized?.en_US,
              size: companyInfo.staffCountRange,
              website: companyInfo.website?.localized?.en_US,
              description: companyInfo.description?.localized?.en_US
            };
          } catch (error) {
            console.error('Error fetching company info:', error);
          }
        }

        // Add experience data
        enrichmentData.experience = profile.positions.values.map((pos: any) => ({
          title: pos.title?.localized?.en_US || '',
          company: pos.companyName?.localized?.en_US || '',
          startDate: this.formatDate(pos.startDate),
          endDate: pos.endDate ? this.formatDate(pos.endDate) : undefined,
          current: pos.current || false,
          description: pos.description?.localized?.en_US
        }));
      }

      // Extract skills if available
      if (profile.skills?.values?.length > 0) {
        enrichmentData.skills = profile.skills.values.map(
          (skill: any) => skill.name?.localized?.en_US
        ).filter(Boolean);
      }

      return enrichmentData;
    } catch (error) {
      console.error('Error enriching lead from LinkedIn:', error);
      return null;
    }
  }

  /**
   * Search for potential leads on LinkedIn
   */
  async searchPotentialLeads(criteria: {
    keywords?: string;
    company?: string;
    title?: string;
    location?: string;
    industry?: string;
  }): Promise<Array<{
    id: string;
    name: string;
    headline: string;
    company?: string;
    location?: string;
    profileUrl: string;
  }>> {
    try {
      const searchResults = await this.linkedInService.searchPeople({
        keywords: criteria.keywords,
        company: criteria.company,
        title: criteria.title,
        start: 0,
        count: 25
      });

      return searchResults.elements.map((person: any) => ({
        id: person.id,
        name: `${person.firstName?.localized?.en_US || ''} ${person.lastName?.localized?.en_US || ''}`.trim(),
        headline: person.headline?.localized?.en_US || '',
        company: person.positions?.values?.[0]?.companyName?.localized?.en_US,
        location: person.location?.basicLocation?.countryCode,
        profileUrl: `https://www.linkedin.com/in/${person.publicIdentifier}`
      }));
    } catch (error) {
      console.error('Error searching LinkedIn:', error);
      return [];
    }
  }

  /**
   * Send personalized outreach message
   */
  async sendPersonalizedOutreach(
    recipientId: string,
    template: {
      subject: string;
      body: string;
    },
    personalizationData: Record<string, string>
  ): Promise<boolean> {
    try {
      // Personalize the message
      let personalizedSubject = template.subject;
      let personalizedBody = template.body;

      Object.entries(personalizationData).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        personalizedSubject = personalizedSubject.replace(new RegExp(placeholder, 'g'), value);
        personalizedBody = personalizedBody.replace(new RegExp(placeholder, 'g'), value);
      });

      // Send the message
      await this.linkedInService.sendMessage(
        recipientId,
        personalizedSubject,
        personalizedBody
      );

      return true;
    } catch (error) {
      console.error('Error sending LinkedIn outreach:', error);
      return false;
    }
  }

  /**
   * Get mutual connections for relationship building
   */
  async getMutualConnections(targetProfileId: string): Promise<Array<{
    id: string;
    name: string;
    headline: string;
    profileUrl: string;
  }>> {
    try {
      // LinkedIn API doesn't directly support mutual connections in v2
      // This would require additional API calls or different approach
      console.warn('Mutual connections feature requires LinkedIn Sales Navigator API');
      return [];
    } catch (error) {
      console.error('Error fetching mutual connections:', error);
      return [];
    }
  }

  /**
   * Extract LinkedIn username from URL
   */
  private extractLinkedInUsername(url: string): string | null {
    const patterns = [
      /linkedin\.com\/in\/([^\/\?]+)/,
      /linkedin\.com\/pub\/([^\/\?]+)/,
      /linkedin\.com\/profile\/view\?id=([^&]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Format LinkedIn date object
   */
  private formatDate(dateObj: any): string {
    if (!dateObj) return '';
    const { year, month = 1, day = 1 } = dateObj;
    return new Date(year, month - 1, day).toISOString().split('T')[0];
  }
}

/**
 * Factory function to create LinkedIn Enrichment Agent
 */
export function createLinkedInEnrichmentAgent(
  userId: string,
  encryptionKey: string,
  refreshConfigs: Parameters<typeof getTokenManager>[1]
): LinkedInEnrichmentAgent {
  return new LinkedInEnrichmentAgent(userId, encryptionKey, refreshConfigs);
}
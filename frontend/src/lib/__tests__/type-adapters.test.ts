import { 
  emailContactToZohoContact,
  zohoContactToEmailContact,
  dealDataToZohoDeal,
  zohoDealToDealData,
  isEmailContact,
  isZohoContact,
  isDealData,
  isZohoDeal
} from '@/lib/type-adapters';
import { Contact as EmailContact, DealData } from '@/types/email';
import { Contact as ZohoContact, Deal as ZohoDeal } from '@/types/zoho';

describe('Type Adapters', () => {
  describe('Contact Type Adapters', () => {
    const mockEmailContact: EmailContact = {
      id: '1',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      company: 'Test Company',
      title: 'Software Engineer',
      source: 'Email',
      type: 'Primary'
    };

    const mockZohoContact: ZohoContact = {
      id: '1',
      Email: 'test@example.com',
      First_Name: 'John',
      Last_Name: 'Doe',
      Phone: '+1234567890',
      Account_Name: 'Test Company',
      Title: 'Software Engineer',
      Lead_Source: 'Email',
      source: 'Email',
      type: 'Primary'
    };

    it('should convert EmailContact to ZohoContact', () => {
      const result = emailContactToZohoContact(mockEmailContact);
      
      expect(result.Email).toBe(mockEmailContact.email);
      expect(result.First_Name).toBe(mockEmailContact.firstName);
      expect(result.Last_Name).toBe(mockEmailContact.lastName);
      expect(result.Phone).toBe(mockEmailContact.phone);
      expect(result.Account_Name).toBe(mockEmailContact.company);
      expect(result.Title).toBe(mockEmailContact.title);
      expect(result.Lead_Source).toBe(mockEmailContact.source);
      expect(result.source).toBe(mockEmailContact.source);
      expect(result.type).toBe(mockEmailContact.type);
    });

    it('should convert ZohoContact to EmailContact', () => {
      const result = zohoContactToEmailContact(mockZohoContact);
      
      expect(result.email).toBe(mockZohoContact.Email);
      expect(result.firstName).toBe(mockZohoContact.First_Name);
      expect(result.lastName).toBe(mockZohoContact.Last_Name);
      expect(result.phone).toBe(mockZohoContact.Phone);
      expect(result.company).toBe(mockZohoContact.Account_Name);
      expect(result.title).toBe(mockZohoContact.Title);
      expect(result.source).toBe(mockZohoContact.source);
      expect(result.type).toBe(mockZohoContact.type);
    });
  });

  describe('Deal Type Adapters', () => {
    const mockDealData: DealData = {
      id: '1',
      name: 'Test Deal',
      stage: 'Qualified Lead',
      priority: 'high',
      source: 'Email',
      description: 'Test deal description',
      customFields: {
        originalEmailId: 'email123',
        urgencyScore: 8,
        requirements: ['React', 'Node.js'],
        nextAction: 'Schedule call',
        dealType: 'Permanent Placement'
      },
      contacts: [
        {
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          source: 'Email',
          type: 'Primary'
        }
      ],
      estimatedValue: 50000,
      expectedCloseDate: new Date('2024-01-01'),
      probability: 80
    };

    it('should convert DealData to ZohoDeal', () => {
      const result = dealDataToZohoDeal(mockDealData);
      
      expect(result.Deal_Name).toBe(mockDealData.name);
      expect(result.Stage).toBe(mockDealData.stage);
      expect(result.Amount).toBe(mockDealData.estimatedValue);
      expect(result.Lead_Source).toBe(mockDealData.source);
      expect(result.Description).toBe(mockDealData.description);
      expect(result.Probability).toBe(mockDealData.probability);
      expect(result.Priority).toBe(mockDealData.priority);
      expect(result.Original_Email_ID).toBe(mockDealData.customFields?.originalEmailId);
      expect(result.Urgency_Score).toBe(mockDealData.customFields?.urgencyScore);
      expect(result.Deal_Type).toBe(mockDealData.customFields?.dealType);
    });

    it('should convert ZohoDeal to DealData', () => {
      const mockZohoDeal: ZohoDeal = {
        id: '1',
        Deal_Name: 'Test Deal',
        Stage: 'Qualified Lead',
        Amount: 50000,
        Lead_Source: 'Email',
        Description: 'Test deal description',
        Probability: 80,
        Priority: 'high',
        Original_Email_ID: 'email123',
        Urgency_Score: 8,
        Deal_Type: 'Permanent Placement'
      };

      const result = zohoDealToDealData(mockZohoDeal);
      
      expect(result.name).toBe(mockZohoDeal.Deal_Name);
      expect(result.stage).toBe(mockZohoDeal.Stage);
      expect(result.estimatedValue).toBe(mockZohoDeal.Amount);
      expect(result.source).toBe(mockZohoDeal.Lead_Source);
      expect(result.description).toBe(mockZohoDeal.Description);
      expect(result.probability).toBe(mockZohoDeal.Probability);
      expect(result.priority).toBe(mockZohoDeal.Priority);
      expect(result.customFields?.originalEmailId).toBe(mockZohoDeal.Original_Email_ID);
      expect(result.customFields?.urgencyScore).toBe(mockZohoDeal.Urgency_Score);
      expect(result.customFields?.dealType).toBe(mockZohoDeal.Deal_Type);
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify EmailContact type', () => {
      const emailContact = { email: 'test@example.com', source: 'Email' };
      const notEmailContact = { Email: 'test@example.com' };
      
      expect(isEmailContact(emailContact)).toBe(true);
      expect(isEmailContact(notEmailContact)).toBe(false);
    });

    it('should correctly identify ZohoContact type', () => {
      const zohoContact = { Email: 'test@example.com' };
      const notZohoContact = { email: 'test@example.com' };
      
      expect(isZohoContact(zohoContact)).toBe(true);
      expect(isZohoContact(notZohoContact)).toBe(false);
    });

    it('should correctly identify DealData type', () => {
      const dealData = { name: 'Test', stage: 'New', contacts: [] };
      const notDealData = { Deal_Name: 'Test' };
      
      expect(isDealData(dealData)).toBe(true);
      expect(isDealData(notDealData)).toBe(false);
    });

    it('should correctly identify ZohoDeal type', () => {
      const zohoDeal = { Deal_Name: 'Test Deal' };
      const notZohoDeal = { name: 'Test Deal' };
      
      expect(isZohoDeal(zohoDeal)).toBe(true);
      expect(isZohoDeal(notZohoDeal)).toBe(false);
    });
  });
});
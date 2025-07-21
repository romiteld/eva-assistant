import { Contact as EmailContact, DealData } from '@/types/email';
import { Contact as ZohoContact, Deal as ZohoDeal } from '@/types/zoho';

/**
 * Type adapters to convert between Email and Zoho module types
 * Ensures seamless data flow between email parsing and Zoho integration
 */

/**
 * Converts an Email Contact to a Zoho Contact format
 */
export function emailContactToZohoContact(emailContact: EmailContact): ZohoContact {
  return {
    Email: emailContact.email,
    First_Name: emailContact.firstName || '',
    Last_Name: emailContact.lastName || '',
    Phone: emailContact.phone,
    Account_Name: emailContact.company,
    Title: emailContact.title,
    Lead_Source: emailContact.source || 'Email',
    source: emailContact.source,
    type: emailContact.type,
    Description: `Contact imported from email. Original source: ${emailContact.source}`
  };
}

/**
 * Converts a Zoho Contact to an Email Contact format
 */
export function zohoContactToEmailContact(zohoContact: ZohoContact): EmailContact {
  return {
    id: zohoContact.id,
    email: zohoContact.Email,
    firstName: zohoContact.First_Name,
    lastName: zohoContact.Last_Name,
    phone: zohoContact.Phone,
    company: zohoContact.Account_Name,
    title: zohoContact.Title,
    source: zohoContact.source || zohoContact.Lead_Source || 'Zoho',
    type: zohoContact.type
  };
}

/**
 * Converts DealData (from email parsing) to ZohoDeal format
 */
export function dealDataToZohoDeal(dealData: DealData): ZohoDeal {
  // Convert contacts from email format to Zoho format
  const zohoContacts = dealData.contacts?.map(contact => emailContactToZohoContact(contact)) || [];
  
  // Get primary contact for deal
  const primaryContact = zohoContacts.find(c => c.type === 'Primary') || zohoContacts[0];
  
  return {
    Deal_Name: dealData.name,
    Amount: dealData.estimatedValue,
    Stage: dealData.stage,
    Closing_Date: dealData.expectedCloseDate?.toISOString(),
    Contact_Name: primaryContact ? `${primaryContact.First_Name} ${primaryContact.Last_Name}`.trim() : undefined,
    Account_Name: primaryContact?.Account_Name,
    Probability: dealData.probability,
    Description: dealData.description,
    Lead_Source: dealData.source,
    // Add custom fields with proper naming
    Priority: dealData.priority,
    Deal_Priority: dealData.priority,
    Original_Email_ID: dealData.customFields?.originalEmailId,
    Urgency_Score: dealData.customFields?.urgencyScore,
    Requirements: Array.isArray(dealData.customFields?.requirements) 
      ? dealData.customFields.requirements.join('; ') 
      : dealData.customFields?.requirements,
    Next_Action: dealData.customFields?.nextAction,
    Email_Subject: dealData.customFields?.emailSubject,
    Sender_Email: dealData.customFields?.senderEmail,
    Received_At: dealData.customFields?.receivedAt,
    Has_Attachments: dealData.customFields?.hasAttachments,
    Deal_Type: dealData.customFields?.dealType,
    Location: dealData.customFields?.location,
    Experience_Level: dealData.customFields?.experienceLevel,
    Automation_Rule: dealData.customFields?.automationRule,
    Automation_Rule_ID: dealData.customFields?.automationRuleId,
    // Add any additional custom fields
    ...Object.keys(dealData.customFields || {}).reduce((acc, key) => {
      // Convert camelCase to Snake_Case for Zoho compatibility
      const zohoKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
      acc[zohoKey] = dealData.customFields![key];
      return acc;
    }, {} as Record<string, any>)
  };
}

/**
 * Converts ZohoDeal to DealData format
 */
export function zohoDealToDealData(zohoDeal: ZohoDeal): DealData {
  return {
    id: zohoDeal.id,
    name: zohoDeal.Deal_Name,
    stage: zohoDeal.Stage || 'New Lead',
    priority: (zohoDeal.Priority || zohoDeal.Deal_Priority || 'medium') as 'high' | 'medium' | 'low',
    source: zohoDeal.Lead_Source || 'Zoho',
    description: zohoDeal.Description || '',
    customFields: {
      originalEmailId: zohoDeal.Original_Email_ID,
      urgencyScore: zohoDeal.Urgency_Score,
      requirements: zohoDeal.Requirements,
      nextAction: zohoDeal.Next_Action,
      emailSubject: zohoDeal.Email_Subject,
      senderEmail: zohoDeal.Sender_Email,
      receivedAt: zohoDeal.Received_At,
      hasAttachments: zohoDeal.Has_Attachments,
      dealType: zohoDeal.Deal_Type,
      location: zohoDeal.Location,
      experienceLevel: zohoDeal.Experience_Level,
      automationRule: zohoDeal.Automation_Rule,
      automationRuleId: zohoDeal.Automation_Rule_ID
    },
    contacts: [], // Would need to be populated separately
    estimatedValue: zohoDeal.Amount,
    expectedCloseDate: zohoDeal.Closing_Date ? new Date(zohoDeal.Closing_Date) : undefined,
    probability: zohoDeal.Probability,
    createdAt: zohoDeal.Created_Time ? new Date(zohoDeal.Created_Time) : undefined,
    updatedAt: zohoDeal.Modified_Time ? new Date(zohoDeal.Modified_Time) : undefined
  };
}

/**
 * Batch conversion utilities
 */
export function convertEmailContactsToZoho(emailContacts: EmailContact[]): ZohoContact[] {
  return emailContacts.map(emailContactToZohoContact);
}

export function convertZohoContactsToEmail(zohoContacts: ZohoContact[]): EmailContact[] {
  return zohoContacts.map(zohoContactToEmailContact);
}

/**
 * Type guards for runtime type checking
 */
export function isEmailContact(contact: any): contact is EmailContact {
  return typeof contact === 'object' && 
         typeof contact.email === 'string' && 
         typeof contact.source === 'string';
}

export function isZohoContact(contact: any): contact is ZohoContact {
  return typeof contact === 'object' && 
         typeof contact.Email === 'string';
}

export function isDealData(deal: any): deal is DealData {
  return typeof deal === 'object' && 
         typeof deal.name === 'string' && 
         typeof deal.stage === 'string' && 
         Array.isArray(deal.contacts);
}

export function isZohoDeal(deal: any): deal is ZohoDeal {
  return typeof deal === 'object' && 
         typeof deal.Deal_Name === 'string';
}
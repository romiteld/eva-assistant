export interface Deal {
  id?: string;
  Deal_Name: string;
  Amount?: number;
  Stage?: string;
  Closing_Date?: string;
  Account_Name?: string;
  Contact_Name?: string;
  Probability?: number;
  Description?: string;
  Lead_Source?: string;
  Created_Time?: string;
  Modified_Time?: string;
  Owner?: {
    id: string;
    name: string;
    email: string;
  };
  [key: string]: any; // Allow for custom fields
}

export interface Contact {
  id?: string;
  First_Name?: string;
  Last_Name?: string;
  Email: string;
  Phone?: string;
  Account_Name?: string;
  Title?: string;
  Department?: string;
  LinkedIn?: string;
  Description?: string;
  Lead_Source?: string;
  Mailing_Street?: string;
  Mailing_City?: string;
  Mailing_State?: string;
  Mailing_Zip?: string;
  Mailing_Country?: string;
  Created_Time?: string;
  Modified_Time?: string;
  Owner?: {
    id: string;
    name: string;
    email: string;
  };
  type?: string; // For email parsing context
  source?: string; // For email parsing context
  [key: string]: any; // Allow for custom fields
}

export interface Lead {
  id?: string;
  First_Name: string;
  Last_Name: string;
  Email: string;
  Phone?: string;
  Company: string;
  Title?: string;
  Lead_Status?: string;
  Lead_Source?: string;
  Industry?: string;
  Annual_Revenue?: number;
  Description?: string;
  Website?: string;
  LinkedIn?: string;
  Lead_Score?: number;
  Street?: string;
  City?: string;
  State?: string;
  Zip_Code?: string;
  Country?: string;
  Created_Time?: string;
  Modified_Time?: string;
  Owner?: {
    id: string;
    name: string;
    email: string;
  };
  [key: string]: any; // Allow for custom fields
}

export interface Task {
  id?: string;
  Subject: string;
  Due_Date?: string;
  Priority?: 'High' | 'Normal' | 'Low';
  Status?: 'Not Started' | 'In Progress' | 'Completed' | 'Deferred';
  Description?: string;
  Related_To?: {
    id: string;
    name: string;
    module: string;
  };
  Owner?: {
    id: string;
    name: string;
    email: string;
  };
  Created_Time?: string;
  Modified_Time?: string;
  [key: string]: any; // Allow for custom fields
}

export interface Account {
  id?: string;
  Account_Name: string;
  Phone?: string;
  Website?: string;
  Industry?: string;
  Annual_Revenue?: number;
  Billing_Street?: string;
  Billing_City?: string;
  Billing_State?: string;
  Billing_Code?: string;
  Billing_Country?: string;
  Description?: string;
  Owner?: {
    id: string;
    name: string;
    email: string;
  };
  Created_Time?: string;
  Modified_Time?: string;
  [key: string]: any; // Allow for custom fields
}

export interface ZohoAPIResponse<T> {
  data: T[];
  info?: {
    page: number;
    per_page: number;
    count: number;
    sort_order: string;
    sort_by: string;
    more_records: boolean;
  };
}

export interface ZohoError {
  code: string;
  details: any;
  message: string;
  status: string;
}

// For the ZohoCRMIntegration class compatibility
export type ZohoModule = 'Leads' | 'Contacts' | 'Deals' | 'Accounts' | 'Tasks';

export interface ZohoWebhookPayload {
  module: ZohoModule;
  operation: 'insert' | 'update' | 'delete';
  ids: string[];
  data?: any;
  timestamp: string;
}

// Type aliases for backward compatibility
export type ZohoLead = Lead;
export type ZohoContact = Contact;
export type ZohoDeal = Deal;
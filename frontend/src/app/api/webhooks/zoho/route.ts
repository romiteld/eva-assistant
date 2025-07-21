import { NextRequest, NextResponse } from 'next/server';
import { withWebhookValidation, logWebhookEvent } from '@/middleware/webhook-validation';
import { createClient } from '@/lib/supabase/server';

async function handleZohoWebhook(request: NextRequest, body: any) {
  const supabase = createClient();
  
  try {
    // Log the webhook event
    await logWebhookEvent('zoho', body.module || 'unknown', 'success', body);
    
    // Handle different Zoho CRM events
    const { module, operation, data } = body;
    
    switch (module) {
      case 'Leads':
        if (operation === 'insert') {
          // New lead created in Zoho
          await supabase
            .from('leads')
            .upsert({
              zoho_id: data.id,
              name: `${data.First_Name} ${data.Last_Name}`,
              email: data.Email,
              phone: data.Phone,
              company: data.Company,
              source: 'zoho_webhook',
              metadata: data,
              synced_at: new Date().toISOString(),
            });
        } else if (operation === 'update') {
          // Lead updated in Zoho
          await supabase
            .from('leads')
            .update({
              name: `${data.First_Name} ${data.Last_Name}`,
              email: data.Email,
              phone: data.Phone,
              company: data.Company,
              metadata: data,
              synced_at: new Date().toISOString(),
            })
            .eq('zoho_id', data.id);
        }
        break;
        
      case 'Contacts':
        if (operation === 'insert' || operation === 'update') {
          await supabase
            .from('contacts')
            .upsert({
              zoho_id: data.id,
              first_name: data.First_Name,
              last_name: data.Last_Name,
              email: data.Email,
              phone: data.Phone,
              account_name: data.Account_Name?.name,
              metadata: data,
              synced_at: new Date().toISOString(),
            });
        }
        break;
        
      case 'Deals':
        if (operation === 'insert' || operation === 'update') {
          await supabase
            .from('deals')
            .upsert({
              zoho_id: data.id,
              name: data.Deal_Name,
              amount: data.Amount,
              stage: data.Stage,
              closing_date: data.Closing_Date,
              probability: data.Probability,
              contact_name: data.Contact_Name?.name,
              metadata: data,
              synced_at: new Date().toISOString(),
            });
        }
        break;
        
      default:
        console.log('Unhandled Zoho module:', module);
    }
    
    return NextResponse.json({ message: 'OK' }, { status: 200 });
  } catch (error) {
    console.error('Zoho webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logWebhookEvent('zoho', body.module || 'unknown', 'error', body, errorMessage);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Export the handler with webhook validation
export const POST = withWebhookValidation(handleZohoWebhook, 'zoho');
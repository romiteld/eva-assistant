import { NextRequest, NextResponse } from 'next/server';
import { graphHelpers } from '@/lib/microsoft/graph-client';
import { withAuthAndRateLimit } from '@/middleware/api-security';
import { AuthenticatedRequest } from '@/middleware/auth';

async function handleGet(request: AuthenticatedRequest) {
  try {

    const contacts = await graphHelpers.getContacts(request.user?.id || '', {
      top: 25,
    });

    return NextResponse.json(contacts);
  } catch (error) {
    console.error('Failed to fetch contacts:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}

// Export the GET handler with authentication and API rate limiting
export const GET = withAuthAndRateLimit(handleGet, 'api');

async function handlePost(request: AuthenticatedRequest) {
  try {

    const body = await request.json();
    const { givenName, surname, email, phone, company, jobTitle } = body;

    const contact: any = {
      givenName,
      surname,
      emailAddresses: email ? [{
        address: email,
        name: `${givenName} ${surname}`,
      }] : [],
    };

    if (phone) {
      contact.mobilePhone = phone;
    }

    if (company) {
      contact.companyName = company;
    }

    if (jobTitle) {
      contact.jobTitle = jobTitle;
    }

    const result = await graphHelpers.createContact(request.user?.id || '', contact);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Failed to create contact:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create contact' },
      { status: 500 }
    );
  }
}

// Export the POST handler with authentication and API rate limiting
export const POST = withAuthAndRateLimit(handlePost, 'api');

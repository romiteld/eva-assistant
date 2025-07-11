import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { graphHelpers } from '@/lib/microsoft/graph-client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const contacts = await graphHelpers.getContacts(session.user.id, {
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    const result = await graphHelpers.createContact(session.user.id, contact);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Failed to create contact:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create contact' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { graphHelpers } from '@/lib/microsoft/graph-client';
import { withAuthAndRateLimit } from '@/middleware/api-security';
import { AuthenticatedRequest } from '@/middleware/auth';

async function handleGet(request: AuthenticatedRequest) {
  try {

    const emails = await graphHelpers.getEmails(request.user?.id || '', {
      top: 10,
      filter: 'isRead eq false',
    });

    return NextResponse.json(emails);
  } catch (error: any) {
    console.error('Failed to fetch emails:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch emails' },
      { status: 500 }
    );
  }
}

// Export the GET handler with authentication and API rate limiting
export const GET = withAuthAndRateLimit(handleGet, 'api');

async function handlePost(request: AuthenticatedRequest) {
  try {

    const body = await request.json();
    const { to, subject, content } = body;

    const message = {
      subject,
      body: {
        contentType: 'HTML',
        content,
      },
      toRecipients: [
        {
          emailAddress: {
            address: to,
          },
        },
      ],
    };

    const result = await graphHelpers.sendEmail(request.user?.id || '', message);

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}

// Export the POST handler with authentication and API rate limiting
export const POST = withAuthAndRateLimit(handlePost, 'api');

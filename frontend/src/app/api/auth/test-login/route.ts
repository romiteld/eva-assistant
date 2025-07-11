import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const supabase = createClient();
    
    // Sign in with the service role to create a test session
    const { data: { users }, error } = await supabase.auth.admin.listUsers({
      perPage: 1
    });

    if (error || !users || users.length === 0) {
      return NextResponse.json({ error: 'No users found' }, { status: 400 });
    }

    // Create a session for the first user
    const user = users[0];
    const { data: session, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email!,
    });

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 400 });
    }

    // Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  } catch (error) {
    console.error('Test login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
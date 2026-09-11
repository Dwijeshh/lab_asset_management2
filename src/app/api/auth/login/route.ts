import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, createSessionToken, setSessionCookie } from '@/lib/auth-jwt';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    console.log('Login attempt received');
    
    // Rate limiting - strict for login
    const clientId = getClientIdentifier(request);
    rateLimit(`auth:login:${clientId}`, { windowMs: 60000, maxRequests: 5 });

    const body = await request.json();
    const { email, password } = body;
    
    console.log('Login request for email:', email);

    if (!email || !password) {
      console.log('Missing email or password');
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user
    console.log('Searching for user:', email.toLowerCase());
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    
    console.log('User search result:', userResult.length > 0 ? 'Found' : 'Not found');

    if (userResult.length === 0) {
      // Generic error to prevent user enumeration
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = userResult[0];

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is disabled' },
        { status: 403 }
      );
    }

    // Verify password
    console.log('Verifying password...');
    const isValid = await verifyPassword(password, user.passwordHash);
    console.log('Password valid:', isValid);

    if (!isValid) {
      console.log('Invalid password for user:', email);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    // Create session token
    console.log('Creating session token...');
    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      collegeId: user.collegeId,
      labId: user.labId,
    });

    // Set cookie
    console.log('Setting session cookie...');
    await setSessionCookie(token);
    console.log('Login successful for:', email);

    logger.info('User logged in', { userId: user.id, email: user.email });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        collegeId: user.collegeId,
        labId: user.labId,
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { 
          status: 429,
          headers: { 'Retry-After': error.retryAfter.toString() }
        }
      );
    }

    console.error('Login error details:', error);
    logger.error('Login error', { error });
    return NextResponse.json(
      { error: 'An error occurred during login', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
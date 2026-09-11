// Simple API key authentication
// In production, use proper authentication (NextAuth.js, Auth0, etc.)

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export function validateApiKey(request: Request): void {
  // Get API key from environment
  const validApiKey = process.env.API_KEY;

  // If no API key is set in environment, allow access (development mode)
  // WARNING: In production, always set API_KEY environment variable
  if (!validApiKey) {
    console.warn('⚠️  WARNING: No API_KEY set in environment. All requests allowed!');
    return;
  }

  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    throw new UnauthorizedError('Missing authorization header');
  }

  // Support "Bearer <key>" format
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader;

  if (token !== validApiKey) {
    throw new UnauthorizedError('Invalid API key');
  }
}

// Alternative: Cookie-based authentication check
export function isAuthenticated(request: Request): boolean {
  // This is a placeholder - implement based on your auth strategy
  // For example, check session cookie, JWT, etc.
  
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    // Development mode - allow all
    return true;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return false;
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader;

  return token === apiKey;
}
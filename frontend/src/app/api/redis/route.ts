import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// Initialize Redis
const redis = Redis.fromEnv();

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { key, value, action } = body;

    // Validate required fields
    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'set':
        if (!key || value === undefined) {
          return NextResponse.json(
            { error: 'Key and value are required for set action' },
            { status: 400 }
          );
        }
        result = await redis.set(key, value);
        break;

      case 'get':
        if (!key) {
          return NextResponse.json(
            { error: 'Key is required for get action' },
            { status: 400 }
          );
        }
        result = await redis.get(key);
        break;

      case 'delete':
        if (!key) {
          return NextResponse.json(
            { error: 'Key is required for delete action' },
            { status: 400 }
          );
        }
        result = await redis.del(key);
        break;

      case 'increment':
        if (!key) {
          return NextResponse.json(
            { error: 'Key is required for increment action' },
            { status: 400 }
          );
        }
        result = await redis.incr(key);
        break;

      case 'expire':
        if (!key || !body.seconds) {
          return NextResponse.json(
            { error: 'Key and seconds are required for expire action' },
            { status: 400 }
          );
        }
        result = await redis.expire(key, body.seconds);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: set, get, delete, increment, expire' },
          { status: 400 }
        );
    }

    // Return the result in the response
    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    console.error('Redis operation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Simple health check endpoint
    const result = await redis.ping();
    
    return NextResponse.json({
      status: 'healthy',
      redis: result === 'PONG' ? 'connected' : 'disconnected'
    });
  } catch (error) {
    console.error('Redis health check error:', error);
    return NextResponse.json({
      status: 'unhealthy',
      redis: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
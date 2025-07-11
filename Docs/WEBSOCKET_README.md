# WebSocket Infrastructure Documentation

## Overview

This WebSocket infrastructure provides real-time communication capabilities for the EVA Assistant application using Socket.io. It includes authentication, room management, presence tracking, and real-time data synchronization.

## Architecture

### Components

1. **WebSocket Service** (`/src/lib/services/websocket.ts`)
   - Core Socket.io client wrapper
   - Event emitter pattern for component communication
   - Automatic reconnection logic
   - Room and presence management

2. **WebSocket Context** (`/src/contexts/WebSocketContext.tsx`)
   - React context provider for global socket access
   - Automatic authentication with session
   - Connection state management

3. **Socket.io Server** (`/server.js`)
   - Custom Next.js server with Socket.io integration
   - Authentication handling
   - Room management
   - Presence tracking

4. **Hooks**
   - `useWebSocket`: Main hook for WebSocket functionality
   - `useRealtimeUpdates`: Real-time data synchronization
   - `usePresence`: User presence management

5. **Types** (`/src/types/websocket.ts`)
   - TypeScript definitions for all WebSocket-related types

## Setup

### Installation

The required packages are already included in package.json:
```bash
npm install socket.io socket.io-client
```

### Running the Server

Use the custom server script instead of the default Next.js dev server:

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Usage

### Basic WebSocket Connection

```typescript
import { useWebSocket } from '@/hooks/useWebSocket';

function MyComponent() {
  const { isConnected, emit, subscribe } = useWebSocket();
  
  useEffect(() => {
    const subscription = subscribe('custom-event', (data) => {
      console.log('Received:', data);
    });
    
    return () => subscription.unsubscribe();
  }, [subscribe]);
  
  const sendMessage = () => {
    emit('custom-event', { message: 'Hello!' });
  };
}
```

### Room Management

```typescript
const { joinRoom, leaveRoom } = useWebSocket();

// Join a room
await joinRoom('room-123');

// Leave a room
await leaveRoom('room-123');
```

### Presence Tracking

```typescript
import { usePresence } from '@/hooks/usePresence';

function PresenceComponent() {
  const { users, onlineCount, setStatus } = usePresence({
    roomId: 'my-room'
  });
  
  return (
    <div>
      <p>Online users: {onlineCount}</p>
      <button onClick={() => setStatus('away')}>Set Away</button>
    </div>
  );
}
```

### Real-time Data Updates

```typescript
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';

interface Task {
  id: string;
  title: string;
  completed: boolean;
}

function TaskList() {
  const { state, sendUpdate } = useRealtimeUpdates<Task>({
    entity: 'tasks',
    roomId: 'project-123',
    onCreate: (task) => console.log('New task:', task),
    onUpdate: (update) => console.log('Task updated:', update),
  });
  
  const createTask = async () => {
    await sendUpdate('create', {
      title: 'New Task',
      completed: false
    });
  };
}
```

## Event Types

### Built-in Events

- `connect`: Socket connected
- `disconnect`: Socket disconnected
- `auth:request`: Authentication request
- `auth:success`: Authentication successful
- `auth:error`: Authentication failed
- `room:join`: Join room request
- `room:leave`: Leave room request
- `presence:update`: User presence updated
- `data:update`: Real-time data update
- `broadcast`: Broadcast message

### Custom Events

You can emit and listen to any custom events:

```typescript
// Emit custom event
emit('my-custom-event', { data: 'value' });

// Subscribe to custom event
subscribe('my-custom-event', (data) => {
  console.log(data);
});
```

## Authentication

The WebSocket connection automatically authenticates using the current session:

1. NextAuth session is used for authentication
2. Auth token is sent during connection
3. Server validates the token
4. Connection is established or rejected

## Error Handling

The infrastructure includes comprehensive error handling:

```typescript
try {
  await joinRoom('room-123');
} catch (error) {
  console.error('Failed to join room:', error);
}
```

## Configuration

### Environment Variables

```env
# WebSocket URL (optional, defaults to current origin)
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3000

# App URL for CORS
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### WebSocket Options

```typescript
const options = {
  url: 'http://localhost:3000',
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
};
```

## Best Practices

1. **Always handle disconnections**: Implement proper error handling and reconnection logic
2. **Use rooms for isolation**: Group related connections in rooms
3. **Implement presence**: Track user online/offline status
4. **Optimize event frequency**: Batch updates when possible
5. **Clean up subscriptions**: Always unsubscribe in useEffect cleanup

## Example Implementation

See `/src/components/examples/WebSocketExample.tsx` for a complete working example.

## Troubleshooting

### Connection Issues

1. Ensure the custom server is running (`npm run dev`)
2. Check CORS configuration
3. Verify authentication is working

### Event Not Received

1. Check event name spelling
2. Ensure you're subscribed before events are emitted
3. Verify room membership if using rooms

### Performance Issues

1. Reduce event frequency
2. Implement debouncing/throttling
3. Use rooms to limit broadcast scope
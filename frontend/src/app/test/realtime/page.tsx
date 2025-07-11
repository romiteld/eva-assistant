'use client';

import WebSocketTestSuite from '@/test/websocket-test';

export default function RealtimeTestPage() {
  return (
    <div className="min-h-screen bg-background">
      <WebSocketTestSuite />
    </div>
  );
}
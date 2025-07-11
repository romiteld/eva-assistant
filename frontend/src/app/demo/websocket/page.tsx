import WebSocketExample from '@/components/examples/WebSocketExample';

export default function WebSocketDemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          WebSocket Real-time Demo
        </h1>
        <WebSocketExample />
      </div>
    </div>
  );
}
'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { usePresence } from '@/hooks/usePresence';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { WebSocketEvent } from '@/types/websocket';

interface Message {
  id: string;
  text: string;
  userId: string;
  userName?: string;
  timestamp: Date;
}

export default function WebSocketExample() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [roomId] = useState('demo-room');
  
  const { 
    isConnected, 
    connectionState, 
    subscribe, 
    emit, 
    joinRoom, 
    updatePresence 
  } = useWebSocket({ autoConnect: true });

  const { 
    users, 
    onlineCount, 
    setStatus 
  } = usePresence({ roomId });

  const {
    state: realtimeState,
    sendUpdate,
  } = useRealtimeUpdates<Message>({
    entity: 'messages',
    roomId,
    onCreate: (message) => {
      setMessages(prev => [...prev, message]);
    },
  });

  // Join room when connected
  useEffect(() => {
    if (isConnected) {
      joinRoom(roomId).catch(console.error);
      updatePresence('online');
    }
  }, [isConnected, roomId, joinRoom, updatePresence]);

  // Subscribe to broadcast messages
  useEffect(() => {
    const subscription = subscribe(WebSocketEvent.BROADCAST, ({ channel, message, senderId }: { channel: string; message: string; senderId: string }) => {
      if (channel === 'chat') {
        const newMessage: Message = {
          id: `${Date.now()}-${Math.random()}`,
          text: message,
          userId: senderId,
          userName: users.find(u => u.userId === senderId)?.name || senderId,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, newMessage]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [subscribe, users]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || !isConnected) return;

    try {
      // Send via broadcast
      emit(WebSocketEvent.BROADCAST, {
        channel: 'chat',
        message: inputMessage,
      });

      // Or send via realtime updates
      // await sendUpdate('create', {
      //   text: inputMessage,
      //   userId: 'current-user',
      //   timestamp: new Date(),
      // });

      setInputMessage('');
    } catch (error) {
      console.error('Failed to send message:', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">WebSocket Demo</h2>
        
        {/* Connection Status */}
        <div className="mb-6">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-sm text-gray-600">
              Status: {connectionState}
            </span>
          </div>
        </div>

        {/* Online Users */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">
            Online Users ({onlineCount})
          </h3>
          <div className="flex flex-wrap gap-2">
            {users.map(user => (
              <div
                key={user.userId}
                className="flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-full"
              >
                <div className={`w-2 h-2 rounded-full ${
                  user.status === 'online' ? 'bg-green-400' :
                  user.status === 'away' ? 'bg-yellow-400' :
                  user.status === 'busy' ? 'bg-red-400' :
                  'bg-gray-400'
                }`} />
                <span className="text-sm">
                  {user.name || user.email}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Presence Controls */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Your Status</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setStatus('online')}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Online
            </button>
            <button
              onClick={() => setStatus('away')}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Away
            </button>
            <button
              onClick={() => setStatus('busy')}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Busy
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Chat Messages</h3>
          <div className="h-64 overflow-y-auto border rounded p-4 mb-4 bg-gray-50">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-center">No messages yet...</p>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="mb-2">
                  <div className="flex items-start space-x-2">
                    <span className="font-semibold text-sm">
                      {msg.userName}:
                    </span>
                    <span className="text-sm">{msg.text}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Message Input */}
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputMessage(e.target.value)}
              onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!isConnected}
            />
            <button
              onClick={sendMessage}
              disabled={!isConnected || !inputMessage.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>

        {/* Real-time Updates Info */}
        {realtimeState.lastUpdate && (
          <div className="text-sm text-gray-600">
            Last update: {realtimeState.lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
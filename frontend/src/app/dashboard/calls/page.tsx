'use client';

import React, { useState, useEffect } from 'react';
import { VideoCall } from '@/components/webrtc/VideoCall';
import { motion } from 'framer-motion';
import { 
  Video, 
  Users, 
  Mic, 
  Monitor, 
  Calendar,
  Clock,
  Copy,
  Check,
  ArrowRight,
  Phone,
  PhoneOff,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';

interface CallRoom {
  id: string;
  name: string;
  createdAt: Date;
  participants: number;
}

export default function CallsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isInCall, setIsInCall] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [copied, setCopied] = useState(false);
  const [recentRooms, setRecentRooms] = useState<CallRoom[]>([]);
  
  // Get user info (in production, get from auth)
  const userId = 'user-' + Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    // Load recent rooms from localStorage
    const stored = localStorage.getItem('recentCallRooms');
    if (stored) {
      setRecentRooms(JSON.parse(stored));
    }

    // Set default username
    const storedName = localStorage.getItem('callUserName');
    if (storedName) {
      setUserName(storedName);
    } else {
      setUserName(`User ${userId.slice(0, 8)}`);
    }
  }, [userId]);

  const createNewRoom = () => {
    const newRoomId = `room-${uuidv4().slice(0, 8)}`;
    setRoomId(newRoomId);
  };

  const joinCall = () => {
    if (!roomId.trim()) {
      toast({
        title: 'Please enter a room ID',
        variant: 'destructive'
      });
      return;
    }

    if (!userName.trim()) {
      toast({
        title: 'Please enter your name',
        variant: 'destructive'
      });
      return;
    }

    // Save username
    localStorage.setItem('callUserName', userName);

    // Add to recent rooms
    const room: CallRoom = {
      id: roomId,
      name: `Call on ${new Date().toLocaleDateString()}`,
      createdAt: new Date(),
      participants: 1,
    };

    const updatedRooms = [room, ...recentRooms.filter(r => r.id !== roomId)].slice(0, 5);
    setRecentRooms(updatedRooms);
    localStorage.setItem('recentCallRooms', JSON.stringify(updatedRooms));

    setIsInCall(true);
  };

  const endCall = () => {
    setIsInCall(false);
    toast({
      title: 'Call ended',
      variant: 'success'
    });
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    toast({
      title: 'Room ID copied to clipboard',
      variant: 'success'
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const joinRecentRoom = (room: CallRoom) => {
    setRoomId(room.id);
  };

  if (isInCall) {
    return (
      <div className="h-screen bg-gray-900">
        <VideoCall
          roomId={roomId}
          userId={userId}
          displayName={userName}
          onCallEnd={endCall}
          initialVideo={true}
          initialAudio={true}
          enableRecording={true}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4"
          >
            <Video className="w-10 h-10 text-blue-600" />
          </motion.div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            EVA Video Calls
          </h1>
          <p className="text-xl text-gray-600">
            High-quality video calls with screen sharing and recording
          </p>
        </div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8 mb-8"
        >
          <h2 className="text-2xl font-semibold mb-6">Start or Join a Call</h2>

          {/* User Name Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Room ID Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room ID
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter room ID or create new"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={createNewRoom}
                className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                New Room
              </button>
              {roomId && (
                <button
                  onClick={copyRoomId}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              )}
            </div>
          </div>

          {/* Join Button */}
          <button
            onClick={joinCall}
            className="w-full py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 text-lg font-medium"
          >
            <Phone className="w-5 h-5" />
            <span>Join Call</span>
          </button>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <div className="bg-white rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-2">Multi-participant</h3>
            <p className="text-gray-600 text-sm">
              Support for multiple participants with automatic layout adjustment
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Monitor className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">Screen Sharing</h3>
            <p className="text-gray-600 text-sm">
              Share your screen, application window, or browser tab
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <div className="w-3 h-3 bg-red-600 rounded-full" />
            </div>
            <h3 className="font-semibold mb-2">Recording</h3>
            <p className="text-gray-600 text-sm">
              Record your calls for later review or sharing
            </p>
          </div>
        </motion.div>

        {/* Recent Rooms */}
        {recentRooms.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-xl p-8"
          >
            <h2 className="text-2xl font-semibold mb-6">Recent Rooms</h2>
            <div className="space-y-3">
              {recentRooms.map((room: CallRoom) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => joinRecentRoom(room)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{room.name}</p>
                      <p className="text-sm text-gray-500">Room ID: {room.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        <Clock className="w-4 h-4 inline mr-1" />
                        {new Date(room.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center text-gray-600"
        >
          <p className="mb-2">
            Share the room ID with others to let them join your call
          </p>
          <p className="text-sm">
            Calls use peer-to-peer connections via WebRTC for low latency
          </p>
        </motion.div>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Mic, 
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
  Settings,
  Zap,
  MessageSquare,
  Activity,
  Wifi,
  WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { voiceStreamingService } from '@/lib/services/webrtc-voice-streaming';
import { Eva3DSphere } from '@/components/voice/Eva3DSphere';
import { useVoiceSession } from '@/hooks/useVoiceSession';
import { cn } from '@/lib/utils';

interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export default function VoiceRealtimePage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioData, setAudioData] = useState<number[]>(new Array(128).fill(0));
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');
  const [latency, setLatency] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // Voice session tracking
  const { 
    sessionData, 
    trackCommand, 
    updateSession 
  } = useVoiceSession(sessionId);

  // Audio visualization update
  const updateAudioVisualization = useCallback(() => {
    const data = voiceStreamingService.getAudioData();
    setAudioData(Array.from(data));
    animationFrameRef.current = requestAnimationFrame(updateAudioVisualization);
  }, []);

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Set up streaming service event listeners
  useEffect(() => {
    const handleConnected = () => {
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      setIsListening(false);
      setIsSpeaking(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };

    const handleError = (err: Error) => {
      setError(err.message);
      setIsConnecting(false);
    };

    const handleTranscript = (text: string) => {
      setCurrentTranscript(text);
    };

    const handleResponseUpdate = (text: string) => {
      setCurrentResponse(text);
    };

    const handleResponseComplete = (text: string) => {
      if (text) {
        setTranscript(prev => [
          ...prev,
          {
            id: `response-${Date.now()}`,
            role: 'assistant',
            content: text,
            timestamp: Date.now()
          }
        ]);
      }
      setCurrentResponse('');
    };

    const handleSpeechStarted = () => {
      setIsListening(true);
      setCurrentTranscript('');
    };

    const handleSpeechStopped = () => {
      setIsListening(false);
      if (currentTranscript) {
        setTranscript(prev => [
          ...prev,
          {
            id: `user-${Date.now()}`,
            role: 'user',
            content: currentTranscript,
            timestamp: Date.now()
          }
        ]);
      }
    };

    const handleAudioChunk = async (audioData: ArrayBuffer) => {
      audioQueueRef.current.push(audioData);
      if (audioQueueRef.current.length === 1) {
        processAudioQueue();
      }
    };

    const processAudioQueue = async () => {
      if (audioQueueRef.current.length === 0 || !audioContextRef.current) return;
      
      setIsSpeaking(true);
      const audioData = audioQueueRef.current.shift()!;
      
      try {
        // Convert PCM16 to Float32
        const pcm16 = new Int16Array(audioData);
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) {
          float32[i] = pcm16[i] / 32768.0;
        }
        
        // Create audio buffer
        const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
        audioBuffer.copyToChannel(float32, 0);
        
        // Play audio
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => {
          processAudioQueue();
          if (audioQueueRef.current.length === 0) {
            setIsSpeaking(false);
          }
        };
        source.start();
      } catch (err) {
        console.error('Audio playback error:', err);
        setIsSpeaking(false);
      }
    };

    // Subscribe to events
    voiceStreamingService.on('connected', handleConnected);
    voiceStreamingService.on('disconnected', handleDisconnected);
    voiceStreamingService.on('error', handleError);
    voiceStreamingService.on('transcript', handleTranscript);
    voiceStreamingService.on('responseUpdate', handleResponseUpdate);
    voiceStreamingService.on('responseComplete', handleResponseComplete);
    voiceStreamingService.on('speechStarted', handleSpeechStarted);
    voiceStreamingService.on('speechStopped', handleSpeechStopped);
    voiceStreamingService.on('audioChunk', handleAudioChunk);

    // Cleanup
    return () => {
      voiceStreamingService.off('connected', handleConnected);
      voiceStreamingService.off('disconnected', handleDisconnected);
      voiceStreamingService.off('error', handleError);
      voiceStreamingService.off('transcript', handleTranscript);
      voiceStreamingService.off('responseUpdate', handleResponseUpdate);
      voiceStreamingService.off('responseComplete', handleResponseComplete);
      voiceStreamingService.off('speechStarted', handleSpeechStarted);
      voiceStreamingService.off('speechStopped', handleSpeechStopped);
      voiceStreamingService.off('audioChunk', handleAudioChunk);
    };
  }, [currentTranscript]);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [transcript, currentTranscript, currentResponse]);

  // Start/stop connection
  const toggleConnection = async () => {
    if (isConnected) {
      voiceStreamingService.disconnect();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else {
      setIsConnecting(true);
      try {
        await voiceStreamingService.connect({
          language: 'en',
          voiceId: 'alloy',
          temperature: 0.8
        });
        voiceStreamingService.startStreaming();
        updateAudioVisualization();
        
        // Track session start
        await trackCommand('voice_streaming', { sessionId }, 'running');
      } catch (err) {
        console.error('Connection failed:', err);
        setError('Failed to connect to voice streaming service');
        setIsConnecting(false);
      }
    }
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    // TODO: Implement actual mute functionality
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Real-time Voice Chat</h1>
          <p className="text-gray-400">Ultra-low latency voice conversation with Eva</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main visualization and controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* 3D Visualization */}
            <Card className="bg-gray-900 border-gray-800 overflow-hidden">
              <div className="relative h-[400px]">
                <Eva3DSphere
                  audioData={audioData}
                  isListening={isListening}
                  isSpeaking={isSpeaking}
                  className="absolute inset-0"
                />
                
                {/* Connection status overlay */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm",
                    isConnected ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"
                  )}>
                    {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                    <span className="text-sm font-medium">
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  
                  {isConnected && (
                    <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-800/50 backdrop-blur-sm">
                      <Activity className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-400">{latency}ms</span>
                    </div>
                  )}
                </div>
                
                {/* Control buttons */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
                  {/* Main call button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleConnection}
                    disabled={isConnecting}
                    className={cn(
                      "p-6 rounded-full shadow-2xl transition-all",
                      isConnected 
                        ? "bg-red-500 hover:bg-red-600 shadow-red-500/50" 
                        : "bg-green-500 hover:bg-green-600 shadow-green-500/50"
                    )}
                  >
                    {isConnecting ? (
                      <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isConnected ? (
                      <PhoneOff className="w-8 h-8 text-white" />
                    ) : (
                      <Phone className="w-8 h-8 text-white" />
                    )}
                  </motion.button>
                  
                  {/* Mute button */}
                  {isConnected && (
                    <motion.button
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={toggleMute}
                      className={cn(
                        "p-4 rounded-full transition-all",
                        isMuted 
                          ? "bg-red-500/20 text-red-400" 
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      )}
                    >
                      {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                    </motion.button>
                  )}
                </div>
              </div>
            </Card>

            {/* Real-time transcript */}
            <Card className="bg-gray-900 border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-400" />
                  Live Transcript
                </h3>
              </div>
              <ScrollArea ref={scrollAreaRef} className="h-[300px] p-4">
                <div className="space-y-3">
                  {transcript.map((entry) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "p-3 rounded-lg",
                        entry.role === 'user' 
                          ? "bg-blue-500/10 border border-blue-500/20 ml-8" 
                          : "bg-purple-500/10 border border-purple-500/20 mr-8"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className={cn(
                          "p-1.5 rounded-full",
                          entry.role === 'user' ? "bg-blue-500/20" : "bg-purple-500/20"
                        )}>
                          {entry.role === 'user' ? (
                            <Mic className="w-3 h-3 text-blue-400" />
                          ) : (
                            <Zap className="w-3 h-3 text-purple-400" />
                          )}
                        </div>
                        <p className="text-sm text-gray-200 flex-1">{entry.content}</p>
                      </div>
                    </motion.div>
                  ))}
                  
                  {/* Current transcript */}
                  {currentTranscript && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 ml-8"
                    >
                      <div className="flex items-start gap-2">
                        <div className="p-1.5 rounded-full bg-blue-500/20">
                          <Mic className="w-3 h-3 text-blue-400" />
                        </div>
                        <p className="text-sm text-gray-200 flex-1">
                          {currentTranscript}
                          <span className="inline-block w-1 h-4 bg-blue-400 ml-1 animate-pulse" />
                        </p>
                      </div>
                    </motion.div>
                  )}
                  
                  {/* Current response */}
                  {currentResponse && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 mr-8"
                    >
                      <div className="flex items-start gap-2">
                        <div className="p-1.5 rounded-full bg-purple-500/20">
                          <Zap className="w-3 h-3 text-purple-400" />
                        </div>
                        <p className="text-sm text-gray-200 flex-1">
                          {currentResponse}
                          <span className="inline-block w-1 h-4 bg-purple-400 ml-1 animate-pulse" />
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>

          {/* Settings and info panel */}
          <div className="space-y-6">
            {/* Connection info */}
            <Card className="bg-gray-900 border-gray-800">
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-gray-400" />
                  Voice Settings
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400">Voice Model</label>
                    <p className="text-white">Alloy (Natural)</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Language</label>
                    <p className="text-white">English</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Streaming Mode</label>
                    <p className="text-white">Real-time WebRTC</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Audio Quality</label>
                    <p className="text-white">48kHz / 16-bit</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Instructions */}
            <Card className="bg-gray-900 border-gray-800">
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-4">How to use</h3>
                <ol className="space-y-2 text-sm text-gray-300">
                  <li className="flex gap-2">
                    <span className="text-purple-400">1.</span>
                    Click the call button to connect
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple-400">2.</span>
                    Start speaking naturally
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple-400">3.</span>
                    Eva will respond in real-time
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple-400">4.</span>
                    Interrupt anytime by speaking
                  </li>
                </ol>
              </div>
            </Card>
          </div>
        </div>

        {/* Error display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-6"
            >
              <Card className="bg-red-900/20 border-red-800">
                <div className="p-4 text-red-300">{error}</div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
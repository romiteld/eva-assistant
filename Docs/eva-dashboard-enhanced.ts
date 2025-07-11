import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Calendar, Mail, Briefcase, Mic, MicOff, Phone, Users, TrendingUp, 
  Clock, CheckCircle, AlertCircle, PlayCircle, Search, Send, FileText, 
  BarChart3, Zap, Globe, Linkedin, DollarSign, Video, Archive, Bot, 
  Menu, X, Upload, Camera, Monitor, MessageSquare, Plus, Settings,
  Share2, FileUp, Image, Loader2, Shield, Database, Wifi
} from 'lucide-react';

// Enhanced EVA Dashboard with Real Integrations
export default function EVADashboard() {
  // Core States
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [realtimeMessages, setRealtimeMessages] = useState<any[]>([]);
  
  // Refs
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  // Real-time metrics with dynamic updates
  const [metrics, setMetrics] = useState({
    timeSaved: 4.2,
    emailsProcessed: 127,
    dealsUpdated: 8,
    meetingsScheduled: 5,
    candidatesReached: 23,
    placementsActive: 12,
    messagesAnalyzed: 342,
    contentGenerated: 18
  });

  // Integration states
  const [integrationStatus, setIntegrationStatus] = useState({
    supabase: 'connecting',
    zoho: 'disconnected',
    outlook: 'connected',
    sharepoint: 'connected',
    zoom: 'connected',
    twilio: 'connected',
    linkedin: 'connected',
    firecrawl: 'connected'
  });

  // Live data states
  const [emails, setEmails] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Initialize WebSocket connection
  useEffect(() => {
    // Simulated WebSocket connection - replace with actual Supabase WebSocket
    const connectWebSocket = () => {
      // In production, use: wsRef.current = new WebSocket('wss://your-supabase-url/realtime/v1/websocket?apikey=your-key');
      console.log('Connecting to Supabase WebSocket...');
      setIsConnected(true);
      setIntegrationStatus(prev => ({ ...prev, supabase: 'connected' }));
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Voice waveform animation
  useEffect(() => {
    if (isListening && waveformRef.current) {
      const canvas = waveformRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const width = canvas.width;
      const height = canvas.height;
      
      const animate = () => {
        ctx.clearRect(0, 0, width, height);
        
        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#3b82f6');
        gradient.addColorStop(0.5, '#8b5cf6');
        gradient.addColorStop(1, '#ec4899');
        
        const bars = 60;
        const barWidth = width / bars;
        
        for (let i = 0; i < bars; i++) {
          const amplitude = Math.sin((Date.now() / 100 + i) * 0.1) * 0.3 + 0.7;
          const barHeight = Math.random() * height * amplitude;
          const x = i * barWidth;
          const y = (height - barHeight) / 2;
          
          ctx.fillStyle = gradient;
          ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
        }
        
        animationRef.current = requestAnimationFrame(animate);
      };
      
      animate();
    } else if (waveformRef.current) {
      const ctx = waveformRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, waveformRef.current.width, waveformRef.current.height);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
  }, [isListening]);

  // Enhanced voice handling with Gemini Live API simulation
  const handleVoiceToggle = useCallback(async () => {
    setIsListening(!isListening);
    
    if (!isListening) {
      setVoiceText("Listening... Ask me anything!");
      
      // Simulate voice processing
      setTimeout(() => {
        setVoiceText("Schedule a meeting with Mike McAdam about the Phoenix advisor position");
        
        setTimeout(() => {
          setVoiceText("I'll check calendars and create a Zoom meeting. Tuesday at 2 PM works for both of you. I'll send invites and prepare the candidate briefing. Should I also update the deal in Zoho?");
          
          // Update metrics
          setMetrics(prev => ({
            ...prev,
            meetingsScheduled: prev.meetingsScheduled + 1,
            timeSaved: prev.timeSaved + 0.3
          }));
        }, 2000);
      }, 1500);
    } else {
      setVoiceText("");
    }
  }, [isListening]);

  // Screen sharing handler
  const handleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });
        streamRef.current = stream;
        setIsScreenSharing(true);
        
        // Send to Gemini Live API
        console.log('Screen sharing started - streaming to Gemini Live API');
      } catch (err) {
        console.error('Error sharing screen:', err);
      }
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setIsScreenSharing(false);
    }
  };

  // Camera handler
  const handleCameraToggle = async () => {
    if (!isCameraActive) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        streamRef.current = stream;
        setIsCameraActive(true);
        
        // Send to Gemini Live API
        console.log('Camera active - streaming to Gemini Live API');
      } catch (err) {
        console.error('Error accessing camera:', err);
      }
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsCameraActive(false);
    }
  };

  // File upload handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    // Process with Gemini
    console.log('Uploading file to Supabase Storage and processing with Gemini...');
  };

  // Helper functions
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const tabs = ['overview', 'workflows', 'communications', 'recruiting', 'content', 'analytics', 'integrations'];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Enhanced Header with Status Indicators */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-800 lg:hidden transition-all"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center space-x-2">
              <Bot className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                EVA
              </h1>
            </div>
            <span className="hidden sm:inline text-gray-400">Good morning, Steve</span>
            
            {/* Connection Status */}
            <div className="hidden md:flex items-center space-x-2 ml-6">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
              <span className="text-xs text-gray-400">
                {isConnected ? 'Connected' : 'Connecting...'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 sm:space-x-6">
            {/* Quick Actions */}
            <button
              onClick={handleScreenShare}
              className={`hidden sm:block p-2 rounded-lg transition-all ${
                isScreenSharing 
                  ? 'bg-purple-500 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title="Share Screen"
            >
              <Monitor className="w-5 h-5" />
            </button>
            
            <button
              onClick={handleCameraToggle}
              className={`hidden sm:block p-2 rounded-lg transition-all ${
                isCameraActive 
                  ? 'bg-purple-500 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title="Toggle Camera"
            >
              <Camera className="w-5 h-5" />
            </button>
            
            <div className="hidden sm:block text-right">
              <div className="text-sm text-gray-400">{formatDate(currentTime)}</div>
              <div className="text-xl font-semibold">{formatTime(currentTime)}</div>
            </div>
            
            <button
              onClick={handleVoiceToggle}
              className={`p-3 rounded-full transition-all transform hover:scale-105 ${
                isListening 
                  ? 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 animate-pulse shadow-lg shadow-red-500/50' 
                  : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/50'
              }`}
            >
              {isListening ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-gray-900 border-b border-gray-800 px-4 py-2">
          <nav className="flex flex-col space-y-1">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setMobileMenuOpen(false);
                }}
                className={`px-4 py-2 rounded-lg capitalize text-left transition-all ${
                  activeTab === tab 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Desktop Navigation */}
      <div className="hidden lg:block bg-gray-900 px-6 py-2 border-b border-gray-800">
        <nav className="flex space-x-6">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg capitalize transition-all ${
                activeTab === tab 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Enhanced Voice Interface */}
      {isListening && (
        <div className="bg-gradient-to-b from-gray-900 to-gray-950 border-b border-gray-800 px-4 sm:px-6 py-6">
          <div className="max-w-4xl mx-auto">
            <canvas 
              ref={waveformRef} 
              width={1000} 
              height={80} 
              className="w-full h-16 sm:h-20 mb-4 rounded-lg"
            />
            <div className="text-center">
              <p className="text-lg sm:text-xl text-gray-300 mb-2">{voiceText}</p>
              <div className="flex justify-center space-x-4 mt-4">
                <button 
                  onClick={handleScreenShare}
                  className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all ${
                    isScreenSharing 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  <span className="text-sm">Share Screen</span>
                </button>
                <button 
                  onClick={handleCameraToggle}
                  className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all ${
                    isCameraActive 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span className="text-sm">Share Camera</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Camera Preview */}
      {isCameraActive && (
        <div className="fixed bottom-24 right-6 z-50 bg-gray-900 rounded-lg shadow-2xl p-2 border border-gray-700">
          <video 
            ref={videoRef}
            autoPlay 
            playsInline
            muted
            className="w-48 h-36 rounded-lg"
          />
          <button
            onClick={handleCameraToggle}
            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 p-1 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="px-4 sm:px-6 py-4 sm:py-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left Column - Enhanced Metrics */}
            <div className="space-y-4 sm:space-y-6 order-2 lg:order-1">
              {/* Real-time Impact Metrics */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
                <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
                  Today's AI Impact
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-gray-800/50 backdrop-blur rounded-lg p-3 sm:p-4 border border-gray-700">
                    <div className="text-2xl sm:text-3xl font-bold text-green-500">{metrics.timeSaved.toFixed(1)}h</div>
                    <div className="text-xs sm:text-sm text-gray-400">Time Saved</div>
                  </div>
                  <div className="bg-gray-800/50 backdrop-blur rounded-lg p-3 sm:p-4 border border-gray-700">
                    <div className="text-2xl sm:text-3xl font-bold text-blue-500">{metrics.emailsProcessed}</div>
                    <div className="text-xs sm:text-sm text-gray-400">Emails</div>
                  </div>
                  <div className="bg-gray-800/50 backdrop-blur rounded-lg p-3 sm:p-4 border border-gray-700">
                    <div className="text-2xl sm:text-3xl font-bold text-purple-500">{metrics.candidatesReached}</div>
                    <div className="text-xs sm:text-sm text-gray-400">Candidates</div>
                  </div>
                  <div className="bg-gray-800/50 backdrop-blur rounded-lg p-3 sm:p-4 border border-gray-700">
                    <div className="text-2xl sm:text-3xl font-bold text-yellow-500">{metrics.placementsActive}</div>
                    <div className="text-xs sm:text-sm text-gray-400">Placements</div>
                  </div>
                </div>
              </div>

              {/* Smart Workflows */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
                <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center">
                  <Zap className="w-5 h-5 mr-2 text-yellow-500" />
                  Active AI Workflows
                </h2>
                <div className="space-y-3">
                  <div className="bg-gray-800/50 backdrop-blur rounded-lg p-3 sm:p-4 border border-gray-700">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">Enriching candidate: Sarah Chen</p>
                        <p className="text-xs text-gray-400">LinkedIn + Firecrawl analysis</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500" style={{ width: '75%' }} />
                    </div>
                  </div>
                  
                  <div className="bg-gray-800/50 backdrop-blur rounded-lg p-3 sm:p-4 border border-gray-700">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">Generating placement report</p>
                        <p className="text-xs text-gray-400">Gemini 2.5 Pro analysis</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all duration-500" style={{ width: '45%' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* File Upload Area */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
                <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center">
                  <FileUp className="w-5 h-5 mr-2 text-blue-500" />
                  Quick Upload
                </h2>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    accept=".pdf,.doc,.docx,.xlsx,.csv,.txt"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm text-gray-400">Drop files or click to upload</p>
                    <p className="text-xs text-gray-500 mt-1">PDF, DOC, XLSX, CSV (up to 50MB)</p>
                  </label>
                </div>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="mt-4">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Uploading and analyzing...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Center Column - Main Actions & Communications */}
            <div className="space-y-4 sm:space-y-6 order-1 lg:order-2">
              {/* AI-Powered Quick Actions */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
                <h2 className="text-lg sm:text-xl font-semibold mb-4">AI Actions</h2>
                <div className="grid grid-cols-2 gap-3">
                  <button className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg p-4 flex flex-col items-center space-y-2 transition-all transform hover:scale-105">
                    <Mail className="w-6 h-6" />
                    <span className="text-sm">Smart Email</span>
                  </button>
                  <button className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg p-4 flex flex-col items-center space-y-2 transition-all transform hover:scale-105">
                    <Users className="w-6 h-6" />
                    <span className="text-sm">Find Candidates</span>
                  </button>
                  <button className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg p-4 flex flex-col items-center space-y-2 transition-all transform hover:scale-105">
                    <Calendar className="w-6 h-6" />
                    <span className="text-sm">Schedule</span>
                  </button>
                  <button className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white rounded-lg p-4 flex flex-col items-center space-y-2 transition-all transform hover:scale-105">
                    <Image className="w-6 h-6" />
                    <span className="text-sm">Generate Image</span>
                  </button>
                </div>
              </div>

              {/* Smart Email Triage */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
                <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center justify-between">
                  <span className="flex items-center">
                    <Mail className="w-5 h-5 mr-2 text-blue-500" />
                    AI Email Triage
                  </span>
                  <span className="text-xs sm:text-sm text-gray-400">14 new</span>
                </h2>
                <div className="space-y-3">
                  <div className="bg-gray-800/50 backdrop-blur rounded-lg p-3 sm:p-4 hover:bg-gray-750 transition-all cursor-pointer border border-gray-700">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center">
                          <span className="w-2 h-2 rounded-full mr-2 bg-red-500 animate-pulse" />
                          <p className="font-medium text-sm sm:text-base truncate">Michael McAdam</p>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-400 mt-1 truncate">Re: Phoenix advisor placement - urgent decision</p>
                        <p className="text-xs text-blue-400 mt-1">AI: High priority - compensation negotiation</p>
                      </div>
                      <span className="text-xs text-gray-500 ml-2 flex-shrink-0">2 min</span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-800/50 backdrop-blur rounded-lg p-3 sm:p-4 hover:bg-gray-750 transition-all cursor-pointer border border-gray-700">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center">
                          <span className="w-2 h-2 rounded-full mr-2 bg-yellow-500" />
                          <p className="font-medium text-sm sm:text-base truncate">Kate Kamman</p>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-400 mt-1 truncate">New candidate referral - top performer</p>
                        <p className="text-xs text-blue-400 mt-1">AI: Draft response ready</p>
                      </div>
                      <span className="text-xs text-gray-500 ml-2 flex-shrink-0">15 min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time Notifications */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
                <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center">
                  <Wifi className="w-5 h-5 mr-2 text-green-500" />
                  Live Updates
                </h2>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <div className="flex items-start space-x-3 p-2 bg-gray-800/50 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 animate-pulse" />
                    <div className="flex-1">
                      <p className="text-sm">New LinkedIn message from advisor interested in Phoenix opportunity</p>
                      <p className="text-xs text-gray-400">Just now</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-2 bg-gray-800/50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                    <div className="flex-1">
                      <p className="text-sm">Zoom recording processed: Client meeting with Guardian Resources</p>
                      <p className="text-xs text-gray-400">5 min ago</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Calendar & Analytics */}
            <div className="space-y-4 sm:space-y-6 order-3">
              {/* Smart Calendar */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
                <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-purple-500" />
                  AI-Optimized Schedule
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg border-l-2 border-blue-500">
                    <div className="text-center flex-shrink-0">
                      <div className="text-xs text-gray-400">10:30</div>
                      <div className="text-xs text-gray-400">AM</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">Client: McAdam Financial</p>
                      <p className="text-xs sm:text-sm text-gray-400">Zoom • AI briefing ready</p>
                    </div>
                    <Video className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg">
                    <div className="text-center flex-shrink-0">
                      <div className="text-xs text-gray-400">2:00</div>
                      <div className="text-xs text-gray-400">PM</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">Candidate: Sarah Chen</p>
                      <p className="text-xs sm:text-sm text-gray-400">Phone • AI notes enabled</p>
                    </div>
                    <Phone className="w-4 h-4 text-green-500 flex-shrink-0" />
                  </div>
                  
                  <button className="w-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white py-2 rounded-lg text-sm transition-all flex items-center justify-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>Find optimal meeting time</span>
                  </button>
                </div>
              </div>

              {/* AI Task Prioritization */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
                <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                  AI Priority Tasks
                </h2>
                <div className="space-y-3">
                  <div className="bg-gray-800/50 backdrop-blur rounded-lg p-3 sm:p-4 border border-gray-700">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs sm:text-sm truncate">Follow up: Guardian Resources placement</p>
                        <div className="flex items-center mt-2 text-xs text-gray-400">
                          <Clock className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span>Due in 2 hours</span>
                        </div>
                      </div>
                      <div className="bg-red-900/50 text-red-300 text-xs px-2 py-1 rounded">
                        Critical
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-800/50 backdrop-blur rounded-lg p-3 sm:p-4 border border-gray-700">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs sm:text-sm truncate">Generate weekly placement report</p>
                        <div className="flex items-center mt-2 text-xs text-gray-400">
                          <Bot className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span>AI will handle 90%</span>
                        </div>
                      </div>
                      <div className="bg-yellow-900/50 text-yellow-300 text-xs px-2 py-1 rounded">
                        Medium
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
                <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-indigo-500" />
                  Performance Pulse
                </h2>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs sm:text-sm text-gray-400">Placement Success Rate</span>
                      <span className="text-xs sm:text-sm font-medium">94%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full" style={{ width: '94%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs sm:text-sm text-gray-400">AI Automation Rate</span>
                      <span className="text-xs sm:text-sm font-medium">78%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full" style={{ width: '78%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
              <h2 className="text-xl sm:text-2xl font-semibold mb-6">Integration Status</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(integrationStatus).map(([service, status]) => (
                  <div key={service} className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium capitalize">{service}</h3>
                      <div className={`w-3 h-3 rounded-full ${
                        status === 'connected' ? 'bg-green-500' : 
                        status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
                        'bg-red-500'
                      }`} />
                    </div>
                    <p className="text-xs text-gray-400 capitalize">{status}</p>
                    {status === 'disconnected' && (
                      <button className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-lg transition-all">
                        Connect
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">API Configuration</h3>
                <div className="space-y-4">
                  <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Gemini 2.5 Pro API</h4>
                        <p className="text-sm text-gray-400">Advanced reasoning and analysis</p>
                      </div>
                      <Shield className="w-5 h-5 text-green-500" />
                    </div>
                  </div>
                  <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Supabase Realtime</h4>
                        <p className="text-sm text-gray-400">WebSocket connections active</p>
                      </div>
                      <Database className="w-5 h-5 text-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add more tab content for workflows, communications, recruiting, content, analytics */}
      </main>

      {/* Enhanced Floating Action Button with Menu */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6">
        <button
          onClick={handleVoiceToggle}
          className={`p-4 rounded-full shadow-2xl transition-all transform hover:scale-110 ${
            isListening 
              ? 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 animate-pulse' 
              : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
          }`}
        >
          {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
}
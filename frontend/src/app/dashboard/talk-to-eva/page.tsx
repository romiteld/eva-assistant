'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Mic, 
  Phone,
  PhoneOff,
  Volume2, 
  VolumeX,
  Search, 
  Navigation, 
  Database, 
  Workflow, 
  Brain,
  Loader2,
  Globe,
  Command,
  Activity,
  Sparkles,
  Zap,
  MessageSquare,
  Settings,
  X,
  Wifi,
  WifiOff,
  User,
  Bot,
  Send,
  Pause,
  Play,
  Paperclip,
  Image as ImageIcon,
  FileText
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';
import { registerEvaAgent, EvaVoiceAgent } from '@/lib/agents/eva-agent';
import { supabaseVoiceStreaming } from '@/lib/services/supabase-voice-streaming';
import { useVoiceSession } from '@/hooks/useVoiceSession';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/browser';
import { FileUploadZone } from '@/components/voice/FileUploadZone';
import { chatFileUploadService, ChatUploadedFile } from '@/lib/services/chat-file-upload';
import { voiceHistoryService, VoiceMessage, ToolExecution as VoiceToolExecution } from '@/lib/services/voice-history-service';
import { useAudioCache } from '@/hooks/useAudioCache';

interface ToolExecution {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  tools?: string[];
  isStreaming?: boolean;
  attachments?: ChatUploadedFile[];
}

export default function TalkToEvaPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [conversation, setConversation] = useState<Message[]>([]);
  const [activeTools, setActiveTools] = useState<ToolExecution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(128));
  const [showSettings, setShowSettings] = useState(false);
  const [streamingSessionId, setStreamingSessionId] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [isSendingText, setIsSendingText] = useState(false);
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([]);
  const [voiceTools, setVoiceTools] = useState<VoiceToolExecution[]>([]);
  const [sessionStartTime] = useState(new Date().toISOString());
  const [uploadedFiles, setUploadedFiles] = useState<ChatUploadedFile[]>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  
  const evaAgentRef = useRef<EvaVoiceAgent | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { cacheAudio } = useAudioCache();
  const scrollAreaRef = useRef<React.ElementRef<typeof ScrollArea> | null>(null);
  
  // Use voice session tracking
  const { 
    sessionData, 
    trackCommand, 
    updateCommand, 
    trackToolUsage,
    trackPageVisit,
    updateSession 
  } = useVoiceSession(sessionId);

  // Initialize voice streaming service
  useEffect(() => {
    // Set up event listeners for voice streaming
    supabaseVoiceStreaming.on('connected', (sessionId: string) => {
      setIsConnected(true);
      setStreamingSessionId(sessionId);
      setError(null);
    });

    supabaseVoiceStreaming.on('disconnected', () => {
      setIsConnected(false);
      setIsListening(false);
      setIsSpeaking(false);
      setStreamingSessionId(null);
    });

    supabaseVoiceStreaming.on('audioData', (data: Uint8Array) => {
      setAudioData(data);
    });

    supabaseVoiceStreaming.on('listening', (listening: boolean) => {
      setIsListening(listening);
    });

    supabaseVoiceStreaming.on('transcript', (text: string) => {
      setTranscript(text);
      const messageId = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      
      setConversation(prev => [...prev, {
        id: messageId,
        role: 'user',
        content: text,
        timestamp: Date.now()
      }]);
      
      // Add to voice messages for history
      setVoiceMessages(prev => [...prev, {
        id: messageId,
        role: 'user',
        content: text,
        timestamp,
        transcription: text
      }]);
    });

    supabaseVoiceStreaming.on('response', (text: string) => {
      setResponse(text);
      const messageId = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      
      setConversation(prev => [...prev, {
        id: messageId,
        role: 'assistant',
        content: text,
        timestamp: Date.now(),
        tools: activeTools.filter(t => t.status === 'completed').map(t => t.name)
      }]);
      
      // Add to voice messages for history
      setVoiceMessages(prev => [...prev, {
        id: messageId,
        role: 'assistant',
        content: text,
        timestamp
      }]);
    });

    supabaseVoiceStreaming.on('processingStart', () => {
      setIsProcessing(true);
    });

    supabaseVoiceStreaming.on('processingEnd', () => {
      setIsProcessing(false);
      setActiveTools([]);
    });

    supabaseVoiceStreaming.on('speakingStart', () => {
      setIsSpeaking(true);
    });

    supabaseVoiceStreaming.on('speakingEnd', () => {
      setIsSpeaking(false);
    });
    
    // Handle audio response for caching
    supabaseVoiceStreaming.on('audioResponse', async (data: { messageId: string; audio: ArrayBuffer }) => {
      try {
        // Cache the audio with the message ID as key
        const cacheKey = `audio-${data.messageId}`;
        await cacheAudio(cacheKey, data.audio);
        
        // Update the corresponding voice message with the cache key
        setVoiceMessages(prev => prev.map(msg => 
          msg.id === data.messageId 
            ? { ...msg, audioCacheKey: cacheKey }
            : msg
        ));
      } catch (error) {
        console.error('Failed to cache audio:', error);
      }
    });

    supabaseVoiceStreaming.on('error', (error: Error) => {
      setError(error.message);
      console.error('Voice streaming error:', error);
    });

    supabaseVoiceStreaming.on('functionCall', (data: any) => {
      const toolId = crypto.randomUUID();
      const startTime = Date.now();
      
      setActiveTools(prev => [...prev, {
        id: toolId,
        name: data.name,
        status: 'running'
      }]);
      
      // Track tool execution for history
      setVoiceTools(prev => [...prev, {
        toolName: data.name,
        timestamp: new Date().toISOString(),
        input: data.args || {},
        output: null,
        duration: 0,
        status: 'success'
      }]);
    });

    return () => {
      supabaseVoiceStreaming.removeAllListeners();
    };
  }, [activeTools]);

  // Initialize Eva agent
  useEffect(() => {
    const initializeEva = async () => {
      try {
        const eva = registerEvaAgent(sessionId);
        await eva.initialize();
        
        // Set up event listeners
        // Eva Brain will handle tool events through the voice streaming service
        const brain = eva.getBrain();
        brain.on('page_navigation', (page: string) => {
          trackPageVisit(page);
        });

        evaAgentRef.current = eva;
      } catch (err) {
        console.error('Failed to initialize Eva:', err);
        setError('Failed to initialize voice assistant');
      }
    };

    initializeEva();

    // Cleanup
    return () => {
      if (evaAgentRef.current) {
        evaAgentRef.current.destroy();
      }
    };
  }, [sessionId, trackCommand, updateCommand, trackToolUsage, trackPageVisit]);

  // Get user data for streaming session
  const { sessionData: voiceSessionData } = useVoiceSession(sessionId);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Focus text input when connected
  useEffect(() => {
    if (isConnected && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isConnected]);
  
  // Scroll to bottom when conversation updates
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [conversation, isProcessing]);
  
  // Save session on unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (voiceMessages.length > 0 && currentUser?.id) {
        saveSessionToHistory();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (voiceMessages.length > 0 && currentUser?.id) {
        saveSessionToHistory();
      }
    };
  }, [voiceMessages, currentUser, sessionId]);
  
  // Get authenticated user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error getting user:', error);
        setError('Please sign in to use voice features');
      } else if (user) {
        console.log('Current user:', user);
        console.log('User ID:', user.id);
        setCurrentUser(user);
        
      } else {
        console.log('No user found');
        setError('Please sign in to use voice features');
      }
    };
    getUser();
  }, []);

  // Save session to voice history
  const saveSessionToHistory = async () => {
    if (!currentUser?.id || voiceMessages.length === 0) return;
    
    try {
      const session = {
        id: sessionId,
        userId: currentUser.id,
        startTime: sessionStartTime,
        endTime: new Date().toISOString(),
        messages: voiceMessages,
        toolExecutions: voiceTools,
        metadata: {
          totalDuration: new Date().getTime() - new Date(sessionStartTime).getTime(),
          messageCount: voiceMessages.length,
          toolCount: voiceTools.length,
          modelUsed: 'gemini-pro-2.5'
        }
      };
      
      const result = await voiceHistoryService.saveSession(session);
      if (result.success) {
        console.log('Voice session saved to history');
      } else {
        console.error('Failed to save voice session:', result.error);
      }
    } catch (error) {
      console.error('Error saving voice session:', error);
    }
  };

  // Toggle connection
  const toggleConnection = async () => {
    if (isConnected) {
      // Save session before disconnecting
      await saveSessionToHistory();
      
      // Disconnect
      await supabaseVoiceStreaming.endSession();
    } else {
      // Connect and start streaming
      if (!currentUser?.id) {
        setError('Please sign in to use voice streaming');
        return;
      }
      
      try {
        setError(null);
        console.log('Starting voice session with user ID:', currentUser.id);
        await supabaseVoiceStreaming.startSession(currentUser.id);
      } catch (err) {
        console.error('Failed to start voice session:', err);
        // Show the actual error message
        if (err instanceof Error) {
          if (err.message.includes('microphone') || err.message.includes('getUserMedia')) {
            setError('Failed to access microphone. Please check your browser permissions.');
          } else if (err.message.includes('new row violates row-level security policy')) {
            setError('Authentication error. Please refresh the page and try again.');
            // Log more details for debugging
            console.error('RLS Policy Error - User ID:', currentUser.id);
            console.error('User object:', currentUser);
          } else {
            setError(`Failed to start voice session: ${err.message}`);
          }
        } else {
          setError('Failed to start voice session. Please try again.');
        }
      }
    }
  };


  // File upload handlers
  const handleFilesUploaded = (files: ChatUploadedFile[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const handleFileRemove = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Quick action handlers
  const quickActions = [
    { 
      icon: Search, 
      label: 'Web Search', 
      command: 'Search the web for ',
      color: 'from-blue-500 to-cyan-500'
    },
    { 
      icon: Navigation, 
      label: 'Navigate', 
      command: 'Navigate to ',
      color: 'from-green-500 to-emerald-500'
    },
    { 
      icon: Database, 
      label: 'Query Data', 
      command: 'Show me ',
      color: 'from-purple-500 to-pink-500'
    },
    { 
      icon: Workflow, 
      label: 'Run Workflow', 
      command: 'Execute workflow ',
      color: 'from-orange-500 to-red-500'
    },
  ];

  const handleQuickAction = async (command: string) => {
    if (!isConnected) {
      setError('Please connect to start using voice commands');
      return;
    }
    
    // Send as text command through Eva Brain
    setTranscript(command);
    setIsProcessing(true);
    
    try {
      if (!evaAgentRef.current) {
        setError('Eva agent not initialized');
        return;
      }
      
      const response = await evaAgentRef.current.getBrain().processVoiceCommand(command);
      if (response?.response) {
        setResponse(response.response);
        // Speech will be handled by the voice streaming service
      }
    } catch (err) {
      console.error('Quick action error:', err);
      setError('Failed to process command');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle text input submission
  const handleTextSubmit = async () => {
    const text = textInput.trim();
    if (!text || !isConnected || isSendingText) return;
    
    setIsSendingText(true);
    setTextInput('');
    setError(null);
    
    // Focus back on textarea after sending
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    
    // Add user message to conversation with attachments
    const currentAttachments = [...uploadedFiles];
    setConversation(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachments: currentAttachments
    }]);
    
    try {
      // Track the command
      const commandId = await trackCommand(text, 'text');
      
      // Process through Eva Brain
      if (!evaAgentRef.current) {
        throw new Error('Eva agent not initialized');
      }
      
      // Show processing state
      setIsProcessing(true);
      
      // Prepare attachments for Eva Brain
      const processedAttachments = currentAttachments.length > 0 ? 
        await Promise.all(
          currentAttachments.map(async (file) => ({
            type: file.fileType,
            content: file.base64 || file.content || '',
            mimeType: file.mimeType,
            fileName: file.fileName
          }))
        ) : undefined;
      
      // Process the text command with attachments
      const response = await evaAgentRef.current.getBrain().processVoiceCommand(text, processedAttachments);
      
      // Clear uploaded files after sending
      setUploadedFiles([]);
      
      if (response?.response) {
        // Add assistant response to conversation
        const responseMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.response,
          timestamp: Date.now(),
          tools: response.toolsUsed || []
        };
        setConversation(prev => [...prev, responseMessage]);
        
        // Update command with response
        if (commandId) {
          await updateCommand(commandId, response.response, 'completed');
        }
        
        // Note: TTS will be automatically handled if the response is sent through
        // the voice streaming service's event system. For now, we're processing
        // text directly through Eva Brain without automatic TTS.
      }
    } catch (err) {
      console.error('Text submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process message');
    } finally {
      setIsProcessing(false);
      setIsSendingText(false);
    }
  };

  // Handle textarea key press
  const handleTextareaKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter, new line on Shift+Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-600" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Talk to Eva</h1>
              <p className="text-sm text-gray-500">Real-time voice assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection status */}
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-600">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500">Disconnected</span>
                </>
              )}
            </div>
            {/* Settings button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation area */}
        <div 
          className="flex-1 flex flex-col bg-white relative"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0 && isConnected) {
              setShowFileUpload(true);
              
              // Process dropped files
              const validFiles: File[] = [];
              for (const file of files) {
                const validation = chatFileUploadService.validateChatFile(file);
                if (validation.valid) {
                  validFiles.push(file);
                } else {
                  setError(validation.error || 'Invalid file');
                }
              }
              
              if (validFiles.length > 0) {
                try {
                  const uploadedFilesList: ChatUploadedFile[] = [];
                  for (const file of validFiles) {
                    const uploadedFile = await chatFileUploadService.uploadChatFile(
                      file,
                      sessionId
                    );
                    uploadedFilesList.push(uploadedFile);
                  }
                  handleFilesUploaded(uploadedFilesList);
                } catch (err) {
                  console.error('File upload error:', err);
                  setError(err instanceof Error ? err.message : 'Failed to upload files');
                }
              }
            }
          }}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <ScrollArea ref={scrollAreaRef} className="h-full">
              <div className="p-6 space-y-4">
                <AnimatePresence>
                  {conversation.length === 0 && !isConnected && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-12"
                    >
                      <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h2 className="text-xl font-medium text-gray-700 mb-2">Start a conversation with Eva</h2>
                      <p className="text-gray-500 mb-6">Click the connect button below to begin</p>
                    </motion.div>
                  )}

                  {/* Real-time transcript display */}
                  {transcript && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="bg-blue-50 rounded-lg px-4 py-2 inline-block">
                          <p className="text-gray-800">{transcript}</p>
                          {isListening && (
                            <span className="inline-block w-2 h-4 bg-blue-600 ml-1 animate-pulse" />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Conversation messages */}
                  {conversation.map((msg, index) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-start gap-3"
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                        msg.role === 'user' ? "bg-blue-100" : "bg-purple-100"
                      )}>
                        {msg.role === 'user' ? (
                          <User className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Bot className="w-4 h-4 text-purple-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className={cn(
                          "rounded-lg px-4 py-2 inline-block max-w-[80%]",
                          msg.role === 'user' 
                            ? "bg-blue-50 text-gray-800" 
                            : "bg-gray-100 text-gray-800"
                        )}>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          {msg.isStreaming && (
                            <span className="inline-block w-2 h-4 bg-gray-600 ml-1 animate-pulse" />
                          )}
                          {/* Display attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {msg.attachments.map((attachment, i) => (
                                <div key={i} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
                                  {attachment.fileType === 'image' ? (
                                    <>
                                      <ImageIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                      <span className="text-xs text-gray-600 truncate">{attachment.fileName}</span>
                                    </>
                                  ) : (
                                    <>
                                      <FileText className="w-4 h-4 text-orange-600 flex-shrink-0" />
                                      <span className="text-xs text-gray-600 truncate">{attachment.fileName}</span>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {msg.tools && msg.tools.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {msg.tools.map((tool, i) => (
                              <span key={i} className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                {tool}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </motion.div>
                  ))}

                  {/* Processing indicator */}
                  {isProcessing && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="bg-gray-100 rounded-lg px-4 py-2 inline-block">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                          <span className="text-gray-600">Eva is thinking...</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>

          {/* Bottom controls */}
          <div className="border-t border-gray-200 bg-gray-50 p-4">
            {/* Error display */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between"
                >
                  <p className="text-sm text-red-600">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-4">
              {/* Connection button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleConnection}
                disabled={isProcessing}
                className={cn(
                  "px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2",
                  isConnected
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-purple-600 hover:bg-purple-700 text-white"
                )}
              >
                {isConnected ? (
                  <>
                    <PhoneOff className="w-5 h-5" />
                    Disconnect
                  </>
                ) : (
                  <>
                    <Phone className="w-5 h-5" />
                    Connect
                  </>
                )}
              </motion.button>

              {/* Status indicators */}
              <div className="flex items-center gap-3 text-sm">
                <AnimatePresence>
                  {isListening && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-center gap-2 text-blue-600"
                    >
                      <Mic className="w-4 h-4 animate-pulse" />
                      <span>Listening</span>
                    </motion.div>
                  )}
                  {isSpeaking && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-center gap-2 text-purple-600"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>Speaking</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Quick actions */}
              <div className="ml-auto flex items-center gap-2">
                {quickActions.slice(0, 2).map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction(action.command)}
                    disabled={!isConnected || isProcessing}
                  >
                    <action.icon className="w-4 h-4 mr-1" />
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Text input area */}
            <div className="mt-4 border-t border-gray-200 pt-4">
              {/* File upload zone */}
              <AnimatePresence>
                {showFileUpload && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4"
                  >
                    <FileUploadZone
                      sessionId={sessionId}
                      onFilesUploaded={handleFilesUploaded}
                      onFileRemove={handleFileRemove}
                      uploadedFiles={uploadedFiles}
                      disabled={!isConnected}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-end gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowFileUpload(!showFileUpload)}
                  disabled={!isConnected}
                  className="flex-shrink-0"
                  title="Attach files"
                >
                  <Paperclip className={cn(
                    "w-5 h-5",
                    showFileUpload ? "text-purple-600" : "text-gray-600",
                    uploadedFiles.length > 0 && "text-purple-600"
                  )} />
                  {uploadedFiles.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 text-white text-xs rounded-full flex items-center justify-center">
                      {uploadedFiles.length}
                    </span>
                  )}
                </Button>
                <div className="flex-1">
                  <Textarea
                    ref={textareaRef}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={handleTextareaKeyPress}
                    placeholder={isConnected ? "Type a message or use voice..." : "Connect to start chatting"}
                    disabled={!isConnected || isSendingText}
                    className="min-h-[60px] max-h-[120px] resize-none bg-white border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                    rows={2}
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleTextSubmit}
                  disabled={!isConnected || !textInput.trim() || isSendingText || isProcessing}
                  className={cn(
                    "px-4 py-3 rounded-lg transition-all flex items-center justify-center",
                    (!isConnected || !textInput.trim() || isSendingText || isProcessing)
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-purple-600 hover:bg-purple-700 text-white"
                  )}
                >
                  {isSendingText ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </motion.button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Press Enter to send, Shift+Enter for new line • Attach images or documents with the paperclip
              </p>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-80 border-l border-gray-200 bg-gray-50 p-4 space-y-4">
          {/* Active Tools */}
          <AnimatePresence>
            {activeTools.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-600" />
                      Active Tools
                    </h3>
                    <div className="space-y-2">
                      {activeTools.map((tool) => (
                        <div
                          key={tool.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-gray-700">{tool.name}</span>
                          <Badge
                            variant={
                              tool.status === 'completed' ? 'default' :
                              tool.status === 'failed' ? 'destructive' :
                              'secondary'
                            }
                            className="text-xs"
                          >
                            {tool.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Capabilities */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                Capabilities
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Web Search</p>
                    <p className="text-xs text-gray-500">Real-time internet search</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Navigation className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Dashboard Control</p>
                    <p className="text-xs text-gray-500">Navigate anywhere</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Database className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Data Management</p>
                    <p className="text-xs text-gray-500">Query and modify</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Workflow className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Workflow Execution</p>
                    <p className="text-xs text-gray-500">Run automations</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Session info */}
          {streamingSessionId && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium text-gray-900 mb-2">Session Info</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>ID: {streamingSessionId.slice(0, 8)}...</p>
                  <p>Status: {isConnected ? 'Active' : 'Inactive'}</p>
                </div>
              </CardContent>
            </Card>
          )}
          
        </div>
      </div>

      {/* Hidden audio element for TTS */}
      <audio ref={audioRef} onEnded={() => setIsSpeaking(false)} />
    </div>
  );
}
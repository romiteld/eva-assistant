import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Paperclip, X, Image, File, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EvaBrain } from '@/lib/services/eva-brain';

interface ChatFile {
  id: string;
  file: File;
  type: 'image' | 'document';
  content: string; // base64 for images, text for documents
  mimeType: string;
  fileName: string;
  previewUrl?: string;
}

interface ChatBoxProps {
  onMessage?: (message: string, attachments?: ChatFile[]) => void;
  onResponse?: (response: string) => void;
  onError?: (error: Error) => void;
  placeholder?: string;
  disabled?: boolean;
  maxFiles?: number;
  sessionId?: string;
  className?: string;
}

export default function ChatBox({
  onMessage,
  onResponse,
  onError,
  placeholder = "Type your message or ask Eva anything...",
  disabled = false,
  maxFiles = 5,
  sessionId,
  className,
}: ChatBoxProps) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<ChatFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const evaBrainRef = useRef<EvaBrain | null>(null);

  // Initialize Eva Brain
  React.useEffect(() => {
    if (sessionId && !evaBrainRef.current) {
      evaBrainRef.current = new EvaBrain(sessionId);
    }
  }, [sessionId]);

  // Handle file selection
  const handleFileSelect = useCallback(async (files: FileList) => {
    if (attachments.length + files.length > maxFiles) {
      onError?.(new Error(`Maximum ${maxFiles} files allowed`));
      return;
    }

    const newAttachments: ChatFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = crypto.randomUUID();
      
      try {
        // Determine file type
        const isImage = file.type.startsWith('image/');
        const type: 'image' | 'document' = isImage ? 'image' : 'document';
        
        let content: string;
        let previewUrl: string | undefined;

        if (isImage) {
          // Convert image to base64
          content = await fileToBase64(file);
          previewUrl = URL.createObjectURL(file);
        } else {
          // Read text content for documents
          content = await fileToText(file);
        }

        const chatFile: ChatFile = {
          id,
          file,
          type,
          content,
          mimeType: file.type,
          fileName: file.name,
          previewUrl,
        };

        newAttachments.push(chatFile);
      } catch (error) {
        console.error('Error processing file:', error);
        onError?.(new Error(`Failed to process file: ${file.name}`));
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);
  }, [attachments.length, maxFiles, onError]);

  // Remove attachment
  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => {
      const updated = prev.filter(att => att.id !== id);
      // Cleanup preview URLs
      const removed = prev.find(att => att.id === id);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return updated;
    });
  }, []);

  // Send message
  const handleSend = useCallback(async () => {
    if (!text.trim() && attachments.length === 0) return;
    if (isProcessing) return;

    setIsProcessing(true);
    
    try {
      // Call onMessage callback
      onMessage?.(text, attachments);

      // Process with Eva Brain if available
      if (evaBrainRef.current) {
        const evaAttachments = attachments.map(att => ({
          type: att.type,
          content: att.content,
          mimeType: att.mimeType,
          fileName: att.fileName,
        }));

        const result = await evaBrainRef.current.processVoiceCommand(text, evaAttachments);
        onResponse?.(result.response);
      }

      // Clear form
      setText('');
      setAttachments(prev => {
        // Cleanup preview URLs
        prev.forEach(att => {
          if (att.previewUrl) {
            URL.revokeObjectURL(att.previewUrl);
          }
        });
        return [];
      });
    } catch (error) {
      console.error('Chat error:', error);
      onError?.(error as Error);
    } finally {
      setIsProcessing(false);
    }
  }, [text, attachments, isProcessing, onMessage, onResponse, onError]);

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelect(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get just base64
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Convert file to text
  const fileToText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-4">
        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="mb-4 space-y-2">
            <div className="text-sm font-medium text-gray-600">Attachments:</div>
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2"
                >
                  {attachment.type === 'image' ? (
                    <Image className="h-4 w-4 text-blue-500" />
                  ) : (
                    <File className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="text-sm truncate max-w-[150px]">
                    {attachment.fileName}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-1"
                    onClick={() => removeAttachment(attachment.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isProcessing}
              className="min-h-[80px] resize-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isProcessing || attachments.length >= maxFiles}
              className="p-2"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleSend}
              disabled={disabled || isProcessing || (!text.trim() && attachments.length === 0)}
              size="sm"
              className="p-2"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
          accept="image/*,.pdf,.txt,.doc,.docx,.md"
        />

        {/* Status */}
        {isProcessing && (
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing your message...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
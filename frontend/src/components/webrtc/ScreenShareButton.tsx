import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Monitor, MonitorOff, AlertCircle } from 'lucide-react';
import { useScreenShare } from '@/hooks/useScreenShare';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ScreenShareButtonProps {
  onStreamReady?: (stream: MediaStream) => void;
  onStreamEnd?: () => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  className?: string;
}

export default function ScreenShareButton({
  onStreamReady,
  onStreamEnd,
  onError,
  disabled = false,
  className,
}: ScreenShareButtonProps) {
  const {
    stream,
    isSharing,
    error,
    startScreenShare,
    stopScreenShare,
    isSupported,
  } = useScreenShare({
    onStreamReady: (stream) => {
      console.log('Screen stream ready', stream);
      onStreamReady?.(stream);
    },
    onStreamEnd: () => {
      console.log('Screen share ended');
      if (onStreamEnd) onStreamEnd();
    },
    onError: (err) => {
      console.error('Screen share error', err);
      onError?.(err);
    },
    defaultOptions: {
      video: {
        frameRate: { ideal: 30, max: 60 },
        width: { ideal: 1920, max: 3840 },
        height: { ideal: 1080, max: 2160 },
      },
      audio: false, // Usually don't need system audio
    },
  });

  if (!isSupported) {
    return (
      <div className="space-y-2">
        <Button disabled variant="outline" className={className}>
          <MonitorOff className="h-4 w-4 mr-2" />
          Screen sharing not supported
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your browser doesn&apos;t support screen sharing.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleToggle = () => {
    if (isSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          onClick={handleToggle}
          disabled={disabled}
          variant={isSharing ? "destructive" : "default"}
          className={className}
        >
          {isSharing ? (
            <>
              <MonitorOff className="h-4 w-4 mr-2" />
              Stop Sharing
            </>
          ) : (
            <>
              <Monitor className="h-4 w-4 mr-2" />
              Share Screen
            </>
          )}
        </Button>
        
        {isSharing && (
          <Badge variant="default" className="animate-pulse">
            Sharing
          </Badge>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
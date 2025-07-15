// Enhanced Voice Service with Visual Input Support

import { VoiceService } from './voice';
import { GeminiLiveMessage } from '@/types/voice';

export class VoiceWithVisualService extends VoiceService {
  private visualStream: MediaStream | null = null;
  private videoProcessor: VideoProcessor | null = null;
  private frameInterval: NodeJS.Timeout | null = null;

  /**
   * Set visual input stream (screen share or camera)
   */
  setVisualStream(stream: MediaStream | null): void {
    this.visualStream = stream;
    
    if (stream) {
      this.startVideoProcessing();
    } else {
      this.stopVideoProcessing();
    }
  }

  /**
   * Start processing video frames
   */
  private startVideoProcessing(): void {
    if (!this.visualStream) return;

    const videoTrack = this.visualStream.getVideoTracks()[0];
    if (!videoTrack) return;

    // Create video processor
    this.videoProcessor = new VideoProcessor(videoTrack);
    
    // Send frames at regular intervals (2 FPS for efficiency)
    this.frameInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendVideoFrame();
      }
    }, 500); // 500ms = 2 FPS
  }

  /**
   * Stop processing video frames
   */
  private stopVideoProcessing(): void {
    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }
    
    if (this.videoProcessor) {
      this.videoProcessor.cleanup();
      this.videoProcessor = null;
    }
  }

  /**
   * Send video frame to Gemini
   */
  private async sendVideoFrame(): Promise<void> {
    if (!this.videoProcessor || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const frameData = await this.videoProcessor.captureFrame();
      if (!frameData) return;

      const message: GeminiLiveMessage = {
        realtimeInput: {
          mediaChunks: [{
            mimeType: 'image/jpeg',
            data: frameData,
          }],
        },
      };

      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send video frame:', error);
    }
  }

  /**
   * Send a message with both audio and visual context
   */
  sendMultimodalMessage(text: string, includeVisual: boolean = true): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const parts: any[] = [{
      text,
    }];

    // Add visual context if available
    if (includeVisual && this.videoProcessor) {
      this.videoProcessor.captureFrame().then(frameData => {
        if (frameData) {
          parts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: frameData,
            },
          });
        }

        const message: GeminiLiveMessage = {
          clientContent: {
            turns: [{
              role: 'user',
              parts,
            }],
          },
        };

        this.ws!.send(JSON.stringify(message));
      });
    } else {
      const message: GeminiLiveMessage = {
        clientContent: {
          turns: [{
            role: 'user',
            parts,
          }],
        },
      };

      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Cleanup
   */
  disconnect(): void {
    this.stopVideoProcessing();
    super.disconnect();
  }
}

/**
 * Video frame processor
 */
class VideoProcessor {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(videoTrack: MediaStreamTrack) {
    // Create video element
    this.video = document.createElement('video');
    this.video.srcObject = new MediaStream([videoTrack]);
    this.video.autoplay = true;
    this.video.muted = true;

    // Create canvas for frame capture
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;

    // Set canvas size based on video dimensions
    this.video.onloadedmetadata = () => {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
    };

    // Start playing with error handling
    this.video.play().catch(error => {
      console.warn('Video autoplay failed (expected if user has not interacted):', error);
    });
  }

  /**
   * Capture current frame as base64 JPEG
   */
  async captureFrame(): Promise<string | null> {
    if (this.video.readyState !== 4) return null; // Video not ready

    try {
      // Draw current frame to canvas
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

      // Convert to base64 JPEG
      const blob = await new Promise<Blob | null>((resolve) => {
        this.canvas.toBlob(resolve, 'image/jpeg', 0.8);
      });

      if (!blob) return null;

      // Convert blob to base64
      const reader = new FileReader();
      return new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = reader.result as string;
          // Remove data URL prefix
          resolve(base64.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Failed to capture frame:', error);
      return null;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Check if video is playing before pausing to avoid interruption errors
    if (!this.video.paused && this.video.readyState > 0) {
      // Let any pending play() promises resolve/reject before pausing
      this.video.play().catch(() => {}).finally(() => {
        this.video.pause();
        this.video.srcObject = null;
      });
    } else {
      // Video is already paused or not ready, safe to clean up
      this.video.srcObject = null;
    }
  }
}
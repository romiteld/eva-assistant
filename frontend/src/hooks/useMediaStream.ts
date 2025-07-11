import { useState, useEffect, useCallback } from 'react';
import { MediaDeviceInfo, EnhancedMediaConstraints, VideoConstraints, AudioConstraints } from '@/types/webrtc';

interface UseMediaStreamProps {
  video?: boolean | MediaTrackConstraints;
  audio?: boolean | MediaTrackConstraints;
  onStreamReady?: (stream: MediaStream) => void;
  onStreamError?: (error: Error) => void;
  onDeviceChange?: (devices: MediaDeviceInfo[]) => void;
}

interface UseMediaStreamReturn {
  stream: MediaStream | null;
  error: Error | null;
  devices: {
    audioInputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
    audioOutputs: MediaDeviceInfo[];
  };
  isLoading: boolean;
  getStream: (constraints?: EnhancedMediaConstraints) => Promise<MediaStream | null>;
  stopStream: () => void;
  switchCamera: () => Promise<void>;
  setAudioDevice: (deviceId: string) => Promise<void>;
  setVideoDevice: (deviceId: string) => Promise<void>;
  applyConstraints: (constraints: MediaTrackConstraints, kind: 'audio' | 'video') => Promise<void>;
}

export const useMediaStream = ({
  video = true,
  audio = true,
  onStreamReady,
  onStreamError,
  onDeviceChange,
}: UseMediaStreamProps = {}): UseMediaStreamReturn => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [devices, setDevices] = useState<{
    audioInputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
    audioOutputs: MediaDeviceInfo[];
  }>({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: [],
  });
  const [currentVideoDeviceIndex, setCurrentVideoDeviceIndex] = useState(0);

  // Get media devices
  const getDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      
      const audioInputs = allDevices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          kind: device.kind,
          label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`,
          groupId: device.groupId,
        }));

      const videoInputs = allDevices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          kind: device.kind,
          label: device.label || `Camera ${device.deviceId.slice(0, 5)}`,
          groupId: device.groupId,
        }));

      const audioOutputs = allDevices
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          kind: device.kind,
          label: device.label || `Speaker ${device.deviceId.slice(0, 5)}`,
          groupId: device.groupId,
        }));

      const newDevices = { audioInputs, videoInputs, audioOutputs };
      setDevices(newDevices);
      onDeviceChange?.(allDevices as MediaDeviceInfo[]);

      return newDevices;
    } catch (err) {
      console.error('Error enumerating devices:', err);
      return devices;
    }
  }, [devices, onDeviceChange]);

  // Get media stream
  const getStream = useCallback(async (
    customConstraints?: EnhancedMediaConstraints
  ): Promise<MediaStream | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints = customConstraints || { video, audio };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setStream(newStream);
      onStreamReady?.(newStream);

      // Get devices after getting stream (labels will be available)
      await getDevices();

      return newStream;
    } catch (err) {
      const error = err as Error;
      setError(error);
      onStreamError?.(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [stream, video, audio, onStreamReady, onStreamError, getDevices]);

  // Stop stream
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Set video device
  const setVideoDevice = useCallback(async (deviceId: string) => {
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      await videoTrack.applyConstraints({
        deviceId: { exact: deviceId },
      });
      
      // Update current video device index
      const index = devices.videoInputs.findIndex(d => d.deviceId === deviceId);
      if (index !== -1) {
        setCurrentVideoDeviceIndex(index);
      }
    } catch (err) {
      console.error('Error setting video device:', err);
      // If constraints fail, get a new stream
      await getStream({
        video: { deviceId: { exact: deviceId } },
        audio: audio as boolean | AudioConstraints,
      });
    }
  }, [stream, audio, devices.videoInputs, getStream]);

  // Switch camera (cycle through available cameras)
  const switchCamera = useCallback(async () => {
    if (!stream || devices.videoInputs.length <= 1) return;

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    const nextIndex = (currentVideoDeviceIndex + 1) % devices.videoInputs.length;
    const nextDevice = devices.videoInputs[nextIndex];

    try {
      await videoTrack.applyConstraints({
        deviceId: { exact: nextDevice.deviceId },
      });
      setCurrentVideoDeviceIndex(nextIndex);
    } catch (err) {
      console.error('Error switching camera:', err);
      // If constraints fail, try getting a new stream
      await setVideoDevice(nextDevice.deviceId);
    }
  }, [stream, devices.videoInputs, currentVideoDeviceIndex, setVideoDevice]);

  // Set audio device
  const setAudioDevice = useCallback(async (deviceId: string) => {
    if (!stream) return;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      await audioTrack.applyConstraints({
        deviceId: { exact: deviceId },
      });
    } catch (err) {
      console.error('Error setting audio device:', err);
      // If constraints fail, get a new stream
      await getStream({
        video: video as boolean | VideoConstraints,
        audio: { deviceId: { exact: deviceId } },
      });
    }
  }, [stream, video, getStream]);

  // Apply constraints to track
  const applyConstraints = useCallback(async (
    constraints: MediaTrackConstraints,
    kind: 'audio' | 'video'
  ) => {
    if (!stream) return;

    const tracks = kind === 'audio' ? stream.getAudioTracks() : stream.getVideoTracks();
    if (tracks.length === 0) return;

    try {
      await Promise.all(tracks.map(track => track.applyConstraints(constraints)));
    } catch (err) {
      console.error(`Error applying ${kind} constraints:`, err);
      throw err;
    }
  }, [stream]);

  // Handle device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      getDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [getDevices]);

  // Auto-start stream if requested
  useEffect(() => {
    if (video || audio) {
      getStream();
    }

    return () => {
      stopStream();
    };
  }, [audio, getStream, stopStream, video]); // Only run on mount

  return {
    stream,
    error,
    devices,
    isLoading,
    getStream,
    stopStream,
    switchCamera,
    setAudioDevice,
    setVideoDevice,
    applyConstraints,
  };
};
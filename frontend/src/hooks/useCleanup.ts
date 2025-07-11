import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for managing cleanup operations and preventing memory leaks
 * Provides utilities for managing subscriptions, intervals, and event listeners
 */
export function useCleanup() {
  const cleanupFunctions = useRef<Set<() => void>>(new Set());
  const isMounted = useRef(true);

  // Add a cleanup function to be called on unmount
  const addCleanup = useCallback((cleanup: () => void) => {
    cleanupFunctions.current.add(cleanup);
    return () => {
      cleanupFunctions.current.delete(cleanup);
      cleanup();
    };
  }, []);

  // Check if component is still mounted
  const checkMounted = useCallback(() => isMounted.current, []);

  // Safe state update that checks if component is mounted
  const safeUpdate = useCallback(<T extends (...args: any[]) => void>(fn: T) => {
    return ((...args: Parameters<T>) => {
      if (isMounted.current) {
        fn(...args);
      }
    }) as T;
  }, []);

  // Cleanup all registered functions on unmount
  useEffect(() => {
    isMounted.current = true;
    
    return () => {
      isMounted.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const functions = cleanupFunctions.current;
      functions.forEach(cleanup => cleanup());
      functions.clear();
    };
  }, []);

  return {
    addCleanup,
    checkMounted,
    safeUpdate,
  };
}

/**
 * Hook for managing array size limits to prevent memory leaks
 */
export function useLimitedArray<T>(maxSize: number = 100) {
  const addItem = useCallback((
    array: T[],
    item: T,
    prepend: boolean = true
  ): T[] => {
    if (prepend) {
      return [item, ...array.slice(0, maxSize - 1)];
    } else {
      return [...array.slice(-(maxSize - 1)), item];
    }
  }, [maxSize]);

  const addItems = useCallback((
    array: T[],
    items: T[],
    prepend: boolean = true
  ): T[] => {
    if (prepend) {
      return [...items, ...array].slice(0, maxSize);
    } else {
      return [...array, ...items].slice(-maxSize);
    }
  }, [maxSize]);

  return { addItem, addItems };
}

/**
 * Hook for managing MediaStream cleanup
 */
export function useMediaStream() {
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }
  }, []);

  const setStream = useCallback((stream: MediaStream | null) => {
    stopStream();
    streamRef.current = stream;
  }, [stopStream]);

  const setMediaRecorder = useCallback((recorder: MediaRecorder | null) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = recorder;
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    streamRef,
    mediaRecorderRef,
    setStream,
    setMediaRecorder,
    stopStream,
  };
}
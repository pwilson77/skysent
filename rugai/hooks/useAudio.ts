import { useCallback, useEffect, useRef, useState } from 'react';
import { audioService, AudioOptions } from '@/lib/audioService';
import { logger } from '@/store/useLoggerStore';

export function useAudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const [isEnabled, setIsEnabled] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update playing status periodically
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setIsPlaying(audioService.getIsPlaying());
      setQueueLength(audioService.getQueueLength());
    }, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const speak = useCallback(async (text: string, options?: AudioOptions) => {
    if (!isEnabled) {
      logger.debug('Audio disabled, skipping speech', 'useAudio');
      return;
    }

    try {
      await audioService.speak(text, options);
    } catch (error) {
      logger.error(`Speak error: ${error}`, 'useAudio');
    }
  }, [isEnabled]);

  const queueSpeak = useCallback(async (text: string, options?: AudioOptions) => {
    if (!isEnabled) {
      logger.debug('Audio disabled, skipping queued speech', 'useAudio');
      return;
    }

    try {
      await audioService.queueSpeak(text, options);
    } catch (error) {
      logger.error(`Queue speak error: ${error}`, 'useAudio');
    }
  }, [isEnabled]);

  const stop = useCallback(() => {
    audioService.stop();
    setIsPlaying(false);
  }, []);

  const clearQueue = useCallback(() => {
    audioService.clearQueue();
    setQueueLength(0);
  }, []);

  const toggleAudio = useCallback(() => {
    setIsEnabled((prev) => !prev);
    if (isEnabled) {
      stop();
      clearQueue();
    }
    logger.info(`Audio ${!isEnabled ? 'enabled' : 'disabled'}`, 'useAudio');
  }, [isEnabled, stop, clearQueue]);

  return {
    speak,
    queueSpeak,
    stop,
    clearQueue,
    toggleAudio,
    isPlaying,
    queueLength,
    isEnabled,
  };
}
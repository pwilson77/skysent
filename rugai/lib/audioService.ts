import { logger } from '@/store/useLoggerStore';
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";


export interface AudioOptions {
  agentId?: string;
  voice?: string;
  voiceId?: string; // For ElevenLabs
  modelId?: string; // For ElevenLabs model selection
  speed?: number;
  pitch?: number;
  useElevenLabs?: boolean; // Toggle between Eliza and ElevenLabs
}

export class AudioService {
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private audioQueue: Array<{ text: string; options: AudioOptions }> = [];
  private isPlaying = false;
  private client = new ElevenLabsClient({
    apiKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '',
  });

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * Convert text to speech using the Eliza API
   */
  async textToSpeechEliza(text: string, agentId: string, options: AudioOptions = {}): Promise<Blob> {
    const baseUrl = process.env.NEXT_PUBLIC_ELIZA_API_ENDPOINT || "http://localhost:3000";

    if (!agentId) {
      throw new Error('Agent ID is required for text-to-speech');
    }

    try {
      const response = await fetch(`${baseUrl}/api/audio/${agentId}/speech/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Eliza TTS API error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      logger.info(`Generated Eliza audio for text: ${text.slice(0, 50)}...`, 'AudioService');
      return audioBlob;
    } catch (error) {
      logger.error(`Eliza TTS error: ${error}`, 'AudioService');
      throw error;
    }
  }

    /**
   * Convert ReadableStream to Blob for browser playback
   */
  private async streamToBlob(stream: ReadableStream<Uint8Array>): Promise<Blob> {
    // Prefer tee()+Response for simplicity, fallback to manual chunking.
    try {
      logger.debug('Attempting tee()+Response blob conversion', 'AudioService');
      // Create two branches; we'll consume one via Response.
      const rs = stream as ReadableStream<Uint8Array> & { tee?: () => [ReadableStream<Uint8Array>, ReadableStream<Uint8Array>] };
      const [branchForResponse] = rs.tee ? rs.tee() : [null as unknown as ReadableStream<Uint8Array>];
      if (branchForResponse) {
        const response = new Response(branchForResponse);
        const blob = await response.blob();
        logger.debug('Audio stream converted to Blob via Response', 'AudioService');
        return blob;
      }
    } catch (e) {
      logger.warn(`tee()+Response path failed: ${e}`, 'AudioService');
    }

    // Fallback: manual chunk aggregation
    try {
      logger.debug('Fallback to manual chunk aggregation', 'AudioService');
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.length) {
          chunks.push(value);
          totalBytes += value.length;
        }
      }
      reader.releaseLock();

      if (totalBytes === 0) {
        logger.error('Audio stream contained 0 bytes', 'AudioService');
        throw new Error('Empty audio stream');
      }

      const parts: BlobPart[] = [];
      for (const u8 of chunks) {
        const buf = new ArrayBuffer(u8.byteLength);
        const copy = new Uint8Array(buf);
        copy.set(u8);
        parts.push(copy);
      }
      const blob = new Blob(parts, { type: 'audio/mpeg' });
      logger.debug(`Audio stream converted to Blob via fallback (${totalBytes} bytes)`, 'AudioService');
      return blob;
    } catch (e) {
      logger.error(`Stream to Blob conversion failed in fallback: ${e}`, 'AudioService');
      throw e;
    }
  }

  /**
   * Play audio from a blob
   */
  private async playAudio(audioBlob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      this.currentAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        this.isPlaying = false;
        logger.debug('Audio playback ended', 'AudioService');
        resolve();
      };

      audio.onerror = (error) => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        this.isPlaying = false;
        logger.error(`Audio playback error: ${error}`, 'AudioService');
        reject(error);
      };

      this.isPlaying = true;
      audio.play().catch((error) => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        this.isPlaying = false;
        reject(error);
      });
    });
  }

  /**
   * Convert text to speech using ElevenLabs API streaming
   */
  async textToSpeechElevenLabsStream(text: string, options: AudioOptions = {}): Promise<void> {
    const voiceId = options.voiceId || process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
    const modelId = options.modelId || 'eleven_flash_v2_5';

    try {
      logger.info(`Starting ElevenLabs streaming for text: ${text.slice(0, 50)}...`, 'AudioService');
      
      const { data } = await this.client.textToSpeech.convert(voiceId, {
        text: text,
        modelId: modelId,
      }).withRawResponse();

      // Convert stream to blob and play
      const audioBlob = await this.streamToBlob(data);
      await this.playAudio(audioBlob);
      
      logger.info('ElevenLabs audio playback completed', 'AudioService');
    } catch (error) {
      logger.error(`ElevenLabs TTS error: ${error}`, 'AudioService');
      throw error;
    }
  }

  /**
   * Convert text to speech and play it (auto-selects provider)
   */
  async speak(text: string, options: AudioOptions = {}): Promise<void> {
    try {
      if (options.useElevenLabs !== false) {
        logger.debug('Using ElevenLabs TTS', 'AudioService');
        await this.textToSpeechElevenLabsStream(text, options);
      } else {
        throw new Error('No TTS provider configured (no API key or agentId)');
      }
    } catch (error) {
      logger.error(`Speak error: ${error}`, 'AudioService');
      throw error;
    }
  }

  /**
   * Add text to speech queue and process it
   */
  async queueSpeak(text: string, options: AudioOptions = {}): Promise<void> {
    this.audioQueue.push({ text, options });
    logger.debug(`Added to audio queue. Queue length: ${this.audioQueue.length}`, 'AudioService');
    
    if (!this.isPlaying) {
      await this.processQueue();
    }
  }

  /**
   * Process the audio queue sequentially
   */
  private async processQueue(): Promise<void> {
    while (this.audioQueue.length > 0) {
      const item = this.audioQueue.shift();
      if (item) {
        try {
          await this.speak(item.text, item.options);
        } catch (error) {
          logger.error(`Queue processing error: ${error}`, 'AudioService');
        }
      }
    }
    logger.debug('Audio queue processing completed', 'AudioService');
  }

  /**
   * Stop current audio playback
   */
  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.isPlaying = false;
    logger.debug('Audio playback stopped', 'AudioService');
  }

  /**
   * Clear the audio queue
   */
  clearQueue(): void {
    this.audioQueue = [];
    logger.debug('Audio queue cleared', 'AudioService');
  }

  /**
   * Check if audio is currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.audioQueue.length;
  }
}

// Export singleton instance
export const audioService = new AudioService();
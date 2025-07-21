// ElevenLabs TTS Service using Supabase Edge Function
export interface TTSOptions {
  text: string;
  voiceId?: string;
  modelId?: string;
}

export class ElevenLabsTTSService {
  private supabaseUrl: string;
  private supabaseAnonKey: string;

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseAnonKey = supabaseAnonKey;
  }

  /**
   * Convert text to speech using ElevenLabs API through Supabase Edge Function
   * @param options - TTS options including text and optional voice/model IDs
   * @returns Audio blob
   */
  async textToSpeech(options: TTSOptions): Promise<Blob> {
    const { text, voiceId, modelId } = options;

    const response = await fetch(`${this.supabaseUrl}/functions/v1/elevenlabs-tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.supabaseAnonKey}`,
      },
      body: JSON.stringify({
        text,
        voice_id: voiceId,
        model_id: modelId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`TTS Error: ${error.error || 'Unknown error'}`);
    }

    return await response.blob();
  }

  /**
   * Convert text to speech and play it immediately
   * @param options - TTS options
   * @returns Audio element
   */
  async textToSpeechAndPlay(options: TTSOptions): Promise<HTMLAudioElement> {
    const audioBlob = await this.textToSpeech(options);
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    // Clean up the object URL when the audio finishes playing
    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(audioUrl);
    });

    await audio.play();
    return audio;
  }

  /**
   * Convert text to speech and get a downloadable URL
   * @param options - TTS options
   * @returns Object URL for the audio (remember to revoke it when done)
   */
  async textToSpeechUrl(options: TTSOptions): Promise<string> {
    const audioBlob = await this.textToSpeech(options);
    return URL.createObjectURL(audioBlob);
  }
}

// Available voice IDs from ElevenLabs
export const ELEVENLABS_VOICES = {
  ADAM: 'pNInz6obpgDQGcFmaJgB',
  ANTONI: 'ErXwobaYiN019PkySvjV',
  ARNOLD: 'VR6AewLTigWG4xSOukaG',
  BELLA: 'EXAVITQu4vr4xnSDxMaL',
  DOMI: 'AZnzlk1XvdvUeBnXmlld',
  ELLI: 'MF3mGyEYCl7XYWbV9V6O',
  EMILY: 'LcfcDJNUP1GQjkzn1xUU',
  ETHAN: 'g5CIjZEefAph4nQFvHAz',
  FREYA: 'jsCqWAovK2LkecY7zXl4',
  GIGI: 'jBpfuIE2acCO8z3wKNLl',
  GIOVANNI: 'zcAOhNBS3c14rBihAFp1',
  GLINDA: 'z9fAnlkpzviPz146aGWa',
  GRACE: 'oWAxZDx7w5VEj9dCyTzz',
  HARRY: 'SOYHLrjzK2X1ezoPC6cr',
  JAMES: 'ZQe5CZNOzWyzPSCn5a3c',
  JEREMY: 'bVMeCyTHy58xNoL34h3p',
  JESSIE: 't0jbNlBVZ17f02VDIeMI',
  JOSEPH: 'Zlb1dXrM653N07WRdFW3',
  JOSH: 'TxGEqnHWrfWFTfGW9XjX',
  LIAM: 'TX3LPaxmHKxFdv7VOQHJ',
  MATILDA: 'XrExE9yKIg1WjnnlVkGX',
  MATTHEW: 'Yko7PKHZNXotIFUBG7I9',
  MICHAEL: 'flq6f7yk4E4fJM5XTYuZ',
  MIMI: 'zrHiDhphv9ZnVXBqCLjz',
  NICOLE: 'piTKgcLEGmPE4e6mEKli',
  PATRICK: 'ODq5zmih8GrVes37Dizd',
  RACHEL: '21m00Tcm4TlvDq8ikWAM',
  RYAN: 'wViXBPUzp2ZZixB1xQuM',
  SAM: 'yoZ06aMxZJJ28mfd3POQ',
  SARAH: 'EXAVITQu4vr4xnSDxMaL',
  SERENA: 'pMsXgVXv3BLzUgSXRplE',
  THOMAS: 'GBv7mTt0atIp3Br8iCZE',
} as const;

// Available models
export const ELEVENLABS_MODELS = {
  ELEVEN_TURBO_V2_5: 'eleven_turbo_v2_5',
  ELEVEN_TURBO_V2: 'eleven_turbo_v2',
  ELEVEN_MONOLINGUAL_V1: 'eleven_monolingual_v1',
  ELEVEN_MULTILINGUAL_V2: 'eleven_multilingual_v2',
  ELEVEN_MULTILINGUAL_V1: 'eleven_multilingual_v1',
} as const;
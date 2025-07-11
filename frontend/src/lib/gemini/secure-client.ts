// Secure Gemini Client - Uses server-side API endpoints
export class SecureGeminiClient {
  private csrfToken: string | null = null;

  constructor() {
    this.initializeCSRFToken();
  }

  private async initializeCSRFToken() {
    try {
      const response = await fetch('/api/csrf');
      const data = await response.json();
      this.csrfToken = data.csrfToken;
    } catch (error) {
      console.error('Failed to fetch CSRF token:', error);
    }
  }

  // Generate text completion
  async generateContent(
    prompt: string,
    options?: {
      model?: string;
      systemInstruction?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ) {
    if (!this.csrfToken) {
      await this.initializeCSRFToken();
    }

    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': this.csrfToken || '',
      },
      body: JSON.stringify({ prompt, ...options }),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    const result = await response.json();
    return result.data;
  }

  // Stream text completion
  async *generateContentStream(
    prompt: string,
    options?: {
      model?: string;
      systemInstruction?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ) {
    if (!this.csrfToken) {
      await this.initializeCSRFToken();
    }

    const params = new URLSearchParams();
    params.append('prompt', prompt);
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }

    const response = await fetch(`/api/gemini?${params}`, {
      headers: {
        'x-csrf-token': this.csrfToken || '',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Stream request failed');
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              yield parsed.text;
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // Chat completion with history
  async chat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options?: {
      model?: string;
      systemInstruction?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ) {
    // Convert messages to a single prompt
    const prompt = messages
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    return this.generateContent(prompt, options);
  }
}

// Export singleton instance
export const secureGemini = new SecureGeminiClient();

// Hook for React components
export function useSecureGemini() {
  const client = new SecureGeminiClient();

  return {
    generateContent: client.generateContent.bind(client),
    generateContentStream: client.generateContentStream.bind(client),
    chat: client.chat.bind(client),
  };
}
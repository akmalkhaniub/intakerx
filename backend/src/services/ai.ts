import { config } from '../config';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
}

export class AIService {
  private static getProviderConfig(providerOverride?: string, modelOverride?: string) {
    const provider = providerOverride || config.aiProvider;
    let model = modelOverride || config.aiModel;
    let apiKey = '';
    let baseUrl = '';

    if (provider === 'gemini') {
      apiKey = config.geminiApiKey;
      baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    } else if (provider === 'groq') {
      apiKey = config.groqApiKey;
      baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
      if (!modelOverride) model = 'llama-3.3-70b-versatile';
    } else if (provider === 'openrouter') {
      apiKey = config.openrouterApiKey;
      baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
      if (!modelOverride) model = 'google/gemini-2.0-flash';
    }

    return { provider, model, apiKey, baseUrl };
  }

  /**
   * Generates embeddings using Gemini's text-embedding-004
   */
  static async getEmbedding(text: string): Promise<number[]> {
    const apiKey = config.geminiApiKey;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.embeddingModel}:embedContent?key=${apiKey}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${config.embeddingModel}`,
          content: {
            parts: [{ text }]
          },
          outputDimensionality: 768
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini embedding error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as any;
      if (data.embedding?.values) {
        return data.embedding.values;
      }
      throw new Error('Invalid response structure from Gemini embedding API');
    } catch (error) {
      console.error('getEmbedding error:', error);
      throw error;
    }
  }

  /**
   * Generates text response using configured provider
   */
  static async generateText(
    systemPrompt: string,
    messages: ChatMessage[],
    options: {
      temperature?: number;
      responseJsonSchema?: any;
      provider?: string;
      model?: string;
    } = {}
  ): Promise<string> {
    const { provider, model, apiKey, baseUrl } = this.getProviderConfig(options.provider, options.model);

    if (provider === 'gemini') {
      const url = `${baseUrl}/${model}:generateContent?key=${apiKey}`;
      
      // Format messages for Gemini (system instruction is separate, user/model are roles)
      const geminiContents = messages.map(m => {
        let role = m.role === 'assistant' ? 'model' : m.role;
        if (role === 'system') role = 'user'; // System messages are not allowed in contents
        return {
          role,
          parts: [{ text: m.content }]
        };
      });

      const requestBody: any = {
        contents: geminiContents,
        generationConfig: {
          temperature: options.temperature ?? 0.2,
        }
      };

      if (systemPrompt) {
        requestBody.systemInstruction = {
          parts: [{ text: systemPrompt }]
        };
      }

      if (options.responseJsonSchema) {
        requestBody.generationConfig.responseMimeType = 'application/json';
        requestBody.generationConfig.responseSchema = options.responseJsonSchema;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Empty response from Gemini API');
      }
      return text;
    } else {
      // OpenAI compatible endpoints (Groq, OpenRouter)
      const isGroq = provider === 'groq';
      const authHeader = isGroq ? `Bearer ${apiKey}` : `Bearer ${apiKey}`;
      const url = baseUrl;

      const formattedMessages = [];
      if (systemPrompt) {
        formattedMessages.push({ role: 'system', content: systemPrompt });
      }
      for (const msg of messages) {
        formattedMessages.push({
          role: msg.role === 'model' ? 'assistant' : msg.role,
          content: msg.content
        });
      }

      const requestBody: any = {
        model,
        messages: formattedMessages,
        temperature: options.temperature ?? 0.2,
      };

      if (options.responseJsonSchema) {
        requestBody.response_format = { type: 'json_object' };
        // We append the JSON schema directive to prompt as fallback for compatibility
        formattedMessages.push({
          role: 'system',
          content: `You must output valid JSON matching this schema: ${JSON.stringify(options.responseJsonSchema)}`
        });
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${provider} API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as any;
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error(`Empty response from ${provider} API`);
      }
      return text;
    }
  }

  /**
   * Streaming completion for chatbot SSE stream. Returns an abort controller and a stream parser.
   */
  static async streamText(
    systemPrompt: string,
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    onDone: (fullText: string) => void,
    onError: (err: any) => void
  ) {
    const { provider, model, apiKey, baseUrl } = this.getProviderConfig();

    if (provider !== 'gemini') {
      // Return a simulated stream or standard OpenAI streaming if needed.
      // For ease of implementation, we fallback to streaming for Gemini, which is our primary.
      // We will implement full SSE streaming for Gemini first.
    }

    const url = `${baseUrl}/${model}:streamGenerateContent?key=${apiKey}`;
    const geminiContents = messages.map(m => {
      let role = m.role === 'assistant' ? 'model' : m.role;
      if (role === 'system') role = 'user';
      return {
        role,
        parts: [{ text: m.content }]
      };
    });

    const requestBody: any = {
      contents: geminiContents,
      generationConfig: {
        temperature: 0.3,
      }
    };

    if (systemPrompt) {
      requestBody.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini stream error: ${errText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Gemini streamGenerateContent returns a JSON array of candidates.
        // It can be formatted as an array that opens with '[' and closes with ']',
        // or a line-by-line streaming format.
        // A simple parser checks for candidate text updates in the buffered JSON stream.
        try {
          // In SSE/streamGenerateContent, the server sends a stream of JSON objects.
          // Since it might send fragments of JSON arrays, we can parse candidate fragments.
          // A robust way to parse Gemini chunk-by-chunk:
          // The buffer contains a stream of JSON array elements.
          // Let's extract values of text fields.
          const matches = [...buffer.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g)];
          // We only emit new text content that we haven't emitted yet.
          let textFound = '';
          for (const match of matches) {
            // Unescape JSON string
            const val = JSON.parse(`"${match[1]}"`);
            textFound += val;
          }

          if (textFound.length > fullText.length) {
            const newChunk = textFound.substring(fullText.length);
            fullText = textFound;
            onChunk(newChunk);
          }
        } catch (e) {
          // Ignore parsing errors for partial chunks
        }
      }

      onDone(fullText);
    } catch (error) {
      onError(error);
    }
  }
}

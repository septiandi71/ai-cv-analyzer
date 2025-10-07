import { registerAs } from '@nestjs/config';

export interface LLMProviderConfig {
  name: string;
  priority: number;
  enabled: boolean;
  rateLimit: {
    rpm: number; // Requests per minute
    tpm: number; // Tokens per minute
  };
  config: Record<string, any>;
}

export default registerAs('llm', () => ({
  // Default temperature for all models
  temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.3'),
  
  // Retry configuration
  retry: {
    maxAttempts: 3,
    backoffMs: 1000,
    backoffMultiplier: 2,
  },

  // Provider configurations (in priority order)
  // Strategy: Use 2 Gemini models for consistency (same API, same tokenization)
  providers: [
    // Primary: Gemini 2.5 Flash (Latest & most capable)
    {
      name: 'gemini-primary',
      priority: 1,
      enabled: process.env.GEMINI_API_KEY ? true : false,
      rateLimit: {
        rpm: 15, // Free tier: 15 requests per minute
        tpm: 1000000, // 1M tokens per minute - Very generous
      },
      config: {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL_PRIMARY || 'gemini-2.5-flash'
      },
    } as LLMProviderConfig,

    // Backup: Gemini 2.0 Flash (Stable & proven fallback)
    {
      name: 'gemini-backup',
      priority: 2,
      enabled: process.env.GEMINI_API_KEY ? true : false,
      rateLimit: {
        rpm: 15, // Same rate limit (shared quota)
        tpm: 1000000, // Same generous limit
      },
      config: {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL_BACKUP || 'gemini-2.0-flash-exp'
      },
    } as LLMProviderConfig,
  ],


}));

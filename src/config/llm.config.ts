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
  providers: [
    // Primary: Google Gemini (Best free tier - No credit card required)
    {
      name: 'gemini',
      priority: 1,
      enabled: process.env.GEMINI_API_KEY ? true : false,
      rateLimit: {
        rpm: 15, // Free tier: 15 requests per minute
        tpm: 1000000, // 1M tokens per minute - Very generous
      },
      config: {
        apiKey: process.env.GEMINI_API_KEY,
        modelFlash: process.env.GEMINI_MODEL_FLASH || 'gemini-1.5-flash',
        modelPro: process.env.GEMINI_MODEL_PRO || 'gemini-1.5-pro',
        useProForSynthesis: process.env.USE_GEMINI_PRO === 'true', // Use Pro for final synthesis
      },
    } as LLMProviderConfig,

    // Backup: OpenRouter Meta Llama (Free & Reliable)
    {
      name: 'openrouter',
      priority: 2,
      enabled: process.env.OPENROUTER_API_KEY ? true : false,
      rateLimit: {
        rpm: 20, // Free tier: 20 requests per minute
        tpm: 200000, // 200K tokens per minute
      },
      config: {
        apiKey: process.env.OPENROUTER_API_KEY,
        baseUrl: 'https://openrouter.ai/api/v1',
        model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
        siteName: process.env.OPENROUTER_SITE_NAME || 'AI CV Analyzer',
        siteUrl: process.env.OPENROUTER_SITE_URL,
      },
    } as LLMProviderConfig,
  ],

  // Task-specific model selection
  taskConfig: {
    cvEvaluation: {
      preferredProvider: 'gemini',
      useFlash: true, // Use Gemini Flash for CV evaluation
    },
    projectEvaluation: {
      preferredProvider: 'gemini',
      useFlash: true, // Use Gemini Flash for project evaluation
    },
    synthesis: {
      preferredProvider: 'gemini',
      useFlash: false, // Use Gemini Pro for final synthesis (better quality)
    },
  },
}));

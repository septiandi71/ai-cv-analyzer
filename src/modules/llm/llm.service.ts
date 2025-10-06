import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface LLMRequestOptions {
  temperature?: number;
  maxTokens?: number;
  preferredProvider?: string;
  useProModel?: boolean; // For Gemini: use Pro instead of Flash
}

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private providers: Map<string, any> = new Map();
  private rateLimiters: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(private configService: ConfigService) {
    this.initializeProviders();
  }

  private initializeProviders() {
    const llmConfig = this.configService.get('llm');
    const providers = llmConfig.providers;

    // Initialize Gemini (PRIMARY - FREE)
    const geminiConfig = providers.find(p => p.name === 'gemini');
    if (geminiConfig?.enabled && geminiConfig.config.apiKey) {
      try {
        this.providers.set('gemini', {
          client: new GoogleGenerativeAI(geminiConfig.config.apiKey),
          config: geminiConfig,
        });
        this.logger.log('✅ Gemini provider initialized (PRIMARY)');
      } catch (error) {
        this.logger.error('❌ Failed to initialize Gemini:', error.message);
      }
    }

    // Initialize OpenRouter (BACKUP - FREE)
    const openrouterConfig = providers.find(p => p.name === 'openrouter');
    if (openrouterConfig?.enabled && openrouterConfig.config.apiKey) {
      try {
        this.providers.set('openrouter', {
          client: new OpenAI({
            apiKey: openrouterConfig.config.apiKey,
            baseURL: openrouterConfig.config.baseUrl,
            defaultHeaders: {
              'HTTP-Referer': openrouterConfig.config.siteUrl || 'http://localhost:3000',
              'X-Title': openrouterConfig.config.siteName || 'AI CV Analyzer',
            },
          }),
          config: openrouterConfig,
        });
        this.logger.log('✅ OpenRouter provider initialized (BACKUP)');
      } catch (error) {
        this.logger.error('❌ Failed to initialize OpenRouter:', error.message);
      }
    }

    if (this.providers.size === 0) {
      this.logger.warn('⚠️  No LLM providers initialized! Please configure at least one provider.');
    } else {
      this.logger.log(`📊 Initialized ${this.providers.size} LLM provider(s): ${Array.from(this.providers.keys()).join(', ')}`);
    }
  }

  /**
   * Generate completion with automatic fallback
   */
  async generateCompletion(
    systemPrompt: string,
    userPrompt: string,
    options: LLMRequestOptions = {},
  ): Promise<LLMResponse> {
    const llmConfig = this.configService.get('llm');
    const temperature = options.temperature ?? llmConfig.temperature;
    const maxRetries = llmConfig.retry.maxAttempts;

    // Get providers sorted by priority
    const sortedProviders = this.getSortedProviders(options.preferredProvider);

    let lastError: Error | undefined;

    // Try each provider in order
    for (const providerName of sortedProviders) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      // Check rate limit
      if (this.isRateLimited(providerName)) {
        this.logger.warn(`⏳ ${providerName} is rate limited, trying next provider...`);
        continue;
      }

      // Retry logic for current provider
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          this.logger.log(
            `🤖 Attempting ${providerName} (attempt ${attempt}/${maxRetries})...`,
          );

          const response = await this.callProvider(
            providerName,
            provider,
            systemPrompt,
            userPrompt,
            temperature,
            options,
          );

          // Success! Track rate limit
          this.trackRequest(providerName);

          this.logger.log(`✅ Successfully generated completion using ${providerName}`);
          return response;
        } catch (error) {
          lastError = error;
          this.logger.error(
            `❌ ${providerName} attempt ${attempt} failed: ${error.message}`,
          );

          // Check if it's a rate limit error
          if (this.isRateLimitError(error)) {
            this.markRateLimited(providerName);
            break; // Don't retry this provider, move to next
          }

          // Exponential backoff before retry
          if (attempt < maxRetries) {
            const backoffMs = llmConfig.retry.backoffMs * Math.pow(llmConfig.retry.backoffMultiplier, attempt - 1);
            this.logger.log(`⏳ Waiting ${backoffMs}ms before retry...`);
            await this.sleep(backoffMs);
          }
        }
      }
    }

    // All providers failed
    throw new Error(
      `All LLM providers failed. Last error: ${lastError?.message || 'Unknown error'}. ` +
      `Please check your API keys and rate limits.`,
    );
  }

  /**
   * Call specific provider
   */
  private async callProvider(
    providerName: string,
    provider: any,
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    options: LLMRequestOptions,
  ): Promise<LLMResponse> {
    switch (providerName) {
      case 'gemini':
        return this.callGemini(provider, systemPrompt, userPrompt, temperature, options);
      case 'openrouter':
        return this.callOpenAICompatible(
          providerName,
          provider,
          systemPrompt,
          userPrompt,
          temperature,
          options,
        );
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  }

  /**
   * Call Google Gemini
   */
  private async callGemini(
    provider: any,
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    options: LLMRequestOptions,
  ): Promise<LLMResponse> {
    const client: GoogleGenerativeAI = provider.client;
    const config = provider.config.config;

    // Choose model (Pro for synthesis, Flash for others)
    const modelName = options.useProModel && config.useProForSynthesis
      ? config.modelPro
      : config.modelFlash;

    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature,
        maxOutputTokens: options.maxTokens || 2048,
      },
    });

    // Combine system and user prompts for Gemini
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    return {
      content: text,
      provider: 'gemini',
      model: modelName,
      tokensUsed: {
        prompt: response.usageMetadata?.promptTokenCount || 0,
        completion: response.usageMetadata?.candidatesTokenCount || 0,
        total: response.usageMetadata?.totalTokenCount || 0,
      },
    };
  }

  /**
   * Call OpenRouter (OpenAI-compatible)
   */
  private async callOpenAICompatible(
    providerName: string,
    provider: any,
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    options: LLMRequestOptions,
  ): Promise<LLMResponse> {
    const client: OpenAI = provider.client;
    const config = provider.config.config;

    // Get the model from config
    const model = config.model || 'meta-llama/llama-3.1-8b-instruct:free';

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: options.maxTokens || 2048,
    });

    const content = completion.choices[0]?.message?.content || '';

    return {
      content,
      provider: providerName,
      model,
      tokensUsed: {
        prompt: completion.usage?.prompt_tokens || 0,
        completion: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Get providers sorted by priority
   */
  private getSortedProviders(preferredProvider?: string): string[] {
    const llmConfig = this.configService.get('llm');
    const allProviders = llmConfig.providers
      .filter(p => p.enabled && this.providers.has(p.name))
      .sort((a, b) => a.priority - b.priority)
      .map(p => p.name);

    // If preferred provider is specified and available, try it first
    if (preferredProvider && this.providers.has(preferredProvider)) {
      return [
        preferredProvider,
        ...allProviders.filter(p => p !== preferredProvider),
      ];
    }

    return allProviders;
  }

  /**
   * Rate limiting helpers
   */
  private isRateLimited(providerName: string): boolean {
    const limiter = this.rateLimiters.get(providerName);
    if (!limiter) return false;

    const now = Date.now();
    if (now >= limiter.resetAt) {
      this.rateLimiters.delete(providerName);
      return false;
    }

    const provider = this.providers.get(providerName);
    const rpm = provider?.config?.rateLimit?.rpm || 10;
    return limiter.count >= rpm;
  }

  private markRateLimited(providerName: string) {
    const resetAt = Date.now() + 60000; // Reset after 1 minute
    this.rateLimiters.set(providerName, { count: 999, resetAt });
  }

  private trackRequest(providerName: string) {
    const now = Date.now();
    const limiter = this.rateLimiters.get(providerName);

    if (!limiter || now >= limiter.resetAt) {
      this.rateLimiters.set(providerName, {
        count: 1,
        resetAt: now + 60000,
      });
    } else {
      limiter.count++;
    }
  }

  private isRateLimitError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    const status = error.status || error.statusCode;
    return (
      status === 429 ||
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('quota exceeded')
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [name, provider] of this.providers.entries()) {
      try {
        // Simple test call
        await this.callProvider(
          name,
          provider,
          'You are a helpful assistant.',
          'Say "OK" if you can read this.',
          0.1,
          { maxTokens: 10 },
        );
        health[name] = true;
      } catch (error) {
        this.logger.error(`Health check failed for ${name}: ${error.message}`);
        health[name] = false;
      }
    }

    return health;
  }
}

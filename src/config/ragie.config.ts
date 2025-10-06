import { registerAs } from '@nestjs/config';

export default registerAs('ragie', () => ({
  apiKey: process.env.RAGIE_API_KEY,
  baseUrl: process.env.RAGIE_BASE_URL || 'https://api.ragie.ai',
}));

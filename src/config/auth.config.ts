import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  // API Key for simple authentication
  // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  apiKey: process.env.API_KEY || 'dev-api-key-change-in-production',
}));

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

/**
 * API Key Authentication Guard
 * 
 * Simple and efficient auth for technical test/MVP
 * Validates API key from request headers
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private configService: ConfigService,
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is public (has @Public() decorator)
    const isPublic = this.reflector.get<boolean>(
      'isPublic',
      context.getHandler(),
    );

    if (isPublic) {
      return true; // Skip auth for public routes
    }

    const request = context.switchToHttp().getRequest();
    
    // Get API key from header
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    // Validate API key
    const validApiKey = this.configService.get<string>('auth.apiKey');

    if (apiKey !== validApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}

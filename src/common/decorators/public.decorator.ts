import { SetMetadata } from '@nestjs/common';

/**
 * Public decorator to skip authentication
 * 
 * Usage:
 * @Public()
 * @Get()
 * getPublicData() { ... }
 */
export const Public = () => SetMetadata('isPublic', true);

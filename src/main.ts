import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './common/guards/api-key.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get config service
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;

  // Enable CORS
  app.enableCors();

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Register global API Key guard
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new ApiKeyGuard(configService, reflector));

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('AI CV Analyzer API')
    .setDescription(
      'Backend service for automated CV and project report evaluation',
    )
    .setVersion('1.0')
    .addTag('upload', 'Document upload endpoints')
    .addTag('evaluation', 'Evaluation job endpoints')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api`);
}
bootstrap();

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EvaluationController } from './evaluation.controller';
import { EvaluationService } from './evaluation.service';
import { EvaluationProcessor } from './evaluation.processor';
import { PrismaService } from '../../common/prisma.service';
import { UploadService } from '../upload/upload.service';
import { LLMService } from '../llm/llm.service';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: 'evaluation',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 200,     // Keep last 200 failed jobs
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [EvaluationController],
  providers: [
    EvaluationService,
    EvaluationProcessor,
    PrismaService,
    UploadService,
    LLMService,
  ],
  exports: [EvaluationService],
})
export class EvaluationModule {}

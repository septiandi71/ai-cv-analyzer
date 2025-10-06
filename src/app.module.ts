import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './common/prisma.service';
import { UploadModule } from './modules/upload/upload.module';
import { LLMModule } from './modules/llm/llm.module';
import { EvaluationModule } from './modules/evaluation/evaluation.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import ragieConfig from './config/ragie.config';
import uploadConfig from './config/upload.config';
import queueConfig from './config/queue.config';
import llmConfig from './config/llm.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        ragieConfig,
        uploadConfig,
        queueConfig,
        llmConfig,
      ],
    }),
    UploadModule,
    LLMModule,
    EvaluationModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}

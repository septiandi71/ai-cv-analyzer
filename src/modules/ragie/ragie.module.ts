import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RagieService } from './ragie.service';

@Module({
  imports: [ConfigModule],
  providers: [RagieService],
  exports: [RagieService],
})
export class RagieModule {}

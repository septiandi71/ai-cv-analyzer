import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const uploadConfig = configService.get('upload');
        return {
          storage: diskStorage({
            destination: uploadConfig.uploadDir,
            filename: (req, file, callback) => {
              // Generate unique filename
              const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
              const ext = extname(file.originalname);
              const name = file.originalname.replace(ext, '').replace(/\s+/g, '-');
              callback(null, `${name}-${uniqueSuffix}${ext}`);
            },
          }),
          limits: {
            fileSize: uploadConfig.maxFileSize, // 10MB default
          },
          fileFilter: (req, file, callback) => {
            if (file.mimetype === 'application/pdf') {
              callback(null, true);
            } else {
              callback(new Error('Only PDF files are allowed'), false);
            }
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService, PrismaService],
  exports: [UploadService],
})
export class UploadModule {}

import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { UploadResponseDto } from './dto/upload-response.dto';
import * as fs from 'fs/promises';
import * as path from 'path';
import pdfParse from 'pdf-parse';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.uploadDir = this.configService.get('upload.uploadDir') || './uploads';
  }

  /**
   * Process uploaded files and save metadata to database
   */
  async processUploadedFiles(
    cvFile: Express.Multer.File,
    reportFile: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    this.logger.log(`Processing uploaded files: ${cvFile.filename}, ${reportFile.filename}`);

    try {
      // Parse PDF files to extract text and metadata
      const [cvData, reportData] = await Promise.all([
        this.parsePdfFile(cvFile),
        this.parsePdfFile(reportFile),
      ]);

      // Save CV to database
      const cvDocument = await this.prisma.uploadedFile.create({
        data: {
          type: 'CV',
          storedFilename: cvFile.filename,
          originalFilename: cvFile.originalname,
          filePath: cvFile.path,
          mimeType: cvFile.mimetype,
          fileSize: cvFile.size,
          extractedText: cvData.text,
          pageCount: cvData.pageCount,
        },
      });

      // Save Project Report to database
      const reportDocument = await this.prisma.uploadedFile.create({
        data: {
          type: 'PROJECT_REPORT',
          storedFilename: reportFile.filename,
          originalFilename: reportFile.originalname,
          filePath: reportFile.path,
          mimeType: reportFile.mimetype,
          fileSize: reportFile.size,
          extractedText: reportData.text,
          pageCount: reportData.pageCount,
        },
      });

      this.logger.log(`Files processed successfully: CV ID=${cvDocument.id}, Report ID=${reportDocument.id}`);

      return {
        cv: {
          id: cvDocument.id,
          filename: cvDocument.originalFilename,
          size: cvDocument.fileSize,
          pageCount: cvDocument.pageCount,
        },
        project_report: {
          id: reportDocument.id,
          filename: reportDocument.originalFilename,
          size: reportDocument.fileSize,
          pageCount: reportDocument.pageCount,
        },
        message: 'Files uploaded successfully',
      };
    } catch (error) {
      this.logger.error(`Error processing uploaded files: ${error.message}`, error.stack);
      
      // Clean up uploaded files on error
      await this.cleanupFiles([cvFile.path, reportFile.path]);
      
      throw new InternalServerErrorException(
        'Failed to process uploaded files. Please try again.',
      );
    }
  }

  /**
   * Parse PDF file and extract text content
   */
  private async parsePdfFile(file: Express.Multer.File): Promise<{
    text: string;
    pageCount: number;
  }> {
    try {
      const dataBuffer = await fs.readFile(file.path);
      const data = await pdfParse(dataBuffer);

      return {
        text: data.text,
        pageCount: (data as any).numpages || 1,
      };
    } catch (error) {
      this.logger.error(`Error parsing PDF file ${file.filename}: ${error.message}`);
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
  }

  /**
   * Get uploaded file by ID
   */
  async getFileById(id: string) {
    return this.prisma.uploadedFile.findUnique({
      where: { id },
    });
  }

  /**
   * Get file with extracted text
   */
  async getFileText(id: string): Promise<string> {
    const file = await this.getFileById(id);
    if (!file) {
      throw new Error(`File not found: ${id}`);
    }
    return file.extractedText;
  }

  /**
   * Clean up files (used on error)
   */
  private async cleanupFiles(filePaths: string[]): Promise<void> {
    for (const filepath of filePaths) {
      try {
        await fs.unlink(filepath);
        this.logger.log(`Cleaned up file: ${filepath}`);
      } catch (error) {
        this.logger.warn(`Failed to cleanup file ${filepath}: ${error.message}`);
      }
    }
  }

  /**
   * Delete uploaded file and its physical file
   */
  async deleteFile(id: string): Promise<void> {
    const file = await this.getFileById(id);
    if (!file) {
      throw new Error(`File not found: ${id}`);
    }

    try {
      // Delete file from filesystem
      await fs.unlink(file.filePath);
      
      // Delete from database
      await this.prisma.uploadedFile.delete({
        where: { id },
      });

      this.logger.log(`File deleted: ${id}`);
    } catch (error) {
      this.logger.error(`Error deleting file ${id}: ${error.message}`);
      throw error;
    }
  }
}

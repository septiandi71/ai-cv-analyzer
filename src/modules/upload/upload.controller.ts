import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiResponse, ApiBody } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { UploadResponseDto } from './dto/upload-response.dto';

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'cv', maxCount: 1 },
      { name: 'project_report', maxCount: 1 },
    ]),
  )
  @ApiOperation({ 
    summary: 'Upload CV and Project Report',
    description: 'Upload candidate CV and project report PDF files. Both files are required.'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        cv: {
          type: 'string',
          format: 'binary',
          description: 'Candidate CV (PDF only, max 10MB)',
        },
        project_report: {
          type: 'string',
          format: 'binary',
          description: 'Project Report (PDF only, max 10MB)',
        },
      },
      required: ['cv', 'project_report'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Files uploaded successfully',
    type: UploadResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Missing files or invalid format',
  })
  async uploadFiles(
    @UploadedFiles()
    files: {
      cv?: Express.Multer.File[];
      project_report?: Express.Multer.File[];
    },
  ): Promise<UploadResponseDto> {
    // Validate that both files are present
    if (!files?.cv || !files?.project_report) {
      throw new BadRequestException(
        'Both CV and project_report files are required',
      );
    }

    const cvFile = files.cv[0];
    const reportFile = files.project_report[0];

    // Process and save file metadata
    const result = await this.uploadService.processUploadedFiles(
      cvFile,
      reportFile,
    );

    return result;
  }
}

import { ApiProperty } from '@nestjs/swagger';

class DocumentInfoDto {
  @ApiProperty({ 
    description: 'Unique document ID',
    example: 'clx1234567890abcdef'
  })
  id: string;

  @ApiProperty({ 
    description: 'Original filename',
    example: 'john_doe_cv.pdf'
  })
  filename: string;

  @ApiProperty({ 
    description: 'File size in bytes',
    example: 524288
  })
  size: number;

  @ApiProperty({ 
    description: 'Number of pages in PDF',
    example: 2
  })
  pageCount: number;
}

export class UploadResponseDto {
  @ApiProperty({ 
    description: 'CV document information',
    type: DocumentInfoDto
  })
  cv: DocumentInfoDto;

  @ApiProperty({ 
    description: 'Project report document information',
    type: DocumentInfoDto
  })
  project_report: DocumentInfoDto;

  @ApiProperty({ 
    description: 'Success message',
    example: 'Files uploaded successfully'
  })
  message: string;
}

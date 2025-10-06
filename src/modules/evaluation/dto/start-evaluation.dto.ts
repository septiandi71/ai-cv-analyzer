import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsNotEmpty } from 'class-validator';

export class StartEvaluationDto {
  @ApiProperty({
    description: 'Job title for the evaluation',
    example: 'Backend Engineer',
  })
  @IsString()
  @IsNotEmpty()
  jobTitle: string;

  @ApiProperty({
    description: 'ID of the uploaded CV document',
    example: 'clx1234567890abcdef',
  })
  @IsUUID()
  @IsNotEmpty()
  cvFileId: string;

  @ApiProperty({
    description: 'ID of the uploaded project report document',
    example: 'clx0987654321zyxwvu',
  })
  @IsUUID()
  @IsNotEmpty()
  projectReportFileId: string;
}

import { ApiProperty } from '@nestjs/swagger';

export class EvaluationStatusDto {
  @ApiProperty({
    description: 'Job ID',
    example: 'clx1234567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Current job status',
    enum: ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'],
    example: 'PROCESSING',
  })
  status: string;

  @ApiProperty({
    description: 'Job title',
    example: 'Backend Engineer',
  })
  jobTitle?: string;

  @ApiProperty({
    description: 'Error message if failed',
    example: 'LLM API timeout',
    required: false,
  })
  error?: string;

  @ApiProperty({
    description: 'Number of retry attempts',
    example: 1,
  })
  attempts?: number;

  @ApiProperty({
    description: 'Job creation timestamp',
    example: '2025-10-06T10:30:00Z',
  })
  createdAt?: Date;

  @ApiProperty({
    description: 'Processing start timestamp',
    example: '2025-10-06T10:30:05Z',
    required: false,
  })
  startedAt?: Date;

  @ApiProperty({
    description: 'Job completion timestamp',
    example: '2025-10-06T10:32:15Z',
    required: false,
  })
  completedAt?: Date;
}

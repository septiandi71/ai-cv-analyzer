import { ApiProperty } from '@nestjs/swagger';
import { EvaluationStatusDto } from './evaluation-status.dto';

class CVScoresDto {
  @ApiProperty({ example: 4.5 })
  technical_skills?: number;

  @ApiProperty({ example: 4.0 })
  experience_level?: number;

  @ApiProperty({ example: 4.2 })
  achievements?: number;

  @ApiProperty({ example: 4.0 })
  cultural_fit?: number;
}

class ProjectScoresDto {
  @ApiProperty({ example: 4.5 })
  correctness?: number;

  @ApiProperty({ example: 4.0 })
  code_quality?: number;

  @ApiProperty({ example: 3.5 })
  resilience?: number;

  @ApiProperty({ example: 4.8 })
  documentation?: number;

  @ApiProperty({ example: 3.0 })
  creativity?: number;
}

export class EvaluationResultDto extends EvaluationStatusDto {
  @ApiProperty({
    description: 'CV match rate (0.0 - 1.0)',
    example: 0.82,
  })
  cvMatchRate: number;

  @ApiProperty({
    description: 'CV evaluation feedback',
    example: 'Strong in backend and cloud, limited AI integration experience...',
  })
  cvFeedback: string;

  @ApiProperty({
    description: 'Detailed CV scores breakdown',
    type: CVScoresDto,
  })
  cvScores?: any;

  @ApiProperty({
    description: 'Project score (1.0 - 5.0)',
    example: 4.5,
  })
  projectScore: number;

  @ApiProperty({
    description: 'Project evaluation feedback',
    example: 'Meets prompt chaining requirements, lacks error handling robustness...',
  })
  projectFeedback: string;

  @ApiProperty({
    description: 'Detailed project scores breakdown',
    type: ProjectScoresDto,
  })
  projectScores?: any;

  @ApiProperty({
    description: 'Overall evaluation summary',
    example: 'Good candidate fit, would benefit from deeper RAG knowledge...',
  })
  overallSummary: string;

  @ApiProperty({
    description: 'LLM provider used',
    example: 'gemini',
  })
  llmProvider?: string;

  @ApiProperty({
    description: 'LLM model used',
    example: 'gemini-1.5-flash',
  })
  llmModel?: string;

  @ApiProperty({
    description: 'Total tokens used',
    example: 2450,
  })
  tokensUsed?: number;

  @ApiProperty({
    description: 'Processing time in milliseconds',
    example: 8500,
  })
  processingTimeMs?: number;
}

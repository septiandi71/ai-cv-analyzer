import { ApiProperty } from '@nestjs/swagger';
import { EvaluationStatusDto } from './evaluation-status.dto';

/**
 * Nested result object containing all evaluation data
 * Simple structure without detailed scores breakdown
 */
class EvaluationResultData {
  @ApiProperty({
    description: 'CV match rate (0.0 - 1.0)',
    example: 0.82,
  })
  cv_match_rate: number;

  @ApiProperty({
    description: 'CV evaluation feedback',
    example: 'Strong in backend and cloud, limited AI integration experience...',
  })
  cv_feedback: string;

  @ApiProperty({
    description: 'Project score (1.0 - 5.0)',
    example: 4.5,
  })
  project_score: number;

  @ApiProperty({
    description: 'Project evaluation feedback',
    example: 'Meets prompt chaining requirements, lacks error handling robustness...',
  })
  project_feedback: string;

  @ApiProperty({
    description: 'Overall evaluation summary',
    example: 'Good candidate fit, would benefit from deeper RAG knowledge...',
  })
  overall_summary: string;
}

export class EvaluationResultDto extends EvaluationStatusDto {
  @ApiProperty({
    description: 'Evaluation results (only present when status is COMPLETED)',
    type: EvaluationResultData,
    required: false,
  })
  result?: EvaluationResultData;

  @ApiProperty({
    description: 'Processing time in milliseconds (only present when status is COMPLETED)',
    example: 38000,
    required: false,
  })
  processing_time_ms?: number;
}

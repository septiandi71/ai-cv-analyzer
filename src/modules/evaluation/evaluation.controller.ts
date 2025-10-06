import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { EvaluationService } from './evaluation.service';
import { StartEvaluationDto } from './dto/start-evaluation.dto';
import { EvaluationStatusDto } from './dto/evaluation-status.dto';
import { EvaluationResultDto } from './dto/evaluation-result.dto';

@ApiTags('Evaluation')
@Controller()
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start evaluation job',
    description: 'Triggers asynchronous AI evaluation pipeline. Returns job ID immediately.',
  })
  @ApiResponse({
    status: 200,
    description: 'Evaluation job created and queued',
    type: EvaluationStatusDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input (file IDs not found)',
  })
  async startEvaluation(
    @Body() dto: StartEvaluationDto,
  ): Promise<EvaluationStatusDto> {
    return this.evaluationService.startEvaluation(dto);
  }

  @Get('result/:id')
  @ApiOperation({
    summary: 'Get evaluation result',
    description: 'Retrieves the status and result of an evaluation job',
  })
  @ApiParam({
    name: 'id',
    description: 'Job ID returned from POST /evaluate',
    example: 'clx1234567890abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'Job found - returns status or result',
    type: EvaluationResultDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async getResult(@Param('id') id: string): Promise<EvaluationResultDto> {
    const result = await this.evaluationService.getJobResult(id);
    
    if (!result) {
      throw new NotFoundException(`Evaluation job not found: ${id}`);
    }

    return result;
  }
}

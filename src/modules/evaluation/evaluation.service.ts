import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../../common/prisma.service';
import { UploadService } from '../upload/upload.service';
import { StartEvaluationDto } from './dto/start-evaluation.dto';
import { EvaluationStatusDto } from './dto/evaluation-status.dto';
import { EvaluationResultDto } from './dto/evaluation-result.dto';

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(
    @InjectQueue('evaluation') private evaluationQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * Start evaluation job
   */
  async startEvaluation(dto: StartEvaluationDto): Promise<EvaluationStatusDto> {
    this.logger.log(`Starting evaluation for job title: ${dto.jobTitle}`);

    // Validate that files exist
    const [cvFile, projectFile] = await Promise.all([
      this.uploadService.getFileById(dto.cvFileId),
      this.uploadService.getFileById(dto.projectReportFileId),
    ]);

    if (!cvFile) {
      throw new BadRequestException(`CV file not found: ${dto.cvFileId}`);
    }

    if (!projectFile) {
      throw new BadRequestException(
        `Project report file not found: ${dto.projectReportFileId}`,
      );
    }

    // Create evaluation job in database
    const job = await this.prisma.evaluationJob.create({
      data: {
        jobTitle: dto.jobTitle,
        status: 'QUEUED',
        cvFileId: dto.cvFileId,
        projectReportFileId: dto.projectReportFileId,
      },
    });

    // Add job to Bull queue
    await this.evaluationQueue.add(
      'evaluate-candidate',
      {
        jobId: job.id,
        jobTitle: dto.jobTitle,
        cvFileId: dto.cvFileId,
        projectReportFileId: dto.projectReportFileId,
      },
      {
        jobId: job.id, // Use database job ID as queue job ID
      },
    );

    this.logger.log(`Evaluation job created: ${job.id}`);

    return {
      id: job.id,
      status: job.status,
      jobTitle: job.jobTitle,
      createdAt: job.createdAt,
    };
  }

  /**
   * Get job result by ID
   */
  async getJobResult(jobId: string): Promise<EvaluationResultDto | null> {
    const job = await this.prisma.evaluationJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return null;
    }

    // Return result based on status
    const result: any = {
      id: job.id,
      status: job.status,
      jobTitle: job.jobTitle,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      attempts: job.attempts,
    };

    // If failed, include error
    if (job.status === 'FAILED' && job.error) {
      result.error = job.error;
    }

    // If completed, include full results
    if (job.status === 'COMPLETED') {
      result.cvMatchRate = job.cvMatchRate;
      result.cvFeedback = job.cvFeedback;
      result.cvScores = job.cvScoresJson;
      result.projectScore = job.projectScore;
      result.projectFeedback = job.projectFeedback;
      result.projectScores = job.projectScoresJson;
      result.overallSummary = job.overallSummary;
      result.llmProvider = job.llmProvider;
      result.llmModel = job.llmModel;
      result.tokensUsed = job.tokensUsed;
      result.processingTimeMs = job.processingTimeMs;
    }

    return result;
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: string,
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
    data?: any,
  ): Promise<void> {
    const updateData: any = { status };

    if (status === 'PROCESSING') {
      updateData.startedAt = new Date();
    } else if (status === 'COMPLETED' || status === 'FAILED') {
      updateData.completedAt = new Date();
    }

    if (data) {
      Object.assign(updateData, data);
    }

    await this.prisma.evaluationJob.update({
      where: { id: jobId },
      data: updateData,
    });

    this.logger.log(`Job ${jobId} status updated to: ${status}`);
  }
}

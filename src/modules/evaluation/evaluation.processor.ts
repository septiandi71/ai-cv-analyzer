import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import { PrismaService } from '../../common/prisma.service';
import { UploadService } from '../upload/upload.service';
import { LLMService } from '../llm/llm.service';

interface EvaluationJobData {
  jobId: string;
  jobTitle: string;
  cvFileId: string;
  projectReportFileId: string;
}

@Processor('evaluation')
export class EvaluationProcessor {
  private readonly logger = new Logger(EvaluationProcessor.name);

  constructor(
    private readonly evaluationService: EvaluationService,
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly llmService: LLMService,
  ) {}

  @Process('evaluate-candidate')
  async handleEvaluation(job: Job<EvaluationJobData>): Promise<void> {
    const { jobId, jobTitle, cvFileId, projectReportFileId } = job.data;
    const startTime = Date.now();

    this.logger.log(`Processing evaluation job: ${jobId}`);

    try {
      // Update status to PROCESSING
      await this.evaluationService.updateJobStatus(jobId, 'PROCESSING');
      await this.incrementAttempts(jobId);

      // Get file contents
      const [cvText, projectText] = await Promise.all([
        this.uploadService.getFileText(cvFileId),
        this.uploadService.getFileText(projectReportFileId),
      ]);

      this.logger.log(`Files loaded for job ${jobId}`);

      // TODO: Phase 4 - RAG Integration (retrieve relevant context)
      // For now, we'll use the extracted text directly

      // Step 1: Evaluate CV
      this.logger.log(`Evaluating CV for job ${jobId}...`);
      const cvEvaluation = await this.evaluateCV(cvText, jobTitle);

      // Step 2: Evaluate Project
      this.logger.log(`Evaluating project for job ${jobId}...`);
      const projectEvaluation = await this.evaluateProject(projectText);

      // Step 3: Generate overall summary
      this.logger.log(`Generating overall summary for job ${jobId}...`);
      const overallSummary = await this.generateOverallSummary(
        cvEvaluation,
        projectEvaluation,
        jobTitle,
      );

      // Calculate processing time
      const processingTimeMs = Date.now() - startTime;

      // Save results to database
      await this.evaluationService.updateJobStatus(jobId, 'COMPLETED', {
        cvMatchRate: cvEvaluation.matchRate,
        cvFeedback: cvEvaluation.feedback,
        cvScoresJson: cvEvaluation.scores,
        projectScore: projectEvaluation.score,
        projectFeedback: projectEvaluation.feedback,
        projectScoresJson: projectEvaluation.scores,
        overallSummary: overallSummary.summary,
        llmProvider: overallSummary.provider,
        llmModel: overallSummary.model,
        tokensUsed: overallSummary.tokensUsed,
        processingTimeMs,
      });

      this.logger.log(
        `Evaluation job ${jobId} completed in ${processingTimeMs}ms`,
      );
    } catch (error) {
      this.logger.error(`Error processing job ${jobId}:`, error.stack);

      // Update job status to FAILED
      await this.evaluationService.updateJobStatus(jobId, 'FAILED', {
        error: error.message,
      });

      // Rethrow to let Bull handle retries
      throw error;
    }
  }

  /**
   * Evaluate CV against job description
   */
  private async evaluateCV(
    cvText: string,
    jobTitle: string,
  ): Promise<{
    matchRate: number;
    feedback: string;
    scores: any;
  }> {
    const systemPrompt = `You are an expert technical recruiter evaluating a candidate's CV for a ${jobTitle} position.

Evaluate the CV based on these criteria (score 1-5 for each):
1. Technical Skills Match (weight: 40%) - Backend, databases, APIs, cloud, AI/LLM exposure
2. Experience Level (weight: 25%) - Years of experience and project complexity
3. Relevant Achievements (weight: 20%) - Impact, scale, adoption
4. Cultural Fit (weight: 15%) - Communication, learning attitude, teamwork

Provide your evaluation in this exact JSON format:
{
  "scores": {
    "technical_skills": {"score": X, "weight": 0.4, "feedback": "..."},
    "experience_level": {"score": X, "weight": 0.25, "feedback": "..."},
    "achievements": {"score": X, "weight": 0.2, "feedback": "..."},
    "cultural_fit": {"score": X, "weight": 0.15, "feedback": "..."}
  },
  "overall_feedback": "Overall assessment in 2-3 sentences..."
}`;

    const userPrompt = `CV Content:\n${cvText.substring(0, 4000)}\n\nJob Title: ${jobTitle}`;

    const response = await this.llmService.generateCompletion(
      systemPrompt,
      userPrompt,
      { temperature: 0.7 },
    );

    // Parse LLM response
    const result = this.parseJSONResponse(response.content);

    // Calculate weighted match rate (convert to 0-1 scale)
    const matchRate = this.calculateWeightedScore(result.scores);

    return {
      matchRate,
      feedback: result.overall_feedback,
      scores: result.scores,
    };
  }

  /**
   * Evaluate project report
   */
  private async evaluateProject(projectText: string): Promise<{
    score: number;
    feedback: string;
    scores: any;
  }> {
    const systemPrompt = `You are an expert technical evaluator assessing a project report.

Evaluate the project based on these criteria (score 1-5 for each):
1. Correctness (weight: 30%) - Implements prompt design, LLM chaining, RAG
2. Code Quality (weight: 25%) - Clean, modular, testable
3. Resilience (weight: 20%) - Handles failures, retries, errors
4. Documentation (weight: 15%) - Clear README, explanations
5. Creativity (weight: 10%) - Extra features beyond requirements

Provide your evaluation in this exact JSON format:
{
  "scores": {
    "correctness": {"score": X, "weight": 0.3, "feedback": "..."},
    "code_quality": {"score": X, "weight": 0.25, "feedback": "..."},
    "resilience": {"score": X, "weight": 0.2, "feedback": "..."},
    "documentation": {"score": X, "weight": 0.15, "feedback": "..."},
    "creativity": {"score": X, "weight": 0.1, "feedback": "..."}
  },
  "overall_feedback": "Overall assessment in 2-3 sentences..."
}`;

    const userPrompt = `Project Report:\n${projectText.substring(0, 4000)}`;

    const response = await this.llmService.generateCompletion(
      systemPrompt,
      userPrompt,
      { temperature: 0.7 },
    );

    // Parse LLM response
    const result = this.parseJSONResponse(response.content);

    // Calculate weighted score (1-5 scale)
    const score = this.calculateWeightedScore(result.scores);

    return {
      score,
      feedback: result.overall_feedback,
      scores: result.scores,
    };
  }

  /**
   * Generate overall summary
   */
  private async generateOverallSummary(
    cvEvaluation: any,
    projectEvaluation: any,
    jobTitle: string,
  ): Promise<{
    summary: string;
    provider: string;
    model: string;
    tokensUsed: number;
  }> {
    const systemPrompt = `You are a hiring manager making a final assessment of a candidate for a ${jobTitle} position.

Based on the CV and project evaluation results, provide a concise 3-5 sentence summary that includes:
1. Overall candidate strengths
2. Key gaps or areas for improvement
3. Final recommendation (Strong Fit / Good Fit / Needs Improvement / Not Recommended)`;

    const userPrompt = `CV Match Rate: ${(cvEvaluation.matchRate * 100).toFixed(0)}%
CV Feedback: ${cvEvaluation.feedback}

Project Score: ${projectEvaluation.score.toFixed(1)}/5.0
Project Feedback: ${projectEvaluation.feedback}

Provide your overall summary:`;

    const response = await this.llmService.generateCompletion(
      systemPrompt,
      userPrompt,
      { temperature: 0.8, useProModel: true }, // Use Pro model for final synthesis
    );

    return {
      summary: response.content,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed?.total || 0,
    };
  }

  /**
   * Parse JSON from LLM response
   */
  private parseJSONResponse(content: string): any {
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No JSON found in response');
    } catch (error) {
      this.logger.error('Failed to parse LLM JSON response:', content);
      throw new Error(`Failed to parse LLM response: ${error.message}`);
    }
  }

  /**
   * Calculate weighted score from individual scores
   */
  private calculateWeightedScore(scores: any): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const key in scores) {
      const item = scores[key];
      totalScore += item.score * item.weight;
      totalWeight += item.weight;
    }

    return totalScore / totalWeight;
  }

  /**
   * Increment job attempts counter
   */
  private async incrementAttempts(jobId: string): Promise<void> {
    await this.prisma.evaluationJob.update({
      where: { id: jobId },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });
  }
}

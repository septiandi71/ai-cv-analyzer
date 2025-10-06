import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import { PrismaService } from '../../common/prisma.service';
import { UploadService } from '../upload/upload.service';
import { LLMService } from '../llm/llm.service';
import { RagieService } from '../ragie/ragie.service';

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
    private readonly ragieService: RagieService,
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

      // Phase 4: RAG Integration - Retrieve ground truth context
      this.logger.log(`Retrieving RAG context for job ${jobId}...`);
      const [jobRequirements, cvCriteria, projectRequirements, projectCriteria] = await Promise.all([
        this.ragieService.retrieveJobRequirements(jobTitle).catch(err => {
          this.logger.warn(`Failed to retrieve job requirements: ${err.message}`);
          return null;
        }),
        this.ragieService.retrieveCVScoringCriteria().catch(err => {
          this.logger.warn(`Failed to retrieve CV criteria: ${err.message}`);
          return null;
        }),
        this.ragieService.retrieveProjectRequirements().catch(err => {
          this.logger.warn(`Failed to retrieve project requirements: ${err.message}`);
          return null;
        }),
        this.ragieService.retrieveProjectScoringCriteria().catch(err => {
          this.logger.warn(`Failed to retrieve project criteria: ${err.message}`);
          return null;
        }),
      ]);

      this.logger.log(`RAG context retrieved for job ${jobId}`);

      // OPTIMIZATION: Run CV and Project evaluation in PARALLEL (reduces ~50% time)
      this.logger.log(`Starting parallel evaluation with RAG context for job ${jobId}...`);
      const [cvEvaluation, projectEvaluation] = await Promise.all([
        this.evaluateCV(cvText, jobTitle, jobRequirements, cvCriteria),
        this.evaluateProject(projectText, projectRequirements, projectCriteria),
      ]);

      this.logger.log(`Parallel evaluation completed for job ${jobId}`);

      // Generate overall summary with LLM (more dynamic and accurate)
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
        tokensUsed: cvEvaluation.tokensUsed + projectEvaluation.tokensUsed + overallSummary.tokensUsed,
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
   * Evaluate CV against job description with RAG context
   */
  private async evaluateCV(
    cvText: string,
    jobTitle: string,
    jobRequirements: any,
    cvCriteria: any,
  ): Promise<{
    matchRate: number;
    feedback: string;
    scores: any;
    provider: string;
    model: string;
    tokensUsed: number;
  }> {
    // Build system prompt with RAG context
    let systemPrompt = `You are an expert technical recruiter evaluating a candidate's CV for a ${jobTitle} position.`;

    // Inject job requirements from ground truth if available
    if (jobRequirements?.context) {
      systemPrompt += `\n\n=== JOB REQUIREMENTS (Ground Truth) ===\n${jobRequirements.context.substring(0, 2000)}\n`;
      this.logger.log(`Using RAG job requirements (${jobRequirements.chunks?.length || 0} chunks, score: ${jobRequirements.relevanceScore?.toFixed(2) || 'N/A'})`);
    }

    // Inject CV scoring criteria from rubric if available
    if (cvCriteria?.context) {
      systemPrompt += `\n\n=== EVALUATION CRITERIA (Ground Truth) ===\n${cvCriteria.context.substring(0, 2000)}\n`;
      this.logger.log(`Using RAG CV criteria (${cvCriteria.chunks?.length || 0} chunks, score: ${cvCriteria.relevanceScore?.toFixed(2) || 'N/A'})`);
    } else {
      // Fallback criteria if RAG unavailable
      systemPrompt += `\n\nEvaluate the CV based on these criteria (score 1-5 for each):
1. Technical Skills Match (weight: 40%) - Backend, databases, APIs, cloud, AI/LLM exposure
2. Experience Level (weight: 25%) - Years of experience and project complexity
3. Relevant Achievements (weight: 20%) - Impact, scale, adoption
4. Cultural Fit (weight: 15%) - Communication, learning attitude, teamwork`;
    }

    systemPrompt += `\n\nIMPORTANT: 
- Respond with ONLY valid JSON, no markdown formatting, no explanations, no code blocks
- Keep each feedback to MAX 100 characters
- Keep overall_feedback to MAX 200 characters

Required JSON format:
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
      { temperature: 0.7, maxTokens: 4096 },
    );

    this.logger.debug(`Raw LLM response for CV evaluation (first 500 chars): ${response.content.substring(0, 500)}`);

    // Parse LLM response
    const result = this.parseJSONResponse(response.content);

    // Calculate weighted match rate (convert to 0-1 scale)
    const matchRate = this.calculateWeightedScore(result.scores);

    return {
      matchRate,
      feedback: result.overall_feedback,
      scores: result.scores,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed?.total || 0,
    };
  }

  /**
   * Evaluate project report with RAG context
   */
  private async evaluateProject(
    projectText: string,
    projectRequirements: any,
    projectCriteria: any,
  ): Promise<{
    score: number;
    feedback: string;
    scores: any;
    provider: string;
    model: string;
    tokensUsed: number;
  }> {
    // Build system prompt with RAG context
    let systemPrompt = `You are an expert technical evaluator assessing a project report.`;

    // Inject project requirements from case study brief if available
    if (projectRequirements?.context) {
      systemPrompt += `\n\n=== PROJECT REQUIREMENTS (Ground Truth) ===\n${projectRequirements.context.substring(0, 2000)}\n`;
      this.logger.log(`Using RAG project requirements (${projectRequirements.chunks?.length || 0} chunks, score: ${projectRequirements.relevanceScore?.toFixed(2) || 'N/A'})`);
    }

    // Inject project scoring criteria from rubric if available
    if (projectCriteria?.context) {
      systemPrompt += `\n\n=== EVALUATION CRITERIA (Ground Truth) ===\n${projectCriteria.context.substring(0, 2000)}\n`;
      this.logger.log(`Using RAG project criteria (${projectCriteria.chunks?.length || 0} chunks, score: ${projectCriteria.relevanceScore?.toFixed(2) || 'N/A'})`);
    } else {
      // Fallback criteria if RAG unavailable
      systemPrompt += `\n\nEvaluate the project based on these criteria (score 1-5 for each):
1. Correctness (weight: 30%) - Implements prompt design, LLM chaining, RAG
2. Code Quality (weight: 25%) - Clean, modular, testable
3. Resilience (weight: 20%) - Handles failures, retries, errors
4. Documentation (weight: 15%) - Clear README, explanations
5. Creativity (weight: 10%) - Extra features beyond requirements`;
    }

    systemPrompt += `\n\nIMPORTANT:
- Respond with ONLY valid JSON, no markdown formatting, no explanations, no code blocks
- Keep each feedback to MAX 100 characters
- Keep overall_feedback to MAX 200 characters

Required JSON format:
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
      { temperature: 0.7, maxTokens: 4096 },
    );

    this.logger.debug(`Raw LLM response for Project evaluation (first 500 chars): ${response.content.substring(0, 500)}`);

    // Parse LLM response
    const result = this.parseJSONResponse(response.content);

    // Calculate weighted score (1-5 scale)
    const score = this.calculateWeightedScore(result.scores);

    return {
      score,
      feedback: result.overall_feedback,
      scores: result.scores,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed?.total || 0,
    };
  }

  /**
   * Generate overall summary with LLM (dynamic and personalized)
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
    const systemPrompt = `You are a senior hiring manager making the final assessment of a candidate for a ${jobTitle} position.

Based on the CV and project evaluation results, provide a personalized 3-5 sentence summary that includes:
1. Candidate's strongest qualities and technical capabilities
2. Areas for development or potential concerns
3. Clear final recommendation: "Strongly Recommend", "Recommend", "Consider with Reservations", or "Not Recommended"

Be specific, constructive, and professional. Use data from the evaluations to support your assessment.`;

    const userPrompt = `CV Evaluation Results:
- Match Rate: ${(cvEvaluation.matchRate * 100).toFixed(0)}%
- Feedback: ${cvEvaluation.feedback}
- Technical Skills: ${cvEvaluation.scores.technical_skills?.score}/5
- Experience Level: ${cvEvaluation.scores.experience_level?.score}/5

Project Evaluation Results:
- Overall Score: ${projectEvaluation.score.toFixed(1)}/5.0
- Feedback: ${projectEvaluation.feedback}
- Code Quality: ${projectEvaluation.scores.code_quality?.score}/5
- Correctness: ${projectEvaluation.scores.correctness?.score}/5

Provide your final assessment:`;

    const response = await this.llmService.generateCompletion(
      systemPrompt,
      userPrompt,
      { temperature: 0.8, maxTokens: 2048 },
    );

    return {
      summary: response.content.trim(),
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed?.total || 0,
    };
  }

  /**
   * Synthesize overall summary without LLM call (fallback/alternative method)
   * Used when LLM is unavailable or for quick previews
   */
  private synthesizeOverallSummary(
    cvEvaluation: any,
    projectEvaluation: any,
    jobTitle: string,
  ): string {
    const cvMatchRate = (cvEvaluation.matchRate * 100).toFixed(0);
    const projectScore = projectEvaluation.score.toFixed(1);
    
    // Determine overall recommendation based on scores
    let recommendation: string;
    const avgScore = (cvEvaluation.matchRate * 100 + projectEvaluation.score * 20) / 2;
    
    if (avgScore >= 85) {
      recommendation = "Strong Fit";
    } else if (avgScore >= 70) {
      recommendation = "Good Fit";
    } else if (avgScore >= 60) {
      recommendation = "Needs Improvement";
    } else {
      recommendation = "Not Recommended";
    }

    // Build summary from evaluation feedback
    const summary = `Candidate for ${jobTitle}: CV shows ${cvMatchRate}% match with ${cvEvaluation.feedback} ` +
      `Project demonstrates ${projectScore}/5.0 score with ${projectEvaluation.feedback} ` +
      `Overall Assessment: ${recommendation}.`;

    return summary;
  }

  /**
   * Parse JSON from LLM response (handles markdown code blocks)
   */
  private parseJSONResponse(content: string): any {
    try {
      // Remove markdown code blocks if present (```json ... ``` or ``` ... ```)
      let cleanedContent = content
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      // Try to find JSON object in the response
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        this.logger.debug(`Attempting to parse JSON: ${jsonStr.substring(0, 200)}...`);
        return JSON.parse(jsonStr);
      }

      // If no JSON found, log the full content for debugging
      this.logger.error('No JSON found in LLM response. Full content:', content.substring(0, 500));
      throw new Error('No JSON found in response');
    } catch (error) {
      this.logger.error('Failed to parse LLM JSON response:', {
        error: error.message,
        contentPreview: content.substring(0, 500),
      });
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

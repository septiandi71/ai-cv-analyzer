import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ragie } from 'ragie';

export interface RagRetrievalResult {
  context: string;
  chunks: Array<{
    text: string;
    score: number;
    metadata?: any;
  }>;
  relevanceScore: number;
  retrievalTimeMs: number;
}

interface RetrievalConfig {
  query: string;
  filterType: 'job_description' | 'case_study_brief' | 'scoring_rubric';
  logMessage: string;
  warningMessage: string;
}

@Injectable()
export class RagieService {
  private readonly logger = new Logger(RagieService.name);
  private client: Ragie;
  private readonly topK: number = 5;
  private readonly minScore: number = 0.1; // Ragie uses semantic similarity (0.1-0.2 is normal)

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get('ragie.apiKey');
    
    if (!apiKey) {
      this.logger.warn('⚠️  Ragie API key not configured. RAG features will be disabled.');
      return;
    }

    this.client = new Ragie({ auth: apiKey });
    this.logger.log('✅ Ragie client initialized');
  }

  /**
   * Check if Ragie is configured and available
   */
  isAvailable(): boolean {
    return !!this.client;
  }

  /**
   * Generic retrieval method to eliminate code duplication
   * @private
   */
  private async retrieve(config: RetrievalConfig): Promise<RagRetrievalResult> {
    const startTime = Date.now();

    try {
      if (!this.isAvailable()) {
        this.logger.warn('Ragie not available, returning empty context');
        return this.emptyResult();
      }

      this.logger.log(config.logMessage);

      const response = await this.client.retrievals.retrieve({
        query: config.query,
        topK: this.topK,
        filter: {
          type: config.filterType,
        },
      });

      const chunks = response.scoredChunks || [];
      const relevantChunks = chunks.filter(chunk => chunk.score >= this.minScore);

      if (relevantChunks.length === 0) {
        this.logger.warn(config.warningMessage);
        return this.emptyResult();
      }

      const context = relevantChunks
        .map(chunk => chunk.text)
        .join('\n\n');

      const avgScore = relevantChunks.reduce((sum, c) => sum + c.score, 0) / relevantChunks.length;
      const retrievalTimeMs = Date.now() - startTime;

      this.logger.log(`Retrieved ${relevantChunks.length} chunks in ${retrievalTimeMs}ms (avg score: ${avgScore.toFixed(2)})`);

      return {
        context,
        chunks: relevantChunks.map(c => ({
          text: c.text,
          score: c.score,
          metadata: c.metadata,
        })),
        relevanceScore: avgScore,
        retrievalTimeMs,
      };
    } catch (error) {
      this.logger.error(`Error during retrieval: ${error.message}`);
      return this.emptyResult();
    }
  }

  /**
   * Retrieve job requirements context for CV evaluation
   */
  async retrieveJobRequirements(jobTitle: string): Promise<RagRetrievalResult> {
    return this.retrieve({
      query: `${jobTitle} job description technical requirements responsibilities qualifications`,
      filterType: 'job_description',
      logMessage: `Retrieving job requirements for: ${jobTitle}`,
      warningMessage: `No relevant job requirements found for: ${jobTitle}`,
    });
  }

  /**
   * Retrieve CV scoring criteria from rubric
   */
  async retrieveCVScoringCriteria(): Promise<RagRetrievalResult> {
    return this.retrieve({
      query: 'CV evaluation criteria technical skills experience achievements cultural fit scoring rubric weights',
      filterType: 'scoring_rubric',
      logMessage: 'Retrieving CV scoring criteria from rubric',
      warningMessage: 'No CV scoring criteria found in rubric',
    });
  }

  /**
   * Retrieve project requirements from case study brief
   */
  async retrieveProjectRequirements(): Promise<RagRetrievalResult> {
    return this.retrieve({
      query: 'AI CV Analyzer case study project requirements technical specifications deliverables features backend LLM RAG',
      filterType: 'case_study_brief',
      logMessage: 'Retrieving project requirements from case study brief',
      warningMessage: 'No project requirements found in case study',
    });
  }

  /**
   * Retrieve project scoring criteria from rubric
   */
  async retrieveProjectScoringCriteria(): Promise<RagRetrievalResult> {
    return this.retrieve({
      query: 'Project evaluation criteria correctness code quality resilience documentation creativity scoring rubric weights',
      filterType: 'scoring_rubric',
      logMessage: 'Retrieving project scoring criteria from rubric',
      warningMessage: 'No project scoring criteria found in rubric',
    });
  }

  /**
   * Return empty result when RAG is unavailable or no results found
   */
  private emptyResult(): RagRetrievalResult {
    return {
      context: '',
      chunks: [],
      relevanceScore: 0,
      retrievalTimeMs: 0,
    };
  }

  /**
   * Upload a document to Ragie for indexing
   * Note: In practice, use Ragie CLI or Dashboard for initial document upload
   */
  async uploadDocument(
    fileContent: Buffer,
    fileName: string,
    metadata: {
      type: 'job_description' | 'case_study_brief' | 'scoring_rubric';
      [key: string]: any;
    },
  ): Promise<string> {
    try {
      if (!this.isAvailable()) {
        throw new Error('Ragie client not initialized');
      }

      this.logger.log(`Uploading document: ${fileName}`);

      // Convert Buffer to Blob-like object for Ragie SDK
      // File constructor expects BlobPart (Uint8Array, ArrayBuffer, or Blob)
      const uint8Array = new Uint8Array(fileContent);
      const file = new File([uint8Array], fileName, { type: 'application/pdf' });

      const response = await this.client.documents.create({
        file: file,
        metadata: metadata as any,
        mode: 'hi_res', // Valid modes: 'hi_res' (accurate) or 'fast'
      });

      this.logger.log(`Document uploaded successfully: ${response.id}`);
      return response.id;
    } catch (error) {
      this.logger.error(`Error uploading document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Index a document from a file path (alias for uploadDocument for script usage)
   */
  async indexDocument(
    filePath: string,
    metadata: {
      type: 'job_description' | 'case_study_brief' | 'scoring_rubric';
      [key: string]: any;
    },
  ): Promise<string> {
    const fs = await import('fs');
    const path = await import('path');
    
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    return this.uploadDocument(fileContent, fileName, metadata);
  }

  /**
   * Get document status by ID
   */
  async getDocumentStatus(documentId: string): Promise<any> {
    try {
      if (!this.isAvailable()) {
        throw new Error('Ragie client not initialized');
      }

      const response = await this.client.documents.get({ documentId });
      return response;
    } catch (error) {
      this.logger.error(`Error getting document status: ${error.message}`);
      throw error;
    }
  }

  /**
   * List all indexed documents
   */
  async listDocuments(): Promise<any[]> {
    try {
      if (!this.isAvailable()) {
        return [];
      }

      const response = await this.client.documents.list();
      
      // Response is paginated, extract the documents array
      const documents = (response as any).documents || [];
      return documents;
    } catch (error) {
      this.logger.error(`Error listing documents: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete a document by ID
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      if (!this.isAvailable()) {
        throw new Error('Ragie client not initialized');
      }

      await (this.client.documents.delete as any)(documentId);
      this.logger.log(`Document deleted: ${documentId}`);
    } catch (error) {
      this.logger.error(`Error deleting document: ${error.message}`);
      throw error;
    }
  }
}

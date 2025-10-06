#!/usr/bin/env ts-node

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RagieService } from '../src/modules/ragie/ragie.service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script to index ground truth documents to Ragie
 * 
 * Usage: npm run index-documents
 * 
 * Documents to be indexed:
 * 1. Backend Qualification.pdf (job_description)
 * 2. Case Study Brief.pdf (case_study_brief)
 * 3. Scoring Rubric.pdf (scoring_rubric)
 */

interface DocumentConfig {
  filename: string;
  type: 'job_description' | 'case_study_brief' | 'scoring_rubric';
  metadata: Record<string, any>;
}

const documentsToIndex: DocumentConfig[] = [
  {
    filename: 'Backend Qualification.pdf',
    type: 'job_description',
    metadata: {
      type: 'job_description',
      role: 'Backend Developer',
      version: '1.0',
      description: 'Technical requirements and responsibilities for Backend Developer position',
    },
  },
  {
    filename: 'Case Study Brief.pdf',
    type: 'case_study_brief',
    metadata: {
      type: 'case_study_brief',
      project: 'AI CV Analyzer',
      version: '1.0',
      description: 'Project requirements and specifications for AI CV Analyzer case study',
    },
  },
  {
    filename: 'Scoring Rubric.pdf',
    type: 'scoring_rubric',
    metadata: {
      type: 'scoring_rubric',
      applies_to: 'both',
      version: '1.0',
      description: 'Evaluation criteria for CV and Project assessment',
    },
  },
];

async function indexDocuments() {
  console.log('🚀 Starting Ragie document indexing...\n');

  // Bootstrap NestJS app to get services
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const ragieService = app.get(RagieService);

  if (!ragieService.isAvailable()) {
    console.error('❌ Ragie service is not available. Please check RAGIE_API_KEY in .env');
    await app.close();
    process.exit(1);
  }

  const testDataDir = path.join(__dirname, '..', 'test-data');

  console.log(`📁 Test data directory: ${testDataDir}\n`);

  // Check if test-data directory exists
  if (!fs.existsSync(testDataDir)) {
    console.error(`❌ Test data directory not found: ${testDataDir}`);
    await app.close();
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  for (const doc of documentsToIndex) {
    const filePath = path.join(testDataDir, doc.filename);

    console.log(`📄 Processing: ${doc.filename}`);
    console.log(`   Type: ${doc.type}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`   ❌ File not found: ${filePath}\n`);
      failCount++;
      continue;
    }

    try {
      // Read file
      const fileBuffer = fs.readFileSync(filePath);
      const fileSizeKB = (fileBuffer.length / 1024).toFixed(2);
      console.log(`   Size: ${fileSizeKB} KB`);

      // Upload to Ragie
      console.log(`   ⏳ Uploading to Ragie...`);
      const documentId = await ragieService.uploadDocument(
        fileBuffer,
        doc.filename,
        doc.metadata as any,
      );

      console.log(`   ✅ Successfully indexed with ID: ${documentId}\n`);
      successCount++;
    } catch (error) {
      console.error(`   ❌ Error indexing document: ${error.message}\n`);
      failCount++;
    }
  }

  // Summary
  console.log('═══════════════════════════════════════════════');
  console.log(`✅ Successfully indexed: ${successCount} documents`);
  console.log(`❌ Failed: ${failCount} documents`);
  console.log('═══════════════════════════════════════════════\n');

  // List all indexed documents
  if (successCount > 0) {
    console.log('📋 Listing all indexed documents:\n');
    try {
      const documents = await ragieService.listDocuments();
      console.log(`Total documents in Ragie: ${documents.length}\n`);

      if (documents.length > 0) {
        documents.forEach((doc: any, index: number) => {
          console.log(`${index + 1}. ${doc.name || 'Unnamed'}`);
          console.log(`   ID: ${doc.id}`);
          console.log(`   Status: ${doc.status || 'N/A'}`);
          console.log(`   Metadata: ${JSON.stringify(doc.metadata || {})}\n`);
        });
      }
    } catch (error) {
      console.error(`Error listing documents: ${error.message}`);
    }
  }

  console.log('✅ Indexing script completed!');
  console.log('💡 Tip: You can now test RAG retrieval with evaluation endpoints.\n');

  await app.close();
  process.exit(successCount > 0 ? 0 : 1);
}

// Run the script
indexDocuments().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

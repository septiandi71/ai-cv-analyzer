#!/usr/bin/env ts-node

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RagieService } from '../src/modules/ragie/ragie.service';

/**
 * Script to check status of specific documents in Ragie
 * 
 * Usage: npm run check-docs-status
 */

// Document IDs from the upload
const DOCUMENT_IDS = {
  'Backend Qualification.pdf': '0e3f40a4-d312-4bcc-aa4b-770fd188b2ec',
  'Case Study Brief.pdf': '9750a37c-c987-4d70-84fd-97234867907a',
  'Scoring Rubric.pdf': '27383d1b-697a-4a55-866d-505e47558dc7',
};

async function checkDocumentStatus() {
  console.log('🔍 Checking ground truth documents status in Ragie...\n');

  // Bootstrap NestJS app to get services
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const ragieService = app.get(RagieService);

  if (!ragieService.isAvailable()) {
    console.error('❌ Ragie service is not available. Please check RAGIE_API_KEY in .env');
    await app.close();
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════════════');

  const statusCounts: Record<string, number> = {};

  for (const [filename, documentId] of Object.entries(DOCUMENT_IDS)) {
    try {
      console.log(`\n📄 ${filename}`);
      console.log(`   ID: ${documentId}`);
      
      const doc = await ragieService.getDocumentStatus(documentId);
      
      const status = doc.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      const statusEmoji = getStatusEmoji(status);
      console.log(`   Status: ${statusEmoji} ${status.toUpperCase()}`);
      
      if (doc.metadata?.type) {
        console.log(`   Type: ${doc.metadata.type}`);
      }
      
      if (doc.createdAt) {
        console.log(`   Created: ${new Date(doc.createdAt).toLocaleString()}`);
      }
      
      // Show progress or recommendations
      if (status === 'refining' || status === 'processing') {
        console.log(`   ⏳ Still processing... This usually takes 2-5 minutes.`);
      } else if (status === 'ready') {
        console.log(`   ✅ Ready for RAG retrieval!`);
      } else if (status === 'error' || status === 'failed') {
        console.log(`   ❌ Processing failed. May need to re-upload.`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      statusCounts['error'] = (statusCounts['error'] || 0) + 1;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  
  // Summary
  console.log('\n📊 Status Summary:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    const emoji = getStatusEmoji(status);
    console.log(`   ${emoji} ${status.toUpperCase()}: ${count} document(s)`);
  });

  const readyCount = statusCounts['ready'] || 0;
  const totalCount = Object.keys(DOCUMENT_IDS).length;

  if (readyCount === totalCount) {
    console.log('\n🎉 All documents are READY! You can now proceed with RAG integration.');
    console.log('💡 Next step: Integrate RAG retrieval into evaluation processor.');
  } else if (readyCount > 0) {
    console.log(`\n⏳ ${totalCount - readyCount} document(s) still processing.`);
    console.log('💡 Wait a few minutes and run this script again: npm run check-docs-status');
  } else {
    console.log('\n⏳ All documents are still processing.');
    console.log('💡 This is normal for hi_res mode. Wait 2-5 minutes and check again.');
  }

  console.log('\n📖 About Processing Modes:');
  console.log('   • hi_res (used): High quality extraction, takes 2-5 minutes per document');
  console.log('   • fast: Quick processing but lower accuracy');
  console.log('   ✅ We use hi_res for better RAG quality!\n');

  await app.close();
}

function getStatusEmoji(status: string): string {
  switch (status.toLowerCase()) {
    case 'ready':
      return '✅';
    case 'refining':
    case 'processing':
    case 'partitioned':
      return '⏳';
    case 'error':
    case 'failed':
      return '❌';
    default:
      return '❓';
  }
}

// Run the script
checkDocumentStatus().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

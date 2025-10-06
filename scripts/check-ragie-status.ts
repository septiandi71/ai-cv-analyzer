#!/usr/bin/env ts-node

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RagieService } from '../src/modules/ragie/ragie.service';

/**
 * Script to check status of documents in Ragie
 * 
 * Usage: npm run check-ragie-status
 */

async function checkRagieStatus() {
  console.log('🔍 Checking Ragie document status...\n');

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

  try {
    // List all documents
    const documents = await ragieService.listDocuments();
    
    if (!documents || documents.length === 0) {
      console.log('📭 No documents found in Ragie.\n');
      await app.close();
      return;
    }

    console.log(`📚 Found ${documents.length} document(s) in Ragie:\n`);
    console.log('═══════════════════════════════════════════════════════════════════════');

    for (const doc of documents) {
      const status = doc.status || 'unknown';
      const statusEmoji = getStatusEmoji(status);
      
      console.log(`\n${statusEmoji} ${doc.name || 'Unnamed Document'}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Status: ${status.toUpperCase()}`);
      console.log(`   Type: ${doc.metadata?.type || 'N/A'}`);
      console.log(`   Created: ${doc.createdAt ? new Date(doc.createdAt).toLocaleString() : 'N/A'}`);
      
      if (doc.metadata) {
        const { type, ...otherMetadata } = doc.metadata;
        if (Object.keys(otherMetadata).length > 0) {
          console.log(`   Metadata: ${JSON.stringify(otherMetadata)}`);
        }
      }

      // Show progress or error info if available
      if (status === 'refining' || status === 'processing') {
        console.log(`   ⏳ Document is still being processed. This may take a few minutes.`);
      } else if (status === 'ready') {
        console.log(`   ✅ Document is ready for retrieval!`);
      } else if (status === 'error' || status === 'failed') {
        console.log(`   ❌ Processing failed. You may need to re-upload this document.`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    
    // Summary
    const statusCounts = documents.reduce((acc, doc) => {
      const status = doc.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\n📊 Status Summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      const emoji = getStatusEmoji(status);
      console.log(`   ${emoji} ${status.toUpperCase()}: ${count}`);
    });

    const readyCount = statusCounts['ready'] || 0;
    const totalCount = documents.length;

    if (readyCount === totalCount) {
      console.log('\n🎉 All documents are ready for RAG retrieval!');
    } else if (readyCount > 0) {
      console.log(`\n⏳ ${totalCount - readyCount} document(s) still processing. Please wait a few minutes.`);
    } else {
      console.log('\n⏳ All documents are still processing. Please wait a few minutes and check again.');
    }

    console.log('\n💡 Tip: Documents in "refining" status may take 2-5 minutes to complete.');
    console.log('💡 Once all documents are "ready", you can use them in evaluation endpoints.\n');

  } catch (error) {
    console.error(`\n❌ Error checking documents: ${error.message}`);
  }

  await app.close();
}

function getStatusEmoji(status: string): string {
  switch (status.toLowerCase()) {
    case 'ready':
      return '✅';
    case 'refining':
    case 'processing':
      return '⏳';
    case 'error':
    case 'failed':
      return '❌';
    default:
      return '❓';
  }
}

// Run the script
checkRagieStatus().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

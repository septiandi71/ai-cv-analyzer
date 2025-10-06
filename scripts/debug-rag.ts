#!/usr/bin/env ts-node

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RagieService } from '../src/modules/ragie/ragie.service';

/**
 * Debug script to test RAG retrieval and see actual chunks
 * 
 * Usage: npm run debug-rag
 */

async function debugRagRetrieval() {
  console.log('🔍 Debugging RAG Retrieval...\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const ragieService = app.get(RagieService);

  if (!ragieService.isAvailable()) {
    console.error('❌ Ragie service is not available');
    await app.close();
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Test 1: Retrieve job requirements
  console.log('📋 Test 1: Retrieve Job Requirements');
  console.log('Query: "Backend Developer job description technical requirements"');
  console.log('Filter: type = "job_description"');
  console.log('');

  try {
    const jobReqs = await ragieService.retrieveJobRequirements('Backend Developer');
    console.log(`✅ Retrieved ${jobReqs.chunks?.length || 0} chunks`);
    console.log(`   Relevance Score: ${jobReqs.relevanceScore?.toFixed(2) || 'N/A'}`);
    console.log(`   Time: ${jobReqs.retrievalTimeMs}ms`);
    
    if (jobReqs.chunks && jobReqs.chunks.length > 0) {
      console.log('\n   📄 Top Chunk:');
      console.log(`   Score: ${jobReqs.chunks[0].score.toFixed(2)}`);
      console.log(`   Text: ${jobReqs.chunks[0].text.substring(0, 200)}...`);
      console.log(`   Metadata: ${JSON.stringify(jobReqs.chunks[0].metadata)}`);
    } else {
      console.log('   ⚠️  No chunks found!');
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════\n');

  // Test 2: Retrieve CV criteria
  console.log('📋 Test 2: Retrieve CV Scoring Criteria');
  console.log('Query: "CV evaluation criteria scoring rubric"');
  console.log('Filter: type = "scoring_rubric"');
  console.log('');

  try {
    const cvCriteria = await ragieService.retrieveCVScoringCriteria();
    console.log(`✅ Retrieved ${cvCriteria.chunks?.length || 0} chunks`);
    console.log(`   Relevance Score: ${cvCriteria.relevanceScore?.toFixed(2) || 'N/A'}`);
    console.log(`   Time: ${cvCriteria.retrievalTimeMs}ms`);
    
    if (cvCriteria.chunks && cvCriteria.chunks.length > 0) {
      console.log('\n   📄 Top Chunk:');
      console.log(`   Score: ${cvCriteria.chunks[0].score.toFixed(2)}`);
      console.log(`   Text: ${cvCriteria.chunks[0].text.substring(0, 200)}...`);
      console.log(`   Metadata: ${JSON.stringify(cvCriteria.chunks[0].metadata)}`);
    } else {
      console.log('   ⚠️  No chunks found!');
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════\n');

  // Test 3: Raw retrieval WITHOUT filter to see all chunks
  console.log('📋 Test 3: Raw Retrieval (No Filter)');
  console.log('Query: "Backend Developer requirements"');
  console.log('Filter: NONE (to see what exists)');
  console.log('');

  try {
    const response = await (ragieService as any).client.retrievals.retrieve({
      query: 'Backend Developer technical requirements responsibilities',
      topK: 10,
      // NO FILTER - see all results
    });

    const chunks = response.scoredChunks || [];
    console.log(`✅ Retrieved ${chunks.length} total chunks (unfiltered)`);
    
    if (chunks.length > 0) {
      console.log('\n   📊 All Chunks:');
      chunks.forEach((chunk: any, index: number) => {
        console.log(`\n   ${index + 1}. Score: ${chunk.score.toFixed(3)}`);
        console.log(`      Document: ${chunk.documentName || 'Unknown'}`);
        console.log(`      Metadata: ${JSON.stringify(chunk.metadata || {})}`);
        console.log(`      Text: ${chunk.text.substring(0, 150)}...`);
      });
    } else {
      console.log('   ⚠️  No chunks found at all! Documents may not be indexed properly.');
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════\n');

  // Test 4: Check minScore threshold
  console.log('📋 Test 4: Threshold Analysis');
  console.log('Current minScore: 0.7');
  console.log('');

  try {
    const response = await (ragieService as any).client.retrievals.retrieve({
      query: 'Backend Developer requirements technical skills',
      topK: 10,
      filter: { type: 'job_description' },
    });

    const chunks = response.scoredChunks || [];
    console.log(`Total chunks with filter: ${chunks.length}`);
    
    if (chunks.length > 0) {
      const scores = chunks.map((c: any) => c.score);
      const maxScore = Math.max(...scores);
      const minScoreVal = Math.min(...scores);
      const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
      
      console.log(`   Max Score: ${maxScore.toFixed(3)}`);
      console.log(`   Min Score: ${minScoreVal.toFixed(3)}`);
      console.log(`   Avg Score: ${avgScore.toFixed(3)}`);
      console.log(`   Chunks >= 0.7: ${chunks.filter((c: any) => c.score >= 0.7).length}`);
      console.log(`   Chunks >= 0.6: ${chunks.filter((c: any) => c.score >= 0.6).length}`);
      console.log(`   Chunks >= 0.5: ${chunks.filter((c: any) => c.score >= 0.5).length}`);
      
      if (maxScore < 0.7) {
        console.log('\n   ⚠️  WARNING: No chunks meet 0.7 threshold!');
        console.log('   💡 Recommendation: Lower minScore to 0.5 or 0.6');
      }
    } else {
      console.log('   ⚠️  No chunks found with this filter!');
      console.log('   💡 Recommendation: Check metadata filter values');
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('\n💡 Recommendations:');
  console.log('1. Check if metadata "type" field matches filter values');
  console.log('2. Consider lowering minScore if chunks score < 0.7');
  console.log('3. Verify documents are properly indexed with correct metadata');
  console.log('4. Try broader query terms if specific queries return nothing');
  console.log('\n');

  await app.close();
}

// Run the script
debugRagRetrieval().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

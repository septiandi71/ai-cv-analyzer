# AI CV Analyzer - Backend

Automated CV and Project Report evaluation system using AI/LLM and RAG (Retrieval-Augmented Generation).

---

## �� Quick Start Guide

### Prerequisites
- Node.js >= 18
- PostgreSQL (via Supabase)
- Redis
- Gemini API Key
- Ragie API Key (optional, has fallback)

### Installation

```bash
# 1. Clone repository
git clone https://github.com/septiandi71/ai-cv-analyzer.git
cd ai-cv-analyzer

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your credentials

# 4. Run database migrations
npx prisma migrate dev

# 5. Start Redis (macOS)
brew services start redis

# 6. Start development server
npm run start:dev
```

Server will be running at: `http://localhost:3000`

### Testing with Postman

1. Import collection from `postman/postman-collection.json`
2. Import environment from `postman/postman-environment-dev.json`
3. Set your `API_KEY` in environment variables
4. Follow the testing flow:
   - Upload CV
   - Upload Project Report
   - Start Evaluation
   - Poll Result (wait ~20-30s)

Sample test files available in `test-data/` folder.

---

## 📚 Tech Stack

- **Framework:** NestJS + TypeScript
- **Database:** PostgreSQL (Supabase) + Prisma ORM
- **Queue:** Bull + Redis
- **LLM:** Google Gemini 2.5 Flash (primary), Gemini 2.0 Flash (backup)
- **RAG:** Ragie (RAG-as-a-Service)
- **PDF Parsing:** pdf2json
- **File Upload:** Multer
- **API Docs:** Swagger/OpenAPI

---

## 🎯 Design Choices & Architecture

### System Architecture

![System Architecture](https://i.imgur.com/xaYgJyo.png)

**Architecture Overview:**

The system follows a **queue-based asynchronous pattern** with 6 main layers:

1. **Client Layer** - Postman/Frontend applications
2. **API Gateway** - NestJS REST API with authentication
3. **Service Layer** - Upload, Evaluation, PDF parsing services
4. **Queue Layer** - Bull + Redis for async job processing
5. **AI/ML Layer** - Gemini LLM and Ragie RAG services
6. **Data Layer** - PostgreSQL (Supabase) with Prisma ORM

**Flow:**
- ① Client uploads files → Stored in database
- ② Client starts evaluation → Job added to queue
- ③ Worker picks job → Calls LLM + RAG → Saves results
- ④ Client polls for results → Returns when completed

### Key Design Decisions

#### 1. **Why NestJS?**
- **Enterprise-ready:** Built-in dependency injection, modular architecture
- **TypeScript-first:** Type safety reduces runtime errors
- **Rich ecosystem:** Swagger, Prisma, Bull integrations work seamlessly
- **Scalable:** Easy to add new modules (e.g., authentication, analytics)

#### 2. **Why Bull Queue + Redis?**
**Problem:** LLM evaluation takes 20-30 seconds, too slow for synchronous API.

**Solution:** Job queue pattern
- Client gets immediate response with `job_id`
- Background worker processes evaluation
- Client polls `/result/:jobId` for status

**Benefits:**
- Non-blocking API (better UX)
- Automatic retries on failure (3 attempts with exponential backoff)
- Horizontal scaling (can add more workers)

#### 3. **Why Google Gemini Flash?**
Compared to alternatives (GPT-4o-mini, Claude Haiku):

| Feature | Gemini 2.5 Flash | GPT-4o-mini | Claude 3.5 Haiku |
|---------|------------------|-------------|------------------|
| **Cost** | $0.075/1M tokens | $0.15/1M | $0.25/1M |
| **Speed** | ~2-3s | ~3-4s | ~2-3s |
| **Context** | 1M tokens | 128k | 200k |
| **JSON Mode** | ✅ Native | ✅ Native | ⚠️ Prompt eng. |

**Winner:** Gemini Flash = 2x cheaper, 8x larger context, native JSON output.

#### 4. **Why RAG (Retrieval-Augmented Generation)?**
**Problem:** Generic LLM evaluation is too broad and subjective.

**Solution:** Ground evaluation with real job requirements
- Upload job descriptions to Ragie
- Retrieve relevant context during evaluation
- LLM scores based on actual requirements, not assumptions

**Fallback:** If RAG unavailable, use hardcoded criteria (system stays functional).

#### 5. **Why Temperature 0.0?**
**Requirement:** Consistent scoring (same CV should get same score every time).

**Evolution:**
- Started with 0.7 → High variance (scores changed 0.5-1.0 points)
- Tried 0.1 → Better but not perfect
- **Final: 0.0** → Perfect consistency after prompt simplification

**Result:** 
```json
Run 1: { matchRate: 4.25, technical_skills: 4, experience: 5 }
Run 2: { matchRate: 4.25, technical_skills: 4, experience: 5 }
Run 3: { matchRate: 4.25, technical_skills: 4, experience: 5 }
```
✅ Zero variance = fair evaluation.

#### 6. **Database Schema Design**

![Database Schema](https://i.imgur.com/dzKeo50.png)

**Two main tables:**
- `uploaded_files` - Stores PDFs with extracted text (avoid re-parsing)
- `evaluation_jobs` - Stores results, metadata, and job status

**Key design patterns:**
- **Snake_case columns** - PostgreSQL convention
- **JSON fields** - Flexible storage for detailed scoring breakdown
- **Foreign keys with cascade delete** - Data integrity
- **Timestamps** - Track job lifecycle (created → started → completed)
- **Error tracking** - Store error messages and retry attempts

**Entity Relationship:**
- One-to-many: One `uploaded_file` can be used in multiple `evaluation_jobs`
- Foreign keys: `cv_file_id` and `project_report_file_id` link to `uploaded_files.id`

#### 7. **API Design Pattern**

**RESTful with polling:**
```
POST /upload         → Returns { cvFileId, projectFileId }
POST /evaluate       → Returns { jobId, status: 'QUEUED' }
GET  /result/:jobId  → Returns { status, results } (poll until COMPLETED)
```

**Why not WebSocket?** 
- Simpler to implement and test
- Good enough for MVP (polling every 2-3 seconds)
- Future improvement: Add WebSocket for real-time updates

#### 8. **Error Handling Strategy**

**Multi-layer resilience:**
1. **LLM Fallback:** Primary (2.5 Flash) → Backup (2.0 Flash)
2. **Queue Retry:** 3 attempts with exponential backoff (5s, 10s, 20s)
3. **RAG Fallback:** Use hardcoded criteria if Ragie unavailable
4. **Graceful Degradation:** System stays functional even if components fail

#### 9. **PDF Processing**

**Library:** pdf2json (not pdf-parse)
- **Why:** Better handling of complex PDFs with tables/images
- **Process:** Extract text → Clean null bytes → Store in database
- **Optimization:** Parse once, reuse for multiple evaluations

---

## 📖 Additional Documentation

- `postman/README.md` - Postman collection usage guide
- `CLEANUP_REPORT.md` - Recent code optimization details
- `docs/` - Technical documentation folder

---

## 📄 License

This project is for educational purposes as part of a technical assessment.

---

**Built with ❤️ using NestJS and Google Gemini**

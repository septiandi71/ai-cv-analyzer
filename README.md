# AI CV Analyzer Backend

Backend service untuk automated CV dan project report screening menggunakan AI/RAG technology.

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- PostgreSQL (via Supabase)
- Redis
- npm atau yarn

### Installation

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env dengan credentials Anda

# Run database migrations
npx prisma migrate dev

# Start Redis
brew services start redis

# Start development server
npm run start:dev
```

Server akan running di: `http://localhost:3000`

## 📚 API Documentation

Interactive API documentation tersedia di:
- **Swagger UI**: http://localhost:3000/api

## 🧪 Testing dengan Postman

Postman Collection sudah tersedia untuk testing API:

### Import Collection
1. Buka Postman
2. Import files dari folder `postman/`:
   - `AI-CV-Analyzer.postman_collection.json`
   - `AI-CV-Analyzer-Local.postman_environment.json`
3. Pilih environment "AI CV Analyzer - Local"
4. Ikuti testing flow di `postman/README.md`

### Testing Flow
1. Upload CV File → Get file ID
2. Upload Project Report → Get file ID  
3. Start Evaluation → Get job ID
4. Poll Get Result → Check status & results

Dokumentasi lengkap: [postman/README.md](./postman/README.md)

## 📁 Test Data

Sample files untuk testing tersedia di folder `test-data/`:
- `CV Devin 250825.pdf` - Sample CV
- `project-report.pdf` - Sample project report

## 🏗️ Tech Stack

- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Queue**: Bull + Redis
- **LLM**: Gemini 1.5 Flash (primary), OpenRouter (backup)
- **RAG**: Ragie
- **File Processing**: Multer + pdf-parse

## 📖 Documentation

Dokumentasi lengkap tersedia di folder `docs/`:
- [DTO Explained](./docs/DTO_EXPLAINED.md) - Penjelasan DTO concepts
- [API Property Visual](./docs/API_PROPERTY_VISUAL.md) - Visual guide @ApiProperty
- [Evaluation Module](./docs/EVALUATION_MODULE_EXPLAINED.md) - Architecture evaluation module


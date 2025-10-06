# Postman Collection - AI CV Analyzer API

Collection ini berisi semua endpoint untuk testing AI CV Analyzer API dengan **upload CV & Project Report dalam satu request**.

## 📦 Import ke Postman

### Method 1: Import File
1. Buka Postman
2. Klik **Import** di kiri atas
3. Drag & drop atau pilih file:
   - `AI-CV-Analyzer.postman_collection.json`
   - `AI-CV-Analyzer-Local.postman_environment.json`
4. Klik **Import**

### Method 2: Import dari Folder
1. Buka Postman
2. Klik **Import** → **Folder**
3. Pilih folder `postman/`
4. Semua file akan ter-import

## 🔧 Setup Environment

1. Setelah import, pilih environment **"AI CV Analyzer - Local"** di dropdown kanan atas
2. Environment variables yang tersedia:
   - `baseUrl` - Base URL API (default: http://localhost:3000)
   - `cvFileId` - Auto-saved setelah upload
   - `projectReportFileId` - Auto-saved setelah upload  
   - `evaluationJobId` - Auto-saved setelah start evaluation

## 🚀 Testing Flow

### Step 1: Upload CV & Project Report (Sekaligus)

#### 1. Upload CV & Project Report
- **Endpoint**: `POST /upload`
- **Body**: Form-data dengan 2 files (cv dan project_report)
- **Response**: Kedua file IDs akan otomatis tersimpan ke environment variables

**⚠️ PENTING: Update file paths di Body tab!**

Di Postman, buka request **"1. Upload CV & Project Report"**:
1. Go to **Body** tab
2. Klik **"Select Files"** untuk kedua field:
   - `cv`: Browse dan pilih file CV Anda (PDF)
   - `project_report`: Browse dan pilih file project report Anda (PDF)

Default paths (ganti dengan path Anda):
```
cv: /Users/pindepin/Documents/pin/ai-cv-analyzer/test-data/CV Devin 250825.pdf
project_report: /Users/pindepin/Documents/pin/ai-cv-analyzer/test-data/project-report.pdf
```

**Response:**
```json
{
  "uploadedFiles": [
    {
      "id": "uuid-cv",
      "originalFilename": "CV.pdf",
      "fileType": "CV",
      "fileSize": 123456,
      "mimeType": "application/pdf"
    },
    {
      "id": "uuid-project",
      "originalFilename": "project-report.pdf",
      "fileType": "PROJECT_REPORT",
      "fileSize": 234567,
      "mimeType": "application/pdf"
    }
  ],
  "message": "2 file(s) uploaded successfully"
}
```

**Auto-save to environment:**
- ✅ `cvFileId` = uuid-cv
- ✅ `projectReportFileId` = uuid-project

### Step 2: Start Evaluation

#### 2. Start Evaluation (Create Job)
- **Endpoint**: `POST /evaluate`
- **Body**: JSON dengan jobTitle, cvFileId, dan projectReportFileId
- **Auto-fill**: cvFileId dan projectReportFileId otomatis terisi dari Step 1
- **Response**: Job ID akan otomatis tersimpan ke `evaluationJobId`
- **Status**: QUEUED (job masuk ke queue untuk diproses async)

**Request body:**
```json
{
  "jobTitle": "Senior Backend Developer",
  "cvFileId": "{{cvFileId}}",
  "projectReportFileId": "{{projectReportFileId}}"
}
```

**Response:**
```json
{
  "id": "job-uuid",
  "status": "QUEUED",
  "jobTitle": "Senior Backend Developer",
  "cvFileId": "uuid-cv",
  "projectReportFileId": "uuid-project",
  "createdAt": "2025-10-06T..."
}
```

**Auto-save to environment:**
- ✅ `evaluationJobId` = job-uuid

### Step 3: Check Status & Results (Polling)

#### 3. Get Evaluation Status
- **Endpoint**: `GET /result/{{evaluationJobId}}`
- **Auto-fill**: evaluationJobId otomatis terisi dari Step 2
- **Polling**: Jalankan berulang setiap 2-5 detik untuk cek progress
- **Status Flow**: 
  - `QUEUED` → Job menunggu di queue
  - `PROCESSING` → Job sedang diproses
  - `COMPLETED` → Job selesai, hasil tersedia ✅
  - `FAILED` → Job gagal, lihat error message ❌

**Response ketika QUEUED/PROCESSING:**
```json
{
  "id": "job-uuid",
  "status": "PROCESSING",
  "jobTitle": "Senior Backend Developer",
  "cvFileId": "uuid-cv",
  "projectReportFileId": "uuid-project",
  "createdAt": "2025-10-06T...",
  "updatedAt": "2025-10-06T..."
}
```

**Response ketika COMPLETED:**
```json
{
  "id": "job-uuid",
  "status": "COMPLETED",
  "jobTitle": "Senior Backend Developer",
  "cvFileId": "uuid-cv",
  "projectReportFileId": "uuid-project",
  
  // CV Evaluation Results
  "cvMatchRate": 85,
  "cvFeedback": "Kandidat memiliki pengalaman yang sangat relevan...",
  "cvScoresJson": {
    "technical_skills": 90,
    "experience": 85,
    "education": 80,
    "certifications": 88
  },
  
  // Project Evaluation Results
  "projectScore": 88,
  "projectFeedback": "Project menunjukkan pemahaman yang baik...",
  "projectScoresJson": {
    "technical_implementation": 90,
    "architecture": 88,
    "best_practices": 85,
    "documentation": 87
  },
  
  // Overall
  "overallSummary": "Kandidat sangat qualified untuk posisi Senior Backend Developer...",
  
  // LLM Metadata
  "llmProvider": "gemini",
  "llmModel": "gemini-1.5-flash",
  "tokensUsed": 2500,
  "processingTimeMs": 3500,
  
  // Timestamps
  "createdAt": "2025-10-06T18:00:00.000Z",
  "updatedAt": "2025-10-06T18:00:05.000Z",
  "completedAt": "2025-10-06T18:00:05.000Z"
}
```

## 📋 Request Collection Summary

| # | Request Name | Method | Endpoint | Description |
|---|---|---|---|---|
| 1 | Health Check | GET | `/` | Verify API is running |
| 2 | Upload CV & Project Report | POST | `/upload` | Upload kedua file sekaligus |
| 3 | Start Evaluation | POST | `/evaluate` | Create evaluation job |
| 4 | Get Evaluation Status | GET | `/result/:id` | Poll job status & results |

## 🧪 Auto-Save Environment Variables

Collection ini sudah dilengkapi dengan **test scripts** yang otomatis menyimpan response data ke environment variables:

### Upload Response → Environment
```javascript
cvFileId = response.files[0].id
projectReportFileId = response.files[1].id
```

### Evaluation Response → Environment
```javascript
evaluationJobId = response.id
```

Jadi Anda tidak perlu manual copy-paste IDs! 🎉

## 🔍 Test Scripts Features

Setiap request dilengkapi dengan test scripts yang akan:

1. ✅ Validasi status code
2. ✅ Validasi response structure
3. ✅ Auto-save IDs ke environment
4. ✅ Console logging untuk debugging
5. ✅ Pretty-print evaluation results

**Lihat hasil di Postman Console:**
- Buka **View** → **Show Postman Console** (atau Cmd+Alt+C)
- Setiap request akan log informasi detail

## 📝 Tips Testing

### 1. Sequential Testing
Jalankan request secara berurutan (1 → 2 → 3) karena setiap step depends on previous response.

### 2. Polling Strategy
Untuk **Get Evaluation Status**:
- Jalankan pertama kali setelah start evaluation
- Jika status masih `QUEUED` atau `PROCESSING`, tunggu 2-5 detik
- Jalankan lagi sampai status menjadi `COMPLETED`
- Postman **Runner** bisa digunakan untuk auto-polling dengan delay

### 3. File Path Configuration
Sebelum testing pertama kali:
1. Pastikan file CV dan project report sudah ada
2. Update file paths di request "Upload CV & Project Report"
3. File format harus PDF
4. Max file size 10MB per file

### 4. Error Handling
Jika request gagal, check:
- ❌ Server running? (`npm run start:dev`)
- ❌ Redis running? (`brew services start redis`)
- ❌ Database connected? (check .env)
- ❌ File paths correct?
- ❌ File format PDF?

## 🔗 Swagger Documentation

Alternative to Postman, buka Swagger UI di browser:
```
http://localhost:3000/api
```

Swagger UI menyediakan interactive API documentation dengan try-it-out feature.

## 📚 Environment Variables Reference

| Variable | Source | Usage |
|---|---|---|
| `baseUrl` | Manual | Base URL untuk semua requests |
| `cvFileId` | Auto from upload | Used in evaluate request |
| `projectReportFileId` | Auto from upload | Used in evaluate request |
| `evaluationJobId` | Auto from evaluate | Used in status request |

## 🎯 Quick Test Checklist

- [ ] Import collection & environment ke Postman
- [ ] Select **AI CV Analyzer - Local** environment
- [ ] Update file paths di "Upload CV & Project Report"
- [ ] Run **Health Check** → should return "Hello World!"
- [ ] Run **Upload CV & Project Report** → check console for saved IDs
- [ ] Run **Start Evaluation** → check console for job ID
- [ ] Run **Get Evaluation Status** repeatedly → wait for COMPLETED
- [ ] Check Postman Console for detailed evaluation results

## 🆘 Troubleshooting

### File Upload Gagal
- Pastikan file path benar
- File format harus PDF
- File size < 10MB
- Check server logs untuk error details

### Evaluation Job Stuck
- Check Redis: `redis-cli ping` (should return PONG)
- Check server logs untuk worker activity
- Verify LLM API keys configured di .env

### 404 Not Found
- Verify server running di port 3000
- Check environment baseUrl = `http://localhost:3000`
- No trailing slash di baseUrl

## 📞 Support

Jika ada masalah atau pertanyaan, check:
1. Server logs (`npm run start:dev` output)
2. Postman Console (View → Show Postman Console)
3. Swagger docs (http://localhost:3000/api)
4. README.md di root project

Happy Testing! 🚀

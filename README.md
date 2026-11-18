# Z-Top

**Z-Top** is an academic co-pilot for university students. It brings course materials, AI-assisted study tools, academic planning, and study tracking into one workspace.

The application has a **Next.js frontend** and a **FastAPI backend**. Student accounts and academic data are stored in a relational database. Uploaded course materials can also be indexed in Qdrant so Z-Chat can retrieve relevant passages and show source citations.

## Features

- **Student accounts** — Register and sign in with an email and password. API routes use signed bearer tokens.
- **Student profile** — Manage personal and education details, plus a profile photo.
- **Course workspace** — Create courses and keep each course's learning materials together.
- **Document reader and uploads** — Upload PDF, DOCX, TXT, Markdown, and common raster-image files. The backend extracts text and keeps page information for course materials.
- **Z-Chat** — Ask questions about a course. Relevant passages are retrieved from the uploaded materials and returned with file/page citations. A separate general-chat mode supports broader study questions and optional course context.
- **Study tools** — Generate flashcards, multiple-choice practice questions, and key takeaways from selected course documents. Extractive fallbacks are used when the language-model service is unavailable.
- **Syllabus and deadline extraction** — Upload a syllabus to identify explicit academic deadlines and add them to the planner.
- **Study planner** — Create a study schedule based on a course, exam date, available study hours, existing workload, and available quiz-score history.
- **Tasks and study tracking** — Add and update tasks, log study sessions, and view study-time analytics.

## Technology stack

| Area | Technologies |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4, custom CSS |
| Icons and document preview | Lucide React, docx-preview |
| Backend API | Python, FastAPI, Uvicorn, Pydantic |
| Database and ORM | SQLAlchemy; SQLite by default; PostgreSQL supported |
| AI text generation | Groq API through its OpenAI-compatible API |
| Embeddings | Google Gemini embedding API |
| Vector retrieval | Qdrant (local persistent storage by default; cloud URL supported) |
| File extraction | pypdf, PyMuPDF, python-docx, Pillow, pytesseract |
| Optional object storage | Supabase Storage |

## Project structure

```text
Z-TOP/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, API routes, database models
│   │   ├── ai.py            # Groq, Gemini embeddings, and Qdrant retrieval
│   │   ├── planner.py       # Deadline parsing and study-topic helpers
│   │   └── storage.py       # Optional Supabase Storage integration
│   ├── .env.example         # Backend environment-variable template
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── src/
│   │   └── app/
│   │       ├── page.tsx     # Main application interface
│   │       ├── layout.tsx   # Root layout and page metadata
│   │       └── globals.css  # Application styles
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## Public deployment

Z-Top is intended to run as a **public website**, with the Next.js frontend and FastAPI backend deployed as separate services. The steps below describe the production setup. The exact dashboard screens and configuration names depend on the hosting providers you choose.

### Production architecture

- **Frontend:** Deploy the Next.js app to a Node.js-compatible hosting platform.
- **Backend:** Deploy the FastAPI app to a Python-compatible hosting platform that supports a persistent service and exposes an HTTPS URL.
- **Database:** Use managed PostgreSQL rather than the default local SQLite database.
- **Vector database:** Use Qdrant Cloud (or another reachable hosted Qdrant instance); do not rely on a local Qdrant directory on an ephemeral host.
- **Uploaded files:** Configure Supabase Storage or another durable object-storage service. Files saved only to the backend's local filesystem may be lost when a hosted service restarts or is redeployed.

### Deployment steps

1. **Prepare the managed services.** Create a PostgreSQL database, a hosted Qdrant collection, and (recommended) a Supabase Storage bucket. Keep all service credentials private.
2. **Deploy the backend.** Connect the repository's `backend/` directory to your Python host. Install dependencies with `pip install -r requirements.txt` and configure the service to start with:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
   If your host uses a different port-variable convention, use the command format it documents.
3. **Set backend environment variables.** Configure at least `DATABASE_URL`, a strong random `TOKEN_SECRET`, `FRONTEND_ORIGIN`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `QDRANT_URL`, and `QDRANT_API_KEY`. Configure the three Supabase variables if you use Supabase Storage. Use the production frontend's HTTPS origin for `FRONTEND_ORIGIN`.
4. **Verify the backend.** After deployment, open `https://<your-backend-domain>/api/health`. The interactive API documentation is at `https://<your-backend-domain>/docs`.
5. **Deploy the frontend.** Connect the repository's `frontend/` directory to a Next.js-compatible host. Set `NEXT_PUBLIC_API_URL` to the deployed backend's HTTPS base URL (for example, `https://api.example.com`), then build the app with `npm run build`. Use the host's normal Next.js start/runtime configuration.
6. **Connect the domains.** Set `FRONTEND_ORIGIN` to the exact public frontend origin, including the scheme (for example, `https://z-top.example.com`). Confirm the frontend calls the deployed backend rather than a localhost URL.
7. **Test the live site.** Register a test account, sign in, create a course, upload a document, and test Z-Chat and the study tools. Also verify that uploaded files and database records remain available after a backend redeploy.

Do not copy the example domain names above as real settings. Replace them with the actual URLs assigned by your hosting providers. The repository does not currently include provider-specific deployment configuration, so the exact click-by-click setup depends on where you host the frontend, backend, database, and storage.

### Optional local development

On Windows, start both the backend and frontend with:

```powershell
.\start-dev.ps1
```

The launcher starts only services that are not already running.

Localhost is only for development on your own computer; it is not the public website address. If you or another developer later need to run the project locally, use the commands below.

**Backend (from the repository root):**

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .\\.venv\\Scripts\\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

**Frontend (in a second terminal):**

```bash
cd frontend
npm install
npm run dev
```

For local development, the frontend is at `http://localhost:3000` and the backend is at `http://localhost:8000`. These addresses are not used by visitors to the deployed website.

## Environment variables

The backend loads `backend/.env` when its AI module starts. Keep real keys and secrets out of Git; never commit your `.env` file.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLAlchemy database connection. Defaults to a local SQLite database at `backend/z_top.db`. PostgreSQL URLs are normalized for psycopg 3. |
| `TOKEN_SECRET` | Secret used to sign login tokens. Replace the development value with a long, random secret before deployment. |
| `FRONTEND_ORIGIN` | Frontend origin allowed by backend CORS. Defaults to `http://localhost:3000` for local development; set it to the deployed frontend origin in production. |
| `GROQ_API_KEY` | Enables AI text generation for Z-Chat, flashcards, quizzes, takeaways, and AI-assisted syllabus deadline extraction. |
| `GROQ_MODEL` | Optional Groq model name. Defaults to `openai/gpt-oss-120b`. |
| `GROQ_NATIVE_JSON` | Set to `true` to request Groq's JSON response mode for structured generation. |
| `GEMINI_API_KEY` | Enables Gemini text embeddings used to index and search course documents semantically. |
| `GEMINI_EMBED_MODEL` | Embedding model name. Defaults to `gemini-embedding-001`. |
| `QDRANT_URL` | Optional Qdrant Cloud/service URL. If omitted, Qdrant uses local persistent storage. |
| `QDRANT_API_KEY` | API key for a hosted Qdrant instance. |
| `QDRANT_PATH` | Local Qdrant storage path. Defaults to `backend/qdrant_data`. |
| `QDRANT_COLLECTION` | Qdrant collection name. Defaults to `z_top_course_chunks`. |
| `RAG_MIN_SCORE` | Minimum vector similarity score for retrieved passages. Defaults to `0.35`. |
| `SUPABASE_URL` | Optional Supabase project URL for remote file storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional Supabase service-role key. Keep this secret and server-side only. |
| `SUPABASE_STORAGE_BUCKET` | Supabase Storage bucket name. Supabase storage is enabled only when all three Supabase variables are set. |
| `NEXT_PUBLIC_API_URL` | Frontend API base URL. Set this to the deployed backend's HTTPS URL in production; the localhost default is for local development only. |

### AI and storage behavior

- **Groq** is the text-generation provider. Set `GROQ_API_KEY` to enable generated chat answers and AI-generated study content.
- **Gemini** is used to create document/query embeddings. Set `GEMINI_API_KEY` to enable semantic indexing and retrieval in Qdrant.
- If Gemini embeddings are not configured or vector retrieval is unavailable, course chat can fall back to lexical matching against extracted document text.
- If Groq is not configured, course chat can still return matching excerpts, and study tools can use extractive fallbacks. General AI chat requires Groq.
- Qdrant uses a local persistent directory by default. Configure `QDRANT_URL` and `QDRANT_API_KEY` to use a hosted instance.
- Files and profile photos are stored on the backend filesystem by default. If all Supabase Storage variables are configured, the backend uses the configured Supabase bucket instead.

The committed `.env.example` lists the core database, token, Gemini, and Qdrant settings. Add the Groq and optional Supabase variables to your local `.env` when you use those integrations.

## API overview

All routes below are under the `/api` prefix. Except for the health check and registration/login, routes require an authenticated bearer token.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | API health and AI/vector configuration status |
| POST | `/auth/register` | Create an account |
| POST | `/auth/login` | Sign in |
| GET | `/auth/me` | Get the signed-in user |
| GET, PUT | `/profile` | Read or update the student profile |
| GET, POST, DELETE | `/profile/photo` | Read, upload, or remove the profile photo |
| GET | `/dashboard` | Dashboard courses, tasks, and summary statistics |
| GET, POST | `/courses` | List or create courses |
| GET, POST | `/tasks` | List or create tasks |
| PATCH | `/tasks/{task_id}` | Update a task |
| POST | `/courses/{course_id}/documents` | Upload course material |
| GET | `/courses/{course_id}/documents` | List course documents |
| GET | `/courses/{course_id}/documents/{document_id}` | Read extracted document pages |
| GET | `/courses/{course_id}/documents/{document_id}/file` | Open the original uploaded file |
| DELETE | `/courses/{course_id}/documents/{document_id}` | Delete a course document and its indexed chunks |
| POST | `/courses/{course_id}/chat` | Ask questions grounded in course documents |
| GET | `/courses/{course_id}/chats` | List course chat sessions |
| GET | `/chat-sessions/{session_id}/messages` | Read a chat session's messages |
| POST | `/general-chats` | General Z-Chat, with optional course context |
| POST | `/courses/{course_id}/flashcards` | Generate flashcards from selected course documents |
| POST | `/courses/{course_id}/quizzes` | Generate practice multiple-choice questions |
| POST | `/quizzes/{quiz_id}/submit` | Submit answers and calculate a quiz score |
| POST | `/courses/{course_id}/summary` | Generate key takeaways |
| POST | `/courses/{course_id}/syllabus` | Upload a syllabus and extract deadlines |
| POST | `/plans` | Generate a study plan |
| GET | `/analytics` | Study-time and quiz analytics |
| POST | `/study-sessions` | Log a study session |

For request schemas, response examples, and interactive testing on the deployed service, open `https://<your-backend-domain>/docs`. For local development only, the docs are available at `http://localhost:8000/docs`.

## Database entities

The SQLAlchemy models in `backend/app/main.py` define these tables:

- `users` — account credentials and account creation time
- `student_profiles` — student and education details
- `courses` — courses owned by a student
- `documents` — extracted course document content and page data
- `tasks` — deadlines and planner tasks
- `flashcard_decks` — flashcard-deck storage model
- `quizzes` — quiz question and score storage model
- `study_sessions` — logged study time
- `chat_sessions` and `chat_messages` — course chat history

Course and user ownership checks are applied by the API before returning or changing private academic data.

## Development commands (optional)

From `frontend/`:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

From `backend/` with the virtual environment activated:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Security and deployment notes

- Use a strong, unique `TOKEN_SECRET` outside local development. The default value in the code is explicitly for development only.
- Never commit `.env` files, API keys, Supabase service-role keys, local databases, uploaded files, or Qdrant data.
- Configure `FRONTEND_ORIGIN` and `NEXT_PUBLIC_API_URL` for the deployed frontend/backend domains.
- Use a managed PostgreSQL database and durable file/vector storage for deployments where local disk may be ephemeral.
- Keep Supabase service-role credentials on the backend only.

## Limitations
- Image and scanned-PDF OCR requires the Tesseract OCR executable to be installed on the machine running the backend.
- Semantic document search requires both Gemini embeddings and a working Qdrant store. Without embeddings, course chat uses keyword-based matching.
- The repository contains quiz-generation and quiz-submission endpoints, as well as quiz database models. The current quiz-generation handler returns generated questions but does not create a quiz database record, so the submission endpoint's persisted-quiz flow needs to be completed before quiz scores can be reliably saved and shown in analytics.
- The backend's environment template does not currently include every optional integration variable. Configure the required values in your hosting provider's backend environment settings; do not commit secrets to the repository.



# Environment Setup & Secrets Management

## 1. Quickstart (Local Development)

### 1.1 Prerequisites
- Node.js 20 LTS or Node.js 22 LTS
- Python 3.11+ (optional for local FastAPI microservice)
- npm 10+
- Docker & Docker Compose (optional for containerized execution)

### 1.2 Installation
```bash
# 1. Clone repository
git clone <repo-url>
cd applet

# 2. Install dependencies
npm install

# 3. Create local environment file
cp .env.example .env.local

# 4. Start local development server
npm run dev
```
The application will launch at `http://localhost:3000`.

---

## 2. Secrets Management & Zero-Leakage Policy

### 2.1 Public vs Private Secrets
- **VITE_SUPABASE_URL** and **VITE_SUPABASE_ANON_KEY** are prefixed with `VITE_` and are bundled into the client SPA. These are protected at the database tier via Row Level Security (RLS) policies.
- **SUPABASE_SERVICE_ROLE_KEY** is strictly private and server-side only. It must NEVER be prefixed with `VITE_` and must NEVER be imported into any file inside `src/components/`, `src/pages/`, or `src/hooks/`.
- **GEMINI_API_KEY** is managed by the server-side environment. In AI Studio and Google Cloud, it is injected directly into server runtime processes.

### 2.2 Git Hygiene
The `.gitignore` strictly excludes:
```
.env
.env.local
.env.*.local
*.pem
*.key
credentials.json
```
If any secret is accidentally committed to Git history, it must be immediately revoked and rotated at the provider dashboard.

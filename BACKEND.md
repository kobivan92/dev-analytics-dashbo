# Dev Analytics Dashboard - SQLite Backend

## Architecture

The app now uses a local SQLite database to store and serve repository, developer, and commit data.

### Components

- **Frontend (Vite + React)**: Port 5000 (default) or 4444 (forwarded)
- **Backend (Express + SQLite)**: Port 3001
- **Database**: `data/devmetrics.sqlite`

### Database Schema

```sql
repositories
  - id (TEXT, PRIMARY KEY)
  - name (TEXT)
  - namespace (TEXT)
  - description (TEXT)
  - primaryLanguage (TEXT)
  - lastActivity (TEXT)
  - healthScore (INTEGER)

developers
  - id (TEXT, PRIMARY KEY)
  - name (TEXT)
  - email (TEXT)
  - avatar (TEXT)
  - role (TEXT)
  - joinedDate (TEXT)

commits
  - hash (TEXT, PRIMARY KEY)
  - message (TEXT)
  - timestamp (TEXT)
  - additions (INTEGER)
  - deletions (INTEGER)

repo_commits (junction table)
  - id (INTEGER, PRIMARY KEY AUTOINCREMENT)
  - repo_id (TEXT, FK -> repositories)
  - developer_id (TEXT, FK -> developers)
  - commit_hash (TEXT, FK -> commits)
```

## API Endpoints

### Health Check
```bash
GET /api/health
```

### Sync from SCM
Fetches repositories and changesets from your SCM server and populates SQLite.
```bash
POST /api/sync
```

### Get Repositories
```bash
GET /api/repositories
# Returns all repos with commit and contributor counts
```

### Get Repository Details
```bash
GET /api/repositories/:id
# Returns repo with top 5 contributors
```

### Get Developers
```bash
GET /api/developers
# Returns all developers with their stats
```

### Get Developer Metrics
```bash
GET /api/developers/:id/metrics
# Returns commit history, totals, language breakdown
```

## Running the App

### Development Mode
Runs both frontend and backend concurrently:
```bash
npm run dev
```

### Individual Servers
```bash
# Frontend only (Vite)
npm run dev:frontend

# Backend only (Express + SQLite)
npm run dev:backend
```

### First Run
1. Start servers: `npm run dev`
2. Open http://localhost:5000 or http://localhost:4444
3. The app automatically triggers initial sync from SCM on first load
4. Data persists in `data/devmetrics.sqlite`

### Manual Sync
To refresh data from SCM:
```bash
curl -X POST http://localhost:3001/api/sync
```

## Environment Variables
Configure SCM credentials in `.env.local`:
```bash
VITE_SCM_BASE_URL=http://172.31.200.215:8080
VITE_SCM_REPOS_PATH=/scm/api/v2/repositories
VITE_SCM_USERNAME=ivan.kobyakov
VITE_SCM_PASSWORD=9Uo2lMW1HrV2
```

## Database Location
- **Path**: `data/devmetrics.sqlite`
- **Auto-created** on first backend start
- **Persists** across restarts
- **Syncs** incrementally from SCM

## Advantages

1. **Fast**: Local SQLite queries are instant
2. **Offline**: Works without SCM connection after initial sync
3. **Flexible**: Easy to add custom metrics and aggregations
4. **Persistent**: Data survives app restarts
5. **Scalable**: Can handle thousands of commits efficiently

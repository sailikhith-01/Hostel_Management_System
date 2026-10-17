# Hostel Management System

## Local services

The project is split into a PostgreSQL database, an Express API, a FastAPI ML
service, and three Next.js dashboard prototypes. The dashboard pages currently
use hard-coded example data; they do not call the API yet.

### 1. Create and initialize PostgreSQL

Create an empty database named `hostel_management`, then apply the schema from
the repository root:

```powershell
createdb -U postgres hostel_management
psql -U postgres -d hostel_management -f database\schema.sql
```

The schema script drops and recreates its tables and views. Only run it against
an empty or disposable development database unless you intend to erase its
existing data. It creates the two supported fine types:

- `Late entry`
- `Heavy electric appliances fine`

### 2. Start the ML service

The two inference models must be present in `ml_services\models`. From the
`ml_services` directory, create and activate a virtual environment, install
the pinned requirements, and start FastAPI:

```powershell
cd ml_services
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The service health endpoint is `http://127.0.0.1:8000/health`.

### 3. Start the Express API

In a second terminal, from the repository root:

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edit `backend\.env` and set `DB_PASSWORD` to the local PostgreSQL password
(or configure `DATABASE_URL` in place of the individual `DB_*` settings).
Then start the API:

```powershell
npm run dev
```

The API listens on `http://localhost:5000`. It checks PostgreSQL before
starting, and `GET /health` checks both PostgreSQL and FastAPI. Configure
`ML_SERVICE_URL` if FastAPI is running elsewhere. `CORS_ORIGIN` is a
comma-separated list of allowed frontend origins.

Available integration routes:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check database and ML service connectivity |
| `POST` | `/api/complaints` | Classify and save a complaint |
| `POST` | `/api/bookings` | Atomically allocate an unoccupied bed |
| `GET` | `/api/students/:studentId/fine-risk` | Derive recent fine features from PostgreSQL and predict risk |
| `GET` | `/api/warden/trends` | Return the complaint trend view |

The complaint request body uses `student_id`, `description`, `room_number`,
and `block_number`. A fine-risk request uses the student's ID in the URL; the
backend derives the same six features expected by the ML endpoint from that
student's fine/payment history.

### 4. Run a dashboard prototype

Each directory under `frontend` is a separate Next.js app. For example:

```powershell
cd frontend\student-dashboard-design
pnpm install
pnpm dev
```

Use the equivalent directory for the admin or matching dashboard. The pages
are presently design prototypes with mock data and action placeholders, so
they can be viewed locally but do not yet consume the Express routes.

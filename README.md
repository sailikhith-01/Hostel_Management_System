# Hostel Management System

## Local services

The project is split into a PostgreSQL database, an Express API, a FastAPI ML
service, and three Next.js dashboards. The student and admin portals use the
Express API for sign-in and account creation.

### 1. Create and initialize PostgreSQL

Create an empty database named `hostel_management`, then apply the schema from
the repository root:

```powershell
createdb -U postgres hostel_management
psql -U postgres -d hostel_management -f database\schema.sql
```

The schema script drops and recreates its tables and views. Only run it against
an empty or disposable development database unless you intend to erase its
existing data. It also inserts the two supported fine types:

- `Late entry`
- `Heavy electric appliances fine`

### What the tables store

Think of a table as a spreadsheet for one kind of information:

| Table | What it stores |
| --- | --- |
| `Admin` | Warden and administrator accounts with usernames and email addresses. |
| `Student` | Student names, email addresses, roll numbers, room preferences, gender, and hostel block. |
| `RoommatePreference` | A student's answers to the roommate-matching questionnaire. |
| `Room` | Each hostel room, its block, gender, and allowed capacity. |
| `Bed` | The individual beds in each room and whether each bed is occupied. |
| `Allocation` | Which student has been assigned to which bed. |
| `GateLog` | Student entry and exit records. A late entry can automatically create a fine. |
| `FineType` | The fine categories and their standard amounts. |
| `Fine` | Fines charged to students, including due date and payment status. |
| `FinePayment` | Payments made toward a fine, including amount, date, and payment method. |
| `Complaint` | Student complaints, their description, category, and priority. |
| `MatchRun` | A record of a roommate-matching calculation. |
| `StudentCluster` | The group assigned to a student by a matching calculation. |
| `MatchSuggestion` | A suggested student pairing and whether it is accepted or rejected. |

`Student`, `Room`, and `Bed` describe residents and accommodation. `Allocation`
connects a student to a bed. Fine, complaint, gate, and matching tables store
hostel activity and results.

### 2. Add sample data

After the schema is installed, run `database\seed.sql` from the repository root:

```powershell
psql -U postgres -d hostel_management -f database\seed.sql
```

Enter your PostgreSQL password if prompted. This sample script can be run
again: it updates the same sample students and rooms instead of adding them a
second time. It creates six example students, six demo rooms (one room for each
allowed capacity), 24 demo beds, the 400-room inventory and its 1,700 beds,
sample allocations and roommate preferences, two example fines, one fine
payment, one gate exit, and one complaint. The sample
male blocks are valid A-T blocks; the sample female blocks are A, S, and I.
It also creates the development admin `admin` / `admin123` and six sample
students, each using `StudentPass123`. These are plaintext development
credentials; do not use them outside a local development database. The script
leaves the matching-result tables empty because those rows should come from an
actual matching run.

If you use pgAdmin instead of the command line:

1. Connect to the `hostel_management` database.
2. Open **Tools → Query Tool**.
3. Open `database\seed.sql` in the query editor.
4. Click **Execute** (or press **F5**).
5. Check the result grid/messages for the student and room counts and fine types.

Expected checks are 6 sample students, 6 demo rooms, 400 inventory rooms, and
the two fine types.
The seed script uses a transaction, so a failed insert is rolled back.

The schema enforces these college rules: male students and rooms use blocks
A-T; female students and rooms use blocks A-I or S; room capacities are 1, 2,
3, 4, 6, or 8. The fine types are exactly `Late entry` and
`Heavy electric appliances fine`.

### 3. Start the ML service

The complaint and fine-risk models, plus the roommate K-Means model and scaler,
must be present in `ml_services\models`. From the
`ml_services` directory, create and activate a virtual environment, install
the pinned requirements, and start FastAPI:

```powershell
cd ml_services
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The service health endpoint is `http://127.0.0.1:8000/health`.

### 4. Start the Express API

In a second terminal, from the repository root:

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edit `backend\.env` and set `DB_PASSWORD` to the local PostgreSQL password
(or configure `DATABASE_URL` in place of the individual `DB_*` settings).
Set `SESSION_SECRET` to a fresh random value (at least 32 characters). For
example, run `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
from the `backend` directory and copy the result into your local `.env`. Never
commit `.env` or use a real password in `.env.example`.

Existing databases must be upgraded without rerunning the destructive schema:

```powershell
psql -U postgres -d hostel_management -f database\migrations\002_auth_complaints_matching.sql
psql -U postgres -d hostel_management -f database\migrations\003_indexes_and_scaling.sql
psql -U postgres -d hostel_management -f database\migrations\004_user_management.sql
psql -U postgres -d hostel_management -f database\migrations\005_room_preference_capacity.sql
psql -U postgres -d hostel_management -f database\migrations\006_admin_hostel_scope.sql
```

The room preference is stored as an integer capacity: `1`, `2`, `3`, `4`, `6`,
or `8`. Both `database\seed.sql` and the standalone inventory reset script seed
the full vacant 400-room inventory:

```powershell
psql -U postgres -d hostel_management -f database\seed_rooms.sql
```

The distribution is 50, 50, 50, 100, 100, and 50 rooms for capacities 1, 2,
3, 4, 6, and 8 respectively. Inventory rooms are distributed among valid
gender/block combinations (10 rooms per male block and 20 per female block),
including Block K, and each room is seeded with a complete, unoccupied set of
beds (1,700 beds total). The seed verifies that all 30 valid gender/block
combinations have inventory. These are
dedicated inventory rooms; the six demo rooms remain separate fixtures.
Re-running either seed releases any allocations and removes match
groups for rooms named `INV001` through `INV400`, restoring those rooms to an
empty state. Run it only when it is safe to reset allocations in this dedicated
inventory.

For compatibility with this development setup, newly created accounts store
their exact password in `password_hash`. Existing `scrypt$...` records remain
login-compatible. Plaintext password storage is not suitable for production;
the application should use a password hashing scheme before handling real
accounts. To reset every existing account to the shared development
credentials, run `npm run reset-passwords` from `backend`; students will use
`StudentPass123` and admins will use `admin123`. This operation overwrites all
current student and admin passwords, so only run it against a development
database. Then start the API:

```powershell
npm run dev
```

The API listens on `http://localhost:5000`. It checks PostgreSQL before
starting, and `GET /health` checks both PostgreSQL and FastAPI. Configure
`ML_SERVICE_URL` if FastAPI is running elsewhere. `CORS_ORIGIN` is a
comma-separated list of allowed frontend origins.

Available authenticated integration routes:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check database and ML service connectivity |
| `POST` | `/api/auth/login` | Sign in as an admin (`username` or email) or student (`email`) |
| `POST` | `/api/auth/register` | Register a student and start their session |
| `POST` | `/api/students` | Admin-only student account creation |
| `GET` | `/api/students` | Admin-only student list with completed/pending allocation status |
| `GET` | `/api/allocations[?student_id=<id>]` | Admin-only available beds, optionally filtered by the student's gender, block, and preferred capacity |
| `POST` | `/api/allocations` | Admin-only compatible bed allocation (`student_id`, `bed_id`) |
| `POST` | `/api/admins` | Super-admin-only admin account creation |
| `GET` | `/api/admins` | Super-admin-only admin account list |
| `PATCH` | `/api/admins/:id/hostel-type` | Super-admin assigns a sub-admin's hostel scope |
| `GET` | `/api/auth/session` | Read the current signed, HttpOnly cookie session |
| `POST` | `/api/auth/logout` | Clear the current session |
| `POST` | `/api/complaints` | Student raises an ML-classified complaint (`description`) |
| `GET` | `/api/admin/complaints?status=pending` | Hostel-scoped complaint review and filtering |
| `PATCH` | `/api/admin/complaints/:id/status` | Admin updates complaint status |
| `GET` | `/api/students/me/records` | Student allocation, complaints, fines, payments, and gate logs |
| `GET` / `PUT` | `/api/students/me/preferences` | Student roommate onboarding |
| `GET` | `/api/admin/records` | Admin fine, payment, and gate-log history |
| `GET` | `/api/admin/fine-risk` | Full fine-risk report and six model features per student |
| `GET` | `/api/students/:studentId/fine-risk` | Student's own or admin-requested risk prediction |
| `POST` | `/api/admin/matching/run` | Cluster submitted preferences and build compatible room groups |
| `GET` | `/api/admin/matching/latest` | Review the latest room groups and pairwise compatibility |
| `POST` | `/api/admin/matching/:runId/confirm` | Atomically validate and allocate all pending groups |
| `POST` | `/api/bookings` | Book a single-occupancy room; shared rooms use matching |
| `GET` | `/api/warden/trends` | Admin complaint trend view |

Sessions expire after eight hours. Shared-room groups use only the allowed
capacities (1, 2, 3, 4, 6, or 8), must fit the complete room bed inventory, and
must have the same gender as the room. Each pair in a shared group must achieve
at least 65% compatibility across the stored preference questionnaire; students
without preferences or a safe available group remain unallocated. The FastAPI
service provides K-Means clusters, while the Express API performs the
pairwise compatibility and room-capacity checks before saving suggestions.
The main admin account is a `SUPER_ADMIN` with access to both hostels. Sub-admin
accounts use the `WARDEN` role with a `mens` or `ladies` assignment; backend
queries and allocation writes enforce that gender scope. Existing wardens are
migrated as `unassigned` until the super-admin assigns their hostel.
Newly created students receive valid neutral roommate-survey defaults in the
same transaction as account creation, so they are eligible for clustering
immediately; students can replace the defaults through the roommate
preferences endpoint. The admin dashboard lists pending and completed bed
assignments and checks gender, block, preferred room capacity, bed inventory,
and roommate compatibility when an admin allocates an available bed.

### 5. Run the dashboards

Each directory under `frontend` is a separate Next.js app. Run these commands
in separate terminals:

```powershell
cd frontend\admin-dashboard-design
pnpm install
pnpm dev
```

```powershell
cd frontend\matching-dashboard-design
pnpm install
pnpm dev --port 3001
```

```powershell
cd frontend\student-dashboard-design
pnpm install
pnpm dev --port 3002
```

The admin dashboard defaults to port 3000. Set
`NEXT_PUBLIC_API_URL` in a local `.env.local` only if the Express API is not
running at `http://localhost:5000`. Admin sign-in works across both admin apps
while they use the same API cookie; student sign-in is in the student app.
The frontends display currency in Indian Rupees (INR).

-- ============================================================================
-- HOSTEL MANAGEMENT SYSTEM - DATABASE SCHEMA (3NF)
-- PostgreSQL Implementation with Triggers, Constraints, and Views
-- ============================================================================

-- Drop tables if they exist (in order of dependency)
DROP VIEW IF EXISTS view_warden_complaint_trends;
DROP VIEW IF EXISTS view_student_fine_summary;
DROP TABLE IF EXISTS FinePayment CASCADE;
DROP TABLE IF EXISTS Fine CASCADE;
DROP TABLE IF EXISTS FineType CASCADE;
DROP TABLE IF EXISTS GateLog CASCADE;
DROP TABLE IF EXISTS Complaint CASCADE;
DROP TABLE IF EXISTS MatchSuggestion CASCADE;
DROP TABLE IF EXISTS StudentCluster CASCADE;
DROP TABLE IF EXISTS MatchGroupMember CASCADE;
DROP TABLE IF EXISTS MatchGroup CASCADE;
DROP TABLE IF EXISTS MatchRun CASCADE;
DROP TABLE IF EXISTS Allocation CASCADE;
DROP TABLE IF EXISTS Bed CASCADE;
DROP TABLE IF EXISTS Room CASCADE;
DROP TABLE IF EXISTS RoommatePreference CASCADE;
DROP TABLE IF EXISTS Student CASCADE;
DROP TABLE IF EXISTS Admin CASCADE;

-- ----------------------------------------------------------------------------
-- 1. ADMIN TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE Admin (
    admin_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'WARDEN' CHECK (role IN ('WARDEN', 'SUPER_ADMIN')),
    hostel_type VARCHAR(12) NOT NULL DEFAULT 'unassigned',
    CONSTRAINT check_admin_hostel_type CHECK (
            (role = 'SUPER_ADMIN' AND hostel_type = 'all') OR
            (role = 'WARDEN' AND hostel_type IN ('mens', 'ladies', 'unassigned'))
        ),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_admin_email_unique ON Admin (lower(email)) WHERE email IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. STUDENT TABLE (First-Year Students Only)
-- ----------------------------------------------------------------------------
CREATE TABLE Student (
    student_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    gender CHAR(1) NOT NULL CHECK (gender IN ('M', 'F')),
    password_hash VARCHAR(255),
    roll_number VARCHAR(50),
    room_preference INT,
    -- Blocks: Men's (A-T), Ladies' (A-I, S)
    block_number VARCHAR(2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_student_block_length CHECK (char_length(block_number) = 1),
    CONSTRAINT check_valid_block CHECK (
        (gender = 'M' AND block_number BETWEEN 'A' AND 'T') OR
        (gender = 'F' AND (block_number BETWEEN 'A' AND 'I' OR block_number = 'S'))
    ),
    CONSTRAINT check_student_room_preference CHECK (room_preference IN (1, 2, 3, 4, 6, 8))
);
CREATE UNIQUE INDEX idx_student_roll_number_unique ON Student (roll_number) WHERE roll_number IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. ROOMMATE PREFERENCE QUESTIONNAIRE (10 Behavioral Questions)
-- ----------------------------------------------------------------------------
CREATE TABLE RoommatePreference (
    student_id INT PRIMARY KEY REFERENCES Student(student_id) ON DELETE CASCADE,
    q1_bedtime INT CHECK (q1_bedtime BETWEEN 1 AND 4),
    q2_wakeup INT CHECK (q2_wakeup BETWEEN 1 AND 4),
    q3_tidiness INT CHECK (q3_tidiness BETWEEN 1 AND 5),
    q4_study_style VARCHAR(20) CHECK (q4_study_style IN ('silent', 'music', 'group', 'library')),
    q5_study_hours INT CHECK (q5_study_hours BETWEEN 1 AND 4),
    q6_food VARCHAR(20) CHECK (q6_food IN ('veg', 'nonveg', 'egg')),
    q7_noise_tolerance INT CHECK (q7_noise_tolerance BETWEEN 1 AND 5),
    q8_visitors_social INT CHECK (q8_visitors_social BETWEEN 1 AND 5),
    q9_weekends VARCHAR(20) CHECK (q9_weekends IN ('hostel', 'home', 'out')),
    q10_share_belongings INT CHECK (q10_share_belongings BETWEEN 1 AND 5),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 4. ROOM & BED TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE Room (
    room_id SERIAL PRIMARY KEY,
    room_number VARCHAR(10) NOT NULL,
    block_number VARCHAR(2) NOT NULL,
    capacity INT NOT NULL CHECK (capacity IN (1, 2, 3, 4, 6, 8)),
    gender CHAR(1) NOT NULL CHECK (gender IN ('M', 'F')),
    CONSTRAINT check_room_block_length CHECK (char_length(block_number) = 1),
    CONSTRAINT check_valid_room_block CHECK (
        (gender = 'M' AND block_number BETWEEN 'A' AND 'T') OR
        (gender = 'F' AND (block_number BETWEEN 'A' AND 'I' OR block_number = 'S'))
    ),
    UNIQUE (room_number, block_number)
);

CREATE TABLE Bed (
    bed_id SERIAL PRIMARY KEY,
    room_id INT NOT NULL REFERENCES Room(room_id) ON DELETE CASCADE,
    bed_label VARCHAR(5) NOT NULL, -- e.g., 'A', 'B', 'C'
    is_occupied BOOLEAN DEFAULT FALSE,
    UNIQUE (room_id, bed_label)
);

-- ----------------------------------------------------------------------------
-- 5. ALLOCATION TABLE (Bed Assignments)
-- ----------------------------------------------------------------------------
CREATE TABLE Allocation (
    allocation_id SERIAL PRIMARY KEY,
    student_id INT UNIQUE NOT NULL REFERENCES Student(student_id) ON DELETE CASCADE,
    bed_id INT UNIQUE NOT NULL REFERENCES Bed(bed_id) ON DELETE RESTRICT,
    allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 6. GATE LOG TABLE (Entry/Exit Tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE GateLog (
    log_id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES Student(student_id) ON DELETE CASCADE,
    direction VARCHAR(3) NOT NULL CHECK (direction IN ('IN', 'OUT')),
    logged_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 7. FINES TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE FineType (
    fine_type_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL CHECK (
        name IN ('Late entry', 'Heavy electric appliances fine')
    ),
    base_amount DECIMAL(10, 2) NOT NULL CHECK (base_amount > 0)
);

INSERT INTO FineType (name, base_amount)
VALUES
    ('Late entry', 100.00),
    ('Heavy electric appliances fine', 500.00)
ON CONFLICT (name) DO UPDATE
SET base_amount = EXCLUDED.base_amount;

CREATE TABLE Fine (
    fine_id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES Student(student_id) ON DELETE CASCADE,
    fine_type_id INT NOT NULL REFERENCES FineType(fine_type_id),
    amount DECIMAL(10, 2) NOT NULL,
    reason TEXT NOT NULL,
    issued_by INT NULL REFERENCES Admin(admin_id) ON DELETE SET NULL, -- NULL = Automatic Trigger
    issued_on DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'waived'))
);

CREATE TABLE FinePayment (
    payment_id SERIAL PRIMARY KEY,
    fine_id INT NOT NULL REFERENCES Fine(fine_id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    paid_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('ONLINE', 'CASH', 'UPI'))
);

-- ----------------------------------------------------------------------------
-- 8. COMPLAINT TABLE (Integrated with ML Auto-Tagging)
-- ----------------------------------------------------------------------------
CREATE TABLE Complaint (
    complaint_id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES Student(student_id) ON DELETE CASCADE,
    room_number VARCHAR(10) NOT NULL,
    block_number VARCHAR(2) NOT NULL CHECK (block_number ~ '^[A-T]$'),
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    confidence DECIMAL(4, 3) DEFAULT 1.000,
    auto_tagged BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'resolved', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 9. ML MATCHING TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE MatchRun (
    run_id SERIAL PRIMARY KEY,
    run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    k INT NOT NULL,
    silhouette DECIMAL(4, 3)
);

CREATE TABLE StudentCluster (
    student_id INT REFERENCES Student(student_id) ON DELETE CASCADE,
    run_id INT REFERENCES MatchRun(run_id) ON DELETE CASCADE,
    cluster_id INT NOT NULL,
    cluster_label VARCHAR(50),
    PRIMARY KEY (student_id, run_id)
);

CREATE TABLE MatchSuggestion (
    suggestion_id SERIAL PRIMARY KEY,
    run_id INT REFERENCES MatchRun(run_id) ON DELETE CASCADE,
    student_a INT REFERENCES Student(student_id) ON DELETE CASCADE,
    student_b INT REFERENCES Student(student_id) ON DELETE CASCADE,
    similarity DECIMAL(4, 3) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected'))
);

CREATE TABLE MatchGroup (
    group_id SERIAL PRIMARY KEY,
    run_id INT NOT NULL REFERENCES MatchRun(run_id) ON DELETE CASCADE,
    room_id INT NOT NULL REFERENCES Room(room_id) ON DELETE CASCADE,
    cluster_id INT NOT NULL,
    capacity INT NOT NULL CHECK (capacity IN (1, 2, 3, 4, 6, 8)),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'rejected')),
    UNIQUE (run_id, room_id)
);

CREATE TABLE MatchGroupMember (
    group_id INT NOT NULL REFERENCES MatchGroup(group_id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES Student(student_id) ON DELETE CASCADE,
    bed_id INT REFERENCES Bed(bed_id),
    PRIMARY KEY (group_id, student_id),
    UNIQUE (group_id, bed_id)
);

-- ============================================================================
-- AUTOMATED TRIGGERS & PROCEDURES
-- ============================================================================

-- TRIGGER: Automatic Late Entry Fine Generation based on Curfew
-- Curfew Times: 8:30 PM (20:30) for Females, 9:15 PM (21:15) for Males
CREATE OR REPLACE FUNCTION check_late_entry_fine()
RETURNS TRIGGER AS $$
DECLARE
    v_gender CHAR(1);
    v_entry_time TIME;
    v_fine_type_id INT;
    v_base_amount DECIMAL(10,2);
    v_is_late BOOLEAN := FALSE;
BEGIN
    IF NEW.direction = 'IN' THEN
        SELECT gender INTO v_gender FROM Student WHERE student_id = NEW.student_id;
        v_entry_time := NEW.logged_at::TIME;

        -- Check late curfew rules
        IF (v_gender = 'F' AND (v_entry_time > '20:30:00' OR v_entry_time < '05:00:00')) THEN
            v_is_late := TRUE;
        ELSIF (v_gender = 'M' AND (v_entry_time > '21:15:00' OR v_entry_time < '05:00:00')) THEN
            v_is_late := TRUE;
        END IF;

        IF v_is_late THEN
            SELECT fine_type_id, base_amount INTO v_fine_type_id, v_base_amount 
            FROM FineType WHERE name = 'Late entry' LIMIT 1;

            INSERT INTO Fine (student_id, fine_type_id, amount, reason, issued_by, issued_on, due_date, status)
            VALUES (
                NEW.student_id,
                v_fine_type_id,
                v_base_amount,
                'Automated fine: Late entry recorded at ' || TO_CHAR(NEW.logged_at, 'HH24:MI'),
                NULL, -- NULL indicates automated system fine
                CURRENT_DATE,
                CURRENT_DATE + INTERVAL '14 days',
                'unpaid'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_late_entry_fine
AFTER INSERT ON GateLog
FOR EACH ROW
EXECUTE FUNCTION check_late_entry_fine();

-- ============================================================================
-- SQL VIEWS FOR ANALYTICS & DASHBOARD
-- ============================================================================

-- VIEW 1: Outstanding Fine Balance per Student
CREATE OR REPLACE VIEW view_student_fine_summary AS
SELECT 
    s.student_id,
    s.full_name,
    s.block_number,
    COALESCE(SUM(f.amount), 0) AS total_fines_issued,
    COALESCE(SUM(CASE WHEN f.status = 'unpaid' THEN f.amount ELSE 0 END), 0) AS outstanding_balance,
    COUNT(CASE WHEN f.status = 'unpaid' THEN 1 END) AS unpaid_fines_count
FROM Student s
LEFT JOIN Fine f ON s.student_id = f.student_id
GROUP BY s.student_id, s.full_name, s.block_number;

-- VIEW 2: Warden Complaint Trend Alerts (Window functions & aggregation)
CREATE OR REPLACE VIEW view_warden_complaint_trends AS
WITH MonthlyComplaints AS (
    SELECT 
        block_number,
        category,
        DATE_TRUNC('month', created_at) AS complaint_month,
        COUNT(complaint_id) AS current_month_count
    FROM Complaint
    GROUP BY block_number, category, DATE_TRUNC('month', created_at)
)
SELECT 
    block_number,
    category,
    complaint_month,
    current_month_count,
    LAG(current_month_count, 1, 0) OVER (
        PARTITION BY block_number, category 
        ORDER BY complaint_month
    ) AS previous_month_count,
    (current_month_count - LAG(current_month_count, 1, 0) OVER (
        PARTITION BY block_number, category 
        ORDER BY complaint_month
    )) AS month_over_month_change
FROM MonthlyComplaints;


-- ============================================================================
-- PERFORMANCE INDEXES (Optimized for Thousands of Concurrent Rows)
-- ============================================================================

-- Speed up authentication and student lookups (case-insensitive email matching)
CREATE INDEX IF NOT EXISTS idx_student_email ON Student(email);
CREATE INDEX IF NOT EXISTS idx_student_lower_email ON Student(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_student_block ON Student(block_number);
CREATE INDEX IF NOT EXISTS idx_student_gender_block ON Student(gender, block_number);

-- Speed up room and bed allocation queries
CREATE INDEX IF NOT EXISTS idx_room_gender_block ON Room(gender, block_number);
CREATE INDEX IF NOT EXISTS idx_room_capacity ON Room(capacity);
CREATE INDEX IF NOT EXISTS idx_bed_room_id ON Bed(room_id);
CREATE INDEX IF NOT EXISTS idx_bed_is_occupied ON Bed(is_occupied);
CREATE INDEX IF NOT EXISTS idx_allocation_student_id ON Allocation(student_id);
CREATE INDEX IF NOT EXISTS idx_allocation_bed_id ON Allocation(bed_id);

-- Speed up gate log lookups and auditing across thousands of rows
CREATE INDEX IF NOT EXISTS idx_gatelog_student_id ON GateLog(student_id);
CREATE INDEX IF NOT EXISTS idx_gatelog_logged_at ON GateLog(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_gatelog_student_logged_at ON GateLog(student_id, logged_at DESC);

-- Speed up fine tracking, payments, and fine-risk calculation
CREATE INDEX IF NOT EXISTS idx_fine_student_id ON Fine(student_id);
CREATE INDEX IF NOT EXISTS idx_fine_status ON Fine(status);
CREATE INDEX IF NOT EXISTS idx_fine_issued_on ON Fine(issued_on DESC);
CREATE INDEX IF NOT EXISTS idx_fine_student_status_issued ON Fine(student_id, status, issued_on);
CREATE INDEX IF NOT EXISTS idx_fine_payment_fine_id ON FinePayment(fine_id);
CREATE INDEX IF NOT EXISTS idx_fine_payment_paid_on ON FinePayment(paid_on DESC);

-- Speed up complaint filtering, status management, and warden trends
CREATE INDEX IF NOT EXISTS idx_complaint_student_id ON Complaint(student_id);
CREATE INDEX IF NOT EXISTS idx_complaint_status_priority ON Complaint(status, priority);
CREATE INDEX IF NOT EXISTS idx_complaint_created_at ON Complaint(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaint_trends ON Complaint(block_number, category, created_at);

-- Speed up roommate matching run review and confirmation
CREATE INDEX IF NOT EXISTS idx_match_group_run_status ON MatchGroup(run_id, status);
CREATE INDEX IF NOT EXISTS idx_match_group_room_id ON MatchGroup(room_id);
CREATE INDEX IF NOT EXISTS idx_match_group_member_group ON MatchGroupMember(group_id);
CREATE INDEX IF NOT EXISTS idx_match_group_member_student ON MatchGroupMember(student_id);
CREATE INDEX IF NOT EXISTS idx_match_suggestion_run ON MatchSuggestion(run_id);
CREATE INDEX IF NOT EXISTS idx_match_suggestion_students ON MatchSuggestion(student_a, student_b);
CREATE INDEX IF NOT EXISTS idx_student_cluster_run ON StudentCluster(run_id);
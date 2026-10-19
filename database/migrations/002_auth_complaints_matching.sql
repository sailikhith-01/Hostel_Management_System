ALTER TABLE Student ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE MatchRun ALTER COLUMN silhouette DROP NOT NULL;

ALTER TABLE Complaint
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'complaint_status_allowed'
    ) THEN
        ALTER TABLE Complaint
            ADD CONSTRAINT complaint_status_allowed
            CHECK (status IN ('pending', 'in_progress', 'resolved', 'rejected'));
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS MatchGroup (
    group_id SERIAL PRIMARY KEY,
    run_id INT NOT NULL REFERENCES MatchRun(run_id) ON DELETE CASCADE,
    room_id INT NOT NULL REFERENCES Room(room_id),
    cluster_id INT NOT NULL,
    capacity INT NOT NULL CHECK (capacity IN (1, 2, 3, 4, 6, 8)),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'rejected')),
    UNIQUE (run_id, room_id)
);

CREATE TABLE IF NOT EXISTS MatchGroupMember (
    group_id INT NOT NULL REFERENCES MatchGroup(group_id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES Student(student_id) ON DELETE CASCADE,
    bed_id INT REFERENCES Bed(bed_id),
    PRIMARY KEY (group_id, student_id),
    UNIQUE (group_id, bed_id)
);

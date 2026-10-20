ALTER TABLE Admin ADD COLUMN IF NOT EXISTS email VARCHAR(100);
ALTER TABLE Admin ADD COLUMN IF NOT EXISTS hostel_type VARCHAR(12) NOT NULL DEFAULT 'unassigned';
ALTER TABLE Student ADD COLUMN IF NOT EXISTS roll_number VARCHAR(50);
ALTER TABLE Student ADD COLUMN IF NOT EXISTS room_preference VARCHAR(50);

UPDATE Admin
SET hostel_type = CASE WHEN role = 'SUPER_ADMIN' THEN 'all' ELSE 'unassigned' END
WHERE hostel_type IS NULL OR (role = 'SUPER_ADMIN' AND hostel_type <> 'all');

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'check_admin_hostel_type'
    ) THEN
        ALTER TABLE Admin
            ADD CONSTRAINT check_admin_hostel_type
            CHECK (
                (role = 'SUPER_ADMIN' AND hostel_type = 'all') OR
                (role = 'WARDEN' AND hostel_type IN ('mens', 'ladies', 'unassigned'))
            );
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_email_unique
    ON Admin (lower(email))
    WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_roll_number_unique
    ON Student (roll_number)
    WHERE roll_number IS NOT NULL;

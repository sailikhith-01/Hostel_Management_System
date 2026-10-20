ALTER TABLE Admin
    ADD COLUMN IF NOT EXISTS hostel_type VARCHAR(12) NOT NULL DEFAULT 'unassigned';

UPDATE Admin
SET hostel_type = CASE WHEN role = 'SUPER_ADMIN' THEN 'all' ELSE 'unassigned' END
WHERE hostel_type IS NULL
   OR (role = 'SUPER_ADMIN' AND hostel_type <> 'all')
   OR (role = 'WARDEN' AND hostel_type NOT IN ('mens', 'ladies', 'unassigned'));

ALTER TABLE Admin DROP CONSTRAINT IF EXISTS check_admin_hostel_type;

ALTER TABLE Admin
    ADD CONSTRAINT check_admin_hostel_type
    CHECK (
        (role = 'SUPER_ADMIN' AND hostel_type = 'all') OR
        (role = 'WARDEN' AND hostel_type IN ('mens', 'ladies', 'unassigned'))
    );

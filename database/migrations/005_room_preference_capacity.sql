ALTER TABLE Student ADD COLUMN IF NOT EXISTS room_preference INTEGER;

ALTER TABLE Student
    ALTER COLUMN room_preference TYPE INTEGER
    USING CASE
        WHEN lower(btrim(room_preference::text)) = 'single' THEN 1
        WHEN btrim(room_preference::text) ~ '^(1|2|3|4|6|8)$'
            THEN btrim(room_preference::text)::integer
        ELSE NULL
    END;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'check_student_room_preference'
    ) THEN
        ALTER TABLE Student
            ADD CONSTRAINT check_student_room_preference
            CHECK (room_preference IN (1, 2, 3, 4, 6, 8));
    END IF;
END;
$$;

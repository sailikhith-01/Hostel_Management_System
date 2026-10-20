-- Sample Hostel Management System data for local development.
-- Safe to run more than once. Run database/schema.sql first.
BEGIN;

-- Development-only plaintext sign-in for the sample admin: admin / admin123.
INSERT INTO Admin (username, email, password_hash, full_name, role, hostel_type)
VALUES ('admin', 'admin@example.edu', 'admin123', 'System Administrator', 'SUPER_ADMIN', 'all')
ON CONFLICT (username) DO UPDATE
SET email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    hostel_type = EXCLUDED.hostel_type;

-- Keep the two supported fine types available even if this seed is used
-- with an already-created schema.
INSERT INTO FineType (name, base_amount)
VALUES
    ('Late entry', 100.00),
    ('Heavy electric appliances fine', 500.00)
ON CONFLICT (name) DO UPDATE
SET base_amount = EXCLUDED.base_amount;

-- All sample students use the development plaintext password StudentPass123.
INSERT INTO Student
    (full_name, email, gender, block_number, roll_number, room_preference, password_hash)
VALUES
    ('Arun Kumar', 'arun.kumar@example.edu', 'M', 'A', 'HST001', 4, 'StudentPass123'),
    ('Ravi Shah', 'ravi.shah@example.edu', 'M', 'T', 'HST002', 4, 'StudentPass123'),
    ('Dev Patel', 'dev.patel@example.edu', 'M', 'B', 'HST003', 4, 'StudentPass123'),
    ('Ananya Rao', 'ananya.rao@example.edu', 'F', 'A', 'HST004', 4, 'StudentPass123'),
    ('Meera Iyer', 'meera.iyer@example.edu', 'F', 'S', 'HST005', 4, 'StudentPass123'),
    ('Sara Khan', 'sara.khan@example.edu', 'F', 'I', 'HST006', 4, 'StudentPass123')
ON CONFLICT (email) DO UPDATE
SET full_name = EXCLUDED.full_name,
    gender = EXCLUDED.gender,
    block_number = EXCLUDED.block_number,
    roll_number = EXCLUDED.roll_number,
    room_preference = EXCLUDED.room_preference,
    password_hash = EXCLUDED.password_hash;

INSERT INTO Room (room_number, block_number, capacity, gender)
VALUES
    ('101', 'A', 1, 'M'),
    ('102', 'T', 2, 'M'),
    ('103', 'B', 6, 'M'),
    ('201', 'A', 3, 'F'),
    ('202', 'S', 4, 'F'),
    ('203', 'I', 8, 'F')
ON CONFLICT (room_number, block_number) DO UPDATE
SET capacity = EXCLUDED.capacity,
    gender = EXCLUDED.gender;

-- Create the correct number of beds for each sample room.
INSERT INTO Bed (room_id, bed_label)
SELECT r.room_id, chr(64 + beds.bed_number)
FROM Room r
CROSS JOIN LATERAL generate_series(1, r.capacity) AS beds(bed_number)
WHERE (r.room_number, r.block_number) IN (
    ('101', 'A'), ('102', 'T'), ('103', 'B'),
    ('201', 'A'), ('202', 'S'), ('203', 'I')
)
ON CONFLICT (room_id, bed_label) DO NOTHING;

INSERT INTO RoommatePreference (
    student_id,
    q1_bedtime,
    q2_wakeup,
    q3_tidiness,
    q4_study_style,
    q5_study_hours,
    q6_food,
    q7_noise_tolerance,
    q8_visitors_social,
    q9_weekends,
    q10_share_belongings
)
SELECT s.student_id, p.q1, p.q2, p.q3, p.q4, p.q5, p.q6, p.q7, p.q8, p.q9, p.q10
FROM (VALUES
    ('arun.kumar@example.edu', 1, 1, 4, 'silent', 4, 'veg', 2, 2, 'hostel', 2),
    ('ravi.shah@example.edu', 3, 3, 3, 'group', 2, 'nonveg', 4, 4, 'home', 4),
    ('dev.patel@example.edu', 2, 2, 3, 'library', 3, 'egg', 3, 3, 'hostel', 3),
    ('ananya.rao@example.edu', 2, 1, 5, 'silent', 4, 'veg', 2, 2, 'home', 2),
    ('meera.iyer@example.edu', 3, 2, 4, 'library', 3, 'egg', 3, 3, 'hostel', 3),
    ('sara.khan@example.edu', 4, 3, 2, 'music', 1, 'nonveg', 5, 4, 'out', 4)
) AS p(email, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10)
JOIN Student s ON s.email = p.email
ON CONFLICT (student_id) DO UPDATE
SET q1_bedtime = EXCLUDED.q1_bedtime,
    q2_wakeup = EXCLUDED.q2_wakeup,
    q3_tidiness = EXCLUDED.q3_tidiness,
    q4_study_style = EXCLUDED.q4_study_style,
    q5_study_hours = EXCLUDED.q5_study_hours,
    q6_food = EXCLUDED.q6_food,
    q7_noise_tolerance = EXCLUDED.q7_noise_tolerance,
    q8_visitors_social = EXCLUDED.q8_visitors_social,
    q9_weekends = EXCLUDED.q9_weekends,
    q10_share_belongings = EXCLUDED.q10_share_belongings;

-- Give each sample student one bed in a room that matches their gender.
INSERT INTO Allocation (student_id, bed_id)
SELECT s.student_id, b.bed_id
FROM (VALUES
    ('arun.kumar@example.edu', '101', 'A', 'A'),
    ('ravi.shah@example.edu', '102', 'T', 'A'),
    ('dev.patel@example.edu', '103', 'B', 'A'),
    ('ananya.rao@example.edu', '201', 'A', 'A'),
    ('meera.iyer@example.edu', '202', 'S', 'A'),
    ('sara.khan@example.edu', '203', 'I', 'A')
) AS assignment(email, room_number, block_number, bed_label)
JOIN Student s ON s.email = assignment.email
JOIN Room r
    ON r.room_number = assignment.room_number
   AND r.block_number = assignment.block_number
JOIN Bed b
    ON b.room_id = r.room_id
   AND b.bed_label = assignment.bed_label
ON CONFLICT DO NOTHING;

-- Keep each bed's display flag consistent with the allocation records.
UPDATE Bed b
SET is_occupied = EXISTS (
    SELECT 1
    FROM Allocation a
    WHERE a.bed_id = b.bed_id
)
WHERE b.room_id IN (
    SELECT r.room_id
    FROM Room r
    WHERE (r.room_number, r.block_number) IN (
        ('101', 'A'), ('102', 'T'), ('103', 'B'),
        ('201', 'A'), ('202', 'S'), ('203', 'I')
    )
);

-- This is an exit log, so it does not trigger the late-entry fine rule.
INSERT INTO GateLog (student_id, direction, logged_at)
SELECT s.student_id, 'OUT', TIMESTAMP '2026-10-18 18:00:00'
FROM Student s
WHERE s.email = 'arun.kumar@example.edu'
  AND NOT EXISTS (
      SELECT 1
      FROM GateLog existing
      WHERE existing.student_id = s.student_id
        AND existing.direction = 'OUT'
        AND existing.logged_at = TIMESTAMP '2026-10-18 18:00:00'
  );

-- Add two example fines; the static reasons make re-running this script safe.
INSERT INTO Fine (
    student_id, fine_type_id, amount, reason, issued_on, due_date, status
)
SELECT
    s.student_id,
    ft.fine_type_id,
    ft.base_amount,
    sample.reason,
    DATE '2026-10-01',
    DATE '2026-10-15',
    sample.status
FROM (VALUES
    ('arun.kumar@example.edu', 'Late entry', 'Sample late-entry fine', 'unpaid'),
    ('meera.iyer@example.edu', 'Heavy electric appliances fine',
     'Sample appliance fine', 'paid')
) AS sample(email, fine_type_name, reason, status)
JOIN Student s ON s.email = sample.email
JOIN FineType ft ON ft.name = sample.fine_type_name
WHERE NOT EXISTS (
    SELECT 1
    FROM Fine existing
    WHERE existing.student_id = s.student_id
      AND existing.fine_type_id = ft.fine_type_id
      AND existing.reason = sample.reason
);

INSERT INTO FinePayment (fine_id, amount, paid_on, mode)
SELECT f.fine_id, f.amount, TIMESTAMP '2026-10-05 12:00:00', 'UPI'
FROM Fine f
JOIN Student s ON s.student_id = f.student_id
JOIN FineType ft ON ft.fine_type_id = f.fine_type_id
WHERE s.email = 'meera.iyer@example.edu'
  AND ft.name = 'Heavy electric appliances fine'
  AND f.reason = 'Sample appliance fine'
  AND NOT EXISTS (
      SELECT 1
      FROM FinePayment existing
      WHERE existing.fine_id = f.fine_id
        AND existing.mode = 'UPI'
        AND existing.paid_on = TIMESTAMP '2026-10-05 12:00:00'
  );

INSERT INTO Complaint (
    student_id, room_number, block_number, description, category, priority,
    confidence, auto_tagged
)
SELECT
    s.student_id, '101', 'A',
    'Water is leaking from the bathroom tap.',
    'Plumbing', 'medium', 0.870, true
FROM Student s
WHERE s.email = 'arun.kumar@example.edu'
  AND NOT EXISTS (
      SELECT 1
      FROM Complaint existing
      WHERE existing.student_id = s.student_id
        AND existing.description = 'Water is leaking from the bathroom tap.'
  );

-- Seed/reset the full 400-room inventory across the valid men's and ladies' blocks.
-- The inventory room IDs use the INV prefix so this operation is safe to repeat.
CREATE TEMP TABLE seed_room_inventory ON COMMIT DROP AS
WITH capacity_counts(capacity, room_count) AS (
    VALUES (1, 50), (2, 50), (3, 50), (4, 100), (6, 100), (8, 50)
),
room_slots AS (
    SELECT counts.capacity,
           slots.room_sequence,
           CASE WHEN slots.room_sequence <= counts.room_count / 2 THEN 'M' ELSE 'F' END AS gender
    FROM capacity_counts counts
    CROSS JOIN LATERAL generate_series(1, counts.room_count) AS slots(room_sequence)
),
gender_slots AS (
    SELECT capacity,
           room_sequence,
           gender,
           row_number() OVER (
               PARTITION BY gender
               ORDER BY capacity, room_sequence
           ) AS gender_room_number
    FROM room_slots
),
numbered_rooms AS (
    SELECT capacity,
           gender,
           gender_room_number,
           row_number() OVER (ORDER BY gender, capacity, room_sequence) AS inventory_room_number
    FROM gender_slots
)
SELECT 'INV' || lpad(inventory_room_number::text, 3, '0') AS room_number,
       blocks.block_number,
       numbered_rooms.capacity,
       numbered_rooms.gender
FROM numbered_rooms
JOIN (VALUES
    ('M', 1, 'A'), ('M', 2, 'B'), ('M', 3, 'C'), ('M', 4, 'D'),
    ('M', 5, 'E'), ('M', 6, 'F'), ('M', 7, 'G'), ('M', 8, 'H'),
    ('M', 9, 'I'), ('M', 10, 'J'), ('M', 11, 'K'), ('M', 12, 'L'),
    ('M', 13, 'M'), ('M', 14, 'N'), ('M', 15, 'O'), ('M', 16, 'P'),
    ('M', 17, 'Q'), ('M', 18, 'R'), ('M', 19, 'S'), ('M', 20, 'T'),
    ('F', 1, 'A'), ('F', 2, 'B'), ('F', 3, 'C'), ('F', 4, 'D'),
    ('F', 5, 'E'), ('F', 6, 'F'), ('F', 7, 'G'), ('F', 8, 'H'),
    ('F', 9, 'I'), ('F', 10, 'S')
) AS blocks(gender, block_index, block_number)
  ON blocks.gender = numbered_rooms.gender
 AND blocks.block_index = (
    (gender_room_number - 1) %
    CASE WHEN numbered_rooms.gender = 'M' THEN 20 ELSE 10 END
 ) + 1;

DELETE FROM MatchGroup match_group
USING Room room
WHERE match_group.room_id = room.room_id
  AND room.room_number LIKE 'INV%'
  AND NOT EXISTS (
      SELECT 1 FROM seed_room_inventory inventory
      WHERE inventory.room_number = room.room_number
        AND inventory.block_number = room.block_number
  );

DELETE FROM Allocation allocation
USING Bed bed
JOIN Room room ON room.room_id = bed.room_id
WHERE allocation.bed_id = bed.bed_id
  AND room.room_number LIKE 'INV%'
  AND NOT EXISTS (
      SELECT 1 FROM seed_room_inventory inventory
      WHERE inventory.room_number = room.room_number
        AND inventory.block_number = room.block_number
  );

DELETE FROM Bed bed
USING Room room
WHERE bed.room_id = room.room_id
  AND room.room_number LIKE 'INV%'
  AND NOT EXISTS (
      SELECT 1 FROM seed_room_inventory inventory
      WHERE inventory.room_number = room.room_number
        AND inventory.block_number = room.block_number
  );

DELETE FROM Room room
WHERE room.room_number LIKE 'INV%'
  AND NOT EXISTS (
      SELECT 1 FROM seed_room_inventory inventory
      WHERE inventory.room_number = room.room_number
        AND inventory.block_number = room.block_number
  );

DELETE FROM MatchGroup match_group
USING Room room
JOIN seed_room_inventory inventory
  ON inventory.room_number = room.room_number
 AND inventory.block_number = room.block_number
WHERE match_group.room_id = room.room_id;

DELETE FROM Allocation allocation
USING Bed bed
JOIN Room room ON room.room_id = bed.room_id
JOIN seed_room_inventory inventory
  ON inventory.room_number = room.room_number
 AND inventory.block_number = room.block_number
WHERE allocation.bed_id = bed.bed_id;

DELETE FROM Bed bed
USING Room room
JOIN seed_room_inventory inventory
  ON inventory.room_number = room.room_number
 AND inventory.block_number = room.block_number
WHERE bed.room_id = room.room_id;

INSERT INTO Room (room_number, block_number, capacity, gender)
SELECT room_number, block_number, capacity, gender
FROM seed_room_inventory
ON CONFLICT (room_number, block_number) DO UPDATE
SET capacity = EXCLUDED.capacity,
    gender = EXCLUDED.gender;

INSERT INTO Bed (room_id, bed_label)
SELECT room.room_id, chr(64 + beds.bed_number)
FROM Room room
JOIN seed_room_inventory inventory
  ON inventory.room_number = room.room_number
 AND inventory.block_number = room.block_number
CROSS JOIN LATERAL generate_series(1, room.capacity) AS beds(bed_number);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM seed_room_inventory) <> 400
       OR (SELECT COUNT(*) FROM Bed bed
           JOIN Room room ON room.room_id = bed.room_id
           JOIN seed_room_inventory inventory
             ON inventory.room_number = room.room_number
            AND inventory.block_number = room.block_number) <> 1700
       OR EXISTS (
           SELECT 1
           FROM Room room
           JOIN seed_room_inventory inventory
             ON inventory.room_number = room.room_number
            AND inventory.block_number = room.block_number
           LEFT JOIN Bed bed ON bed.room_id = room.room_id
           GROUP BY room.room_id, room.capacity
           HAVING COUNT(bed.bed_id) <> room.capacity
       ) THEN
        RAISE EXCEPTION '400-room inventory has an invalid room or bed distribution';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM (VALUES
            ('M', 'A'), ('M', 'B'), ('M', 'C'), ('M', 'D'), ('M', 'E'),
            ('M', 'F'), ('M', 'G'), ('M', 'H'), ('M', 'I'), ('M', 'J'),
            ('M', 'K'), ('M', 'L'), ('M', 'M'), ('M', 'N'), ('M', 'O'),
            ('M', 'P'), ('M', 'Q'), ('M', 'R'), ('M', 'S'), ('M', 'T'),
            ('F', 'A'), ('F', 'B'), ('F', 'C'), ('F', 'D'), ('F', 'E'),
            ('F', 'F'), ('F', 'G'), ('F', 'H'), ('F', 'I'), ('F', 'S')
        ) AS expected(gender, block_number)
        WHERE NOT EXISTS (
            SELECT 1
            FROM Room room
            JOIN seed_room_inventory inventory
              ON inventory.room_number = room.room_number
             AND inventory.block_number = room.block_number
            WHERE room.gender = expected.gender
              AND room.block_number = expected.block_number
        )
    ) THEN
        RAISE EXCEPTION 'Inventory must include rooms in every valid gender/block combination';
    END IF;
    IF EXISTS (
        SELECT expected.capacity
        FROM (VALUES
            (1, 50), (2, 50), (3, 50), (4, 100), (6, 100), (8, 50)
        ) AS expected(capacity, room_count)
        LEFT JOIN (
            SELECT room.capacity, COUNT(*) AS room_count
            FROM Room room
            JOIN seed_room_inventory inventory
              ON inventory.room_number = room.room_number
             AND inventory.block_number = room.block_number
            GROUP BY room.capacity
        ) actual ON actual.capacity = expected.capacity
        WHERE COALESCE(actual.room_count, 0) <> expected.room_count
    ) THEN
        RAISE EXCEPTION '400-room inventory capacity distribution does not match specification';
    END IF;
END;
$$;

COMMIT;

-- Quick checks: 6 demo students, 400 inventory rooms, 1,700 inventory beds, and 2 fine types.
SELECT COUNT(*) AS sample_students FROM Student
WHERE email LIKE '%@example.edu';
SELECT COUNT(*) AS sample_rooms FROM Room
WHERE (room_number, block_number) IN (
    ('101', 'A'), ('102', 'T'), ('103', 'B'),
    ('201', 'A'), ('202', 'S'), ('203', 'I')
);
SELECT capacity, COUNT(*) AS rooms, SUM(capacity) AS beds
FROM Room
WHERE room_number LIKE 'INV%'
GROUP BY capacity
ORDER BY capacity;
SELECT name, base_amount FROM FineType ORDER BY name;

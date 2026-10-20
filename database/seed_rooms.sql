-- Seed/reset the 400-room vacant inventory.
-- Run after database/schema.sql and the user-management migrations.
-- This script intentionally releases allocations made in rooms named INV001-INV400.
-- It seeds one 400-room inventory across every valid gender/block combination:
-- 10 rooms per male block and 20 rooms per female block, with 1,700 beds total.
BEGIN;

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
           room_sequence,
           gender,
           gender_room_number,
           row_number() OVER (
               ORDER BY gender, capacity, room_sequence
           ) AS inventory_room_number
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
CROSS JOIN LATERAL generate_series(1, room.capacity) AS beds(bed_number)
ON CONFLICT (room_id, bed_label) DO NOTHING;

UPDATE Bed bed
SET is_occupied = FALSE
FROM Room room
JOIN seed_room_inventory inventory
  ON inventory.room_number = room.room_number
 AND inventory.block_number = room.block_number
WHERE bed.room_id = room.room_id;

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM seed_room_inventory) <> 400 THEN
        RAISE EXCEPTION 'Expected 400 inventory rooms';
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
        RAISE EXCEPTION 'Inventory capacity distribution does not match specification';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM Room room
        JOIN seed_room_inventory inventory
          ON inventory.room_number = room.room_number
         AND inventory.block_number = room.block_number
        LEFT JOIN Bed bed ON bed.room_id = room.room_id
        GROUP BY room.room_id, room.capacity
        HAVING COUNT(bed.bed_id) <> room.capacity
            OR COUNT(bed.bed_id) FILTER (WHERE bed.is_occupied) <> 0
            OR BOOL_OR(bed.bed_id IS NULL)
    ) THEN
        RAISE EXCEPTION 'Inventory contains occupied rooms or incomplete beds';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM Bed bed
        JOIN Room room ON room.room_id = bed.room_id
        JOIN seed_room_inventory inventory
          ON inventory.room_number = room.room_number
         AND inventory.block_number = room.block_number
    ) <> 1700 THEN
        RAISE EXCEPTION 'Expected exactly 1700 beds across the 400 inventory rooms';
    END IF;
END;
$$;

COMMIT;

SELECT capacity, COUNT(*) AS rooms
FROM Room
WHERE room_number LIKE 'INV%'
GROUP BY capacity
ORDER BY capacity;

SELECT block_number, gender, COUNT(*) AS rooms, SUM(capacity) AS beds
FROM Room
WHERE room_number LIKE 'INV%'
GROUP BY block_number, gender
ORDER BY gender, block_number;

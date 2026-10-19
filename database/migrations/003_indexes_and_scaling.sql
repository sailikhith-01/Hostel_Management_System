-- ============================================================================
-- MIGRATION 003: Indexes and Constraints for Enterprise Scaling
-- Safe to execute against existing databases without data loss.
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

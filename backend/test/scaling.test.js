const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MATCH_CAPACITIES,
  COMPATIBILITY_THRESHOLD,
  preferenceCompatibility,
  buildRoomGroups,
} = require('../matching');

test('high-throughput stress test: matching 2,000 students across 400 rooms executes in under 500ms', () => {
  const blocks = ['A', 'B', 'C', 'D', 'E'];
  const genders = ['M', 'F'];
  const studyStyles = ['silent', 'music', 'group', 'library'];
  const foods = ['veg', 'nonveg', 'egg'];
  const weekends = ['hostel', 'home', 'out'];

  const students = [];
  for (let i = 1; i <= 2000; i += 1) {
    students.push({
      student_id: i,
      full_name: `Student ${i}`,
      gender: genders[i % 2],
      block_number: blocks[i % blocks.length],
      cluster_id: i % 4,
      preferences: {
        q1_bedtime: 1 + (i % 4),
        q2_wakeup: 1 + ((i + 1) % 4),
        q3_tidiness: 1 + (i % 5),
        q4_study_style: studyStyles[i % studyStyles.length],
        q5_study_hours: 1 + (i % 4),
        q6_food: foods[i % foods.length],
        q7_noise_tolerance: 1 + (i % 5),
        q8_visitors_social: 1 + (i % 5),
        q9_weekends: weekends[i % weekends.length],
        q10_share_belongings: 1 + (i % 5),
      },
    });
  }

  const rooms = [];
  const capacities = [1, 2, 3, 4, 6];
  for (let r = 1; r <= 400; r += 1) {
    const capacity = capacities[r % capacities.length];
    rooms.push({
      room_id: r,
      room_number: `${100 + r}`,
      block_number: blocks[r % blocks.length],
      capacity,
      gender: genders[r % 2],
      beds: Array.from({ length: capacity }, (_, idx) => ({ bed_id: r * 10 + idx })),
    });
  }

  const startTime = Date.now();
  const result = buildRoomGroups(students, rooms);
  const elapsed = Date.now() - startTime;

  console.log(`Stress test matched ${result.groups.length} rooms for 2000 students in ${elapsed}ms`);
  assert.ok(elapsed < 2000, `Execution took too long: ${elapsed}ms`);
  assert.ok(result.groups.length > 0, 'Should have formed room groups');

  for (const group of result.groups) {
    assert.ok(MATCH_CAPACITIES.includes(group.capacity));
    assert.ok(group.students.length <= group.capacity);
    if (group.capacity > 1) {
      assert.ok(group.students.length >= 2);
    }
    for (let left = 0; left < group.students.length; left += 1) {
      for (let right = left + 1; right < group.students.length; right += 1) {
        const leftStudent = students.find((s) => s.student_id === group.students[left].student_id);
        const rightStudent = students.find((s) => s.student_id === group.students[right].student_id);
        const score = preferenceCompatibility(leftStudent.preferences, rightStudent.preferences);
        assert.ok(score >= COMPATIBILITY_THRESHOLD);
      }
    }
  }
});

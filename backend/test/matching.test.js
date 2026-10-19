const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MATCH_CAPACITIES,
  COMPATIBILITY_THRESHOLD,
  preferenceCompatibility,
  buildRoomGroups,
} = require('../matching');

const compatiblePreferences = {
  q1_bedtime: 2,
  q2_wakeup: 2,
  q3_tidiness: 3,
  q4_study_style: 'library',
  q5_study_hours: 3,
  q6_food: 'veg',
  q7_noise_tolerance: 3,
  q8_visitors_social: 3,
  q9_weekends: 'hostel',
  q10_share_belongings: 3,
};

function student(studentId, gender, clusterId, overrides = {}) {
  return {
    student_id: studentId,
    full_name: `Student ${studentId}`,
    gender,
    block_number: 'A',
    cluster_id: clusterId,
    preferences: { ...compatiblePreferences, ...overrides },
  };
}

function room(roomId, capacity, gender, bedCount = capacity) {
  return {
    room_id: roomId,
    room_number: String(roomId),
    block_number: 'A',
    capacity,
    gender,
    beds: Array.from({ length: bedCount }, (_, index) => ({ bed_id: index + 1 })),
  };
}

test('room groups stay within allowed capacity, gender, cluster and pairwise compatibility', () => {
  const incompatible = {
    q1_bedtime: 4,
    q2_wakeup: 4,
    q3_tidiness: 1,
    q4_study_style: 'music',
    q5_study_hours: 1,
    q6_food: 'nonveg',
    q7_noise_tolerance: 5,
    q8_visitors_social: 5,
    q9_weekends: 'out',
    q10_share_belongings: 5,
  };
  const students = [
    student(1, 'M', 0),
    student(2, 'M', 0),
    student(3, 'M', 0, incompatible),
    student(4, 'M', 1),
    student(5, 'F', 0),
    student(6, 'F', 0),
  ];
  const result = buildRoomGroups(students, [
    room(10, 4, 'M'),
    room(11, 2, 'F'),
    room(13, 3, 'M', 2),
    room(14, 5, 'M'),
  ]);

  assert.deepEqual(MATCH_CAPACITIES, [1, 2, 3, 4, 6, 8]);
  for (const group of result.groups) {
    assert.ok(MATCH_CAPACITIES.includes(group.capacity));
    assert.ok(group.students.length <= group.capacity);
    assert.ok(group.students.every((member) =>
      students.find((candidate) => candidate.student_id === member.student_id).gender === group.gender));
    assert.ok(group.students.every((member) => member.cluster_id === group.cluster_id));
    if (group.capacity > 1) assert.ok(group.students.length >= 2);
    for (let left = 0; left < group.students.length; left += 1) {
      for (let right = left + 1; right < group.students.length; right += 1) {
        const first = students.find((candidate) => candidate.student_id === group.students[left].student_id);
        const second = students.find((candidate) => candidate.student_id === group.students[right].student_id);
        assert.ok(preferenceCompatibility(first.preferences, second.preferences) >= COMPATIBILITY_THRESHOLD);
      }
    }
  }

  const firstRoomGroup = result.groups.find((group) => group.room_id === 10);
  assert.deepEqual(firstRoomGroup.students.map((member) => member.student_id).sort(), [1, 2]);
  assert.ok(result.unmatched_student_ids.includes(3));
  assert.ok(result.unmatched_student_ids.includes(4));
  assert.ok(!firstRoomGroup.students.some((member) => member.student_id === 4));
});

test('single rooms can take one student but shared rooms never receive a solo allocation', () => {
  const result = buildRoomGroups(
    [student(1, 'M', 0)],
    [room(1, 4, 'M'), room(2, 1, 'M')],
  );
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].room_id, 2);
  assert.equal(result.groups[0].students.length, 1);
  assert.deepEqual(result.unmatched_student_ids, []);
});

test('preference compatibility is symmetric and bounded', () => {
  const left = compatiblePreferences;
  const right = { ...left, q2_wakeup: 4, q4_study_style: 'music', q6_food: 'egg' };
  assert.equal(preferenceCompatibility(left, right), preferenceCompatibility(right, left));
  assert.ok(preferenceCompatibility(left, right) >= 0);
  assert.ok(preferenceCompatibility(left, right) <= 1);
});

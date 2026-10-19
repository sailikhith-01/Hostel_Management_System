const MATCH_CAPACITIES = [1, 2, 3, 4, 6, 8];
const COMPATIBILITY_THRESHOLD = 0.65;

function preferenceCompatibility(left, right) {
  const scaledQuestions = [
    ['q1_bedtime', 3], ['q2_wakeup', 3], ['q3_tidiness', 4],
    ['q5_study_hours', 3], ['q7_noise_tolerance', 4],
    ['q8_visitors_social', 4], ['q10_share_belongings', 4],
  ];
  const numericScore = scaledQuestions.reduce(
    (score, [key, range]) => score + (1 - Math.abs(left[key] - right[key]) / range), 0,
  ) / scaledQuestions.length;
  const categoricalScore = [
    left.q4_study_style === right.q4_study_style,
    left.q6_food === right.q6_food,
    left.q9_weekends === right.q9_weekends,
  ].filter(Boolean).length / 3;
  return Number((numericScore * 0.7 + categoricalScore * 0.3).toFixed(3));
}

function buildRoomGroups(students, rooms) {
  const unassigned = new Set(students.map((student) => student.student_id));
  const byId = new Map(students.map((student) => [student.student_id, student]));
  const groups = [];

  // Partition students by gender and hostel block for high-throughput matching at scale
  const studentsByBlock = new Map();
  for (const student of students) {
    const key = `${student.gender}:${student.block_number}`;
    if (!studentsByBlock.has(key)) {
      studentsByBlock.set(key, []);
    }
    studentsByBlock.get(key).push(student);
  }

  for (const room of rooms) {
    if (!MATCH_CAPACITIES.includes(room.capacity) || room.beds.length !== room.capacity) continue;
    const blockKey = `${room.gender}:${room.block_number}`;
    const blockPool = studentsByBlock.get(blockKey) || [];
    const candidates = blockPool.filter((student) => unassigned.has(student.student_id));
    if (candidates.length === 0) continue;

    // Partition candidates by cluster_id so seeds only evaluate same-cluster peers
    const candidatesByCluster = new Map();
    for (const c of candidates) {
      if (!candidatesByCluster.has(c.cluster_id)) {
        candidatesByCluster.set(c.cluster_id, []);
      }
      candidatesByCluster.get(c.cluster_id).push(c);
    }

    let bestGroup = [];
    let bestAverage = -1;

    for (const clusterCandidates of candidatesByCluster.values()) {
      for (const seed of clusterCandidates) {
        const group = [seed];
        const possible = clusterCandidates
          .filter((candidate) => candidate.student_id !== seed.student_id)
          .map((candidate) => ({
            student: candidate,
            score: preferenceCompatibility(seed.preferences, candidate.preferences),
          }))
          .filter((candidate) => candidate.score >= COMPATIBILITY_THRESHOLD)
          .sort((left, right) => right.score - left.score);

        for (const candidate of possible) {
          if (group.length >= room.capacity) break;
          if (group.every((member) =>
            preferenceCompatibility(member.preferences, candidate.student.preferences) >= COMPATIBILITY_THRESHOLD)) {
            group.push(candidate.student);
          }
        }
        const pairScores = [];
        for (let left = 0; left < group.length; left += 1) {
          for (let right = left + 1; right < group.length; right += 1) {
            pairScores.push(preferenceCompatibility(group[left].preferences, group[right].preferences));
          }
        }
        const average = pairScores.length
          ? pairScores.reduce((sum, score) => sum + score, 0) / pairScores.length
          : 1;
        if (group.length > bestGroup.length || (group.length === bestGroup.length && average > bestAverage)) {
          bestGroup = group;
          bestAverage = average;
        }
      }
    }

    if (bestGroup.length) {
      if (room.capacity > 1 && bestGroup.length < 2) continue;
      bestGroup.forEach((student) => unassigned.delete(student.student_id));
      groups.push({
        room_id: room.room_id,
        room_number: room.room_number,
        block_number: room.block_number,
        gender: room.gender,
        capacity: room.capacity,
        cluster_id: bestGroup[0].cluster_id,
        students: bestGroup.map((student) => ({
          student_id: student.student_id,
          full_name: student.full_name,
          cluster_id: student.cluster_id,
          compatibility: bestGroup
            .filter((member) => member.student_id !== student.student_id)
            .map((member) => ({
              student_id: member.student_id,
              score: preferenceCompatibility(student.preferences, member.preferences),
            })),
        })),
      });
    }
  }
  return { groups, unmatched_student_ids: [...unassigned].map((id) => byId.get(id).student_id) };
}

module.exports = {
  MATCH_CAPACITIES,
  COMPATIBILITY_THRESHOLD,
  preferenceCompatibility,
  buildRoomGroups,
};

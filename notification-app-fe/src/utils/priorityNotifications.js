const typeWeight = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

function toTime(value) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function getPriorityNotifications(notifications, limit = 5) {
  return [...notifications]
    .filter((notification) => !notification.viewed)
    .sort((left, right) => {
      const leftScore = typeWeight[left.type] ?? 0;
      const rightScore = typeWeight[right.type] ?? 0;

      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      return toTime(right.createdAt) - toTime(left.createdAt);
    })
    .slice(0, limit);
}

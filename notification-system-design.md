# Notification System Design

## Stage 1

The notification service should expose a small REST contract around creating, reading, and updating notifications. I would keep the API resource focused on notifications instead of mixing it with users or placement modules.

### Main endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/notifications` | List notifications for the logged-in student |
| `GET` | `/notifications/:id` | Read one notification |
| `POST` | `/notifications` | Create a notification from an internal/admin service |
| `PATCH` | `/notifications/:id/read` | Mark one notification as read |
| `PATCH` | `/notifications/read-all` | Mark all visible notifications as read |

### Query parameters for list API

`GET /notifications?page=1&limit=20&notification_type=Placement`

`page` and `limit` handle pagination. `notification_type` is optional and supports `Placement`, `Event`, and `Result`.

### JSON response

```json
{
  "notifications": [
    {
      "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
      "type": "Result",
      "message": "mid-sem",
      "timestamp": "2026-04-22 17:51:30",
      "isRead": false
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 58
}
```

The frontend should log the start and failure of important API calls using the shared logging middleware. Example: when fetching notifications starts, log package `api`; when a page or filter changes, log package `page`.

## Stage 2

I would choose PostgreSQL for persistent storage. Notifications are structured data, queries are mostly filtered by student, read status, type, and time, and PostgreSQL handles this pattern well with indexes. It also gives good safety for future joins with students, batches, departments, and placement events.

### Suggested schema

```sql
CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  student_id BIGINT NOT NULL,
  notification_type notification_type NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  read_at TIMESTAMP NULL
);
```

As data grows, the main problem will be slow reads for unread notifications and large scans by `student_id`. I would solve that first with correct indexes and then with archiving/partitioning if the table becomes very large.

## Stage 3

The given query is logically correct, but it will become slow when a student has many rows or the table has millions of rows:

```sql
SELECT *
FROM notifications
WHERE student_id = 1042 AND is_read = false
ORDER BY created_at ASC;
```

The issue is that the database may scan many rows before sorting. Adding separate indexes on each column is not as effective because the database still has to combine them and sort.

Better index:

```sql
CREATE INDEX idx_notifications_student_unread_time
ON notifications (student_id, is_read, created_at DESC);
```

Better query for the UI:

```sql
SELECT id, notification_type, message, is_read, created_at
FROM notifications
WHERE student_id = 1042
  AND is_read = false
ORDER BY created_at DESC
LIMIT 20;
```

To find all students who received placement notifications in the last 7 days:

```sql
SELECT DISTINCT student_id
FROM notifications
WHERE notification_type = 'Placement'
  AND created_at >= now() - interval '7 days';
```

## Stage 4

Fetching notifications on every page load for every student will add unnecessary load. I would improve it in layers:

1. Use pagination and only fetch the first page initially.
2. Cache recent notification responses on the client for a short time.
3. Store unread count separately or compute it with a small indexed query.
4. Use polling only when needed, for example every 30 to 60 seconds while the user is active.
5. For very active systems, use push updates through WebSocket/SSE for unread count or new notification events.

The tradeoff is complexity. Polling is easier but wastes requests. WebSocket/SSE is faster for real-time updates but needs more backend work and connection handling. For this task, paginated API calls plus a short client cache are enough.

## Stage 5

The current pseudocode sends an email, saves to DB, and pushes an in-app notification inside one loop:

```text
for student_id in student_ids:
  send_email(student_id, message)
  save_to_db(student_id, message)
  push_to_app(student_id, message)
```

This is risky because one email failure can slow or block the whole process. If `send_email` fails for 200 students midway, the remaining work may become unclear.

I would save notification records first, then enqueue email and app delivery jobs separately.

```text
function notify_all(student_ids, message):
  notification_batch_id = create_batch(message)

  for student_id in student_ids:
    save_notification(student_id, message, notification_batch_id)
    enqueue_email_job(student_id, message, notification_batch_id)
    enqueue_app_push_job(student_id, message, notification_batch_id)

  return notification_batch_id
```

DB save and delivery should not be treated as one transaction. The notification record is the source of truth. Email and push can retry independently. Logs should be placed around batch creation, queue failure, and retry exhaustion.

## Stage 6

Priority notifications should be selected by a simple score and then by recency. In this implementation I used:

`Placement > Result > Event`, then newest first.

```javascript
const typeWeight = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

function getPriorityNotifications(notifications, limit = 5) {
  return [...notifications]
    .filter((notification) => !notification.viewed)
    .sort((left, right) => {
      const typeDifference = typeWeight[right.type] - typeWeight[left.type];
      if (typeDifference !== 0) return typeDifference;
      return new Date(right.createdAt) - new Date(left.createdAt);
    })
    .slice(0, limit);
}
```

This keeps the rule easy to explain and easy to change later if product wants a different ranking.

## Stage 7

The frontend implementation has:

- an all notifications view
- a priority inbox view
- filter by notification type
- pagination using `page` and `limit`
- local viewed/new state
- API fallback data so the UI remains usable if the protected test API is not reachable
- logging middleware calls in `component`, `api`, `hook`, `page`, and `state`

The logs are placed where I would normally add them while debugging a production issue: app opened, fetch started, API returned data, fallback used, state loaded, tab changed, filter changed, page changed, and notification marked viewed.

## Notification App Backend

Small Node.js backend for the campus notification app.

### Run

```bash
npm start
```

Default port: `4000`

### Endpoints

- `GET /health`
- `GET /notifications?page=1&limit=5&notification_type=Placement`
- `POST /notifications`
- `PATCH /notifications/:id/viewed`

The backend uses the shared `Log(stack, level, package, message)` function from `logging-middleware`.

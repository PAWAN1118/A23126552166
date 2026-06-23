import http from "node:http";
import { URL } from "node:url";
import { randomUUID } from "node:crypto";
import { Log } from "../logging-middleware/index.js";

const port = Number(process.env.PORT ?? 4000);
const allowedTypes = new Set(["Event", "Result", "Placement"]);

const notifications = [
  {
    id: "d146095a-0d86-4a34-9e69-3900a14576bc",
    type: "Result",
    message: "mid-sem",
    createdAt: "2026-04-22 17:51:30",
    viewed: false,
  },
  {
    id: "b283218f-ea5a-4b7c-93a9-1f2f240d64b0",
    type: "Placement",
    message: "CSX Corporation hiring",
    createdAt: "2026-04-22 17:51:18",
    viewed: false,
  },
  {
    id: "81589ada-0ad3-4f77-9554-f52fb558e09d",
    type: "Event",
    message: "farewell",
    createdAt: "2026-04-22 17:51:06",
    viewed: false,
  },
  {
    id: "e005513a-142b-4bbc-8678-eefec65e1ede",
    type: "Result",
    message: "mid-sem",
    createdAt: "2026-04-22 17:50:54",
    viewed: true,
  },
  {
    id: "ea836726-c25e-4f21-a72f-544a6af8a37f",
    type: "Result",
    message: "project-review",
    createdAt: "2026-04-22 17:50:42",
    viewed: false,
  },
  {
    id: "e03cb427-8fc6-47f7-bb00-be228f6b2dc",
    type: "Result",
    message: "external",
    createdAt: "2026-04-22 17:50:30",
    viewed: true,
  },
];

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if(!chucks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function listNotifications(searchParams) {
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 10)));
  const type = searchParams.get("notification_type");

  const filtered =
    type && allowedTypes.has(type)
      ? notifications.filter((notification) => notification.type === type)
      : notifications;

  const start = (page - 1) * limit;

  return {
    notifications: filtered.slice(start, start + limit),
    page,
    limit,
    total: filtered.length,
  };
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    await Log("backend", "info", "route", "Health check requested");
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/notifications") {
    const result = listNotifications(url.searchParams);
    await Log("backend", "info", "controller", `Returned ${result.notifications.length} notifications`);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/notifications") {
    const body = await readBody(request);

    if (!allowedTypes.has(body.type) || !body.message) {
      await Log("backend", "warn", "handler", "Rejected invalid notification create request");
      sendJson(response, 400, { message: "type and message are required" });
      return;
    }

    const notification = {
      id: randomUUID(),
      type: body.type,
      message: body.message,
      createdAt: new Date().toISOString(),
      viewed: false,
    };

    notifications.unshift(notification);
    await Log("backend", "info", "service", `Created ${body.type} notification`);
    sendJson(response, 201, notification);
    return;
  }

  const markViewedMatch = url.pathname.match(/^\/notifications\/([^/]+)\/viewed$/);
  if (request.method === "PATCH" && markViewedMatch) {
    const notification = notifications.find((item) => item.id === markViewedMatch[1]);

    if (!notification) {
      await Log("backend", "warn", "repository", `Notification not found: ${markViewedMatch[1]}`);
      sendJson(response, 404, { message: "notification not found" });
      return;
    }

    notification.viewed = true;
    await Log("backend", "info", "service", `Marked notification viewed: ${notification.id}`);
    sendJson(response, 200, notification);
    return;
  }

  await Log("backend", "warn", "route", `${request.method} ${url.pathname} not found`);
  sendJson(response, 404, { message: "route not found" });
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch(async (error) => {
    await Log("backend", "error", "handler", error.message || "Unhandled backend error");
    sendJson(response, 500, { message: "internal server error" });
  });
});

server.listen(port, () => {
  Log("backend", "info", "service", `Notification backend started on port ${port}`);
});

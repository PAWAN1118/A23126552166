import { Log, getAuthHeaders } from "logging-middleware";

const sampleNotifications = [
  {
    id: "n-1",
    title: "Placement drive scheduled",
    message: "AffordMed placement drive registration is open for eligible students.",
    type: "Placement",
    read: false,
    createdAt: "2026-06-23T09:30:00.000Z",
  },
  {
    id: "n-2",
    title: "Round 1 results published",
    message: "Shortlisted candidates can review their status on the student portal.",
    type: "Result",
    read: false,
    createdAt: "2026-06-22T15:45:00.000Z",
  },
  {
    id: "n-3",
    title: "Pre-placement talk",
    message: "Join the online briefing before attempting the full-stack task.",
    type: "Event",
    read: true,
    createdAt: "2026-06-21T11:00:00.000Z",
  },
  {
    id: "n-4",
    title: "Document verification",
    message: "Upload updated resume and roll number details before the deadline.",
    type: "Placement",
    read: true,
    createdAt: "2026-06-20T08:15:00.000Z",
  },
];

const pageSize = 3;
const defaultApiUrl = "http://4.224.186.213/evaluation-service/notifications";

function normalizeNotification(notification) {
  const id = notification.ID ?? notification.id;
  const type = notification.Type ?? notification.type;
  const message = notification.Message ?? notification.message;
  const timestamp = notification.Timestamp ?? notification.createdAt;

  return {
    id,
    type,
    title: `${type} update`,
    message,
    createdAt: timestamp,
    viewed: false,
  };
}

function getLocalNotifications() {
  return sampleNotifications.map((notification) => ({
    ...notification,
    viewed: notification.read,
  }));
}

export async function fetchNotifications({ filter = "All", page = 1, limit = pageSize } = {}) {
  try {
    await Log("frontend", "info", "api", `Started notification fetch: type=${filter}, page=${page}, limit=${limit}`);

    const apiUrl = import.meta.env.VITE_NOTIFICATIONS_API_URL || defaultApiUrl;
    if (apiUrl) {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (filter !== "All") {
        params.set("notification_type", filter);
      }

      const authHeaders = await getAuthHeaders();
      if (!authHeaders.Authorization) {
        throw new Error("Auth token unavailable");
      }

      const response = await fetch(`${apiUrl}?${params.toString()}`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error(`Notifications API failed with status ${response.status}`);
      }

      const data = await response.json();
      const notifications = (data.notifications ?? []).map(normalizeNotification);
      await Log("frontend", "info", "api", `Notification API returned ${notifications.length} records`);

      return {
        notifications,
        total: data.total ?? notifications.length,
        page,
        pageSize: limit,
      };
    }

    throw new Error("Notification API URL missing");
  } catch (error) {
    await Log("frontend", "warn", "api", `${error.message}. Using local notification data.`);

    const localNotifications = getLocalNotifications();
    const filtered =
      filter === "All"
        ? localNotifications
        : localNotifications.filter((notification) => notification.type === filter);

    const start = (Number(page) - 1) * limit;
    const notifications = filtered.slice(start, start + limit);

    return {
      notifications,
      total: filtered.length,
      page,
      pageSize: limit,
    };
  }
}

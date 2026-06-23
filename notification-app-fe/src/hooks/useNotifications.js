import { useState, useEffect, useMemo } from "react";
import { Log } from "logging-middleware";
import { fetchNotifications } from "../api/notifications";
import { getPriorityNotifications } from "../utils/priorityNotifications";

const viewedStorageKey = "campus-notifications-viewed";

function readViewedIds() {
  try {
    return JSON.parse(localStorage.getItem(viewedStorageKey) ?? "[]");
  } catch {
    return [];
  }
}

export function useNotifications({ filter, page, limit = 5 }) {
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(limit);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewedIds, setViewedIds] = useState(readViewedIds);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await fetchNotifications({ filter, page, limit });
        if (!active) return;

        const viewedSet = new Set(readViewedIds());
        const nextNotifications = (data.notifications ?? []).map((notification) => ({
          ...notification,
          viewed: viewedSet.has(notification.id) || Boolean(notification.viewed),
        }));

        setNotifications(nextNotifications);
        setTotal(data.total ?? 0);
        setPageSize(data.pageSize ?? limit);
        await Log("frontend", "info", "hook", `Loaded ${nextNotifications.length} notifications into state`);
      } catch (loadError) {
        if (!active) return;

        setNotifications([]);
        setTotal(0);
        setError(loadError.message || "Unable to load notifications");
        await Log("frontend", "error", "hook", loadError.message || "Unable to load notifications");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [filter, page, limit]);

  const markViewed = async (id) => {
    const nextIds = Array.from(new Set([...viewedIds, id]));
    localStorage.setItem(viewedStorageKey, JSON.stringify(nextIds));
    setViewedIds(nextIds);
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, viewed: true } : notification
      )
    );
    await Log("frontend", "info", "state", `Notification marked viewed: ${id}`);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const unreadCount = notifications.filter((notification) => !notification.viewed).length;
  const priorityNotifications = useMemo(
    () => getPriorityNotifications(notifications, 5),
    [notifications]
  );

  return {
    notifications,
    priorityNotifications,
    total,
    totalPages,
    unreadCount,
    loading,
    error,
    markViewed,
  };
}

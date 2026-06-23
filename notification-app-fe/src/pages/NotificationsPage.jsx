import { useState } from "react";
import { Log } from "logging-middleware";
import {
  Alert,
  Badge,
  Box,
  CircularProgress,
  Divider,
  Pagination,
  Tab,
  Tabs,
  Stack,
  Typography,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";

import { NotificationCard } from "../components/NotificationCard";
import { NotificationFilter } from "../components/NotificationFilter";
import { useNotifications } from "../hooks/useNotifications";

export function NotificationsPage() {
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [view, setView] = useState("all");

  const {
    notifications,
    priorityNotifications,
    totalPages,
    unreadCount,
    loading,
    error,
    markViewed,
  } = useNotifications({ filter, page, limit: 5 });

  const handleFilterChange = (_, newFilter) => {
    const nextFilter = newFilter ?? "All";
    setFilter(nextFilter);
    setPage(1);
    Log("frontend", "info", "page", `Notification filter changed to ${nextFilter}`);
  };

  const handlePageChange = (_, newPage) => {
    setPage(newPage);
    Log("frontend", "info", "page", `Notification page changed to ${newPage}`);
  };

  const handleViewChange = (_, nextView) => {
    setView(nextView);
    setPage(1);
    Log("frontend", "info", "page", `Notification tab changed to ${nextView}`);
  };

  const visibleNotifications = view === "priority" ? priorityNotifications : notifications;

  return (
    <Box sx={{ maxWidth: 720, mx: "auto", px: 2, py: 4 }}>
      <Stack direction="row" spacing={1.5} mb={3} sx={{ alignItems: "center" }}>
        <Badge badgeContent={unreadCount} color="primary" max={99}>
          <NotificationsIcon sx={{ fontSize: 28 }} />
        </Badge>
        <Typography variant="h5" fontWeight={700}>
          Notifications
        </Typography>
      </Stack>

      <Divider sx={{ mb: 3 }} />

      <Tabs value={view} onChange={handleViewChange} sx={{ mb: 3 }}>
        <Tab value="all" label="All Notifications" />
        <Tab value="priority" label="Priority Inbox" />
      </Tabs>

      <Box sx={{ marginBottom: 3 }}>
        <NotificationFilter value={filter} onChange={handleFilterChange} />
      </Box>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && error && (
        <Alert severity="error">Failed to load notifications: {error}</Alert>
      )}

      {!loading && !error && visibleNotifications.length === 0 && (
        <Alert severity="info">No notifications found for this filter.</Alert>
      )}

      {!loading && !error && visibleNotifications.length > 0 && (
        <Stack spacing={1.5}>
          {visibleNotifications.map((n) => (
            <NotificationCard key={n.id} notification={n} onView={markViewed} />
          ))}
        </Stack>
      )}

      {!loading && view === "all" && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={handlePageChange}
            color="primary"
            shape="rounded"
          />
        </Box>
      )}
    </Box>
  );
}

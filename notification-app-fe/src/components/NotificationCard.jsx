import {
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

const formatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function NotificationCard({ notification, onView }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        borderColor: notification.viewed ? "divider" : "primary.light",
        bgcolor: notification.viewed ? "background.paper" : "#f7fbff",
      }}
    >
      <CardActionArea onClick={() => onView(notification.id)}>
        <CardContent>
          <Stack
            direction="row"
            gap={2}
            sx={{ justifyContent: "space-between", alignItems: "flex-start" }}
          >
            <Stack spacing={0.75}>
              <Typography variant="subtitle1" fontWeight={700}>
                {notification.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {notification.message}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatter.format(new Date(notification.createdAt))}
              </Typography>
            </Stack>
            <Stack spacing={1} sx={{ alignItems: "flex-end" }}>
              <Chip size="small" label={notification.type} color="primary" variant="outlined" />
              {!notification.viewed && <Chip size="small" label="New" color="success" />}
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

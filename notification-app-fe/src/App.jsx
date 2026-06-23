import { useEffect } from "react";
import { Log } from "logging-middleware";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { NotificationsPage } from "./pages/NotificationsPage";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#2f6fba",
    },
    background: {
      default: "#f6f8fb",
    },
  },
  shape: {
    borderRadius: 8,
  },
});

export default function App() {
  useEffect(() => {
    Log("frontend", "info", "component", "Notification app opened");
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationsPage />
    </ThemeProvider>
  );
}

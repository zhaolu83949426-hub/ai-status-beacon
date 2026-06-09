import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/glassmorphism.css";
import { StatusBar } from "../pages/status-bar/StatusBar";
import { ApprovalPage } from "../pages/approval/ApprovalPage";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { SettingsPage } from "../pages/settings/SettingsPage";

function Router() {
  const hash = window.location.hash.replace("#", "");
  switch (hash) {
    case "approval":
      return <ApprovalPage />;
    case "dashboard":
      return <DashboardPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return <StatusBar />;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router />
  </StrictMode>
);

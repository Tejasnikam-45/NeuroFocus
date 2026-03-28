import { Routes, Route, Outlet } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Dashboard } from "./pages/Dashboard";
import { AgentPage } from "./pages/AgentPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { FlowsPage } from "./pages/FlowsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { LandingPage } from "./pages/LandingPage";

function AppShell() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/landing" element={<LandingPage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/flows" element={<FlowsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Route>
    </Routes>
  );
}

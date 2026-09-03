import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireAuth } from "./lib/auth";
import { AuthScreen } from "./screens/AuthScreen";
import { TodayScreen } from "./screens/TodayScreen";
import { PlanningScreen } from "./screens/PlanningScreen";
import { SessionScreen } from "./screens/SessionScreen";
import { ProgressScreen } from "./screens/ProgressScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/today" replace />} />
      <Route path="/login" element={<AuthScreen />} />
      <Route
        path="/today"
        element={
          <RequireAuth>
            <AppShell>
              <TodayScreen />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/planning"
        element={
          <RequireAuth>
            <AppShell>
              <PlanningScreen />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/progress"
        element={
          <RequireAuth>
            <AppShell>
              <ProgressScreen />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/session"
        element={
          <RequireAuth>
            <SessionScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <OnboardingScreen />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}

export default App;

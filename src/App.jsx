import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireAuth, useAuth } from "./lib/auth";
import { isStandalone, platform } from "./lib/installPrompt";
import { logEvent } from "./lib/analytics";
import { AuthScreen } from "./screens/AuthScreen";
import { LandingRoute } from "./screens/LandingScreen";
import { ResetPasswordScreen } from "./screens/ResetPasswordScreen";
import { TodayScreen } from "./screens/TodayScreen";
import { PlanningScreen } from "./screens/PlanningScreen";
import { SessionScreen } from "./screens/SessionScreen";
import { ProgressScreen } from "./screens/ProgressScreen";
import { RevisionsScreen } from "./screens/RevisionsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";

function App() {
  const { session } = useAuth();

  useEffect(() => {
    if (session && isStandalone()) logEvent("app_opened_standalone", platform());
    // Once per sign-in, not on every re-render (session reference is
    // stable across renders while the same user stays signed in).
  }, [session]);

  return (
    <Routes>
      <Route path="/" element={<LandingRoute />} />
      <Route path="/login" element={<AuthScreen />} />
      <Route
        path="/reset-password"
        element={
          <RequireAuth>
            <ResetPasswordScreen />
          </RequireAuth>
        }
      />
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
        path="/revisions"
        element={
          <RequireAuth>
            <AppShell>
              <RevisionsScreen />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <AppShell>
              <ProfileScreen />
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

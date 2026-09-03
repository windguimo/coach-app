import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { TodayScreen } from "./screens/TodayScreen";
import { SessionScreen } from "./screens/SessionScreen";
import { ProgressScreen } from "./screens/ProgressScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/today" replace />} />
      <Route
        path="/today"
        element={
          <AppShell>
            <TodayScreen />
          </AppShell>
        }
      />
      <Route
        path="/progress"
        element={
          <AppShell>
            <ProgressScreen />
          </AppShell>
        }
      />
      <Route path="/session" element={<SessionScreen />} />
      <Route path="/onboarding" element={<OnboardingScreen />} />
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}

export default App;

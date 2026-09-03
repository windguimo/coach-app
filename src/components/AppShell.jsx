import { useIsDesktop } from "../hooks/useIsDesktop";
import { Sidebar } from "./Sidebar";
import { BottomTabBar } from "./BottomTabBar";
import "./AppShell.css";

// Wraps the "chrome" screens (Today, Progress): a left sidebar on desktop,
// a bottom tab bar on mobile — matching 7a's sidebar and 6a/6c's tab bar.
export function AppShell({ children }) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <div className="app-shell app-shell--desktop">
        <Sidebar />
        <div className="app-shell__main">{children}</div>
      </div>
    );
  }

  return (
    <div className="app-shell app-shell--mobile">
      <div className="app-shell__main">{children}</div>
      <BottomTabBar />
    </div>
  );
}

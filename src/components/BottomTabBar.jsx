import { useLocation, Link } from "react-router-dom";
import { Icon } from "./Icon";
import "./BottomTabBar.css";

const TABS = [
  { id: "today", label: "Aujourd'hui", icon: "sun-horizon", to: "/today" },
  { id: "planning", label: "Planning", icon: "calendar-blank", to: "/planning" },
  { id: "progress", label: "Progression", icon: "chart-line-up", to: "/progress" },
  { id: "profile", label: "Profil", icon: "user", to: "/profile" },
];

export function BottomTabBar() {
  const { pathname } = useLocation();

  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.to);
        return (
          <Link key={tab.id} to={tab.to} className={`tabbar__item${active ? " tabbar__item--active" : ""}`}>
            <Icon name={tab.icon} size={21} />
            <span className="tabbar__label">{tab.label}</span>
            {active && <span className="tabbar__mark" />}
          </Link>
        );
      })}
    </nav>
  );
}

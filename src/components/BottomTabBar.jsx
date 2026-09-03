import { useLocation, Link } from "react-router-dom";
import { Icon } from "./Icon";
import "./BottomTabBar.css";

const TABS = [
  { id: "today", label: "Aujourd'hui", icon: "sun-horizon", to: "/today" },
  { id: "planning", label: "Planning", icon: "calendar-blank", to: null },
  { id: "progress", label: "Progression", icon: "chart-line-up", to: "/progress" },
  { id: "profile", label: "Profil", icon: "user", to: null },
];

export function BottomTabBar() {
  const { pathname } = useLocation();

  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {TABS.map((tab) => {
        const active = tab.to && pathname.startsWith(tab.to);
        const content = (
          <>
            <Icon name={tab.icon} size={21} />
            <span className="tabbar__label">{tab.label}</span>
            {active && <span className="tabbar__mark" />}
          </>
        );
        return tab.to ? (
          <Link key={tab.id} to={tab.to} className={`tabbar__item${active ? " tabbar__item--active" : ""}`}>
            {content}
          </Link>
        ) : (
          <span key={tab.id} className="tabbar__item" title="Bientôt disponible">
            {content}
          </span>
        );
      })}
    </nav>
  );
}

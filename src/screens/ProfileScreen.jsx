import { Icon } from "../components/Icon";
import { useAuth } from "../lib/auth";
import { useProfile, levelFromXp } from "../hooks/useProfile";
import { supabase } from "../lib/supabaseClient";
import "./ProfileScreen.css";

export function ProfileScreen() {
  const { session } = useAuth();
  const { profile, loading } = useProfile();

  if (loading || !profile) return <div className="today-loading">Chargement…</div>;

  const { level } = levelFromXp(profile.xp);
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="profile-screen">
      <div className="profile-header">
        <span className="profile-header__avatar">{profile.initials}</span>
        <div>
          <h2 className="profile-header__name">{profile.display_name}</h2>
          <div className="profile-header__email">{session?.user?.email}</div>
        </div>
      </div>

      <div className="profile-stats">
        <div className="profile-stat">
          <div className="profile-stat__value">{profile.xp.toLocaleString("fr-FR")}</div>
          <div className="profile-stat__label">XP</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat__value">Niveau {level}</div>
          <div className="profile-stat__label">Praticien</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat__value">{profile.streak_days}</div>
          <div className="profile-stat__label">jours de série</div>
        </div>
      </div>

      {memberSince && <p className="profile-since">Membre depuis {memberSince}</p>}

      <button className="profile-signout" onClick={() => supabase.auth.signOut()}>
        <Icon name="sign-out" size={16} />
        Se déconnecter
      </button>
    </div>
  );
}

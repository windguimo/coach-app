import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { isPushSubscribed, pushSupported, subscribeToPush } from "../lib/push";
import "./ReminderBanner.css";

export function ReminderBanner() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushSupported()) return;
      const already = await isPushSubscribed();
      if (!cancelled && !already) setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  const activate = async () => {
    setBusy(true);
    setError(null);
    try {
      await subscribeToPush();
      setVisible(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="reminder-banner">
      <div className="reminder-banner__icon">
        <Icon name="bell" size={16} />
      </div>
      <div className="reminder-banner__body">
        <div className="reminder-banner__title">Activez les rappels</div>
        <div className="reminder-banner__text">On vous prévient si vous n'avez pas fait votre séance, pour ne pas casser votre série.</div>
        {error && <div className="reminder-banner__error">{error}</div>}
      </div>
      <div className="reminder-banner__actions">
        <button className="btn-accent" onClick={activate} disabled={busy}>
          {busy ? "…" : "Activer"}
        </button>
        <button className="reminder-banner__dismiss" onClick={() => setVisible(false)}>
          Plus tard
        </button>
      </div>
    </div>
  );
}

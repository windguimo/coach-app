import { useEffect, useState } from "react";
import { useProfile } from "./useProfile";
import {
  isIOS,
  isStandalone,
  getDeferredPrompt,
  clearDeferredPrompt,
  shouldShowInstallPrompt,
  recordInstallPromptShown,
} from "../lib/installPrompt";
import { logEvent } from "../lib/analytics";

// Decides once per mount whether to show the install banner (first session
// done + not standalone + anti-fatigue budget not spent), then latches that
// decision into state — re-deriving it from localStorage on every render
// would make the banner vanish right after showing, since
// shouldShowInstallPrompt() flips to "not due again" the instant it's
// recorded as shown.
export function useInstallPrompt() {
  const { profile, loading } = useProfile();
  const [visible, setVisible] = useState(false);
  const [decided, setDecided] = useState(false);
  const [hasNativePrompt, setHasNativePrompt] = useState(!!getDeferredPrompt());

  useEffect(() => {
    const onBip = () => setHasNativePrompt(true);
    const onInstalled = () => {
      logEvent("app_installed");
      setHasNativePrompt(false);
      setVisible(false);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (decided || loading || !profile) return;
    setDecided(true);

    const firstSessionDone = (profile.streak_days ?? 0) >= 1;
    const canOfferSomething = isIOS() || hasNativePrompt;
    if (firstSessionDone && !isStandalone() && canOfferSomething && shouldShowInstallPrompt()) {
      setVisible(true);
      recordInstallPromptShown();
      logEvent("install_prompt_shown");
    }
  }, [decided, loading, profile, hasNativePrompt]);

  const dismiss = () => {
    logEvent("install_prompt_dismissed");
    setVisible(false);
  };

  const promptInstall = async () => {
    const deferred = getDeferredPrompt();
    if (!deferred) return;
    deferred.prompt();
    const choice = await deferred.userChoice;
    logEvent(choice.outcome === "accepted" ? "install_prompt_accepted" : "install_prompt_dismissed");
    clearDeferredPrompt();
    setVisible(false);
  };

  return { visible, isIOS: isIOS(), hasNativePrompt, dismiss, promptInstall };
}

// Subject a visitor tried in the landing-page demo, carried across signup
// (and a possible email confirmation round-trip) so onboarding can
// pre-select it. Read-once: taking it clears it.
const KEY = "coach:pending-topic";

export function setPendingTopic(topic) {
  try {
    localStorage.setItem(KEY, topic);
  } catch {
    // storage unavailable (private mode) — onboarding just won't pre-select
  }
}

export function takePendingTopic() {
  try {
    const topic = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return topic?.trim() || null;
  } catch {
    return null;
  }
}

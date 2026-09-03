import { useMemo, useState } from "react";
import { ONBOARDING_PACES, ONBOARDING_TOPICS } from "../data/content";

const DAYS = ["L", "M", "M", "J", "V", "S", "D"];
const DEFAULT_TOPICS = ["Négociation commerciale", "Prise de parole"];
const DEFAULT_MINUTES = 15;

// Mirrors the onboarding logic in the source .dc.html: toggling topics or the
// daily pace recomputes a live plan preview.
export function useOnboarding() {
  const [selected, setSelected] = useState(DEFAULT_TOPICS);
  const [pace, setPace] = useState(`${DEFAULT_MINUTES} min`);

  const toggleTopic = (label) => {
    setSelected((sel) => (sel.includes(label) ? sel.filter((x) => x !== label) : sel.concat(label)));
  };

  const topics = useMemo(
    () =>
      ONBOARDING_TOPICS.map((label) => ({
        label,
        on: selected.includes(label),
        toggle: () => toggleTopic(label),
      })),
    [selected]
  );

  const paces = ONBOARDING_PACES.map((label) => ({
    label,
    on: label === pace,
    pick: () => setPace(label),
  }));

  const minutes = parseInt(pace, 10);
  const n = selected.length;

  const planLine =
    n === 0
      ? "Choisissez un sujet et je propose un premier planning."
      : `${n} ${n > 1 ? "sujets" : "sujet"} en alternance, ${minutes} min par jour — un cours, un quiz, une révision. Premier point d'étape dans ${
          n <= 2 ? "10" : "14"
        } jours.`;

  const planWeek = DAYS.map((label, i) => ({
    label,
    weekend: i > 4,
    on: n > 0,
  }));

  const selectionSummary =
    n === 0 ? "Aucun sujet sélectionné" : `${n} ${n > 1 ? "sujets sélectionnés" : "sujet sélectionné"} · ${minutes} min/jour`;

  return { topics, paces, pace, planLine, planWeek, selectionSummary, canSubmit: n > 0 };
}

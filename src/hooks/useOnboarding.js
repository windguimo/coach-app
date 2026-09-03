import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { ONBOARDING_PACES, ONBOARDING_TOPICS } from "../data/content";

// French label, Postgres dow (0=Sun..6=Sat) — Mon..Sun display order.
const DAYS = [
  { label: "L", dow: 1 },
  { label: "M", dow: 2 },
  { label: "M", dow: 3 },
  { label: "J", dow: 4 },
  { label: "V", dow: 5 },
  { label: "S", dow: 6 },
  { label: "D", dow: 0 },
];
const DEFAULT_MINUTES = 15;

export function useOnboarding() {
  const navigate = useNavigate();
  const [customTopics, setCustomTopics] = useState([]);
  const [selected, setSelected] = useState([]);
  const [pace, setPace] = useState(`${DEFAULT_MINUTES} min`);
  const [activeDays, setActiveDays] = useState(DAYS.map((d) => d.dow));
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const toggleDay = (dow) => {
    setActiveDays((days) => {
      if (days.includes(dow)) {
        if (days.length === 1) return days; // keep at least one active day
        return days.filter((d) => d !== dow);
      }
      return days.concat(dow);
    });
  };

  const allTopics = useMemo(() => [...ONBOARDING_TOPICS, ...customTopics], [customTopics]);

  const toggleTopic = (label) => {
    setSelected((sel) => (sel.includes(label) ? sel.filter((x) => x !== label) : sel.concat(label)));
  };

  const addCustomTopic = () => {
    const label = query.trim();
    if (!label) return;
    if (!allTopics.includes(label)) setCustomTopics((t) => t.concat(label));
    if (!selected.includes(label)) setSelected((sel) => sel.concat(label));
    setQuery("");
  };

  const trimmedQuery = query.trim();
  const queryMatchesExisting = allTopics.some((t) => t.toLowerCase() === trimmedQuery.toLowerCase());

  const topics = allTopics.map((label) => ({
    label,
    on: selected.includes(label),
    toggle: () => toggleTopic(label),
  }));

  if (trimmedQuery && !queryMatchesExisting) {
    topics.unshift({
      label: `Ajouter « ${trimmedQuery} »`,
      isCustom: true,
      on: false,
      toggle: addCustomTopic,
    });
  }

  const paces = ONBOARDING_PACES.map((label) => ({
    label,
    on: label === pace,
    pick: () => setPace(label),
  }));

  const minutes = parseInt(pace, 10);
  const n = selected.length;

  const daysCount = activeDays.length;
  const planLine =
    n === 0
      ? "Choisissez un sujet et je propose un premier planning."
      : `${n} ${n > 1 ? "sujets" : "sujet"} en alternance, ${minutes} min, ${daysCount} jour${daysCount > 1 ? "s" : ""} par semaine — un cours, un quiz. Premier point d'étape dans ${
          n <= 2 ? "10" : "14"
        } jours.`;

  const planWeek = DAYS.map(({ label, dow }) => ({
    label,
    weekend: dow === 0 || dow === 6,
    on: n > 0 && activeDays.includes(dow),
    toggle: () => toggleDay(dow),
  }));

  const selectionSummary =
    n === 0 ? "Aucun sujet sélectionné" : `${n} ${n > 1 ? "sujets sélectionnés" : "sujet sélectionné"} · ${minutes} min/jour`;

  const submit = async () => {
    if (n === 0) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase.rpc("apply_onboarding", {
      p_subjects: selected,
      p_daily_minutes: minutes,
      p_active_days: activeDays,
    });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate("/today");
  };

  return {
    topics,
    paces,
    pace,
    planLine,
    planWeek,
    selectionSummary,
    canSubmit: n > 0 && !submitting,
    submitting,
    error,
    submit,
    query,
    setQuery,
    addCustomTopic,
  };
}

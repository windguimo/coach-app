import { burstFrom, vibrate } from "../lib/celebrate";

function optionKind(i, correctIndex, picked, answered) {
  if (!answered) return "idle";
  if (i === correctIndex) return "correct";
  if (i === picked) return "wrong";
  return "dim";
}

export function QuizOptions({ question, picked, answered, onPick }) {
  // Feedback fires on the click itself (correct_index is already on the
  // client), not when the server-scored result comes back — keeps it instant.
  const handlePick = (i, event) => {
    if (answered) return;
    if (i === question.correct_index) {
      burstFrom(event.currentTarget);
      vibrate(30);
    } else {
      vibrate([60, 40, 60]);
    }
    onPick(i);
  };

  return (
    <div className="quiz-options">
      {question.options.map((label, i) => (
        <button
          key={i}
          onClick={(e) => handlePick(i, e)}
          className={`quiz-option quiz-option--${optionKind(i, question.correct_index, picked, answered)}${
            answered && i === picked ? " quiz-option--picked" : ""
          }`}
        >
          <span className="quiz-option__label">{label}</span>
          <span className="quiz-option__mark">{answered ? (i === question.correct_index ? "✓" : i === picked ? "×" : "") : ""}</span>
        </button>
      ))}
    </div>
  );
}

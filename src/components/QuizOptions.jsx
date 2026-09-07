function optionKind(i, correctIndex, picked, answered) {
  if (!answered) return "idle";
  if (i === correctIndex) return "correct";
  if (i === picked) return "wrong";
  return "dim";
}

export function QuizOptions({ question, picked, answered, onPick }) {
  return (
    <div className="quiz-options">
      {question.options.map((label, i) => (
        <button
          key={i}
          onClick={() => onPick(i)}
          className={`quiz-option quiz-option--${optionKind(i, question.correct_index, picked, answered)}`}
        >
          <span className="quiz-option__label">{label}</span>
          <span className="quiz-option__mark">{answered ? (i === question.correct_index ? "✓" : i === picked ? "×" : "") : ""}</span>
        </button>
      ))}
    </div>
  );
}

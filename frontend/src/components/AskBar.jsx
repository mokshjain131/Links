import { useState } from "react";

/**
 * AskBar — Text input + send button for the Ask Your Feed chat.
 */
export default function AskBar({ onSubmit, disabled }) {
  const [question, setQuestion] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setQuestion("");
  };

  return (
    <form className="chat-input-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        className="input"
        placeholder="Ask anything about your saved content..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        disabled={disabled}
      />
      <button
        type="submit"
        className="btn btn-primary"
        disabled={disabled || !question.trim()}
      >
        {disabled ? (
          <span className="spinner" style={{ width: 16, height: 16 }} />
        ) : (
          "Ask"
        )}
      </button>
    </form>
  );
}

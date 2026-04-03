import { useState, useRef, useEffect } from "react";
import { api } from "../lib/api";
import AskBar from "../components/AskBar";

/**
 * Ask — Chat interface for querying your saved content via Gemini.
 */
export default function Ask() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "👋 Hi! I can help you explore your saved links. Try asking me things like:\n\n" +
        "• \"What have I saved about investing?\"\n" +
        "• \"Summarize my fitness content\"\n" +
        "• \"Which topics do I save the most?\"\n" +
        "• \"Have I saved anything contradictory about diet?\"",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = async (question) => {
    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const result = await api.ask(question);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.answer },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ ${err.message || "Something went wrong. Please try again."}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="chat-container">
        {/* Messages */}
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-bubble ${msg.role}`}>
              {msg.content.split("\n").map((line, j) => (
                <span key={j}>
                  {line}
                  {j < msg.content.split("\n").length - 1 && <br />}
                </span>
              ))}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="chat-bubble assistant">
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <AskBar onSubmit={handleSubmit} disabled={loading} />
      </div>
    </div>
  );
}

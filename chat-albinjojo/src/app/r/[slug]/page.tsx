"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { connectToRoom, sendMessage, ChatConnection } from "@/lib/webrtc";
import { useVanishMessages } from "@/lib/useVanishMessages";
import { ChatThread } from "@/components/ChatThread";

const WORKER_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8787";

type Stage = "gate" | "nickname" | "chat";

const stageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

export default function RoomPage() {
  const { slug } = useParams<{ slug: string }>();
  const [stage, setStage] = useState<Stage>("gate");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const { messages, addMessage, clear, vanishOn, setVanishOn } = useVanishMessages();
  const [input, setInput] = useState("");
  const connectionRef = useRef<ChatConnection | null>(null);
  const peerNickname = useRef<string>("them");
  const connecting = useRef(false);

  useEffect(() => {
    fetch(`${WORKER_URL}/api/rooms/${slug}`)
      .then((res) => res.json())
      .then((data) => setQuestion(data.question || ""));
  }, [slug]);

  async function handleVerify() {
    if (connecting.current) return;
    connecting.current = true;
    setError("");
    const res = await fetch(`${WORKER_URL}/api/rooms/${slug}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
    const data = await res.json();

    if (!data.ok) {
      setError("Wrong answer, try again");
      connecting.current = false;
      return;
    }

    connectionRef.current = await connectToRoom(
      slug,
      data.access,
      handleIncoming,
      () => {
        // Data channel finishing its handshake shouldn't skip the mandatory
        // nickname step — only submitNickname() may advance to "chat".
      }
    );
    setStage("nickname");
  }

  function handleIncoming(raw: string) {
    const data = JSON.parse(raw);
    if (data.type === "nickname") {
      peerNickname.current = data.nickname;
    } else {
      // Text messages may carry their own `from` — either the owner's
      // nickname, or (when relayed through the owner from another guest)
      // that guest's nickname. Falls back to the last-known nickname for
      // safety, but with forwarding in place every message should have one.
      addMessage(data.from || peerNickname.current, data.text, false);
    }
  }

  function submitNickname() {
    if (!nickname.trim()) {
      setNicknameError("Please enter a nickname");
      return;
    }
    if (connectionRef.current) {
      sendMessage(
        connectionRef.current,
        JSON.stringify({ type: "nickname", nickname: nickname.trim() })
      );
    }
    setStage("chat");
  }

  function send() {
    if (!input.trim() || !connectionRef.current) return;
    sendMessage(connectionRef.current, JSON.stringify({ type: "text", text: input }));
    addMessage("me", input, true);
    setInput("");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <AnimatePresence mode="wait">
        {stage === "gate" && (
          <motion.div
            key="gate"
            variants={stageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="hard-panel p-6 text-center"
          >
            <p className="section-label mb-4 justify-center" style={{ "--label-accent": "var(--yellow)" } as React.CSSProperties}>
              01. ACCESS
            </p>
            <p className="font-display mb-5 text-lg font-semibold">
              {question || "Loading..."}
            </p>
            <input
              className="hard-input mb-3"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              placeholder="Your answer"
            />
            <button className="hard-btn hard-btn-primary w-full justify-center" onClick={handleVerify}>
              Unlock
            </button>
            {error && <p className="mt-3 font-mono text-[10px] text-red">{error}</p>}
          </motion.div>
        )}

        {stage === "nickname" && (
          <motion.div
            key="nickname"
            variants={stageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="hard-panel p-6 text-center"
          >
            <p className="section-label mb-4 justify-center" style={{ "--label-accent": "var(--lavender)" } as React.CSSProperties}>
              02. IDENTIFY
            </p>
            <p className="font-display mb-5 text-lg font-semibold">
              What should I call <span className="accent-word">you</span>?
            </p>
            <input
              className="hard-input mb-3"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                if (nicknameError) setNicknameError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && submitNickname()}
              placeholder="Nickname"
            />
            <button
              className="hard-btn hard-btn-primary w-full justify-center"
              onClick={submitNickname}
              disabled={!nickname.trim()}
            >
              Continue
            </button>
            {nicknameError && <p className="mt-3 font-mono text-[10px] text-red">{nicknameError}</p>}
          </motion.div>
        )}

        {stage === "chat" && (
          <motion.div
            key="chat"
            variants={stageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="hard-panel flex h-[640px] flex-col p-6"
          >
            <p className="section-label mb-4" style={{ "--label-accent": "var(--orange)" } as React.CSSProperties}>
              03. LIVE CHAT
            </p>
            <div className="mb-4 flex justify-between">
              <button className="hard-btn" onClick={() => setVanishOn((v) => !v)}>
                Vanish mode: {vanishOn ? "ON" : "OFF"}
              </button>
              <button className="hard-btn" onClick={clear}>
                Clear
              </button>
            </div>
            <div className="mb-4 min-h-0 flex-1 overflow-y-auto">
              <ChatThread messages={messages} />
            </div>
            <div className="flex gap-2">
              <input
                className="hard-input flex-1"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Type a message"
              />
              <button className="hard-btn hard-btn-primary" onClick={send}>
                Send
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

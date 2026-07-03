"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { connectToRoom, sendMessage, ChatConnection } from "@/lib/webrtc";

interface Message {
  id: string;
  from: string;
  text: string;
  fading: boolean;
}

const WORKER_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8787";

type Stage = "gate" | "nickname" | "chat";

export default function RoomPage() {
  const { slug } = useParams<{ slug: string }>();
  const [stage, setStage] = useState<Stage>("gate");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [nickname, setNickname] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [vanishOn, setVanishOn] = useState(false);
  const vanishOnRef = useRef(vanishOn);
  vanishOnRef.current = vanishOn;
  const [input, setInput] = useState("");
  const connectionRef = useRef<ChatConnection | null>(null);
  const peerNickname = useRef<string>("them");
  const connecting = useRef(false);

  useEffect(() => {
    fetch(`${WORKER_URL}/api/rooms/${slug}`)
      .then((res) => res.json())
      .then((data) => setQuestion(data.question || ""));
  }, [slug]);

  function addMessage(from: string, text: string) {
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { id, from, text, fading: false }]);

    if (vanishOnRef.current) {
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, fading: true } : m))
        );
        setTimeout(() => {
          setMessages((prev) => prev.filter((m) => m.id !== id));
        }, 1000);
      }, 4000);
    }
  }

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
      "guest",
      data.access,
      handleIncoming,
      () => setStage("chat")
    );
    setStage("nickname");
  }

  function handleIncoming(raw: string) {
    const data = JSON.parse(raw);
    if (data.type === "nickname") {
      peerNickname.current = data.nickname;
    } else {
      addMessage(peerNickname.current, data.text);
    }
  }

  function submitNickname() {
    if (connectionRef.current) {
      sendMessage(
        connectionRef.current,
        JSON.stringify({ type: "nickname", nickname })
      );
    }
    setStage("chat");
  }

  function send() {
    if (!input.trim() || !connectionRef.current) return;
    sendMessage(connectionRef.current, JSON.stringify({ type: "text", text: input }));
    addMessage("me", input);
    setInput("");
  }

  if (stage === "gate") {
    return (
      <main style={{ maxWidth: 400, margin: "4rem auto", textAlign: "center" }}>
        <p>{question || "Loading..."}</p>
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Your answer"
        />
        <button onClick={handleVerify}>Unlock</button>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </main>
    );
  }

  if (stage === "nickname") {
    return (
      <main style={{ maxWidth: 400, margin: "4rem auto", textAlign: "center" }}>
        <p>What should I call you?</p>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Nickname"
        />
        <button onClick={submitNickname}>Continue</button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 500, margin: "2rem auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <button onClick={() => setVanishOn((v) => !v)}>
          Vanish mode: {vanishOn ? "ON" : "OFF"}
        </button>
        <button onClick={() => setMessages([])}>Clear</button>
      </div>
      <div style={{ minHeight: 300 }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              opacity: m.fading ? 0 : 1,
              filter: m.fading ? "blur(3px)" : "none",
              transition: "opacity 1s ease, filter 1s ease",
            }}
          >
            <b>{m.from}:</b> {m.text}
          </div>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send()}
        placeholder="Type a message"
      />
      <button onClick={send}>Send</button>
    </main>
  );
}
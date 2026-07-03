"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { connectToRoom, sendMessage, ChatConnection } from "@/lib/webrtc";

const WORKER_URL = "http://127.0.0.1:8787";

type Stage = "gate" | "nickname" | "chat";

export default function RoomPage() {
  const { slug } = useParams<{ slug: string }>();
  const [stage, setStage] = useState<Stage>("gate");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [nickname, setNickname] = useState("");
  const [messages, setMessages] = useState<{ from: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const connectionRef = useRef<ChatConnection | null>(null);
  const peerNickname = useRef<string>("them");

  async function handleVerify() {
    setError("");
    const res = await fetch(`${WORKER_URL}/api/rooms/${slug}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
    const data = await res.json();

    if (!data.ok) {
      setError("Wrong answer, try again");
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
      setMessages((prev) => [...prev, { from: peerNickname.current, text: data.text }]);
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
    setMessages((prev) => [...prev, { from: "me", text: input }]);
    setInput("");
  }

  if (stage === "gate") {
    return (
      <main style={{ maxWidth: 400, margin: "4rem auto", textAlign: "center" }}>
        <p>Answer to enter this room:</p>
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
      <div style={{ minHeight: 300 }}>
        {messages.map((m, i) => (
          <div key={i}>
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
"use client";

import { useState, useEffect } from "react";
import { connectToRoom, sendMessage, ChatConnection } from "@/lib/webrtc";

const WORKER_URL = "http://127.0.0.1:8787";

interface Room {
  slug: string;
  question: string;
  created_at: number;
}

interface Message {
  id: string;
  from: string;
  text: string;
  fading: boolean;
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [vanishOn, setVanishOn] = useState(true);
  const [input, setInput] = useState("");
  const [connection, setConnection] = useState<ChatConnection | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("session_token");
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${WORKER_URL}/api/rooms`)
      .then((res) => res.json())
      .then((data) => setRooms(data.rooms));
  }, [token]);

  function addMessage(from: string, text: string) {
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { id, from, text, fading: false }]);

    if (vanishOn) {
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

  async function handleLogin() {
    setLoginError("");
    const res = await fetch(`${WORKER_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!data.token) {
      setLoginError("Invalid credentials");
      return;
    }

    localStorage.setItem("session_token", data.token);
    setToken(data.token);
  }

  async function createRoom() {
    if (!newQuestion.trim() || !newAnswer.trim()) return;

    const res = await fetch(`${WORKER_URL}/api/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": token!,
      },
      body: JSON.stringify({ question: newQuestion, answer: newAnswer }),
    });
    const data = await res.json();

    if (data.slug) {
      setNewQuestion("");
      setNewAnswer("");
      const roomsRes = await fetch(`${WORKER_URL}/api/rooms`);
      const roomsData = await roomsRes.json();
      setRooms(roomsData.rooms);
    }
  }

  async function openRoom(slug: string) {
    setActiveSlug(slug);
    setMessages([]);
    const conn = await connectToRoom(
      slug,
      "owner",
      undefined,
      (raw) => {
        const data = JSON.parse(raw);
        if (data.type === "text") {
          addMessage("them", data.text);
        }
      },
      () => {}
    );
    setConnection(conn);
  }

  function send() {
    if (!input.trim() || !connection) return;
    sendMessage(connection, JSON.stringify({ type: "text", text: input }));
    addMessage("me", input);
    setInput("");
  }

  if (!token) {
    return (
      <main style={{ maxWidth: 300, margin: "4rem auto" }}>
        <h2>Admin Login</h2>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleLogin}>Log in</button>
        {loginError && <p style={{ color: "red" }}>{loginError}</p>}
      </main>
    );
  }

  return (
    <main style={{ display: "flex", maxWidth: 700, margin: "2rem auto" }}>
      <div style={{ width: 220 }}>
        <h3>Rooms</h3>
        <div style={{ marginBottom: "1rem" }}>
          <input
            placeholder="Question"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
          />
          <input
            placeholder="Answer"
            value={newAnswer}
            onChange={(e) => setNewAnswer(e.target.value)}
          />
          <button onClick={createRoom}>Create Room</button>
        </div>
        {rooms.map((r) => (
          <div key={r.slug} onClick={() => openRoom(r.slug)} style={{ cursor: "pointer" }}>
            {r.question}
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        {activeSlug ? (
          <>
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
          </>
        ) : (
          <p>Select a room to connect</p>
        )}
      </div>
    </main>
  );
}
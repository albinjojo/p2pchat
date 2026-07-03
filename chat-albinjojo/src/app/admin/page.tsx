"use client";

import { useState, useEffect } from "react";
import { connectToRoom, sendMessage, ChatConnection } from "@/lib/webrtc";

const WORKER_URL = "http://127.0.0.1:8787";

interface Room {
  slug: string;
  question: string;
  created_at: number;
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ from: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [connection, setConnection] = useState<ChatConnection | null>(null);

  // On page load, check if we already have a saved session
  useEffect(() => {
    const saved = localStorage.getItem("session_token");
    if (saved) setToken(saved);
  }, []);

  // Once logged in, fetch the room list
  useEffect(() => {
    if (!token) return;
    fetch(`${WORKER_URL}/api/rooms`)
      .then((res) => res.json())
      .then((data) => setRooms(data.rooms));
  }, [token]);

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
          setMessages((prev) => [...prev, { from: "them", text: data.text }]);
        }
      },
      () => {}
    );
    setConnection(conn);
  }

  function send() {
    if (!input.trim() || !connection) return;
    sendMessage(connection, JSON.stringify({ type: "text", text: input }));
    setMessages((prev) => [...prev, { from: "me", text: input }]);
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
      <div style={{ width: 200 }}>
        <h3>Rooms</h3>
        {rooms.map((r) => (
          <div key={r.slug} onClick={() => openRoom(r.slug)} style={{ cursor: "pointer" }}>
            {r.question}
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        {activeSlug ? (
          <>
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
          </>
        ) : (
          <p>Select a room to connect</p>
        )}
      </div>
    </main>
  );
}
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const WORKER_URL = "http://127.0.0.1:8787";

interface Room {
  slug: string;
  name: string;
  question: string;
  created_at: number;
}

export default function Lobby() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [showLoginBox, setShowLoginBox] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [newName, setNewName] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("session_token");
    if (saved) setToken(saved);
  }, []);

  function fetchRooms() {
    fetch(`${WORKER_URL}/api/rooms`)
      .then((res) => res.json())
      .then((data) => setRooms(data.rooms || []));
  }

  useEffect(() => {
    fetchRooms();
  }, []);

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
    setShowLoginBox(false);
    setUsername("");
    setPassword("");
  }

  function handleLogout() {
    localStorage.removeItem("session_token");
    setToken(null);
  }

  async function createRoom() {
    if (!newName.trim() || !newQuestion.trim() || !newAnswer.trim()) return;

    const res = await fetch(`${WORKER_URL}/api/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": token!,
      },
      body: JSON.stringify({ name: newName, question: newQuestion, answer: newAnswer }),
    });
    const data = await res.json();

    if (data.slug) {
      setNewName("");
      setNewQuestion("");
      setNewAnswer("");
      fetchRooms();
    }
  }

  async function deleteRoom(slug: string) {
    await fetch(`${WORKER_URL}/api/rooms/${slug}`, {
      method: "DELETE",
      headers: { "X-Session-Token": token! },
    });
    fetchRooms();
  }

  return (
    <main className="max-w-xl mx-auto py-16 px-6">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 className="text-2xl font-mono">chat.albinjojo.me</h1>

        {token ? (
          <button onClick={handleLogout}>Log out</button>
        ) : (
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowLoginBox((v) => !v)}>Login</button>
            {showLoginBox && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "2.5rem",
                  border: "1px solid #444",
                  padding: "1rem",
                  background: "#111",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  width: 200,
                  zIndex: 10,
                }}
              >
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
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
                <button onClick={handleLogin}>Log in</button>
                {loginError && <p style={{ color: "red", fontSize: "0.8rem" }}>{loginError}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {token && (
        <div style={{ marginBottom: "2rem", border: "1px solid #333", padding: "1rem" }}>
          <h3>Create Room</h3>
          <input
            placeholder="Room name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
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
          <button onClick={createRoom}>Create</button>
        </div>
      )}

      {rooms.length === 0 ? (
        <p className="text-sm text-neutral-500">No rooms yet.</p>
      ) : (
        rooms.map((r) => (
          <div key={r.slug} className="flex justify-between items-center border p-4 rounded mb-3">
            <Link href={`/r/${r.slug}`}>{r.name}</Link>
            {token && (
              <button onClick={() => deleteRoom(r.slug)}>×</button>
            )}
          </div>
        ))
      )}
    </main>
  );
}
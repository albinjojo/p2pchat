"use client";

import { useState, useEffect, useRef } from "react";
import { connectToRoom, sendMessage, ChatConnection } from "@/lib/webrtc";

const WORKER_URL = "http://127.0.0.1:8787";

interface Room {
  slug: string;
  name: string;
  question: string;
  created_at: number;
}

interface Message {
  id: string;
  from: string;
  text: string;
  fading: boolean;
}

interface Note {
  id: string;
  title: string | null;
  content: string;
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [rooms, setRooms] = useState<Room[]>([]);
  const [newName, setNewName] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newMaxGuests, setNewMaxGuests] = useState(1);

  const [notes, setNotes] = useState<Note[]>([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [vanishOn, setVanishOn] = useState(false);
  const vanishOnRef = useRef(vanishOn);
  vanishOnRef.current = vanishOn;
  const [input, setInput] = useState("");
  const [connection, setConnection] = useState<ChatConnection | null>(null);
  const peerNickname = useRef<string>("them");

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

  useEffect(() => {
    if (token) fetchNotes();
  }, [token]);

  function fetchNotes() {
    fetch(`${WORKER_URL}/api/notes`, {
      headers: { "X-Session-Token": token! },
    })
      .then((res) => res.json())
      .then((data) => setNotes(data.notes || []));
  }

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
      const roomsRes = await fetch(`${WORKER_URL}/api/rooms`);
      const roomsData = await roomsRes.json();
      setRooms(roomsData.rooms);
    }
  }

  async function deleteRoom(slug: string) {
    await fetch(`${WORKER_URL}/api/rooms/${slug}`, {
      method: "DELETE",
      headers: { "X-Session-Token": token! },
    });
    setRooms((prev) => prev.filter((r) => r.slug !== slug));
    if (activeSlug === slug) setActiveSlug(null);
  }

  async function saveNote() {
    if (!noteContent.trim()) return;

    if (editingNoteId) {
      await fetch(`${WORKER_URL}/api/notes/${editingNoteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": token!,
        },
        body: JSON.stringify({ title: noteTitle, content: noteContent }),
      });
    } else {
      await fetch(`${WORKER_URL}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": token!,
        },
        body: JSON.stringify({ title: noteTitle, content: noteContent }),
      });
    }

    setNoteTitle("");
    setNoteContent("");
    setEditingNoteId(null);
    fetchNotes();
  }

  function startEditNote(note: Note) {
    setEditingNoteId(note.id);
    setNoteTitle(note.title || "");
    setNoteContent(note.content);
  }

  function cancelEditNote() {
    setEditingNoteId(null);
    setNoteTitle("");
    setNoteContent("");
  }

  async function deleteNote(id: string) {
    await fetch(`${WORKER_URL}/api/notes/${id}`, {
      method: "DELETE",
      headers: { "X-Session-Token": token! },
    });
    if (editingNoteId === id) cancelEditNote();
    fetchNotes();
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
        if (data.type === "nickname") {
          peerNickname.current = data.nickname;
        } else if (data.type === "text") {
          addMessage(peerNickname.current, data.text);
        }
      },
      () => {},
      newMaxGuests
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
    <main style={{ maxWidth: 900, margin: "2rem auto" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <button onClick={handleLogout}>Log out</button>
      </div>
      <div style={{ display: "flex", gap: "2rem" }}>
        <div style={{ width: 220 }}>
          <h3>Rooms</h3>
          <input
            placeholder="Room name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ display: "block", width: "100%", marginBottom: "0.3rem" }}
          />
          <input
            placeholder="Question"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            style={{ display: "block", width: "100%", marginBottom: "0.3rem" }}
          />
          <input
            placeholder="Answer"
            value={newAnswer}
            onChange={(e) => setNewAnswer(e.target.value)}
            style={{ display: "block", width: "100%", marginBottom: "0.3rem" }}
          />
          <input
            type="number"
            min={1}
            placeholder="Max guests"
            value={newMaxGuests}
            onChange={(e) => setNewMaxGuests(Number(e.target.value))}
            style={{ display: "block", width: "100%", marginBottom: "0.3rem" }}
          />
          <button onClick={createRoom}>Create Room</button>

          {rooms.map((r) => (
            <div key={r.slug} style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
              <span
                onClick={() => openRoom(r.slug)}
                style={{ cursor: "pointer", fontWeight: activeSlug === r.slug ? "bold" : "normal" }}
              >
                {r.name}
              </span>
              <button onClick={() => deleteRoom(r.slug)}>×</button>
            </div>
          ))}

          <h3 style={{ marginTop: "2rem" }}>Notes</h3>
          <input
            placeholder="Title"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            style={{ display: "block", width: "100%", marginBottom: "0.3rem" }}
          />
          <textarea
            placeholder="Note..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            rows={3}
            style={{ display: "block", width: "100%", marginBottom: "0.3rem" }}
          />
          <button onClick={saveNote}>{editingNoteId ? "Update Note" : "Save Note"}</button>
          {editingNoteId && <button onClick={cancelEditNote}>Cancel</button>}

          {notes.map((n) => (
            <div key={n.id} style={{ marginTop: "0.5rem", fontSize: "0.9rem", display: "flex", justifyContent: "space-between" }}>
              <span onClick={() => startEditNote(n)} style={{ cursor: "pointer" }}>
                {n.title || "(untitled)"}
              </span>
              <button onClick={() => deleteNote(n.id)}>×</button>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }}>
          <h3>Chat</h3>
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
            <p style={{ color: "#888" }}>Select a room to start chatting</p>
          )}
        </div>
      </div>
    </main>
  );
}
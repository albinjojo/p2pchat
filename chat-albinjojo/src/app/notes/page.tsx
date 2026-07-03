"use client";

import { useState, useEffect } from "react";

const WORKER_URL = "http://127.0.0.1:8787";

interface Note {
  id: string;
  title: string | null;
  content: string;
  created_at: number;
}

export default function NotesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("session_token");
    if (saved) setToken(saved);
  }, []);

  function fetchNotes(tok: string) {
    fetch(`${WORKER_URL}/api/notes`, {
      headers: { "X-Session-Token": tok },
    })
      .then((res) => res.json())
      .then((data) => setNotes(data.notes || []));
  }

  useEffect(() => {
    if (token) fetchNotes(token);
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

  function resetForm() {
    setTitle("");
    setContent("");
    setEditingId(null);
  }

  async function saveNote() {
    if (!content.trim() || !token) return;

    if (editingId) {
      await fetch(`${WORKER_URL}/api/notes/${editingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": token,
        },
        body: JSON.stringify({ title, content }),
      });
    } else {
      await fetch(`${WORKER_URL}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": token,
        },
        body: JSON.stringify({ title, content }),
      });
    }

    resetForm();
    fetchNotes(token);
  }

  async function deleteNote(id: string) {
    if (!token) return;
    await fetch(`${WORKER_URL}/api/notes/${id}`, {
      method: "DELETE",
      headers: { "X-Session-Token": token },
    });
    fetchNotes(token);
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setTitle(note.title || "");
    setContent(note.content);
  }

  if (!token) {
    return (
      <main style={{ maxWidth: 300, margin: "4rem auto" }}>
        <h2>Notes Login</h2>
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
        {loginError && <p style={{ color: "red" }}>{loginError}</p>}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 600, margin: "2rem auto" }}>
      <h1>Notes</h1>

      <div style={{ marginBottom: "2rem", border: "1px solid #333", padding: "1rem" }}>
        <input
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ display: "block", width: "100%", marginBottom: "0.5rem" }}
        />
        <textarea
          placeholder="Write or paste anything..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          style={{ display: "block", width: "100%", marginBottom: "0.5rem" }}
        />
        <button onClick={saveNote}>{editingId ? "Update" : "Save"}</button>
        {editingId && <button onClick={resetForm}>Cancel</button>}
      </div>

      {notes.length === 0 ? (
        <p style={{ color: "#888" }}>No notes yet.</p>
      ) : (
        notes.map((n) => (
          <div key={n.id} style={{ border: "1px solid #333", padding: "1rem", marginBottom: "0.75rem" }}>
            {n.title && <h4>{n.title}</h4>}
            <p style={{ whiteSpace: "pre-wrap" }}>{n.content}</p>
            <button onClick={() => startEdit(n)}>Edit</button>
            <button onClick={() => deleteNote(n.id)}>Delete</button>
          </div>
        ))
      )}
    </main>
  );
}
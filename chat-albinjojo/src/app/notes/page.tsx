"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const WORKER_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8787";

const PASTELS = ["bg-yellow", "bg-green-light", "bg-lavender"];

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
      <main className="mx-auto flex min-h-screen w-full max-w-xs flex-col justify-center px-6">
        <div className="hard-panel p-6">
          <p className="section-label mb-4 justify-center" style={{ "--label-accent": "var(--yellow)" } as React.CSSProperties}>
            01. NOTES ACCESS
          </p>
          <input
            className="hard-input mb-3"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="hard-input mb-3"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          <button className="hard-btn hard-btn-primary w-full justify-center" onClick={handleLogin}>
            Log in
          </button>
          {loginError && <p className="mt-3 font-mono text-[10px] text-red">{loginError}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="font-display mb-2 text-2xl font-bold">Notes</h1>
      <p className="section-label mb-8" style={{ "--label-accent": "var(--lavender)" } as React.CSSProperties}>
        02. SCRATCHPAD
      </p>

      <div className="hard-panel mb-8 p-5">
        <label className="input-label">Title (optional)</label>
        <input
          className="hard-input mb-3"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label className="input-label">Content</label>
        <textarea
          className="hard-input mb-3"
          placeholder="Write or paste anything..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
        />
        <div className="flex gap-2">
          <button className="hard-btn hard-btn-primary flex-1 justify-center" onClick={saveNote}>
            {editingId ? "Update" : "Save"}
          </button>
          {editingId && (
            <button className="hard-btn" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="font-mono text-xs text-ink-faint">No notes yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map((n, i) => (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`hard-panel p-5 ${PASTELS[i % PASTELS.length]}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="tag-badge">NOTE-{String(i + 1).padStart(2, "0")}</span>
              </div>
              {n.title && <h4 className="font-display mb-1 font-semibold">{n.title}</h4>}
              <p className="min-w-0 whitespace-pre-wrap break-words text-sm text-ink-muted">{n.content}</p>
              <div className="mt-3 flex gap-2">
                <button className="hard-btn" onClick={() => startEdit(n)}>
                  Edit
                </button>
                <button className="hard-btn" onClick={() => deleteNote(n.id)}>
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </main>
  );
}

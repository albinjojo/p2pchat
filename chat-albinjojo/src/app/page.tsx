"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";
import { connectToRoom, sendMessage, ChatConnection } from "@/lib/webrtc";
import { useVanishMessages } from "@/lib/useVanishMessages";
import { ChatThread } from "@/components/ChatThread";

const WORKER_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8787";

const PASTEL_YELLOW = "bg-yellow";
const PASTEL_GREEN = "bg-green-light";
const PASTEL_LAVENDER = "bg-lavender";

interface Room {
  slug: string;
  name: string;
  question: string;
  created_at: number;
}

interface Note {
  id: string;
  title: string | null;
  content: string;
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
  const [newMaxGuests, setNewMaxGuests] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [notes, setNotes] = useState<Note[]>([]);
  const [showCreateNoteForm, setShowCreateNoteForm] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [viewingNoteId, setViewingNoteId] = useState<string | null>(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editNoteTitle, setEditNoteTitle] = useState("");
  const [editNoteContent, setEditNoteContent] = useState("");

  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const { messages, addMessage, clear, vanishOn, setVanishOn } = useVanishMessages();
  const [input, setInput] = useState("");
  const [connection, setConnection] = useState<ChatConnection | null>(null);
  const [myNickname, setMyNickname] = useState("");

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
    setActiveSlug(null);
    clear();
    connection?.close();
    setConnection(null);
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
      setShowCreateForm(false);
      fetchRooms();
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

  async function createNote() {
    if (!newNoteContent.trim()) return;

    await fetch(`${WORKER_URL}/api/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": token!,
      },
      body: JSON.stringify({ title: newNoteTitle, content: newNoteContent }),
    });

    setNewNoteTitle("");
    setNewNoteContent("");
    setShowCreateNoteForm(false);
    fetchNotes();
  }

  function startEditNote(note: Note) {
    setEditNoteTitle(note.title || "");
    setEditNoteContent(note.content);
    setIsEditingNote(true);
  }

  function cancelEditNote() {
    setIsEditingNote(false);
  }

  async function saveEditedNote() {
    if (!viewingNoteId || !editNoteContent.trim()) return;

    await fetch(`${WORKER_URL}/api/notes/${viewingNoteId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": token!,
      },
      body: JSON.stringify({ title: editNoteTitle, content: editNoteContent }),
    });

    setIsEditingNote(false);
    fetchNotes();
  }

  async function deleteNote(id: string) {
    await fetch(`${WORKER_URL}/api/notes/${id}`, {
      method: "DELETE",
      headers: { "X-Session-Token": token! },
    });
    if (viewingNoteId === id) {
      setViewingNoteId(null);
      setIsEditingNote(false);
    }
    fetchNotes();
  }

  const peerNickname = useRef("them");

  async function openRoom(slug: string) {
    connection?.close();
    setActiveSlug(slug);
    clear();
    peerNickname.current = "them";
    const conn = await connectToRoom(
      slug,
      "owner",
      undefined,
      (raw) => {
        const data = JSON.parse(raw);
        if (data.type === "nickname") {
          peerNickname.current = data.nickname;
        } else if (data.type === "text") {
          addMessage(peerNickname.current, data.text, false);
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
    addMessage("me", input, true);
    setInput("");
  }

  function sendNickname() {
    if (!myNickname.trim() || !connection) return;
    sendMessage(connection, JSON.stringify({ type: "nickname", nickname: myNickname }));
  }

  const viewingNote = notes.find((n) => n.id === viewingNoteId) ?? null;

  return (
    <main className={`mx-auto w-full px-6 py-16 ${token ? "max-w-5xl" : "max-w-xl"}`}>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">
            chat.<span className="accent-word">albinjojo</span>.me
          </h1>
          <p className="section-label mt-2">SYSTEM // P2P SIGNAL</p>
        </div>

        {token ? (
          <button className="hard-btn" onClick={handleLogout}>
            Log out
          </button>
        ) : (
          <div className="relative">
            <button className="hard-btn" onClick={() => setShowLoginBox((v) => !v)}>
              Login
            </button>
            <AnimatePresence>
              {showLoginBox && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="hard-panel absolute right-0 top-12 z-10 flex w-56 flex-col gap-2 p-4"
                >
                  <input
                    className="hard-input"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <input
                    className="hard-input"
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                  <button className="hard-btn hard-btn-primary justify-center" onClick={handleLogin}>
                    Log in
                  </button>
                  {loginError && (
                    <p className="font-mono text-[10px] text-red">{loginError}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {!token ? (
        <div>
          <p className="section-label mb-4" style={{ "--label-accent": "var(--yellow)" } as React.CSSProperties}>
            01. ROOMS
          </p>
          {rooms.length === 0 ? (
            <p className="font-mono text-xs text-ink-faint">No rooms yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {rooms.map((r, i) => {
                const pastel = [PASTEL_YELLOW, PASTEL_GREEN, PASTEL_LAVENDER][i % 3];
                return (
                  <Link key={r.slug} href={`/r/${r.slug}`}>
                    <div
                      className={`hard-panel flex items-center justify-between px-5 py-4 transition-transform hover:translate-x-[1px] hover:translate-y-[1px] ${pastel}`}
                    >
                      <span className="font-display font-semibold">{r.name}</span>
                      <span className="tag-badge">RM-{String(i + 1).padStart(2, "0")}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
          <div className="flex min-w-0 flex-col gap-8">
            <div className="hard-panel p-5">
              <p className="section-label mb-4" style={{ "--label-accent": "var(--yellow)" } as React.CSSProperties}>
                02. ROOMS
              </p>

              <button
                className="hard-btn w-full justify-center"
                onClick={() => setShowCreateForm((v) => !v)}
              >
                {showCreateForm ? "− Cancel" : "+ Create Room"}
              </button>

              <AnimatePresence initial={false}>
                {showCreateForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="pt-3">
                      <label className="input-label">Room name</label>
                      <input
                        className="hard-input mb-3"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                      <label className="input-label">Question</label>
                      <input
                        className="hard-input mb-3"
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                      />
                      <label className="input-label">Answer</label>
                      <input
                        className="hard-input mb-3"
                        value={newAnswer}
                        onChange={(e) => setNewAnswer(e.target.value)}
                      />
                      <label className="input-label">Max guests</label>
                      <input
                        type="number"
                        min={1}
                        className="hard-input mb-3"
                        value={newMaxGuests}
                        onChange={(e) => setNewMaxGuests(Number(e.target.value))}
                      />
                      <button
                        className="hard-btn hard-btn-primary w-full justify-center"
                        onClick={createRoom}
                      >
                        Create Room
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-4 flex max-h-[280px] flex-col overflow-y-auto overscroll-contain pr-1">
                {rooms.map((r, i) => {
                  const pastel = [PASTEL_YELLOW, PASTEL_GREEN, PASTEL_LAVENDER][i % 3];
                  return (
                    <div
                      key={r.slug}
                      className={`mini-card flex items-center justify-between ${pastel}`}
                    >
                      <span
                        onClick={() => openRoom(r.slug)}
                        className={`font-display min-w-0 flex-1 cursor-pointer truncate font-semibold ${
                          activeSlug === r.slug ? "text-orange" : ""
                        }`}
                      >
                        {r.name}
                      </span>
                      <button className="chip-btn" onClick={() => deleteRoom(r.slug)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="hard-panel p-5">
              <p className="section-label mb-4" style={{ "--label-accent": "var(--lavender)" } as React.CSSProperties}>
                03. NOTES
              </p>

              <button
                className="hard-btn w-full justify-center"
                onClick={() => setShowCreateNoteForm((v) => !v)}
              >
                {showCreateNoteForm ? "− Cancel" : "+ Create Note"}
              </button>

              <AnimatePresence initial={false}>
                {showCreateNoteForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="pt-3">
                      <label className="input-label">Title</label>
                      <input
                        className="hard-input mb-3"
                        value={newNoteTitle}
                        onChange={(e) => setNewNoteTitle(e.target.value)}
                      />
                      <label className="input-label">Content</label>
                      <textarea
                        className="hard-input mb-3"
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        rows={3}
                      />
                      <button
                        className="hard-btn hard-btn-primary w-full justify-center"
                        onClick={createNote}
                      >
                        Create Note
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-4 flex max-h-[280px] flex-col overflow-y-auto overscroll-contain pr-1">
                {notes.map((n, i) => {
                  const pastel = [PASTEL_GREEN, PASTEL_LAVENDER, PASTEL_YELLOW][i % 3];
                  return (
                    <div
                      key={n.id}
                      className={`mini-card flex items-center justify-between ${pastel}`}
                    >
                      <span
                        onClick={() => {
                          setViewingNoteId(viewingNoteId === n.id ? null : n.id);
                          setIsEditingNote(false);
                        }}
                        className={`font-display min-w-0 flex-1 cursor-pointer truncate font-semibold ${
                          viewingNoteId === n.id ? "text-orange" : ""
                        }`}
                      >
                        {n.title || "(untitled)"}
                      </span>
                      <button className="chip-btn" onClick={() => deleteNote(n.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-8">
            <div className="hard-panel flex h-[640px] flex-col p-6">
              <p className="section-label mb-4" style={{ "--label-accent": "var(--orange)" } as React.CSSProperties}>
                04. LIVE CHAT
              </p>

              {activeSlug ? (
                <>
                  <div className="mb-4 flex gap-2">
                    <input
                      className="hard-input flex-1"
                      placeholder="Your nickname"
                      value={myNickname}
                      onChange={(e) => setMyNickname(e.target.value)}
                    />
                    <button className="hard-btn" onClick={sendNickname}>
                      Set nickname
                    </button>
                  </div>
                  <div className="mb-4 flex justify-between">
                    <button className="hard-btn" onClick={() => setVanishOn((v) => !v)}>
                      Vanish mode: {vanishOn ? "ON" : "OFF"}
                    </button>
                    <button className="hard-btn" onClick={clear}>
                      Clear
                    </button>
                  </div>
                  <div className="mb-4 min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
                </>
              ) : (
                <p className="font-mono text-xs text-ink-faint">Select a room to start chatting</p>
              )}
            </div>

            <div className="hard-panel p-5">
              <p className="section-label mb-4" style={{ "--label-accent": "var(--lavender)" } as React.CSSProperties}>
                05. NOTE VIEW
              </p>
              {viewingNote ? (
                isEditingNote ? (
                  <>
                    <label className="input-label">Title</label>
                    <input
                      className="hard-input mb-3"
                      value={editNoteTitle}
                      onChange={(e) => setEditNoteTitle(e.target.value)}
                    />
                    <label className="input-label">Content</label>
                    <textarea
                      className="hard-input mb-3"
                      value={editNoteContent}
                      onChange={(e) => setEditNoteContent(e.target.value)}
                      rows={8}
                    />
                    <div className="flex gap-2">
                      <button
                        className="hard-btn hard-btn-primary flex-1 justify-center"
                        onClick={saveEditedNote}
                      >
                        Update
                      </button>
                      <button className="hard-btn" onClick={cancelEditNote}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h4 className="font-display mb-2 font-semibold">
                      {viewingNote.title || "(untitled)"}
                    </h4>
                    <div className="max-h-[240px] overflow-y-auto overscroll-contain pr-1">
                      <p className="min-w-0 whitespace-pre-wrap break-words text-sm text-ink-muted">
                        {viewingNote.content}
                      </p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button className="hard-btn" onClick={() => startEditNote(viewingNote)}>
                        Edit
                      </button>
                      <button className="hard-btn" onClick={() => setViewingNoteId(null)}>
                        Close
                      </button>
                    </div>
                  </>
                )
              ) : (
                <p className="font-mono text-xs text-ink-faint">Click a note to view it here</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

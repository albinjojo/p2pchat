import { RoomSignal } from "./room";
export { RoomSignal };

interface Env {
  DB: D1Database;
  ROOM: DurableObjectNamespace;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Session-Token",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function isAuthenticated(request: Request, env: Env): Promise<boolean> {
  const token = request.headers.get("X-Session-Token");
  if (!token) return false;

  const row = await env.DB
    .prepare("SELECT expires_at FROM sessions WHERE token = ?")
    .bind(token)
    .first<{ expires_at: number }>();

  if (!row) return false;
  if (row.expires_at < Date.now()) return false;

  return true;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/api/login" && request.method === "POST") {
      const { username, password } = await request.json<{
        username: string;
        password: string;
      }>();

      const row = await env.DB
        .prepare("SELECT password_hash FROM admin WHERE username = ?")
        .bind(username)
        .first<{ password_hash: string }>();

      if (!row) return json({ error: "Invalid credentials" }, 401);

      const hashedAttempt = await hashPassword(password);
      if (hashedAttempt !== row.password_hash) {
        return json({ error: "Invalid credentials" }, 401);
      }

      const token = crypto.randomUUID();
      const now = Date.now();
      const expiresAt = now + 30 * 24 * 60 * 60 * 1000;

      await env.DB
        .prepare("INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)")
        .bind(token, now, expiresAt)
        .run();

      return json({ token });
    }

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      if (!(await isAuthenticated(request, env))) {
        return json({ error: "Not authorized" }, 403);
      }

     const { name, question, answer } = await request.json<{
        name: string;
        question: string;
        answer: string;
      }>();

      if (!name || !question || !answer) {
        return json({ error: "name, question and answer required" }, 400);
      }

      const slug = crypto.randomUUID().slice(0, 8);
      const answerHash = await hashPassword(answer);
      const createdAt = Date.now();

      await env.DB
        .prepare("INSERT INTO rooms (slug, name, question, answer_hash, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(slug, name, question, answerHash, createdAt)
        .run();

      return json({ slug, url: `/r/${slug}` });
    }

   if (url.pathname === "/api/rooms" && request.method === "GET") {
      const { results } = await env.DB
        .prepare("SELECT slug, name, question, created_at FROM rooms ORDER BY created_at DESC")
        .all();

      return json({ rooms: results });
    }

    const verifyMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/verify$/);
    if (verifyMatch && request.method === "POST") {
      const slug = verifyMatch[1];
      const { answer } = await request.json<{ answer: string }>();

      const room = await env.DB
        .prepare("SELECT answer_hash FROM rooms WHERE slug = ?")
        .bind(slug)
        .first<{ answer_hash: string }>();

      if (!room) return json({ error: "Room not found" }, 404);

      const attemptHash = await hashPassword(answer || "");
      if (attemptHash !== room.answer_hash) {
        return json({ ok: false, error: "Wrong answer" }, 401);
      }

      const access = crypto.randomUUID();
      return json({ ok: true, access });
    }

    const deleteMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)$/);
   if (deleteMatch && request.method === "GET") {
      const slug = deleteMatch[1];
      const room = await env.DB
        .prepare("SELECT slug, name, question, created_at FROM rooms WHERE slug = ?")
        .bind(slug)
        .first();

      if (!room) return json({ error: "Room not found" }, 404);
      return json(room);
    }
    if (deleteMatch && request.method === "DELETE") {
      if (!(await isAuthenticated(request, env))) {
        return json({ error: "Not authorized" }, 403);
      }

      const slug = deleteMatch[1];
      await env.DB.prepare("DELETE FROM rooms WHERE slug = ?").bind(slug).run();
      return json({ ok: true });
    }

    const wsMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/);
    if (wsMatch) {
      const slug = wsMatch[1];
      const id = env.ROOM.idFromName(slug);
      const stub = env.ROOM.get(id);
      return stub.fetch(request);
    }

    if (url.pathname === "/api/notes" && request.method === "POST") {
      if (!(await isAuthenticated(request, env))) {
        return json({ error: "Not authorized" }, 403);
      }

      const { title, content } = await request.json<{
        title?: string;
        content: string;
      }>();

      if (!content) return json({ error: "content required" }, 400);
      if (content.length > 10000) {
        return json({ error: "content too long (max 10000 chars)" }, 400);
      }

      const id = crypto.randomUUID();
      const createdAt = Date.now();

      await env.DB
        .prepare("INSERT INTO notes (id, title, content, created_at) VALUES (?, ?, ?, ?)")
        .bind(id, title || null, content, createdAt)
        .run();

      return json({ id });
    }

    if (url.pathname === "/api/notes" && request.method === "GET") {
      if (!(await isAuthenticated(request, env))) {
        return json({ error: "Not authorized" }, 403);
      }

      const { results } = await env.DB
        .prepare("SELECT id, title, content, created_at FROM notes ORDER BY created_at DESC")
        .all();

      return json({ notes: results });
    }

    const noteMatch = url.pathname.match(/^\/api\/notes\/([^/]+)$/);
    if (noteMatch && request.method === "PATCH") {
      if (!(await isAuthenticated(request, env))) {
        return json({ error: "Not authorized" }, 403);
      }

      const id = noteMatch[1];
      const { title, content } = await request.json<{
        title?: string;
        content: string;
      }>();

      if (!content) return json({ error: "content required" }, 400);
      if (content.length > 10000) {
        return json({ error: "content too long (max 10000 chars)" }, 400);
      }

      await env.DB
        .prepare("UPDATE notes SET title = ?, content = ? WHERE id = ?")
        .bind(title || null, content, id)
        .run();

      return json({ ok: true });
    }

    if (noteMatch && request.method === "DELETE") {
      if (!(await isAuthenticated(request, env))) {
        return json({ error: "Not authorized" }, 403);
      }

      const id = noteMatch[1];
      await env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  },
};
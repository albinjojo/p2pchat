import { RoomSignal } from "./room";
export { RoomSignal };

interface Env {
  DB: D1Database;
  ROOM: DurableObjectNamespace;
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

    if (url.pathname === "/api/login" && request.method === "POST") {
      const { username, password } = await request.json<{
        username: string;
        password: string;
      }>();

      const row = await env.DB
        .prepare("SELECT password_hash FROM admin WHERE username = ?")
        .bind(username)
        .first<{ password_hash: string }>();

      if (!row) {
        return new Response(JSON.stringify({ error: "Invalid credentials" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const hashedAttempt = await hashPassword(password);

      if (hashedAttempt !== row.password_hash) {
        return new Response(JSON.stringify({ error: "Invalid credentials" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const token = crypto.randomUUID();
      const now = Date.now();
      const expiresAt = now + 30 * 24 * 60 * 60 * 1000;

      await env.DB
        .prepare("INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)")
        .bind(token, now, expiresAt)
        .run();

      return new Response(JSON.stringify({ token }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      if (!(await isAuthenticated(request, env))) {
        return new Response(JSON.stringify({ error: "Not authorized" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
     const { question, answer } = await request.json<{
        question: string;
        answer: string;
      }>();

      if (!question || !answer) {
        return new Response(JSON.stringify({ error: "question and answer required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const slug = crypto.randomUUID().slice(0, 8);
      const answerHash = await hashPassword(answer);
      const createdAt = Date.now();

      await env.DB
        .prepare("INSERT INTO rooms (slug, question, answer_hash, created_at) VALUES (?, ?, ?, ?)")
        .bind(slug, question, answerHash, createdAt)
        .run();

      return new Response(JSON.stringify({ slug, url: `/r/${slug}` }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
	if (url.pathname === "/api/rooms" && request.method === "GET") {
      const { results } = await env.DB
        .prepare("SELECT slug, question, created_at FROM rooms ORDER BY created_at DESC")
        .all();

      return new Response(JSON.stringify({ rooms: results }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
	const verifyMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/verify$/);
    if (verifyMatch && request.method === "POST") {
      const slug = verifyMatch[1];
      const { answer } = await request.json<{ answer: string }>();

      const room = await env.DB
        .prepare("SELECT answer_hash FROM rooms WHERE slug = ?")
        .bind(slug)
        .first<{ answer_hash: string }>();

      if (!room) {
        return new Response(JSON.stringify({ error: "Room not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const attemptHash = await hashPassword(answer || "");

      if (attemptHash !== room.answer_hash) {
        return new Response(JSON.stringify({ ok: false, error: "Wrong answer" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const access = crypto.randomUUID();

      return new Response(JSON.stringify({ ok: true, access }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
const deleteMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)$/);
    if (deleteMatch && request.method === "DELETE") {
      if (!(await isAuthenticated(request, env))) {
        return new Response(JSON.stringify({ error: "Not authorized" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const slug = deleteMatch[1];
      await env.DB.prepare("DELETE FROM rooms WHERE slug = ?").bind(slug).run();

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const wsMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/);
    if (wsMatch) {
      const slug = wsMatch[1];
      const id = env.ROOM.idFromName(slug);
      const stub = env.ROOM.get(id);
      return stub.fetch(request);
    }
    return new Response("Not found", { status: 404 });
  },
};
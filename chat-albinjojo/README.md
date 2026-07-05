# chat.albinjojo.me

A gate-locked, peer-to-peer chat application. There are no accounts and no server-side message history — once a guest is let into a room, text is exchanged directly between browsers over WebRTC. The backend only handles room metadata and the initial connection handshake.

## How it works

1. The owner creates a room with a challenge question and answer (a shared secret only someone who knows the owner would be able to answer).
2. Anyone with the room link is shown the question. A correct answer grants a one-time access token.
3. Past the gate, the guest's browser opens a WebRTC connection to the room owner's browser.
4. Chat messages travel over that peer-to-peer data channel directly — they are never written to a database or passed through the backend.
5. The Cloudflare Worker backend is only involved in: verifying the gate answer, issuing the access token, and relaying the WebRTC signaling messages (session offers, answers, and ICE candidates) needed to establish the direct connection.

## Important limitation: the room owner must be online

This is not a server-backed chat product with persistent message delivery. The room owner's own browser tab is the hub every guest connects to, and when a room has multiple guests, the owner's browser is also responsible for relaying messages between them (owner-centric star topology, not a full mesh).

Consequences of this design:

- If the owner does not currently have the room open, a guest who answers the gate question correctly still cannot start chatting — there is no peer on the other end for their browser to connect to.
- If the owner closes their tab or loses network connectivity mid-conversation, every guest is disconnected at the same time, since all guest connections route through the owner.
- Messages are not stored anywhere. Closing a tab loses that side's chat history permanently; there is no way to retrieve it later.

This is a deliberate tradeoff in exchange for genuine peer-to-peer privacy (no server ever sees message content), not an oversight. The product is best suited for live, scheduled conversations where the owner is present, not asynchronous messaging.

## Architecture

- **Frontend** (`chat-albinjojo/`): Next.js App Router, deployed on Vercel.
- **Backend** (`chat-albinjojo-worker/`): Cloudflare Worker with:
  - D1 for room metadata, notes, and admin sessions.
  - A `RoomSignal` Durable Object per room, used only to relay WebRTC signaling messages between the owner and however many guests are connected.
- **Transport**: WebRTC `RTCDataChannel`, one connection per guest. The owner's browser forwards each guest's messages to every other connected guest so everyone sees the full conversation.

## Features

- Gate-locked rooms with a custom question/answer per room.
- Mandatory nicknames on both the guest and owner side.
- Multi-guest group chat with no fixed guest limit.
- Vanish mode: messages can be set to auto-expire and fade out after a delay.
- No persisted message history by design.

## Project structure

```
chat-albinjojo/                 Next.js frontend
  src/app/                      Routes: owner dashboard (/), guest room (/r/[slug]), notes (/notes)
  src/lib/webrtc.ts             WebRTC connection management, owner and guest sides
  src/lib/useVanishMessages.ts  Message state and vanish-mode expiry logic
  src/components/               Shared UI (chat thread, onboarding guide, site background)

chat-albinjojo-worker/          Cloudflare Worker backend
  src/index.ts                  HTTP API: rooms, notes, admin auth
  src/room.ts                   RoomSignal Durable Object: WebRTC signaling relay
  schema.sql                    D1 schema
```

## Local development

Frontend:

```bash
cd chat-albinjojo
npm install
npm run dev
```

Requires `NEXT_PUBLIC_API_URL` in `.env.local`, pointing at a running worker. Defaults to `http://127.0.0.1:8787` for local `wrangler dev`.

Backend:

```bash
cd chat-albinjojo-worker
npm install
npx wrangler dev
```

## Deployment

- The frontend deploys to Vercel automatically on push to `main` via Vercel's Git integration.
- The backend deploys separately and manually, via `npx wrangler deploy` from `chat-albinjojo-worker/`. Pushing to `main` does not deploy the worker — that step has to be run explicitly whenever `chat-albinjojo-worker/src` changes.

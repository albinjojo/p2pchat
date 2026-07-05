const WORKER_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8787";
const WS_URL = WORKER_URL.replace(/^http/, "ws");

export interface ChatConnection {
  peer: RTCPeerConnection;
  channel: RTCDataChannel;
  close: () => void;
}

const pendingQueues = new WeakMap<ChatConnection, string[]>();

export async function connectToRoom(
  slug: string,
  role: "owner" | "guest",
  access: string | undefined,
  onMessage: (text: string) => void,
  onOpen: () => void,
  maxGuests?: number
): Promise<ChatConnection> {
  const params = new URLSearchParams({ role });
  if (access) params.set("access", access);
  if (maxGuests) params.set("max", String(maxGuests + 1));
  const ws = new WebSocket(`${WS_URL}/api/rooms/${slug}/ws?${params}`);

  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
  });

  const queue: string[] = [];
  let channel: RTCDataChannel;

  function flushQueue() {
    if (channel?.readyState === "open") {
      for (const text of queue.splice(0)) {
        channel.send(text);
      }
    }
  }

  function handleChannelOpen() {
    onOpen();
    flushQueue();
  }

  if (role === "owner") {
    channel = peer.createDataChannel("chat");
    setupChannel(channel, onMessage, handleChannelOpen);
  }

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: "ice", candidate: event.candidate }));
    }
  };

  peer.ondatachannel = (event) => {
    channel = event.channel;
    setupChannel(channel, onMessage, handleChannelOpen);
  };

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    // Sent by the Durable Object once both parties are connected — either
    // because we were already here and someone just joined, or because we
    // just joined a room where someone was already waiting. Only the owner
    // ever initiates the offer, and only now that a peer is confirmed
    // present, so the offer never gets sent (and lost) into an empty room.
    if (msg.type === "peer-joined") {
      if (role === "owner" && peer.signalingState === "stable") {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: "offer", offer }));
      }
    }

   if (msg.type === "offer") {
      if (peer.signalingState === "stable" || peer.signalingState === "have-remote-offer") {
        await peer.setRemoteDescription(msg.offer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "answer", answer }));
      }
    }

    if (msg.type === "answer") {
      if (peer.signalingState === "have-local-offer") {
        await peer.setRemoteDescription(msg.answer);
      }
    }

    if (msg.type === "ice") {
      await peer.addIceCandidate(msg.candidate);
    }
  };

  const connection: ChatConnection = {
    peer,
    get channel() {
      return channel;
    },
    close: () => {
      channel?.close();
      peer.close();
      ws.close();
    },
  } as ChatConnection;

  pendingQueues.set(connection, queue);
  return connection;
}

function setupChannel(
  channel: RTCDataChannel,
  onMessage: (text: string) => void,
  onOpen: () => void
) {
  channel.onopen = onOpen;
  channel.onmessage = (event) => onMessage(event.data);
}

export function sendMessage(connection: ChatConnection, text: string) {
  if (connection.channel?.readyState === "open") {
    connection.channel.send(text);
  } else {
    pendingQueues.get(connection)?.push(text);
  }
}
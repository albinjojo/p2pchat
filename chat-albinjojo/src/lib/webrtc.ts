const WORKER_URL = "http://127.0.0.1:8787"; // swap for the real domain once deployed
const WS_URL = "ws://127.0.0.1:8787";

export interface ChatConnection {
  peer: RTCPeerConnection;
  channel: RTCDataChannel;
  close: () => void;
}

export async function connectToRoom(
  slug: string,
  role: "owner" | "guest",
  access: string | undefined,
  onMessage: (text: string) => void,
  onOpen: () => void
): Promise<ChatConnection> {
  // 1. Open the signaling WebSocket to our Durable Object
  const params = new URLSearchParams({ role });
  if (access) params.set("access", access);
  const ws = new WebSocket(`${WS_URL}/api/rooms/${slug}/ws?${params}`);

  // 2. Set up the peer connection with a public STUN server
  // (STUN just tells each browser its own public address — see earlier explanation)
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
  });

  let channel: RTCDataChannel;

  // Whoever is "owner" initiates the connection and creates the data channel.
  // The "guest" just waits for the owner's offer.
  if (role === "owner") {
    channel = peer.createDataChannel("chat");
    setupChannel(channel, onMessage, onOpen);
  }

  // 3. Whenever our side discovers a possible connection path (ICE candidate),
  // send it to the other side via the signaling WebSocket.
  peer.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: "ice", candidate: event.candidate }));
    }
  };

  // If we're the guest, the data channel arrives from the owner's side instead
  // of being created locally — this event fires when that happens.
  peer.ondatachannel = (event) => {
    channel = event.channel;
    setupChannel(channel, onMessage, onOpen);
  };

  // 4. Handle whatever the other side sends us through signaling
  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    console.log(`[${role}] received signal:`, msg.type);

    if (msg.type === "offer") {
      await peer.setRemoteDescription(msg.offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: "answer", answer }));
    }

    if (msg.type === "answer") {
      await peer.setRemoteDescription(msg.answer);
    }

    if (msg.type === "ice") {
      await peer.addIceCandidate(msg.candidate);
    }
  };

  // 5. Once the signaling socket is open, the owner kicks off the handshake
  ws.onopen = async () => {
    console.log(`[${role}] WebSocket connected`);
    if (role === "owner") {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: "offer", offer }));
      console.log(`[${role}] sent offer`);
    }
  };

  ws.onerror = (err) => {
    console.error(`[${role}] WebSocket error`, err);
  };

  ws.onclose = (event) => {
    console.log(`[${role}] WebSocket closed`, event.code, event.reason);
  };

  return {
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
  }
}
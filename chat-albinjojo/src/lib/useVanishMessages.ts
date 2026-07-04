"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  own: boolean;
  expiresAt: number | null;
}

const VANISH_DELAY_MS = 20000;
const TICK_MS = 250;

export function useVanishMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [vanishOn, setVanishOn] = useState(false);
  const vanishOnRef = useRef(vanishOn);
  vanishOnRef.current = vanishOn;

  const addMessage = useCallback((from: string, text: string, own: boolean) => {
    const id = crypto.randomUUID();
    const expiresAt = vanishOnRef.current ? Date.now() + VANISH_DELAY_MS : null;
    setMessages((prev) => [...prev, { id, from, text, own, expiresAt }]);
  }, []);

  const clear = useCallback(() => setMessages([]), []);

  // Each message's removal depends only on its own `expiresAt`, computed once
  // at add-time. A shared clock just evaluates that per-message deadline, so
  // no message's timer can ever be affected by another message being added,
  // removed, or expiring around it.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages((prev) => {
        const next = prev.filter((m) => m.expiresAt === null || m.expiresAt > now);
        return next.length === prev.length ? prev : next;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  return { messages, addMessage, clear, vanishOn, setVanishOn };
}

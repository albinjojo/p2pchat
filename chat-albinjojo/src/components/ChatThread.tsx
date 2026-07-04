"use client";

import { motion, AnimatePresence, type Variants } from "framer-motion";
import type { ChatMessage } from "@/lib/useVanishMessages";

const bubbleVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: {
    opacity: 0,
    filter: "blur(3px)",
    transition: { duration: 1, ease: "easeInOut" },
  },
};

export function ChatThread({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-3 overflow-x-hidden">
      <AnimatePresence initial={false}>
        {messages.map((m) => (
          <motion.div
            key={m.id}
            layout
            variants={bubbleVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`flex ${m.own ? "justify-end" : "justify-start"}`}
          >
            <div className="min-w-0 max-w-[75%]">
              {!m.own && <div className="input-label mb-1 ml-1">{m.from}</div>}
              <div
                className={
                  m.own
                    ? "break-words rounded-xl rounded-br-sm border-[2.5px] border-ink bg-orange px-4 py-2 text-sm text-ink shadow-[3px_3px_0_0_var(--ink)]"
                    : "break-words rounded-xl rounded-bl-sm border-[2.5px] border-ink bg-lavender px-4 py-2 text-sm text-ink shadow-[3px_3px_0_0_var(--ink)]"
                }
              >
                {m.text}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

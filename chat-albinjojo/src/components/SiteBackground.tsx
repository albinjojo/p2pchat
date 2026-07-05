"use client";

import { usePathname } from "next/navigation";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export function SiteBackground() {
  const pathname = usePathname();
  const isChatRoom = pathname?.startsWith("/r/");

  return (
    <div
      className={`pointer-events-none fixed inset-0 -z-10 ${isChatRoom ? "opacity-80" : ""}`}
      aria-hidden
    >
      <DotLottieReact
        src="/site-background.lottie"
        loop
        autoplay
        layout={{ fit: "cover", align: [0.5, 0.5] }}
      />
    </div>
  );
}

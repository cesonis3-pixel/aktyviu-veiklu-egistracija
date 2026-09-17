"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export function MessagesRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    function refresh() {
      if (document.visibilityState === "visible" && !pending) startTransition(() => router.refresh());
    }
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, pending]);
  return null;
}

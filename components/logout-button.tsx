"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";

export function LogoutButton() {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) {
        setError(getAuthErrorMessage(error));
      } else {
        window.location.replace(new URL("/", window.location.origin).href);
      }
    } catch (error) {
      setError(getAuthErrorMessage(error));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={logout} disabled={pending}>
        {pending ? "Atsijungiama…" : "Atsijungti"}
      </button>
      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

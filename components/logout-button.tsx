"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setPending(true);
    setError("");
    try {
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) {
        setError("Nepavyko atsijungti. Pabandykite dar kartą.");
      } else {
        router.replace("/");
        router.refresh();
      }
    } catch {
      setError("Nepavyko susisiekti su paslauga. Pabandykite dar kartą.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={logout} disabled={pending}>{pending ? "Atsijungiama…" : "Atsijungti"}</button>
      {error && <p className="message error" role="alert">{error}</p>}
    </div>
  );
}

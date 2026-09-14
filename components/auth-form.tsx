"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

function errorMessage(code?: string) {
  switch (code) {
    case "invalid_credentials":
      return "Neteisingas el. paštas arba slaptažodis.";
    case "email_not_confirmed":
      return "Prieš prisijungdami patvirtinkite savo el. paštą.";
    case "weak_password":
      return "Slaptažodis per silpnas. Pasirinkite ilgesnį ir sudėtingesnį slaptažodį.";
    case "user_already_exists":
      return "Nepavyko užregistruoti paskyros. Pabandykite prisijungti.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Per daug bandymų. Palaukite ir pabandykite dar kartą.";
    default:
      return "Nepavyko atlikti veiksmo. Patikrinkite duomenis ir bandykite dar kartą.";
  }
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const register = mode === "register";
  const title = register ? "Registruotis" : "Prisijungti";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    setPending(true);
    setError("");
    setSuccess(false);

    try {
      const supabase = createClient();
      const result = register
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
          })
        : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) {
        setError(errorMessage(result.error.code));
      } else if (register) {
        form.reset();
        setSuccess(true);
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
    <section className="auth-card" aria-labelledby="auth-title">
      <h1 id="auth-title">{title}</h1>
      <form onSubmit={handleSubmit} className="auth-form" aria-busy={pending}>
        <label htmlFor="email">El. paštas</label>
        <input id="email" name="email" type="email" autoComplete="email" required disabled={pending} />
        <label htmlFor="password">Slaptažodis</label>
        <input id="password" name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={register ? 6 : undefined} required disabled={pending} aria-describedby={register ? "password-hint" : undefined} />
        {register && <small id="password-hint">Bent 6 simboliai.</small>}
        <button type="submit" disabled={pending}>{pending ? "Palaukite…" : title}</button>
        {error && <p className="message error" role="alert">{error}</p>}
        {success && <p className="message success" role="status">Registracija sėkminga. Gali reikėti patvirtinti el. paštą – patikrinkite savo pašto dėžutę ir sekite laiške pateiktą nuorodą. Tada galėsite prisijungti.</p>}
      </form>
      <nav className="auth-links" aria-label="Paskyros nuorodos">
        <Link href={register ? "/login" : "/register"}>{register ? "Jau turite paskyrą? Prisijunkite" : "Neturite paskyros? Registruokitės"}</Link>
        <Link href="/">Grįžti į pagrindinį</Link>
      </nav>
    </section>
  );
}

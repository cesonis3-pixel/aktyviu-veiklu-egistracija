"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const register = mode === "register";
  const title = register ? "Registruotis" : "Prisijungti";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    setPending(true);
    setError("");
    setSuccess(false);

    try {
      const supabase = createClient();
      if (register) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: new URL("/auth/callback", window.location.origin)
              .href,
          },
        });
        if (error) {
          setError(getAuthErrorMessage(error));
          return;
        }
        // Supabase can obscure an existing account instead of returning an error.
        if (data.user?.identities?.length === 0) {
          setError(
            "Paskyra šiuo el. paštu gali jau egzistuoti. Jau turite paskyrą? Prisijunkite.",
          );
          return;
        }
        form.reset();
        setSuccess(true);
      } else {
        // Password login never registers a user or sends confirmation emails.
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setError(getAuthErrorMessage(error));
          return;
        }
        if (!data.session) {
          setError(
            "Supabase negrąžino prisijungimo sesijos. Pabandykite prisijungti dar kartą.",
          );
          return;
        }
        // Cookies are saved before the promise resolves. A fresh document
        // avoids reusing an anonymous prefetched layout after signing in.
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
    <section className="auth-card" aria-labelledby="auth-title">
      <h1 id="auth-title">{title}</h1>
      <form onSubmit={handleSubmit} className="auth-form" aria-busy={pending}>
        <label htmlFor="email">El. paštas</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
        />
        <label htmlFor="password">Slaptažodis</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={register ? "new-password" : "current-password"}
          minLength={register ? 6 : undefined}
          required
          disabled={pending}
          aria-describedby={register ? "password-hint" : undefined}
        />
        {register && <small id="password-hint">Bent 6 simboliai.</small>}
        <button type="submit" disabled={pending}>
          {pending ? (register ? "Registruojama..." : "Jungiamasi...") : title}
        </button>
        {error && (
          <p className="message error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="message success" role="status">
            Registracija sėkminga. Gali reikėti patvirtinti el. paštą –
            patikrinkite savo pašto dėžutę ir sekite laiške pateiktą nuorodą.
            Tada galėsite prisijungti.
          </p>
        )}
      </form>
      <nav className="auth-links" aria-label="Paskyros nuorodos">
        <Link href={register ? "/login" : "/register"}>
          {register
            ? "Jau turite paskyrą? Prisijunkite"
            : "Neturite paskyros? Registruokitės"}
        </Link>
        <Link href="/">Grįžti į pagrindinį</Link>
      </nav>
    </section>
  );
}

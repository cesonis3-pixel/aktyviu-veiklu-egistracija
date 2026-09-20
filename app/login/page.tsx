import { AuthForm } from "@/components/auth-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const returnTo = next?.startsWith("/") && !next.startsWith("//") && !/[\\\u0000-\u0020]/.test(next) ? next : undefined;
  const confirmationMessage =
    error === "confirmation_browser"
      ? "Patvirtinimo nuorodą atidarykite toje pačioje naršyklėje, kurioje registravotės. Jei el. paštas jau patvirtintas, prisijunkite slaptažodžiu."
      : error === "confirmation_network"
        ? "Nepavyko susisiekti su Supabase ir užbaigti patvirtinimo. Patikrinkite interneto ryšį ir pabandykite prisijungti."
        : error === "confirmation"
          ? "Nepavyko užbaigti el. pašto patvirtinimo. Nuoroda gali būti pasibaigusi arba jau panaudota. Jei el. paštas jau patvirtintas, prisijunkite slaptažodžiu."
          : null;
  return (
    <main id="main-content" className="auth-page">
      {confirmationMessage && (
        <p className="message error" role="alert">
          {confirmationMessage}
        </p>
      )}
      <AuthForm mode="login" returnTo={returnTo} />
    </main>
  );
}

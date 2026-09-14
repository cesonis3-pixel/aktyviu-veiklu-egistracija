import { AuthForm } from "@/components/auth-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main id="main-content" className="auth-page">
      {error === "confirmation" && (
        <p className="message error" role="alert">
          Nepavyko patvirtinti el. pašto. Nuoroda gali būti pasibaigusi arba jau
          panaudota. Pabandykite prisijungti.
        </p>
      )}
      <AuthForm mode="login" />
    </main>
  );
}

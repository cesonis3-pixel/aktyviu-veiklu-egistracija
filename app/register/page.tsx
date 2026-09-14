import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <main id="main-content" className="auth-page">
      <AuthForm mode="register" />
    </main>
  );
}

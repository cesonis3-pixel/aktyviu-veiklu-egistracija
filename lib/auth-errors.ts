type AuthFailure = {
  code?: string;
  status?: number;
  name?: string;
  message?: string;
};

export function getAuthErrorMessage(error: unknown): string {
  const failure: AuthFailure =
    typeof error === "object" && error !== null ? error : {};
  const message = failure.message?.toLowerCase() ?? "";
  const code = failure.code;

  if (
    code === "email_not_confirmed" ||
    message.includes("email not confirmed")
  ) {
    return "Pirmiausia patvirtinkite el. paštą.";
  }
  if (
    code === "invalid_credentials" ||
    message.includes("invalid login credentials")
  ) {
    return "Neteisingas el. paštas arba slaptažodis.";
  }
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    message.includes("already registered")
  ) {
    return "Ši paskyra jau egzistuoja. Prisijunkite.";
  }
  if (
    code === "over_email_send_rate_limit" ||
    message.includes("email rate limit")
  ) {
    return "Pasiektas patvirtinimo laiškų siuntimo limitas. Jei paskyra jau sukurta, prisijunkite. Jei ne – bandykite vėliau.";
  }
  if (code === "over_request_rate_limit" || failure.status === 429) {
    return "Pasiektas patvirtinimo laiškų siuntimo limitas. Jei paskyra jau sukurta, prisijunkite. Jei ne – bandykite vėliau.";
  }
  if (
    code === "email_address_not_authorized" ||
    message.includes("email address not authorized")
  ) {
    return "Supabase laiškų paslauga negali siųsti patvirtinimo šiuo adresu. Projekto administratorius turi sukonfigūruoti SMTP laiškų siuntimą.";
  }
  if (code === "weak_password") {
    return "Slaptažodis per silpnas. Pasirinkite ilgesnį ir sudėtingesnį slaptažodį.";
  }
  if (code === "email_address_invalid" || code === "validation_failed") {
    return "Patikrinkite el. pašto adresą ir slaptažodžio reikalavimus.";
  }
  if (code === "signup_disabled" || code === "email_provider_disabled") {
    return "Registracija el. paštu šiuo metu išjungta Supabase nustatymuose. Kreipkitės į projekto administratorių.";
  }
  if (code === "captcha_failed") {
    return "Supabase reikalauja CAPTCHA patikros. Kreipkitės į projekto administratorių.";
  }
  if (failure.status && failure.status >= 500) {
    return "Supabase paslaugos klaida. Pabandykite vėliau; jei kartojasi, kreipkitės į projekto administratorių.";
  }
  if (
    failure.name === "AuthRetryableFetchError" ||
    failure.name === "TypeError" ||
    failure.status === 0
  ) {
    return "Nepavyko susisiekti su serveriu. Bandykite dar kartą.";
  }
  return "Nepavyko atlikti Supabase autentifikacijos veiksmo. Pabandykite dar kartą arba kreipkitės į projekto administratorių.";
}

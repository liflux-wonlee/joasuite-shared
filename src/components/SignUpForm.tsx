import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { useJoaSuite } from "../context";

/**
 * Passwordless, email-first signup. Calls signInWithOtp with
 * shouldCreateUser:true, which is safe to use identically for both a
 * brand-new email and an email that already has a JoaSuite account
 * (Supabase never reveals which case it is, never touches an existing
 * password, and never creates a duplicate account) - the two cases are
 * disambiguated later, safely, by SetPasswordForm after the link is
 * clicked, not here. No password field on this screen at all, so there's
 * nothing for an existing user to "silently lose" by re-submitting this
 * form with a new value.
 */
export function SignUpForm() {
  const { t } = useTranslation();
  const { supabase, ui, router } = useJoaSuite();
  const { Button, Label, EmailInput } = ui as any;
  const { Link } = router;
  const [step, setStep] = useState<"email" | "sent">("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/onboarding/set-password` : undefined,
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStep("sent");
  };

  if (step === "sent") {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Mail className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="font-semibold">{t("signup_wizard.check_email_title", "Check your email")}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t(
              "signup_wizard.check_email_desc",
              "We sent a secure link to {{email}}. Click it to continue.",
              { email },
            )}
          </p>
        </div>
        <Button variant="outline" className="w-full" onClick={() => setStep("email")}>
          {t("signup_wizard.use_different_email", "Use a different email")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signup-wizard-email">{t("signup_wizard.email_label", "Email")}</Label>
        <EmailInput
          id="signup-wizard-email"
          value={email}
          onChange={(e: any) => setEmail(e.target.value)}
          required
          autoFocus
        />
      </div>
      <Button type="submit" disabled={busy || !email} className="w-full">
        {busy ? t("signup_wizard.sending", "Sending…") : t("signup_wizard.continue", "Continue")}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        {t(
          "signup_wizard.existing_hint",
          "Already have a JoaSuite account? Enter your email above — we'll sign you in, no new account needed.",
        )}
      </p>
      <p className="text-sm text-center text-muted-foreground">
        {t("signup_wizard.have_password", "Prefer to sign in with a password?")}{" "}
        <Link to="/signin" className="text-primary underline">
          {t("signup_wizard.sign_in", "Sign in")}
        </Link>
      </p>
    </form>
  );
}

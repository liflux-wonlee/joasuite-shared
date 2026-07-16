import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useJoaSuite } from "../context";

const FRESH_ACCOUNT_WINDOW_MS = 5 * 60 * 1000;

/**
 * Landing page for SignUpForm's magic-link email. Supabase's client
 * auto-detects the session from the callback URL, so this just waits for
 * that, then decides what to show:
 *   - Account created within the last few minutes (this signup flow just
 *     created it) -> genuinely new user, offer to set a password.
 *   - Otherwise -> an existing user who already has a password just
 *     re-verified their email via magic link; nothing new to set up,
 *     send them straight into the app.
 * This is what safely resolves the new-vs-existing ambiguity that
 * SignUpForm deliberately can't: it happens post-auth, after Supabase has
 * already proven which case it is via account age, not by asking a
 * pre-auth endpoint to reveal it.
 */
export function SetPasswordForm() {
  const { t } = useTranslation();
  const { supabase, ui, router } = useJoaSuite();
  const { Button, Input, Label } = ui as any;
  const { useNavigate } = router;
  const nav = useNavigate();
  const [phase, setPhase] = useState<"checking" | "new" | "existing" | "invalid">("checking");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const decide = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const createdAt = data.user?.created_at ? new Date(data.user.created_at).getTime() : 0;
      const isFresh = !!createdAt && Date.now() - createdAt < FRESH_ACCOUNT_WINDOW_MS;
      setPhase(isFresh ? "new" : "existing");
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_IN") decide();
    });
    supabase.auth.getSession().then(({ data }: any) => {
      if (data.session) {
        decide();
        return;
      }
      setTimeout(async () => {
        const { data: d2 } = await supabase.auth.getSession();
        if (!cancelled) {
          if (d2.session) decide();
          else setPhase("invalid");
        }
      }, 800);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === "existing") nav({ to: "/app" });
  }, [phase, nav]);

  if (phase === "checking" || phase === "existing") {
    return <div className="p-8 text-center text-sm text-muted-foreground">{t("common.loading", "Loading…")}</div>;
  }

  if (phase === "invalid") {
    return (
      <div className="space-y-2 text-center">
        <h2 className="font-semibold">{t("set_password.invalid_title", "This link has expired")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("set_password.invalid_desc", "Please request a new sign-in link.")}
        </p>
      </div>
    );
  }

  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (pw.length < 8) {
      toast.error(t("set_password.min_length", "Password must be at least 8 characters."));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("set_password.success", "Password set"));
    nav({ to: "/app" });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("set_password.title", "Set a password")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("set_password.desc", "Optional — lets you sign in directly next time without an email link.")}
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="set-password-pw">{t("set_password.label", "Password")}</Label>
          <div className="relative">
            <Input
              id="set-password-pw"
              type={showPw ? "text" : "password"}
              value={pw}
              onChange={(e: any) => setPw(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              className="pr-10"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
              aria-label={showPw ? t("common.hide_password", "Hide") : t("common.show_password", "Show")}
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? t("set_password.submitting", "Saving…") : t("set_password.submit", "Set password & continue")}
        </Button>
      </form>
      <button
        type="button"
        onClick={() => nav({ to: "/app" })}
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground underline"
      >
        {t("set_password.skip", "Skip for now")}
      </button>
    </div>
  );
}

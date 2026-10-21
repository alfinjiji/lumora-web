"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRef, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, type Schemas } from "@/lib/api";
import { DataForm, type Field } from "@/components/Form";
export default function AuthPage({
  mode = "login",
  admin = false,
}: {
  mode?: string;
  admin?: boolean;
}) {
  const token = useRef(""),
    [existing, setExisting] = useState(false),
    [visible, setVisible] = useState(false);
  const router = useRouter(),
    q = useQueryClient();
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<Schemas["User"]>("get", "/api/v1/me"),
    retry: false,
    enabled: mode === "accept-invitation",
  });
  useEffect(() => {
    token.current =
      new URLSearchParams(location.hash.slice(1)).get("token") || "";
    if (location.hash)
      history.replaceState(null, "", location.pathname + location.search);
  }, []);
  const titles: Record<string, string> = {
    login: "Welcome back.",
    register: "Make yourself at home.",
    "forgot-password": "Find your way back.",
    "reset-password": "A fresh beginning.",
    "verify-email": "Confirm your email.",
    "accept-invitation": "A place in the studio.",
    "confirm-email": "Confirm your new email.",
  };
  const password: Field = {
    name: "password",
    label: "Password",
    type: visible ? "text" : "password",
    required: true,
    hint: "Use at least 12 characters for a new password.",
  };
  let fields: Field[] = [
    { name: "email", label: "Email address", type: "email", required: true },
    password,
  ];
  if (mode === "register")
    fields = [
      { name: "name", label: "Your name", required: true },
      ...fields,
      { ...password, name: "password_confirmation", label: "Confirm password" },
      {
        name: "accept_terms",
        label: "I accept the ordering terms",
        required: true,
        options: [{ value: "true", label: "I agree" }],
      },
    ];
  if (mode === "forgot-password")
    fields = [
      { name: "email", label: "Email address", type: "email", required: true },
    ];
  if (mode === "reset-password")
    fields = [
      { name: "email", label: "Email address", type: "email", required: true },
      password,
      {
        ...password,
        name: "password_confirmation",
        label: "Confirm new password",
      },
    ];
  if (mode === "accept-invitation")
    fields = user
      ? []
      : existing
        ? [
            {
              name: "email",
              label: "Invited email address",
              type: "email",
              required: true,
            },
            password,
          ]
        : [
            { name: "name", label: "Your name", required: true },
            password,
            {
              ...password,
              name: "password_confirmation",
              label: "Confirm password",
            },
          ];
  if (["verify-email", "confirm-email"].includes(mode)) fields = [];
  async function submit(d: Record<string, string>) {
    if (mode === "accept-invitation" && existing && !user) {
      await api("post", "/auth/login", {
        email: d.email,
        password: d.password,
      });
      await q.invalidateQueries({ queryKey: ["me"] });
      return;
    }
    let result: Schemas["User"] | undefined;
    if (mode === "login")
      result = await api("post", "/auth/login", {
        email: d.email,
        password: d.password,
      });
    else if (mode === "register")
      result = await api("post", "/auth/register", {
        ...d,
        accept_terms: d.accept_terms === "true",
      });
    else if (mode === "forgot-password") {
      await api("post", "/auth/forgot-password", { email: d.email });
      return;
    } else if (mode === "reset-password") {
      await api("post", "/auth/reset-password", { ...d, token: token.current });
      return;
    } else if (mode === "verify-email") {
      await api("post", "/auth/email-verification/confirm", {
        token: token.current,
      });
      await q.invalidateQueries({ queryKey: ["me"] });
      return;
    } else if (mode === "confirm-email") {
      await api("post", "/api/v1/me/email-change/confirm", {
        token: token.current,
      });
      await q.invalidateQueries({ queryKey: ["me"] });
      return;
    } else if (mode === "accept-invitation")
      result = await api("post", "/auth/invitations/accept", {
        token: token.current,
        ...(!user ? d : {}),
      });
    if (result) {
      q.setQueryData(["me"], result);
      await q.invalidateQueries({ queryKey: ["cart"] });
      router.push(result.staff_role ? "/admin" : "/account");
    }
  }
  return (
    <div className="admin-app">
      <section className="login-page">
        <div className="login-story">
          <div className="login-brand">
            Aura<em>flare</em>
          </div>
          <div className="eyebrow">THE CANDLE STUDIO</div>
          <div className="login-art">
            {/* Reference photography is decorative, not a catalogue record. */}
            <img src="/images/design/jar.webp" alt="A candle in a glass jar" />
          </div>
          <h2 className="login-quote">
            A little light.
            <br />A world of possibilities.
          </h2>
          <p>A thoughtful space for lovely things.</p>
          <div className="login-story-footer">
            SMALL RITUALS. LOVELY MOMENTS.
          </div>
        </div>
        <div className="login-form-side">
          <div className="login-form-wrap">
            <div className="login-mark">✳</div>
            <h1>{titles[mode] || titles.login}</h1>
            <p className="sub">
              {mode === "login"
                ? admin
                  ? "Sign in to your Auraflare studio."
                  : "Your candles, orders and little rituals."
                : "Use your secure Auraflare account."}
            </p>
            <div className="login-form">
              <DataForm
                key={mode + existing + Boolean(user)}
                fields={fields}
                onSubmit={submit}
                submit={
                  mode === "login"
                    ? "Sign in"
                    : mode === "forgot-password"
                      ? "Request recovery link"
                      : mode === "accept-invitation" && existing && !user
                        ? "Sign in to accept"
                        : "Continue"
                }
              >
                {fields.some((f) => f.name === "password") && (
                  <button
                    type="button"
                    className="text-link"
                    aria-pressed={visible}
                    onClick={() => setVisible((v) => !v)}
                  >
                    {visible ? "Hide password" : "Show password"}
                  </button>
                )}
              </DataForm>
            </div>
            <div className="auth-links">
              <Link href="/forgot-password">Forgot password?</Link>
              <Link href={mode === "login" ? "/register" : "/login"}>
                {mode === "login" ? "Create an account" : "Sign in"}
              </Link>
              {mode === "accept-invitation" && !user && (
                <button onClick={() => setExisting((v) => !v)}>
                  {existing
                    ? "Create a new account"
                    : "I already have an account"}
                </button>
              )}
              <Link href="/">Back to the studio ↗</Link>
            </div>
            <p className="login-disclosure">
              {mode === "forgot-password"
                ? "If the account exists, a recovery link will be prepared."
                : "Your role is assigned by the studio. There is no default account or password."}
            </p>
          </div>
          <span className="login-bottom">Auraflare · The candle studio</span>
        </div>
      </section>
    </div>
  );
}

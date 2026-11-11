"use server";

import { headers } from "next/headers";
import { Resend } from "resend";
import { checkRateLimit } from "@/lib/rate-limit";

export interface ContactInput {
  name: string;
  email: string;
  msg: string;
}

export type ContactResult =
  | { ok: true; name: string }
  | { ok: false; error: "invalid" | "rate_limited" | "send_failed" };

const DEFAULT_FROM = "Arcade Vault <onboarding@resend.dev>";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function sendContactMessage(
  input: ContactInput,
): Promise<ContactResult> {
  const name = clean(input?.name);
  const email = clean(input?.email);
  const msg = clean(input?.msg);

  if (
    name.length < 1 ||
    name.length > 60 ||
    email.length < 1 ||
    email.length > 120 ||
    !EMAIL_RE.test(email) ||
    msg.length < 1 ||
    msg.length > 2000
  ) {
    return { ok: false, error: "invalid" };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return { ok: false, error: "rate_limited" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) {
    console.error(
      "[contacto] Falta RESEND_API_KEY o CONTACT_TO_EMAIL en el entorno.",
    );
    return { ok: false, error: "send_failed" };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
      to,
      replyTo: email,
      // Sin saltos de línea en el asunto (evita inyección de cabeceras).
      subject: `[Arcade Vault] Mensaje de ${name.replace(/[\r\n]+/g, " ")}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\n${msg}`,
    });
    if (error) {
      console.error("[contacto] Resend devolvió error:", error);
      return { ok: false, error: "send_failed" };
    }
    return { ok: true, name };
  } catch (err) {
    console.error("[contacto] Error al enviar:", err);
    return { ok: false, error: "send_failed" };
  }
}

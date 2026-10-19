import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

/**
 * Temporary preview diagnostic. Returns whether Resend env is present and
 * attempts a dry send to a disposable address only when ?send=1.
 * Never echoes secret values.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const hasKey = Boolean(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM || "";
  const fromDomain = from.includes("@") ? from.split("@").pop() : null;
  const hasFrom = Boolean(from);
  const payload: Record<string, unknown> = {
    hasKey,
    hasFrom,
    fromDomain,
    fromLooksLikeEmail: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(from.replace(/^.*</, "").replace(/>$/, "").trim()) || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(from),
    nodeEnv: process.env.NODE_ENV,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  };

  if (url.searchParams.get("send") !== "1") {
    return NextResponse.json(payload);
  }

  if (!hasKey || !hasFrom) {
    return NextResponse.json({ ...payload, send: "skipped-missing-env" }, { status: 500 });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error, data } = await resend.emails.send({
      from,
      to: "aidv-test@mail.grokbot.com",
      subject: "aidv preview resend probe",
      html: "<p>resend probe ok</p>",
      text: "resend probe ok",
    });
    if (error) {
      return NextResponse.json(
        {
          ...payload,
          send: "error",
          errorName: error.name,
          errorMessage: (error as { message?: string }).message,
          statusCode: (error as { statusCode?: number }).statusCode,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ ...payload, send: "ok", id: data?.id ?? null });
  } catch (e) {
    return NextResponse.json(
      {
        ...payload,
        send: "exception",
        exceptionName: e instanceof Error ? e.name : "unknown",
        exceptionMessage: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}

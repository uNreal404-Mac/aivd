"use client";

// Last-resort page when the root layout itself fails. It cannot rely on the
// site's styles, so it carries its own minimal ones.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "black", color: "white", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Something went wrong · 页面出了点问题</h1>
          <p style={{ color: "gray", margin: "0 0 20px" }}>Please try again. 请重试。</p>
          <button type="button" onClick={reset} style={{ padding: "10px 18px", borderRadius: 12, border: 0, cursor: "pointer", fontSize: 14 }}>
            Try again · 重试
          </button>
        </div>
      </body>
    </html>
  );
}

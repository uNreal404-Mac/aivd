// Phase-2 old-domain redirect proxy.
// Keep auth and webhook requests on the old host while other traffic moves to
// the new Pages host. Copy this file to public/_worker.js only in phase 2.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const staysOnOldHost =
      url.pathname === "/api/auth" ||
      url.pathname.startsWith("/api/auth/") ||
      url.pathname === "/api/webhooks" ||
      url.pathname.startsWith("/api/webhooks/");

    if (staysOnOldHost) {
      return env.APP.fetch(request);
    }

    return Response.redirect(
      `https://aivd-preview.pages.dev${url.pathname}${url.search}`,
      301,
    );
  },
};

// Phase-2 old-domain redirect proxy.
// Keep auth and webhook requests on the old host while other traffic moves to
// the new Pages host. Copy this file to public/_worker.js only in phase 2.
const OLD_HOST = "dreamutopia-video.pages.dev";
const NEW_HOST = "aivd-preview.pages.dev";

function getPhase2Route(requestUrl) {
  const url = new URL(requestUrl);
  const staysOnOldHost =
    url.hostname === OLD_HOST &&
    (url.pathname === "/api/auth" ||
      url.pathname.startsWith("/api/auth/") ||
      url.pathname === "/api/webhooks" ||
      url.pathname.startsWith("/api/webhooks/"));

  if (staysOnOldHost) {
    return { type: "proxy" };
  }

  if (url.hostname !== OLD_HOST) {
    return { type: "proxy" };
  }

  return {
    type: "redirect",
    status: 301,
    location: `https://${NEW_HOST}${url.pathname}${url.search}`,
  };
}

export default {
  async fetch(request, env) {
    const decision = getPhase2Route(request.url);

    if (decision.type === "proxy") {
      return env.APP.fetch(request);
    }

    return Response.redirect(decision.location, decision.status);
  },
};

// Stable Pages URL for the isolated admin001 preview Worker.
export default {
  async fetch(request, env) {
    return env.APP.fetch(request);
  },
};

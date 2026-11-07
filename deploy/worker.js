// Static asset server for Pokepack. Everything is prebuilt by Vite.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  }
};

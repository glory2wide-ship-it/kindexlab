/** Stub `server-only` so tsx scripts can import Next server modules. */
require("module").Module._load = ((origLoad) =>
  function patchedLoad(request, parent, isMain) {
    if (request === "server-only") return {};
    return origLoad(request, parent, isMain);
  })(require("module").Module._load);

const Module = require("node:module")

const load = Module._load

// Next replaces this marker during its own compilation. Plain Node tests need the
// equivalent empty server implementation so they can exercise server modules.
Module._load = function loadForNodeTests(request, parent, isMain) {
  if (request === "server-only") return {}
  return load.call(this, request, parent, isMain)
}

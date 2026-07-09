// Keep this route on the Node runtime (the shared image handler reads font
// files from disk). `runtime` must be declared directly here — Next forbids
// re-exporting it from another module — so only the image itself is re-exported.
export const runtime = "nodejs"
export { default, alt, size, contentType } from "./opengraph-image"

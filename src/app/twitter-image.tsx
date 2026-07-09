// Re-export `runtime` too so the Twitter card stays on the Node runtime (it
// reads font files from disk); without it this route would rely on Next's
// default runtime and could silently break if that ever flips to edge.
export { default, alt, size, contentType, runtime } from "./opengraph-image"

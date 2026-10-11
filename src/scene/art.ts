/**
 * Where the pictures live. Every picture is kept twice, as a WebP and as a
 * PNG: Pixi's asset resolver takes the WebP where the browser understands
 * it (about a fifth of the bytes) and the PNG elsewhere.
 */
export function artUrl(name: string): string {
  return `${import.meta.env.BASE_URL}art/${name}.{webp,png}`;
}

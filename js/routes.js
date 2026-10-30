/*
 * Page addresses. Each location page has a hash route ("#/outdoor/beach", or
 * "#/studio" for a shoot that is its own only location); the contents page has
 * no hash. The "#/" prefix never matches an element id, so the browser never
 * scrolls to an anchor by itself. Photo links keep "#photo/<shoot>/<chapter>/<photo>".
 */

const PHOTO_PREFIX = "#photo/";

export function routeFor(shootId, chapterId, solo) {
  return solo ? `/${shootId}` : `/${shootId}/${chapterId}`;
}

export function parseHash(hash) {
  if (hash === "" || hash === "#") return { kind: "contents" };
  if (hash.startsWith("#/")) return { kind: "location", path: decodeURIComponent(hash.slice(1)) };
  if (hash.startsWith(PHOTO_PREFIX)) return { kind: "photo", photoKey: decodeURIComponent(hash.slice(PHOTO_PREFIX.length)) };
  // Ordinary anchors ("#about" from the cover) belong to the contents page.
  return { kind: "anchor" };
}

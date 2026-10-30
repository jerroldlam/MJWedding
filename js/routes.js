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
  if (hash.startsWith("#/")) {
    const path = decode(hash.slice(1));
    return path === null ? { kind: "invalid" } : { kind: "location", path };
  }
  if (hash.startsWith(PHOTO_PREFIX)) {
    const photoKey = decode(hash.slice(PHOTO_PREFIX.length));
    return photoKey === null ? { kind: "invalid" } : { kind: "photo", photoKey };
  }
  // Ordinary anchors ("#about" from the cover) belong to the contents page.
  return { kind: "anchor" };
}

// A mangled address (e.g. a stray "%" from a chat app) can't be decoded; null
// lets callers treat it as an unknown address rather than throw.
function decode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return null;
  }
}

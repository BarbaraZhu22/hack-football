/** Action name → clip file or procedural pose. Backend should send these names only. */

export const BODY_MODEL_PATH = "/models/body/Superhero_Male_FullBody.gltf";

export const ACTION_CATALOG = {
  run: { kind: "clip", url: "/models/clips/run.glb" },
  soccerPass: { kind: "clip", url: "/models/clips/soccer-pass.fbx" },
  slide: { kind: "pose", pose: "slide" },
  carry: { kind: "pose", pose: "carry" },
};

const DEFAULT_ORIGIN =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")) ||
  "http://127.0.0.1:3000";

/** Absolute URL for GLTFLoader (required outside the browser and for R3F cache keys). */
export function modelAssetUrl(path) {
  const pathname = path.startsWith("/") ? path : `/${path}`;
  const origin = typeof window !== "undefined" ? window.location.origin : DEFAULT_ORIGIN;
  return `${origin}${pathname}`;
}

export function getBodyModelUrl() {
  return modelAssetUrl(BODY_MODEL_PATH);
}

export function getAction(name) {
  return ACTION_CATALOG[name] ?? null;
}

export function getClipUrl(name) {
  const entry = getAction(name);
  return entry?.kind === "clip" ? modelAssetUrl(entry.url) : null;
}

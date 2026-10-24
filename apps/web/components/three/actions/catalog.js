/** Action name → clip file or procedural pose. Backend should send these names only. */

export const BODY_MODEL_URL = "/models/body/Superhero_Male_FullBody.gltf";

export const ACTION_CATALOG = {
  run: { kind: "clip", url: "/models/clips/run.glb" },
  slide: { kind: "pose", pose: "slide" },
  carry: { kind: "pose", pose: "carry" },
};

export function getAction(name) {
  return ACTION_CATALOG[name] ?? null;
}

export function getClipUrl(name) {
  const entry = getAction(name);
  return entry?.kind === "clip" ? entry.url : null;
}

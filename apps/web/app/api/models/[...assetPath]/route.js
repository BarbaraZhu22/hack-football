import { readFile } from "node:fs/promises";
import path from "node:path";

const MODEL_ROOT = path.resolve(process.cwd(), "components/three/models");
const CONTENT_TYPES = {
  ".bin": "application/octet-stream",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".png": "image/png",
};

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  const { assetPath = [] } = await params;
  const versionedPath = assetPath[0] === "v2" ? assetPath.slice(1) : assetPath;
  const resolvedPath = path.resolve(MODEL_ROOT, ...versionedPath);
  if (!resolvedPath.startsWith(`${MODEL_ROOT}${path.sep}`)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const body = await readFile(resolvedPath);
    const contentType = CONTENT_TYPES[path.extname(resolvedPath).toLowerCase()];
    if (!contentType) return new Response("Not found", { status: 404 });
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

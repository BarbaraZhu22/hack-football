import * as THREE from 'three'
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'

export interface TeamKit {
  jersey: string
  shorts: string
  socks: string
  boots: string
  trim: string
  number: string
  name: string
}

export const KITS: Record<'home' | 'away', TeamKit> = {
  home: {
    jersey: '#78c7ea',
    shorts: '#0b2132',
    socks: '#8ed9f4',
    boots: '#111518',
    trim: '#f4fbff',
    number: '6',
    name: 'MCI',
  },
  away: {
    jersey: '#d01722',
    shorts: '#f3f0e7',
    socks: '#f3f0e7',
    boots: '#151515',
    trim: '#ffffff',
    number: '8',
    name: 'ARS',
  },
}

interface Region {
  minY: number
  maxY: number
  minX?: number
  maxX?: number
  minZ?: number
  maxZ?: number
  sleeves?: boolean
}

function triangleSelected(cx: number, cy: number, cz: number, r: Region) {
  if (cy < r.minY || cy > r.maxY) return false
  if (r.minX !== undefined && Math.abs(cx) < r.minX) return false
  if (r.maxX !== undefined && Math.abs(cx) > r.maxX) return false
  if (r.minZ !== undefined && cz < r.minZ) return false
  if (r.maxZ !== undefined && cz > r.maxZ) return false
  if (r.sleeves && cy < 1.26) return false
  return true
}

function buildKitMesh(
  source: THREE.SkinnedMesh,
  region: Region,
  material: THREE.Material,
  inflate: number,
  name: string,
  opts: { smooth?: number; flare?: number; expandX?: number; expandZ?: number; clothNormals?: boolean } = {},
) {
  const geo = source.geometry
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const normal = geo.getAttribute('normal') as THREE.BufferAttribute
  if (!pos) return null
  const sourceIndex = geo.getIndex()
  const vertexCount = pos.count
  const use: boolean[] = new Array(vertexCount).fill(false)
  const indices: number[] = []
  const triCount = sourceIndex ? sourceIndex.count / 3 : vertexCount / 3
  for (let t = 0; t < triCount; t++) {
    const ia = sourceIndex ? sourceIndex.getX(t * 3) : t * 3
    const ib = sourceIndex ? sourceIndex.getX(t * 3 + 1) : t * 3 + 1
    const ic = sourceIndex ? sourceIndex.getX(t * 3 + 2) : t * 3 + 2
    const cx = (pos.getX(ia) + pos.getX(ib) + pos.getX(ic)) / 3
    const cy = (pos.getY(ia) + pos.getY(ib) + pos.getY(ic)) / 3
    const cz = (pos.getZ(ia) + pos.getZ(ib) + pos.getZ(ic)) / 3
    if (!triangleSelected(cx, cy, cz, region)) continue
    indices.push(ia, ib, ic)
    use[ia] = use[ib] = use[ic] = true
  }
  if (!indices.length) return null

  const newGeo = new THREE.BufferGeometry()
  const newPos = new Float32Array(vertexCount * 3)
  const newNorm = new Float32Array(vertexCount * 3)
  newPos.set(pos.array as Float32Array)
  if (normal) newNorm.set(normal.array as Float32Array)
  const used: number[] = []
  for (let i = 0; i < vertexCount; i++) if (use[i]) used.push(i)

  // Relax the shell over the body so pectorals/abs do not print through a
  // supposedly loose football shirt. Boundary triangles keep the garment hem.
  if (opts.smooth) {
    const neighbours = new Map<number, number[]>()
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t], b = indices[t + 1], c = indices[t + 2]
      const add = (u: number, v: number) => { const arr = neighbours.get(u) ?? []; arr.push(v); neighbours.set(u, arr) }
      add(a, b); add(b, a); add(b, c); add(c, b); add(a, c); add(c, a)
    }
    for (let it = 0; it < opts.smooth; it++) {
      const next = new Map<number, [number, number, number]>()
      for (const i of used) {
        const nb = neighbours.get(i)
        if (!nb || nb.length === 0) continue
        let sx = 0, sy = 0, sz = 0
        for (const j of nb) { sx += newPos[j * 3]; sy += newPos[j * 3 + 1]; sz += newPos[j * 3 + 2] }
        const k = 0.35
        next.set(i, [
          newPos[i * 3] * (1 - k) + (sx / nb.length) * k,
          newPos[i * 3 + 1] * (1 - k) + (sy / nb.length) * k,
          newPos[i * 3 + 2] * (1 - k) + (sz / nb.length) * k,
        ])
      }
      for (const [i, p] of next) { newPos[i * 3] = p[0]; newPos[i * 3 + 1] = p[1]; newPos[i * 3 + 2] = p[2] }
    }
  }

  for (const i of used) {
    const off = i * 3
    const nx = normal ? normal.getX(i) : 0
    const ny = normal ? normal.getY(i) : 1
    const nz = normal ? normal.getZ(i) : 0
    const y = newPos[off + 1]
    const flare = opts.flare ? Math.max(0, 1.14 - y) * opts.flare : 0
    const amount = inflate + flare
    newPos[off] += nx * amount
    newPos[off + 1] += ny * amount
    newPos[off + 2] += nz * amount
    if (opts.expandX) newPos[off] *= opts.expandX
    if (opts.expandZ) newPos[off + 2] *= opts.expandZ
  }
  if (opts.clothNormals) {
    for (const i of used) {
      const off = i * 3
      const x = newPos[off]
      const z = newPos[off + 2]
      const len = Math.hypot(x, z) || 1
      newNorm[off] = (x / len) * 0.92
      newNorm[off + 1] = 0.22
      newNorm[off + 2] = (z / len) * 0.92
    }
  }
  newGeo.setAttribute('position', new THREE.BufferAttribute(newPos, 3))
  if (normal) newGeo.setAttribute('normal', new THREE.BufferAttribute(newNorm, 3))
  for (const key of ['skinIndex', 'skinWeight', 'uv', 'color']) {
    const attr = geo.getAttribute(key)
    if (attr) newGeo.setAttribute(key, attr.clone())
  }
  newGeo.setIndex(indices)
  newGeo.computeBoundingSphere()
  newGeo.computeBoundingBox()

  const mesh = new THREE.SkinnedMesh(newGeo, material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = false
  mesh.frustumCulled = false
  mesh.bindMode = source.bindMode
  mesh.bind(source.skeleton, source.bindMatrix)
  mesh.position.copy(source.position)
  mesh.quaternion.copy(source.quaternion)
  mesh.scale.copy(source.scale)
  return mesh
}

function makeFabricMaterial(color: string, roughness = 0.78) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.01 })
}

function makeNumberDecal(kit: TeamKit, dark = false) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 512, 512)
  ctx.fillStyle = dark ? '#0b2132' : '#ffffff'
  ctx.font = 'bold 300px Inter, Helvetica, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(kit.number, 256, 300)
  ctx.font = '600 48px Inter, Helvetica, Arial, sans-serif'
  ctx.letterSpacing = '10px'
  ctx.fillText(kit.name, 258, 90)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  const geo = new THREE.PlaneGeometry(0.34, 0.34)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.renderOrder = 5
  return mesh
}


export interface PreparedHero {
  scene: THREE.Group
  meshes: {
    body: THREE.SkinnedMesh
    head: THREE.Mesh | null
    overlays: THREE.SkinnedMesh[]
  }
  decal: THREE.Mesh
}

/** Clone the CC0 Quaternius hero, fit it to 1.80 m and build a skin-tight kit. */
export function prepareHero(gltf: GLTF, side: 'home' | 'away'): PreparedHero {
  const root = skeletonClone(gltf.scene) as THREE.Group
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const height = box.max.y - box.min.y
  const scale = 1.8 / height
  root.scale.setScalar(scale)
  root.updateMatrixWorld(true)
  const box2 = new THREE.Box3().setFromObject(root)
  root.position.y = -box2.min.y
  root.traverse((o: THREE.Object3D) => {
    const m = o as THREE.Mesh
    if (m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh) {
      m.castShadow = true
      m.receiveShadow = true
      m.frustumCulled = false
      const mm = (m as THREE.Mesh).material
      if (mm) (m as THREE.Mesh).material = Array.isArray(mm) ? mm.map((x) => x.clone()) : mm.clone()
      const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial
      if (mat && 'envMapIntensity' in mat) mat.envMapIntensity = 0.5
    }
  })

  let body: THREE.SkinnedMesh | null = null
  let head: THREE.Mesh | null = null
  root.traverse((o: THREE.Object3D) => {
    const sm = o as THREE.SkinnedMesh
    if (sm.isSkinnedMesh && sm.name !== 'Eyes') {
      const mat = sm.material as THREE.Material
      if (mat && /Superhero|Body/i.test(mat.name)) body = sm
      if (mat && /Hair/i.test(mat.name)) head = o as unknown as THREE.Mesh
    }
  })
  if (!body) {
    root.traverse((o) => {
      const sm = o as THREE.SkinnedMesh
      if (sm.isSkinnedMesh && !body) body = sm
    })
  }
  if (!body) throw new Error('No skinned body found in hero model')
  const bodyMesh: THREE.SkinnedMesh = body
  const kit = KITS[side]
  const parent = bodyMesh.parent!
  const overlays: THREE.SkinnedMesh[] = []

  const jersey = buildKitMesh(
    bodyMesh,
    { minY: 0.93, maxY: 1.605, maxX: 0.54 },
    makeFabricMaterial(kit.jersey, 0.8),
    0.02,
    'kit_jersey',
  )
  if (jersey) {
    parent.add(jersey)
    overlays.push(jersey)
  }

  const shorts = buildKitMesh(
    bodyMesh,
    { minY: 0.66, maxY: 1.01, maxX: 0.38 },
    makeFabricMaterial(kit.shorts, 0.84),
    0.014,
    'kit_shorts',
  )
  if (shorts) {
    parent.add(shorts)
    overlays.push(shorts)
  }

  const socks = buildKitMesh(
    bodyMesh,
    { minY: 0.05, maxY: 0.39, maxX: 0.27 },
    makeFabricMaterial(kit.socks, 0.86),
    0.01,
    'kit_socks',
  )
  if (socks) {
    parent.add(socks)
    overlays.push(socks)
  }

  const boots = buildKitMesh(
    bodyMesh,
    { minY: -0.02, maxY: 0.085 },
    new THREE.MeshStandardMaterial({ color: kit.boots, roughness: 0.38, metalness: 0.08 }),
    0.018,
    'kit_boots',
  )
  if (boots) {
    parent.add(boots)
    overlays.push(boots)
  }

  const decal = makeNumberDecal(kit, side === 'home')
  decal.visible = false // attached by the actor once the skeleton is live
  root.add(decal)

  return { scene: root, meshes: { body: bodyMesh, head, overlays }, decal }
}

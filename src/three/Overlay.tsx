import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { sampleFrame, type Simulation } from '../sim/engine'

function makeTextSprite(text: string, color = '#fff7d6') {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 192
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.fillStyle = 'rgba(4,10,10,0.86)'
  ctx.beginPath()
  ctx.roundRect(12, 30, 1000, 124, 22)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = color
  ctx.font = '700 62px Inter, Helvetica, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 512, 94)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })
  const s = new THREE.Sprite(mat)
  s.scale.set(1.55, 0.29, 1)
  s.renderOrder = 30
  return s
}

function DynamicTrail({
  sim,
  timeRef,
  role,
  color,
}: {
  sim: Simulation
  timeRef: React.MutableRefObject<number>
  role: 'tackler' | 'carrier'
  color: string
}) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(80 * 3), 3))
    return g
  }, [])
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false }),
    [color],
  )
  const line = useMemo(() => new THREE.Line(geom, mat), [geom, mat])
  useFrame(() => {
    const f = sampleFrame(sim, timeRef.current)
    const trail = role === 'tackler' ? f.aTrail : f.bTrail
    const arr = geom.getAttribute('position') as THREE.BufferAttribute
    const n = Math.min(trail.length, 80)
    for (let i = 0; i < n; i++) {
      arr.setXYZ(i, trail[trail.length - n + i].x, 0.045, trail[trail.length - n + i].z)
    }
    geom.setDrawRange(0, n)
    arr.needsUpdate = true
  })
  return <primitive object={line} />
}

export function MotionOverlay({
  sim,
  timeRef,
  showForces,
  showTrajectory,
}: {
  sim: Simulation
  timeRef: React.MutableRefObject<number>
  showForces: boolean
  showTrajectory: boolean
}) {
  const contact = sim.impact
  const paths = useMemo(() => {
    const a: [number, number, number][] = []
    const b: [number, number, number][] = []
    const ball: [number, number, number][] = []
    sim.frames.forEach((f, i) => {
      if (i % 5 === 0) {
        a.push([f.tackler.x, 0.04, f.tackler.z])
        b.push([f.carrier.x, 0.04, f.carrier.z])
        if (f.t >= sim.contactT) ball.push([f.ball.p.x, f.ball.p.y, f.ball.p.z])
      }
    })
    return { a, b, ball }
  }, [sim])

  const annotationGroup = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const arrowLabel = useMemo(() => makeTextSprite(`IMPULSE ${Math.round(contact.impulse)} N·s`, '#ffd166'), [contact.impulse])
  const arrows = useMemo(() => {
    const prep = (h: THREE.ArrowHelper, opacity: number) => {
      for (const mat of [h.line.material, h.cone.material] as THREE.Material[]) {
        mat.depthTest = false
        mat.depthWrite = false
        mat.transparent = true
        mat.opacity = opacity
      }
      h.renderOrder = 34
      h.visible = false
      return h
    }
    const a = prep(new THREE.ArrowHelper(new THREE.Vector3(contact.normal.x, 0.18, contact.normal.z).normalize(), new THREE.Vector3(contact.point.x, contact.point.y + 0.06, contact.point.z), 0.92, 0xffcf5c, 0.18, 0.09), 0.95)
    const bf = sim.frames[Math.floor((sim.contactT + 0.05) * 120)]
    const b = prep(new THREE.ArrowHelper(new THREE.Vector3(0.46, 0.28, 0.84).normalize(), new THREE.Vector3(bf.ball.p.x, bf.ball.p.y + 0.05, bf.ball.p.z), 0.72, 0xb9ffd9, 0.16, 0.08), 0.9)
    return { a, b }
  }, [contact, sim])

  useEffect(() => {
    annotationGroup.current?.traverse((o) => o.layers.set(3))
  })
  useFrame(() => {
    const t = timeRef.current
    const dt = t - sim.contactT
    const active = dt > -0.1 && dt < 1.7
    if (ringRef.current) {
      ringRef.current.visible = active
      const k = THREE.MathUtils.clamp(1 + dt * 1.5, 0.6, 2.3)
      ringRef.current.scale.setScalar(k)
      const mat = ringRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = THREE.MathUtils.clamp(0.48 - dt * 0.38, 0, 0.48)
    }
    if (glowRef.current) {
      glowRef.current.visible = active
      const pulse = 0.8 + Math.sin(t * 18) * 0.12
      glowRef.current.scale.setScalar(pulse)
      const mat = glowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = THREE.MathUtils.clamp(0.22 - Math.abs(dt) * 0.1, 0, 0.22)
    }
    arrows.a.visible = showForces && dt > -0.05 && dt < 0.9
    arrows.b.visible = showForces && dt > 0.01 && dt < 0.9
    if (arrowLabel) {
      arrowLabel.visible = showForces && dt > -0.05 && dt < 0.9
    }
  })

  return (
    <group ref={annotationGroup}>
      {showTrajectory && (
        <>
          <Line points={paths.a} color="#7dd8ff" lineWidth={1.4} dashed dashSize={0.34} gapSize={0.24} transparent opacity={0.5} />
          <Line points={paths.b} color="#ff7b7b" lineWidth={1.4} dashed dashSize={0.3} gapSize={0.24} transparent opacity={0.55} />
          <Line points={paths.ball} color="#c9ff99" lineWidth={1.8} dashed dashSize={0.3} gapSize={0.18} transparent opacity={0.7} />
          <DynamicTrail sim={sim} timeRef={timeRef} role="tackler" color="#9ee7ff" />
          <DynamicTrail sim={sim} timeRef={timeRef} role="carrier" color="#ff9f9b" />
        </>
      )}

      {/* contact footprint */}
      <mesh ref={glowRef} position={[contact.point.x, 0.06, contact.point.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.52, 48]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={ringRef} position={[contact.point.x, 0.07, contact.point.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.24, 0.3, 48]} />
        <meshBasicMaterial color="#ffe3a1" transparent opacity={0.6} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* contact height tick */}
      <mesh position={[contact.point.x, contact.point.y / 2 + 0.03, contact.point.z]}>
        <cylinderGeometry args={[0.009, 0.009, contact.point.y, 6]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <mesh position={[contact.point.x, contact.point.y, contact.point.z]}>
        <sphereGeometry args={[0.05, 14, 12]} />
        <meshBasicMaterial color="#ffecad" toneMapped={false} />
      </mesh>

      {showForces && (
        <>
          <primitive object={arrows.a} />
          <primitive object={arrows.b} />
          <primitive object={arrowLabel} position={[contact.point.x + 0.55, contact.point.y + 0.56, contact.point.z + 0.24]} />
        </>
      )}
    </group>
  )
}

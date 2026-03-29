'use client';

/**
 * SplashCrest3D — Three.js / React Three Fiber 3D crest for the splash screen.
 *
 * Renders a physically-based extruded gold shield with a canvas-textured
 * "DE" monogram, cinematic lighting, and a ~2.8s reveal animation:
 *   1. Shield rises from below + subtle tilt, gold bevel catches key light
 *   2. Monogram fades in after shield settles
 *   3. Everything rests perfectly facing the viewer
 *
 * Props:
 *   size         — width in px (height auto-proportioned 200:228)
 *   onReady      — called when entrance animation finishes
 *   reducedMotion — skips animation, shows everything immediately
 */

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* ─────────────────────── Shield shape ─────────────────────────────────── */

function buildShieldShape(): THREE.Shape {
  // Original viewBox: 200×228. Shield: 26,24 → 174,24 → 174,146 → 100,218 → 26,146
  // Normalise to centre (100,121), scale so full width = 2 units.
  const cx = 100, cy = 121, s = 2 / 148;
  const pts: [number, number][] = [
    [26, 24], [174, 24], [174, 146], [100, 218], [26, 146],
  ];
  const shape = new THREE.Shape();
  pts.forEach(([x, y], i) => {
    const px = (x - cx) * s;
    const py = -(y - cy) * s; // flip Y
    i === 0 ? shape.moveTo(px, py) : shape.lineTo(px, py);
  });
  shape.closePath();
  return shape;
}

function buildLinerShape(): THREE.Shape {
  const cx = 100, cy = 121, s = 2 / 148;
  const pts: [number, number][] = [
    [40, 38], [160, 38], [160, 144], [100, 206], [40, 144],
  ];
  const shape = new THREE.Shape();
  pts.forEach(([x, y], i) => {
    const px = (x - cx) * s;
    const py = -(y - cy) * s;
    i === 0 ? shape.moveTo(px, py) : shape.lineTo(px, py);
  });
  shape.closePath();
  return shape;
}

/* ─────────────────────── Canvas texture for DE monogram ───────────────── */

function buildMonogramTexture(): THREE.CanvasTexture {
  const W = 512, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, W, H);

  // Vertical gold gradient (mirrors SVG goldV)
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,    '#EDD68A');
  grad.addColorStop(0.22, '#C9A227');
  grad.addColorStop(0.58, '#9E7914');
  grad.addColorStop(0.82, '#B8941F');
  grad.addColorStop(1,    '#C9A84C');

  ctx.fillStyle = grad;
  // Use Georgia as guaranteed-available serif fallback for Cormorant Garamond
  ctx.font = "600 230px 'Cormorant Garamond', Georgia, serif";
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DE', W / 2, H / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/* ─────────────────────── Easing helpers ───────────────────────────────── */

const easeOutExpo  = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* ─────────────────────── Shield + Monogram scene object ───────────────── */

interface ShieldMeshProps {
  reducedMotion: boolean;
  onReady: () => void;
}

function ShieldScene({ reducedMotion, onReady }: ShieldMeshProps) {
  const groupRef    = useRef<THREE.Group>(null!);
  const monogramRef = useRef<THREE.Mesh>(null!);
  const startRef    = useRef<number | null>(null);
  const doneRef     = useRef(false);

  const ANIM_S = reducedMotion ? 0.001 : 2.8; // animation duration in seconds

  // ── Geometry (memoised — only built once) ──
  const extrudeOpts = useMemo<THREE.ExtrudeGeometryOptions>(() => ({
    depth:          0.07,
    bevelEnabled:   true,
    bevelThickness: 0.024,
    bevelSize:      0.02,
    bevelSegments:  6,
  }), []);

  const shieldGeo = useMemo(
    () => new THREE.ExtrudeGeometry(buildShieldShape(), extrudeOpts),
    [extrudeOpts],
  );
  const linerGeo = useMemo(
    () => new THREE.ExtrudeGeometry(buildLinerShape(), {
      depth: 0.001, bevelEnabled: false,
    }),
    [],
  );
  const monogramGeo = useMemo(
    () => new THREE.PlaneGeometry(0.9, 0.9),
    [],
  );

  // ── Materials ──
  const goldMat = useMemo(() => new THREE.MeshStandardMaterial({
    color:     new THREE.Color('#C9A227'),
    metalness: 0.95,
    roughness: 0.25,
  }), []);

  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({
    color:     new THREE.Color('#0c0c0c'),
    metalness: 0.05,
    roughness: 0.9,
  }), []);

  const linerMat = useMemo(() => new THREE.MeshStandardMaterial({
    color:       new THREE.Color('#C9A227'),
    metalness:   0.88,
    roughness:   0.35,
    transparent: true,
    opacity:     0.18,
  }), []);

  const monogramTex = useMemo(() => buildMonogramTexture(), []);
  const monogramMat = useMemo(() => new THREE.MeshBasicMaterial({
    map:         monogramTex,
    transparent: true,
    opacity:     reducedMotion ? 1 : 0,
    depthTest:   false,
  }), [monogramTex, reducedMotion]);

  // ── Animation ──
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const g = groupRef.current;
    const m = monogramRef.current;

    if (reducedMotion) {
      g.position.y = 0;
      g.rotation.set(0, 0, 0);
      if (m) (m.material as THREE.MeshBasicMaterial).opacity = 1;
      if (!doneRef.current) { doneRef.current = true; onReady(); }
      return;
    }

    if (startRef.current === null) startRef.current = clock.elapsedTime;
    const elapsed = clock.elapsedTime - startRef.current;
    const t = Math.min(elapsed / ANIM_S, 1);

    // Y: rise from -1.6 up to 0 (overshoots then settles)
    const tRise = easeOutExpo(Math.min(t / 0.75, 1));
    g.position.y = -1.6 + 1.6 * tRise;

    // X-tilt: tip forward from 35° to 0°
    const tTilt = easeOutQuart(t);
    g.rotation.x = (1 - tTilt) * 0.6;

    // Z-wobble: damped oscillation
    g.rotation.z = Math.sin(elapsed * 4.5) * 0.04 * Math.max(0, 1 - t * 1.8);

    // Monogram fade in — starts at 55% through animation
    if (m) {
      const tMono = Math.min(Math.max((t - 0.55) / 0.45, 0), 1);
      (m.material as THREE.MeshBasicMaterial).opacity =
        easeInOutCubic(tMono);
    }

    if (t >= 1 && !doneRef.current) {
      doneRef.current = true;
      onReady();
    }
  });

  return (
    <group
      ref={groupRef}
      position={[0, reducedMotion ? 0 : -1.6, 0]}
    >
      {/* ── Dark shield body (back face + fill) ── */}
      <mesh geometry={shieldGeo} material={darkMat} position={[0, 0, -0.07]} />

      {/* ── Gold bevel/edge layer ── */}
      <mesh geometry={shieldGeo} material={goldMat} position={[0, 0, -0.07]}>
        {/* override with identical gold mat for clarity */}
      </mesh>

      {/* ── Inner liner (faint gold rule) ── */}
      <mesh geometry={linerGeo} material={linerMat} position={[0, 0, 0.001]} />

      {/* ── DE monogram plane ── */}
      <mesh
        ref={monogramRef}
        geometry={monogramGeo}
        material={monogramMat}
        position={[0.02, -0.01, 0.072]}
      />
    </group>
  );
}

/* ─────────────────────── Lights ────────────────────────────────────────── */

function Lights() {
  return (
    <>
      {/* Warm key light — upper left, primary specular catch on bevel */}
      <directionalLight
        position={[-2.5, 4.5, 3]}
        intensity={4.0}
        color="#FFF3C8"
      />
      {/* Cool rim — lower right, edge separation */}
      <directionalLight
        position={[3.5, -2.5, -1]}
        intensity={1.4}
        color="#B0C8FF"
      />
      {/* Top fill — simulates overhead */}
      <directionalLight
        position={[0, 6, 0]}
        intensity={0.8}
        color="#FFE8A0"
      />
      {/* Soft fill — front */}
      <directionalLight
        position={[0, 0, 5]}
        intensity={0.5}
        color="#FFFFFF"
      />
      {/* Ambient — very dim base */}
      <ambientLight intensity={0.12} color="#FFFFFF" />
    </>
  );
}

/* ─────────────────────── Public component ──────────────────────────────── */

interface SplashCrest3DProps {
  size?: number;
  onReady?: () => void;
  reducedMotion?: boolean;
}

export default function SplashCrest3D({
  size = 210,
  onReady,
  reducedMotion = false,
}: SplashCrest3DProps) {
  const h = Math.round(size * (228 / 200));
  // stable callback reference
  const handleReady = useCallback(() => { onReady?.(); }, [onReady]);

  return (
    <div style={{ width: size, height: h, display: 'block', pointerEvents: 'none' }}>
      <Canvas
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 3.4], fov: 36 }}
        style={{ background: 'transparent' }}
        dpr={[1, 2]}
      >
        <Lights />
        <ShieldScene reducedMotion={reducedMotion} onReady={handleReady} />
      </Canvas>
    </div>
  );
}

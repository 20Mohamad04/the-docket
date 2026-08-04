"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";

// ─── CONFIG ───────────────────────────────────────────────────────────
const PARTICLE_COUNT = 12000;
const BASE_RADIUS = 1.8;
const RADIUS_SPREAD = 0.6;

// ─── COLORS ───────────────────────────────────────────────────────────
const COLOR_PRIMARY = new THREE.Color("#8b5cf6");
const COLOR_SECONDARY = new THREE.Color("#3b82f6");
const COLOR_TERTIARY = new THREE.Color("#d946ef");
const COLOR_QUATERNARY = new THREE.Color("#06b6d4");

// ─── NOISE (fast pseudo-noise for particles) ──────────────────────────
function noise3D(x: number, y: number, z: number): number {
  return (
    Math.sin(x * 1.27 + y * 3.71 + z * 2.53) *
    Math.cos(y * 2.91 + z * 1.37 + x * 3.17) *
    Math.sin(z * 3.13 + x * 2.37 + y * 1.73)
  );
}

// ─── VERTEX SHADER (particles) ────────────────────────────────────────
const PARTICLE_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aRandom;

  uniform float uTime;
  uniform float uAmplitude;
  uniform float uPeak;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vDist;

  void main() {
    vColor = aColor;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float dist = length(position);
    vDist = dist;

    float baseSize = aSize * (1.0 + uAmplitude * 2.8);
    float pulse = 1.0 + sin(uTime * 3.0 + aRandom * 6.2831) * 0.18 * (1.0 + uAmplitude * 2.5);

    gl_PointSize = baseSize * pulse * (320.0 / -mvPosition.z);

    vAlpha = 0.55 + uAmplitude * 0.45;
    vAlpha *= smoothstep(4.0, 1.0, dist);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

// ─── FRAGMENT SHADER (particles) ──────────────────────────────────────
const PARTICLE_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uAmplitude;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vDist;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    alpha = pow(alpha, 1.4);

    float core = exp(-dist * 9.0) * 0.6;
    vec3 finalColor = vColor * (1.0 + core);
    finalColor *= (1.0 + uAmplitude * 0.7);

    gl_FragColor = vec4(finalColor, alpha * vAlpha);
  }
`;

// ─── VERTEX SHADER (core glow) ────────────────────────────────────────
const CORE_VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ─── FRAGMENT SHADER (core glow) ──────────────────────────────────────
const CORE_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uAmplitude;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.5);
    float pulse = 0.5 + sin(uTime * 1.5) * 0.15 + uAmplitude * 0.5;
    vec3 color = mix(uColor1, uColor2, fresnel + uAmplitude * 0.3);
    color *= fresnel * pulse;
    float alpha = fresnel * (0.28 + uAmplitude * 0.45);
    gl_FragColor = vec4(color, alpha);
  }
`;

// ─── VERTEX SHADER (atmosphere) ───────────────────────────────────────
const ATMO_VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ─── FRAGMENT SHADER (atmosphere) ─────────────────────────────────────
const ATMO_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uAmplitude;
  uniform vec3 uGlowColor;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 5.0);
    float pulse = 0.3 + sin(uTime * 1.2) * 0.08 + uAmplitude * 0.4;
    vec3 color = uGlowColor * fresnel * pulse;
    float alpha = fresnel * (0.08 + uAmplitude * 0.18);
    gl_FragColor = vec4(color, alpha);
  }
`;

// ═════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════

interface AIOrbProps {
  /** 0–1, drives animation intensity (from audio amplitude) */
  amplitude?: number;
  /** Called when user types and submits */
  onSubmit?: (text: string) => void;
  /** Display text below the orb */
  subtitle?: string;
  /** Status label above the orb */
  status?: string;
  /** Height of the orb container (px) */
  height?: number;
}

export default function AIOrb({
  amplitude = 0,
  onSubmit,
  subtitle = "",
  status = "ORB READY",
  height = 500,
}: AIOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orbRef = useRef<THREE.Points | null>(null);
  const coreRef = useRef<THREE.Mesh | null>(null);
  const atmoRef = useRef<THREE.Mesh | null>(null);
  const originalPosRef = useRef<Float32Array | null>(null);
  const velocitiesRef = useRef<Float32Array | null>(null);
  const randomRef = useRef<Float32Array | null>(null);
  const animIdRef = useRef<number>(0);
  const ampSmoothRef = useRef(0);
  const clockRef = useRef(new THREE.Clock());

  const [inputVal, setInputVal] = useState("");

  // ─── Initialize Three.js ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const heightActual = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / heightActual, 0.1, 100);
    camera.position.z = 6;
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, heightActual);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // ── PARTICLE GEOMETRY ──────────────────────────────────────────
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const originalPositions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const randoms = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const sv = Math.random();
      let radius: number;
      if (sv < 0.7) {
        radius = BASE_RADIUS + (Math.random() - 0.5) * RADIUS_SPREAD * 0.3;
      } else if (sv < 0.9) {
        radius = BASE_RADIUS * (0.7 + Math.random() * 0.35);
      } else {
        radius = BASE_RADIUS * Math.random() * 0.5;
      }

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      originalPositions[i3] = x;
      originalPositions[i3 + 1] = y;
      originalPositions[i3 + 2] = z;
      velocities[i3] = 0;
      velocities[i3 + 1] = 0;
      velocities[i3 + 2] = 0;

      // Color gradient based on Y position
      const normalizedY = (y / BASE_RADIUS + 1) * 0.5;
      const particleColor = new THREE.Color();

      if (normalizedY < 0.3) {
        particleColor.copy(COLOR_SECONDARY).lerp(COLOR_QUATERNARY, normalizedY / 0.3);
      } else if (normalizedY < 0.55) {
        particleColor.copy(COLOR_PRIMARY).lerp(COLOR_SECONDARY, (normalizedY - 0.3) / 0.25);
      } else if (normalizedY < 0.75) {
        particleColor.copy(COLOR_PRIMARY).lerp(COLOR_TERTIARY, (normalizedY - 0.55) / 0.2);
      } else {
        particleColor.copy(COLOR_TERTIARY).lerp(COLOR_PRIMARY, (normalizedY - 0.75) / 0.25);
      }

      particleColor.offsetHSL(
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.08
      );

      colors[i3] = particleColor.r;
      colors[i3 + 1] = particleColor.g;
      colors[i3 + 2] = particleColor.b;

      sizes[i] = 0.025 * (0.5 + Math.random() * 1.0);
      randoms[i] = Math.random() * Math.PI * 2;
    }

    originalPosRef.current = originalPositions;
    velocitiesRef.current = velocities;
    randomRef.current = randoms;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));

    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: 0 },
        uPeak: { value: 0 },
      },
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });

    const particleOrb = new THREE.Points(geometry, particleMaterial);
    scene.add(particleOrb);
    orbRef.current = particleOrb;

    // ── CORE GLOW ────────────────────────────────────────────────
    const coreGeo = new THREE.SphereGeometry(0.6, 32, 32);
    const coreMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: 0 },
        uColor1: { value: COLOR_PRIMARY },
        uColor2: { value: COLOR_TERTIARY },
      },
      vertexShader: CORE_VERTEX_SHADER,
      fragmentShader: CORE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
    });
    const coreGlow = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreGlow);
    coreRef.current = coreGlow;

    // ── ATMOSPHERE ───────────────────────────────────────────────
    const atmoGeo = new THREE.SphereGeometry(2.5, 32, 32);
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: 0 },
        uGlowColor: { value: COLOR_PRIMARY.clone().lerp(COLOR_SECONDARY, 0.5) },
      },
      vertexShader: ATMO_VERTEX_SHADER,
      fragmentShader: ATMO_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmosphere);
    atmoRef.current = atmosphere;

    // ─── ANIMATION LOOP ────────────────────────────────────────────
    const clock = clockRef.current;

    function animate() {
      const id = requestAnimationFrame(animate);
      animIdRef.current = id;

      const time = clock.getElapsedTime();
      const smoothAmp = ampSmoothRef.current;

      // Update particle material uniforms
      particleMaterial.uniforms.uTime.value = time;
      particleMaterial.uniforms.uAmplitude.value = smoothAmp;

      // Update core glow uniforms
      coreMat.uniforms.uTime.value = time;
      coreMat.uniforms.uAmplitude.value = smoothAmp;

      // Update atmosphere uniforms
      atmoMat.uniforms.uTime.value = time;
      atmoMat.uniforms.uAmplitude.value = smoothAmp;

      // ── UPDATE PARTICLE POSITIONS ──────────────────────────────
      const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
      const posArr = posAttr.array as Float32Array;
      const origArr = originalPositions;
      const velArr = velocities;
      const randArr = randoms;

      const breathScale = 1.0 + Math.sin(time * 0.8) * 0.03;
      const speakExpand = 1.0 + smoothAmp * 0.35;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const ox = origArr[i3];
        const oy = origArr[i3 + 1];
        const oz = origArr[i3 + 2];
        const rand = randArr[i];

        let targetX = ox * breathScale * speakExpand;
        let targetY = oy * breathScale * speakExpand;
        let targetZ = oz * breathScale * speakExpand;

        // Audio noise displacement
        if (smoothAmp > 0.01) {
          const ns = 1.5;
          const nsp = 2.0;
          const nx = noise3D(ox * ns + time * nsp, oy * ns, oz * ns + rand);
          const ny = noise3D(ox * ns, oy * ns + time * nsp, oz * ns + rand);
          const nz = noise3D(ox * ns + rand, oy * ns, oz * ns + time * nsp);
          const nStr = smoothAmp * 0.4;
          targetX += nx * nStr;
          targetY += ny * nStr;
          targetZ += nz * nStr;
        }

        // Spring physics
        velArr[i3] += (targetX - posArr[i3]) * 0.04;
        velArr[i3 + 1] += (targetY - posArr[i3 + 1]) * 0.04;
        velArr[i3 + 2] += (targetZ - posArr[i3 + 2]) * 0.04;
        velArr[i3] *= 0.92;
        velArr[i3 + 1] *= 0.92;
        velArr[i3 + 2] *= 0.92;
        posArr[i3] += velArr[i3];
        posArr[i3 + 1] += velArr[i3 + 1];
        posArr[i3 + 2] += velArr[i3 + 2];
      }
      posAttr.needsUpdate = true;

      // Rotation
      const rotSpeed = 0.001 + smoothAmp * 0.015;
      particleOrb.rotation.y += rotSpeed;
      particleOrb.rotation.x = Math.sin(time * 0.3) * 0.15;

      // Core scale
      const coreScale = 0.8 + smoothAmp * 0.3 + Math.sin(time * 1.5) * 0.05;
      coreGlow.scale.set(coreScale, coreScale, coreScale);

      // Atmosphere scale
      const atmoScale = 1.0 + smoothAmp * 0.1;
      atmosphere.scale.set(atmoScale, atmoScale, atmoScale);

      renderer.render(scene, camera);
    }

    animate();

    // ─── RESIZE ─────────────────────────────────────────────────────
    function handleResize() {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    // ─── CLEANUP ────────────────────────────────────────────────────
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animIdRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ─── Update amplitude from props ────────────────────────────────
  useEffect(() => {
    ampSmoothRef.current += (amplitude - ampSmoothRef.current) * 0.12;
  }, [amplitude]);

  // ─── Submit handler ─────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (inputVal.trim() && onSubmit) {
      onSubmit(inputVal.trim());
      setInputVal("");
    }
  }, [inputVal, onSubmit]);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Status */}
      <div
        style={{
          color: "rgba(123, 104, 238, 0.7)",
          fontSize: 11,
          letterSpacing: 4,
          textTransform: "uppercase" as const,
          marginBottom: 10,
        }}
      >
        {status}
      </div>

      {/* Orb canvas */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          maxWidth: 600,
          height,
          borderRadius: 24,
          overflow: "hidden",
        }}
      />

      {/* Subtitle / AI response */}
      {subtitle && (
        <div
          style={{
            color: "rgba(255,255,255,0.75)",
            fontSize: 15,
            maxWidth: 500,
            textAlign: "center",
            lineHeight: 1.6,
            marginTop: 16,
          }}
        >
          {subtitle}
        </div>
      )}

      {/* Input */}
      {onSubmit && (
        <div style={{ display: "flex", gap: 10, width: 480, marginTop: 20 }}>
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Ask the orb..."
            style={{
              flex: 1,
              padding: "14px 22px",
              borderRadius: 30,
              border: "1px solid rgba(123,104,238,0.3)",
              background: "rgba(255,255,255,0.04)",
              color: "#fff",
              fontSize: 15,
              outline: "none",
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              padding: "14px 28px",
              borderRadius: 30,
              border: "none",
              background: "linear-gradient(135deg, #7b68ee, #d946ef)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Speak
          </button>
        </div>
      )}
    </div>
  );
}
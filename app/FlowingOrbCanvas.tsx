"use client";
// Split into its own module (rather than living inline in page.tsx like
// almost everything else in this app) purely so next/dynamic can code-split
// it — R3F/three/postprocessing must never end up in the main bundle, and
// that requires importing this file lazily as a real, separate chunk.
import React,{useEffect,useMemo,useRef,useState} from "react";
import {Canvas,useFrame,useThree} from "@react-three/fiber";
import {Sphere} from "@react-three/drei";
import {EffectComposer,Bloom,ToneMapping} from "@react-three/postprocessing";
import type {EffectComposer as EffectComposerImpl} from "postprocessing";
import * as THREE from "three";

// Diagnostics-only — reuses the existing Eruda debug console (loaded behind
// ?debug=1 in app/page.tsx) rather than building new tooling. Plain
// console.error/console.log calls show up there as-is on mobile, where
// there's no other way to inspect what's happening. Investigating a
// flicker reported on iPhone (screenshots alternate between rendering
// correctly and going black) — this only makes the cause visible, it does
// not attempt a fix.
const diagTime=()=>new Date().toISOString();

// ── Shaders — unchanged from the previous imperative implementation ────────
const NEBULA_PARTICLE_VERTEX_SHADER=`
attribute vec3 aColor;
attribute float aSize;
attribute float aRandom;
uniform float uTime;
uniform float uAmplitude;
varying vec3 vColor;
varying float vAlpha;

void main(){
  vColor=aColor;
  vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
  float dist=length(position);
  float baseSize=aSize*(1.0+uAmplitude*2.5);
  float pulse=1.0+sin(uTime*3.0+aRandom*6.28)*0.15*(1.0+uAmplitude*2.0);
  gl_PointSize=baseSize*pulse*(300.0/-mvPosition.z);
  vAlpha=0.6+uAmplitude*0.4;
  vAlpha*=smoothstep(3.5,1.0,dist);
  gl_Position=projectionMatrix*mvPosition;
}`;

const NEBULA_PARTICLE_FRAGMENT_SHADER=`
uniform float uAmplitude;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec2 center=gl_PointCoord-vec2(0.5);
  float dist=length(center);
  if(dist>0.5)discard;
  float alpha=1.0-smoothstep(0.0,0.5,dist);
  alpha=pow(alpha,1.5);
  float core=exp(-dist*8.0)*0.5;
  vec3 finalColor=vColor*(1.0+core);
  finalColor*=(1.0+uAmplitude*0.6);
  gl_FragColor=vec4(finalColor,alpha*vAlpha);
}`;

const NEBULA_CORE_VERTEX_SHADER=`
varying vec3 vNormal;
varying vec3 vWorldPos;
void main(){
  vNormal=normalize(normalMatrix*normal);
  vec4 wp=modelMatrix*vec4(position,1.0);
  vWorldPos=wp.xyz;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;

const NEBULA_CORE_FRAGMENT_SHADER=`
uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColor1;
uniform vec3 uColor2;
varying vec3 vNormal;
varying vec3 vWorldPos;
void main(){
  vec3 viewDir=normalize(cameraPosition-vWorldPos);
  float fresnel=pow(1.0-max(dot(viewDir,vNormal),0.0),2.5);
  float pulse=0.5+sin(uTime*1.5)*0.15+uAmplitude*0.5;
  vec3 color=mix(uColor1,uColor2,fresnel+uAmplitude*0.3);
  color*=fresnel*pulse;
  float alpha=fresnel*(0.25+uAmplitude*0.4);
  gl_FragColor=vec4(color,alpha);
}`;

const NEBULA_ATMOS_FRAGMENT_SHADER=`
uniform float uTime;
uniform float uAmplitude;
uniform vec3 uGlowColor;
varying vec3 vNormal;
varying vec3 vWorldPos;
void main(){
  vec3 viewDir=normalize(cameraPosition-vWorldPos);
  float fresnel=pow(1.0-max(dot(viewDir,vNormal),0.0),5.0);
  float pulse=0.3+sin(uTime*1.2)*0.08+uAmplitude*0.4;
  vec3 color=uGlowColor*fresnel*pulse;
  float alpha=fresnel*(0.08+uAmplitude*0.15);
  gl_FragColor=vec4(color,alpha);
}`;

// Cheap pseudo-noise for CPU-side particle displacement (matches source technique)
function nebulaNoise3D(x:number,y:number,z:number){
  return Math.sin(x*1.27+y*3.71+z*2.53)*
    Math.cos(y*2.91+z*1.37+x*3.17)*
    Math.sin(z*3.13+x*2.37+y*1.73);
}

// Scaled down from the source's 12,000 — this renders at 34-76px, not
// full-screen, so density beyond this is invisible but still costs CPU
// every single frame for as long as the chat stays open.
const PARTICLE_COUNT=2200;
const BASE_RADIUS=1.8,RADIUS_SPREAD=0.6,PARTICLE_SIZE=0.05;

function buildParticleData(){
  const colorPrimary=new THREE.Color("#8b5cf6");
  const colorSecondary=new THREE.Color("#3b82f6");
  const colorTertiary=new THREE.Color("#d946ef");
  const colorQuaternary=new THREE.Color("#06b6d4");

  const positions=new Float32Array(PARTICLE_COUNT*3);
  const originalPositions=new Float32Array(PARTICLE_COUNT*3);
  const colorsArr=new Float32Array(PARTICLE_COUNT*3);
  const sizesArr=new Float32Array(PARTICLE_COUNT);
  const randomOffsets=new Float32Array(PARTICLE_COUNT);

  for(let i=0;i<PARTICLE_COUNT;i++){
    const i3=i*3;
    const theta=Math.random()*Math.PI*2;
    const phi=Math.acos(2*Math.random()-1);
    const surfaceOrVolume=Math.random();
    let radius:number;
    if(surfaceOrVolume<0.7) radius=BASE_RADIUS+(Math.random()-0.5)*RADIUS_SPREAD*0.3;
    else if(surfaceOrVolume<0.9) radius=BASE_RADIUS*(0.7+Math.random()*0.35);
    else radius=BASE_RADIUS*Math.random()*0.5;

    const x=radius*Math.sin(phi)*Math.cos(theta);
    const y=radius*Math.sin(phi)*Math.sin(theta);
    const z=radius*Math.cos(phi);
    positions[i3]=x;positions[i3+1]=y;positions[i3+2]=z;
    originalPositions[i3]=x;originalPositions[i3+1]=y;originalPositions[i3+2]=z;

    const normalizedY=(y/BASE_RADIUS+1)*0.5;
    const particleColor=new THREE.Color();
    if(normalizedY<0.3) particleColor.copy(colorSecondary).lerp(colorQuaternary,normalizedY/0.3);
    else if(normalizedY<0.55) particleColor.copy(colorPrimary).lerp(colorSecondary,(normalizedY-0.3)/0.25);
    else if(normalizedY<0.75) particleColor.copy(colorPrimary).lerp(colorTertiary,(normalizedY-0.55)/0.2);
    else particleColor.copy(colorTertiary).lerp(colorPrimary,(normalizedY-0.75)/0.25);
    particleColor.offsetHSL((Math.random()-0.5)*0.05,(Math.random()-0.5)*0.1,(Math.random()-0.5)*0.08);
    colorsArr[i3]=particleColor.r;colorsArr[i3+1]=particleColor.g;colorsArr[i3+2]=particleColor.b;

    sizesArr[i]=PARTICLE_SIZE*(0.5+Math.random()*1.0);
    randomOffsets[i]=Math.random()*Math.PI*2;
  }

  return{positions,originalPositions,colorsArr,sizesArr,randomOffsets,colorPrimary,colorSecondary,colorTertiary};
}

// Lives inside <Canvas> — owns the actual per-frame animation via useFrame,
// driven by the same manual-amplitude-overrides-idle-pulse logic as before.
function NebulaScene({activeRef,manualAmpRef}:{
  activeRef:React.RefObject<boolean>;
  manualAmpRef:React.RefObject<number|null>;
}){
  const data=useMemo(buildParticleData,[]);
  const pointsRef=useRef<THREE.Points>(null!);
  const coreRef=useRef<THREE.Mesh>(null!);
  const atmosphereRef=useRef<THREE.Mesh>(null!);
  const velocitiesRef=useRef<Float32Array>(new Float32Array(PARTICLE_COUNT*3));
  const smoothAmplitudeRef=useRef(0);

  const particleUniforms=useMemo(()=>({uTime:{value:0},uAmplitude:{value:0}}),[]);
  const coreUniforms=useMemo(()=>({
    uTime:{value:0},uAmplitude:{value:0},
    uColor1:{value:data.colorPrimary},uColor2:{value:data.colorTertiary},
  }),[data]);
  const atmosUniforms=useMemo(()=>({
    uTime:{value:0},uAmplitude:{value:0},
    uGlowColor:{value:data.colorPrimary.clone().lerp(data.colorSecondary,0.5)},
  }),[data]);

  const returnForce=0.04,damping=0.92,idleBreathSpeed=0.8,idleBreathAmount=0.03,
    speakExpandAmount=0.35,speakNoiseScale=1.5,speakNoiseSpeed=2.0,
    idleRotationSpeed=0.001,speakRotationSpeed=0.015;

  useFrame((state)=>{
    const time=state.clock.getElapsedTime();
    // Real speech amplitude takes priority when set; otherwise fall back to
    // the automatic "thinking" pulse, then idle.
    const manual=manualAmpRef.current;
    const target=manual!==null?manual:(activeRef.current?0.5:0.06);
    smoothAmplitudeRef.current+=(target-smoothAmplitudeRef.current)*(manual!==null?0.35:0.08);
    const amp=smoothAmplitudeRef.current;

    particleUniforms.uTime.value=time;particleUniforms.uAmplitude.value=amp;
    coreUniforms.uTime.value=time;coreUniforms.uAmplitude.value=amp;
    atmosUniforms.uTime.value=time;atmosUniforms.uAmplitude.value=amp;

    const breathScale=1.0+Math.sin(time*idleBreathSpeed)*idleBreathAmount;
    const speakExpand=1.0+amp*speakExpandAmount;

    const posAttr=pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const posArr=posAttr.array as Float32Array;
    const velocities=velocitiesRef.current;
    const{originalPositions,randomOffsets}=data;

    for(let i=0;i<PARTICLE_COUNT;i++){
      const i3=i*3;
      const ox=originalPositions[i3],oy=originalPositions[i3+1],oz=originalPositions[i3+2];
      const rand=randomOffsets[i];
      let targetX=ox*breathScale*speakExpand;
      let targetY=oy*breathScale*speakExpand;
      let targetZ=oz*breathScale*speakExpand;

      if(amp>0.01){
        const nx=nebulaNoise3D(ox*speakNoiseScale+time*speakNoiseSpeed,oy*speakNoiseScale,oz*speakNoiseScale+rand);
        const ny=nebulaNoise3D(ox*speakNoiseScale,oy*speakNoiseScale+time*speakNoiseSpeed,oz*speakNoiseScale+rand);
        const nz=nebulaNoise3D(ox*speakNoiseScale+rand,oy*speakNoiseScale,oz*speakNoiseScale+time*speakNoiseSpeed);
        const noiseStrength=amp*0.4;
        targetX+=nx*noiseStrength;targetY+=ny*noiseStrength;targetZ+=nz*noiseStrength;
      }

      velocities[i3]+=(targetX-posArr[i3])*returnForce;
      velocities[i3+1]+=(targetY-posArr[i3+1])*returnForce;
      velocities[i3+2]+=(targetZ-posArr[i3+2])*returnForce;
      velocities[i3]*=damping;velocities[i3+1]*=damping;velocities[i3+2]*=damping;
      posArr[i3]+=velocities[i3];posArr[i3+1]+=velocities[i3+1];posArr[i3+2]+=velocities[i3+2];
    }
    posAttr.needsUpdate=true;

    const rotSpeed=idleRotationSpeed+amp*speakRotationSpeed;
    pointsRef.current.rotation.y+=rotSpeed;
    pointsRef.current.rotation.x=Math.sin(time*0.3)*0.15;

    const coreScale=0.8+amp*0.3+Math.sin(time*1.5)*0.05;
    coreRef.current.scale.setScalar(coreScale);
    const atmosScale=1.0+amp*0.1;
    atmosphereRef.current.scale.setScalar(atmosScale);
  });

  return(
    <>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.positions,3]}/>
          <bufferAttribute attach="attributes-aColor" args={[data.colorsArr,3]}/>
          <bufferAttribute attach="attributes-aSize" args={[data.sizesArr,1]}/>
          <bufferAttribute attach="attributes-aRandom" args={[data.randomOffsets,1]}/>
        </bufferGeometry>
        <shaderMaterial
          uniforms={particleUniforms}
          vertexShader={NEBULA_PARTICLE_VERTEX_SHADER}
          fragmentShader={NEBULA_PARTICLE_FRAGMENT_SHADER}
          transparent depthWrite={false} depthTest blending={THREE.AdditiveBlending}/>
      </points>
      <Sphere ref={coreRef} args={[0.6,24,24]}>
        <shaderMaterial
          uniforms={coreUniforms}
          vertexShader={NEBULA_CORE_VERTEX_SHADER}
          fragmentShader={NEBULA_CORE_FRAGMENT_SHADER}
          transparent depthWrite={false} side={THREE.FrontSide} blending={THREE.AdditiveBlending}/>
      </Sphere>
      <Sphere ref={atmosphereRef} args={[2.5,24,24]}>
        <shaderMaterial
          uniforms={atmosUniforms}
          vertexShader={NEBULA_CORE_VERTEX_SHADER}
          fragmentShader={NEBULA_ATMOS_FRAGMENT_SHADER}
          transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending}/>
      </Sphere>
    </>
  );
}

// Diagnostics-only. @react-three/postprocessing's <EffectComposer> has no
// onResize/onCreated prop, but it internally calls `composer.setSize(...)`
// once on mount and again every time R3F's reactive `size` changes (that's
// the same value driving this hook) — so watching `size` here is a
// reasonable stand-in for "render targets created or resized". Logged
// separately from the ref-based creation log below since a mobile browser
// recreating the composer without a matching size change (e.g. after a
// context-loss/restore cycle) would itself be a meaningful signal.
function ComposerResizeDiagnostics(){
  const size=useThree((state)=>state.size);
  const prevSizeRef=useRef<{width:number;height:number}|null>(null);
  useEffect(()=>{
    const prev=prevSizeRef.current;
    console.log(
      `[FlowingOrb] EffectComposer ${prev?"resized":"initial size"} @ ${diagTime()}`,
      {from:prev,to:{width:size.width,height:size.height}},
    );
    prevSizeRef.current={width:size.width,height:size.height};
  },[size.width,size.height]);
  return null;
}

export default function FlowingOrbCanvas({size,activeRef,manualAmpRef}:{
  size:number;
  activeRef:React.RefObject<boolean>;
  manualAmpRef:React.RefObject<number|null>;
}){
  // Already capped — an uncapped dpr on a high-density iPhone screen driving
  // EffectComposer's multiple render targets (inputBuffer, outputBuffer,
  // depth) for a 34-76px UI element is real, avoidable GPU memory pressure,
  // and a plausible contributor to why the context gets lost in the first
  // place, not just how slowly it recovers.
  const dpr=typeof window!=="undefined"?Math.min(window.devicePixelRatio||1,2):1;
  const composerRef=useRef<EffectComposerImpl|null>(null);
  // Bumped on 'webglcontextrestored' to remount just the EffectComposer
  // subtree — see the comment on that listener below for why.
  const[composerEpoch,setComposerEpoch]=useState(0);
  return(
    <Canvas
      dpr={dpr}
      gl={{antialias:true,alpha:true,powerPreference:"low-power"}}
      camera={{fov:45,position:[0,0,6],near:0.1,far:100}}
      style={{width:size,height:size,display:"block"}}
      // Fixes a real bug the diagnostics above surfaced: EffectComposer was
      // resizing seconds after creation with no genuine change to this
      // fixed 34-76px container — a mobile Safari address-bar collapse
      // fires a window 'resize' event, and R3F's <Canvas> unconditionally
      // remeasures its container on that event (via react-use-measure)
      // regardless of whether anything here actually changed size.
      //
      // Note this can't be fixed with a container-scoped ResizeObserver of
      // our own: <Canvas> has no prop to supply an external size (its
      // CanvasProps type explicitly omits `size`) or to swap in a custom
      // observer — react-use-measure's ResizeObserver + window listener are
      // both wired internally with no way to bypass them. `resize` is the
      // one supported escape hatch, so it's used to make the *effect* of
      // that unavoidable remeasurement inert: offsetSize measures via
      // element.offsetWidth/offsetHeight (integer, layout-box) instead of
      // getBoundingClientRect (fractional/subpixel), so a container whose
      // real size hasn't changed reports identical numbers even through an
      // address-bar-driven reflow — react-use-measure's own equality check
      // then skips the state update entirely, so size never reaches
      // EffectComposer. scroll:false additionally drops ancestor
      // scroll-container listeners, since the flicker was reported as
      // happening specifically during scroll.
      resize={{offsetSize:true,scroll:false}}
      onCreated={(state)=>{
        // Diagnostics confirmed genuine WebGL context loss (WebGLContextEvent,
        // isTrusted:true) followed by a slow ~12s recovery via a full
        // component remount — mobile Safari/WebKit reclaims WebGL contexts
        // under memory pressure more aggressively than desktop, so this is
        // a real, recurring condition to recover from properly, not just an
        // edge case to log.
        const canvas=state.gl.domElement;
        canvas.addEventListener("webglcontextlost",(e)=>{
          // Per the WebGL spec, an unprevented 'webglcontextlost' tells the
          // browser to treat the loss as permanent — it won't attempt
          // automatic restoration (or does so far more slowly/
          // inconsistently). This is what actually enables the fast native
          // restore path the fix below depends on. three.js's own
          // WebGLRenderer already calls this internally too; calling it
          // here as well is harmless (idempotent per spec) and doesn't
          // leave fast recovery dependent on library-internal wiring we
          // don't directly control.
          e.preventDefault();
          console.error(`[FlowingOrb] WebGL context LOST @ ${diagTime()}`,e);
        });
        canvas.addEventListener("webglcontextrestored",(e)=>{
          console.log(`[FlowingOrb] WebGL context RESTORED @ ${diagTime()}`,e);
          // three.js's own renderer already rebuilds its core GL state and
          // resets its internal texture/geometry caches on restore (see
          // WebGLRenderer's onContextRestore -> initGLContext), so ordinary
          // scene resources — the particle points, core/atmosphere spheres
          // in NebulaScene — re-upload automatically on the next frame; no
          // action needed for those. @react-three/postprocessing's
          // EffectComposer manages its own render targets (inputBuffer,
          // outputBuffer, depth) outside that path, though, and is the one
          // piece not verified to recover on its own. Bumping this key
          // remounts just that subtree, creating fresh render targets
          // against the now-restored context — the outer <Canvas>/
          // WebGLRenderer/GL context itself is never touched, so this is a
          // fast in-memory recreation, not the ~12s outer remount it
          // replaces.
          setComposerEpoch((n)=>n+1);
        });
      }}>
      <NebulaScene activeRef={activeRef} manualAmpRef={manualAmpRef}/>
      {/* Real full-screen luminance-threshold bloom, replacing the old
          additive-blending approximation. Threshold is low and smoothing
          soft so the nebula's own colors (not just hot white highlights)
          actually trigger it — tuned to read as a refined glow rather than
          a blown-out blur at this small a render size; ToneMapping (ACES,
          matching the previous renderer.toneMapping setting) runs last so
          it grades the combined bloom+scene output, not the reverse. */}
      <ComposerResizeDiagnostics/>
      <EffectComposer
        key={composerEpoch}
        ref={(instance)=>{
          if(instance&&composerRef.current!==instance){
            composerRef.current=instance;
            console.log(`[FlowingOrb] EffectComposer instance created @ ${diagTime()}`,instance);
          }
        }}>
        <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.4} intensity={0.6} radius={0.4} mipmapBlur/>
        <ToneMapping/>
      </EffectComposer>
    </Canvas>
  );
}

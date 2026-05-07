import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useRef, useState, useMemo, memo, useCallback, createContext, useContext } from "react";
import { useMissionEventSystem, useMysteryBoxSystem } from "./MissionSystem";

const LANES = [-2, 0, 2];

const SKINS = [
  { id: "default", name: "Classic", colors: { body: "#ff4d6d", head: "#ffd166", legs: "#111827", arm: "#ff7aa2" } },
  { id: "neon", name: "Neon", colors: { body: "#00f5d4", head: "#ffd166", legs: "#111827", arm: "#00f5d4" } },
  { id: "sunset", name: "Sunset", colors: { body: "#f15bb5", head: "#fee440", legs: "#111827", arm: "#f15bb5" } },
  { id: "shadow", name: "Shadow", colors: { body: "#333333", head: "#666666", legs: "#111111", arm: "#333333" } },
  { id: "hero", name: "Hero", colors: { body: "#3a86ff", head: "#ffd166", legs: "#111827", arm: "#3a86ff" } },
];

// ---------------- CHARACTER ----------------
const Character = memo(function Character({
  laneRef,
  jumpRef,
  jumpStartRef,
  slideRef,
  playerRef,
  speedRef,
  gameOver,
  skinColors,
  hoverboardActive,
}) {
  const ref = useRef();
  const vel = useRef(0);
  const swing = useRef(0);

  // tuned physics (higher jump, smoother gravity/airtime)
  const GRAVITY = 28; // Increased for snappier fall
  const JUMP_V = 10.5; // Stronger initial jump
  const FORCE_FALL_V = -12;
  const FORCE_FALL_S = 0.75; 

  useFrame((state, delta) => {
    if (!ref.current || gameOver) return;

    // Snappier lane follow with a slight overshoot/spring feel
    const laneIndex = laneRef?.current ?? 1;
    const targetX = LANES[laneIndex] ?? 0;
    const moveFactor = 1 - Math.exp(-35 * delta); 
    
    const prevX = ref.current.position.x;
    ref.current.position.x += (targetX - ref.current.position.x) * moveFactor;

    // Add tilt and roll effect when switching lanes
    const currentVelocityX = (ref.current.position.x - prevX) / delta;
    ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, -currentVelocityX * 0.015, 0.15);
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, currentVelocityX * 0.008, 0.15);

    // Subtle side-to-side sway when running on ground
    if (ref.current.position.y <= 0.505) {
      ref.current.position.x += Math.sin(state.clock.elapsedTime * 8) * 0.01;
    }

    // forward motion
    ref.current.position.z -= (speedRef.current || 0) * delta * 60;

    const nowS = performance.now() / 1000;

    // jump
    if (jumpRef?.current) {
      if (ref.current.position.y <= 0.505) {
        vel.current = JUMP_V;
        if (jumpStartRef) jumpStartRef.current = nowS;
      }
      jumpRef.current = false;
    }

    // gravity integration
    const gravityMul = vel.current > 0 ? 0.85 : 1.8; // Snappier peak and fall
    vel.current -= GRAVITY * gravityMul * delta;
    ref.current.position.y += vel.current * delta;

    // force landing
    if (jumpStartRef?.current && nowS - jumpStartRef.current > FORCE_FALL_S) {
      if (vel.current > FORCE_FALL_V) {
        vel.current = Math.min(vel.current, FORCE_FALL_V);
      }
    }

    // ground clamp
    if (ref.current.position.y < 0.5) {
      ref.current.position.y = 0.5;
      vel.current = 0;
      if (jumpStartRef) jumpStartRef.current = 0;
    }

    // sliding visual
    const sliding = slideRef?.current && (nowS - slideRef.current < 0.65);
    const targetScaleY = sliding ? 0.4 : 1;
    const slideLerp = 1 - Math.exp(-25 * delta); 
    ref.current.scale.y += (targetScaleY - ref.current.scale.y) * slideLerp;

    // limb swing (time-based, scaled by speed but clamped)
    const speedFactor = Math.max(0.8, Math.min(2.0, Math.abs(speedRef.current) * 2.2));
    swing.current += speedFactor * delta * 3.0;

    // update limbs (cache children locally)
    const leftLeg = ref.current.children[2];
    const rightLeg = ref.current.children[3];
    const leftArm = ref.current.children[4];
    const rightArm = ref.current.children[5];

    if (leftLeg) leftLeg.rotation.x = Math.sin(swing.current) * 0.6;
    if (rightLeg) rightLeg.rotation.x = -Math.sin(swing.current) * 0.6;
    if (leftArm) leftArm.rotation.x = -Math.sin(swing.current) * 0.6;
    if (rightArm) rightArm.rotation.x = Math.sin(swing.current) * 0.6;

    if (sliding) {
      if (leftArm) leftArm.rotation.x = -0.9;
      if (rightArm) rightArm.rotation.x = -0.9;
    }

    // publish position for camera/collisions (ref object)
    if (!playerRef.current) playerRef.current = { x: 0, y: 0.5, z: 0, scaleY: 1 };
    playerRef.current.x = ref.current.position.x;
    playerRef.current.y = ref.current.position.y;
    playerRef.current.z = ref.current.position.z;
    playerRef.current.scaleY = ref.current.scale.y;
  });

  return (
    <group ref={ref} position={[0, 0.5, 0]}>
      {/* body */}
      <mesh castShadow position={[0, 0.8, 0]}>
        <boxGeometry args={[0.5, 1, 0.35]} />
        <meshStandardMaterial color={skinColors?.body || "#ff4d6d"} />
      </mesh>

      {/* head */}
      <mesh castShadow position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.32]} />
        <meshStandardMaterial color={skinColors?.head || "#ffd166"} />
      </mesh>

      {/* left leg */}
      <mesh castShadow position={[-0.15, 0.2, 0]}>
        <boxGeometry args={[0.2, 0.6, 0.2]} />
        <meshStandardMaterial color={skinColors?.legs || "#111827"} />
      </mesh>

      {/* right leg */}
      <mesh castShadow position={[0.15, 0.2, 0]}>
        <boxGeometry args={[0.2, 0.6, 0.2]} />
        <meshStandardMaterial color={skinColors?.legs || "#111827"} />
      </mesh>

      {/* left arm */}
      <mesh castShadow position={[-0.42, 0.9, 0]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color={skinColors?.arm || "#ff7aa2"} />
      </mesh>

      {/* right arm */}
      <mesh castShadow position={[0.42, 0.9, 0]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color={skinColors?.arm || "#ff7aa2"} />
      </mesh>

      {/* hoverboard glow (simple, lightweight) */}
      <mesh visible={!!hoverboardActive} position={[0, 0.36, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.52, 0.52, 0.02, 24]} />
        <meshStandardMaterial
          color="#7c3aed"
          emissive="#7c3aed"
          emissiveIntensity={0.85}
          transparent
          opacity={0.72}
          roughness={0.1}
          metalness={0.6}
        />
      </mesh>
    </group>
  );
});

// ---------------- CAMERA ----------------
const CameraFollow = memo(function CameraFollow({ playerRef, speedRef, crashFxRef }) {
  const { camera } = useThree();
  const posTarget = useRef(new THREE.Vector3());
  const lookTarget = useRef(new THREE.Vector3());
  const tempMat = useRef(new THREE.Matrix4());
  const targetQuat = useRef(new THREE.Quaternion());

  useEffect(() => {
    if (playerRef.current) {
      lookTarget.current.set(playerRef.current.x, playerRef.current.y + 1.1, playerRef.current.z - 5.5);
      camera.position.set(playerRef.current.x, playerRef.current.y + 3.2, playerRef.current.z + 6.2);
      camera.lookAt(lookTarget.current);
    } else {
      lookTarget.current.set(0, 1.6, -5.5);
      camera.position.set(0, 3.2, 6.2);
      camera.lookAt(0, 1.6, -5.5);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state, delta) => {
    if (!playerRef.current) return;

    const baseY = playerRef.current.y + 3.2;
    const baseZ = playerRef.current.z + 6.2;

    // Removed sway for a more stable feel
    const swayX = 0;
    const swayY = 0;

    const crashFx = crashFxRef?.current || 0;
    // Reduced screen shake
    const shake = crashFx > 0 ? crashFx * 0.3 : 0;
    const shakeX = (Math.random() - 0.5) * shake;
    const shakeY = (Math.random() - 0.5) * shake;
    const shakeZ = (Math.random() - 0.5) * shake * 0.5;

    // Camera follows player x slightly so it feels more dynamic
    posTarget.current.set(playerRef.current.x * 0.4 + swayX + shakeX, baseY + swayY + shakeY, baseZ + shakeZ);

    const lerpFactor = 1 - Math.exp(-8 * delta); // Smoother camera follow
    camera.position.lerp(posTarget.current, lerpFactor);

    lookTarget.current.set(playerRef.current.x, playerRef.current.y + 1.1, playerRef.current.z - 5.5);

    tempMat.current.lookAt(camera.position, lookTarget.current, camera.up);
    targetQuat.current.setFromRotationMatrix(tempMat.current);
    camera.quaternion.slerp(targetQuat.current, lerpFactor);

    if (crashFxRef?.current > 0) {
      crashFxRef.current = Math.max(0, crashFxRef.current - delta * 3.4);
    }
  });

  return null;
});

// ---------------- THEMES ----------------
const THEMES = [
  {
    id: "city", name: "Urban Rush",
    bg: "linear-gradient(#0f172a, #334155)", fog: "#334155",
    floor0: "#1e293b", floor1: "#0f172a",
    wall0: "#334155", wall1: "#1e293b",
    trimA0: "#38bdf8", trimA1: "#818cf8", trimA2: "#f472b6",
    trimB0: "#22d3ee", trimB1: "#a78bfa",
    preview: "#38bdf8"
  },
  {
    id: "jungle", name: "Jungle Explorer",
    bg: "linear-gradient(#064e3b, #0f766e)", fog: "#064e3b",
    floor0: "#14532d", floor1: "#166534",
    wall0: "#065f46", wall1: "#047857",
    trimA0: "#10b981", trimA1: "#34d399", trimA2: "#6ee7b7",
    trimB0: "#84cc16", trimB1: "#a3e635",
    preview: "#10b981"
  },
  {
    id: "desert", name: "Sahara Gold",
    bg: "linear-gradient(#fdba74, #fcd34d)", fog: "#fcd34d",
    floor0: "#fef08a", floor1: "#ffedd5",
    wall0: "#fde68a", wall1: "#fed7aa",
    trimA0: "#ef4444", trimA1: "#fb923c", trimA2: "#fcd34d",
    trimB0: "#f97316", trimB1: "#f59e0b",
    preview: "#fcd34d"
  },
  {
    id: "night", name: "Midnight Ride",
    bg: "linear-gradient(#020617, #0f172a)", fog: "#020617",
    floor0: "#0f172a", floor1: "#020617",
    wall0: "#1e293b", wall1: "#0f172a",
    trimA0: "#a855f7", trimA1: "#d946ef", trimA2: "#8b5cf6",
    trimB0: "#7c3aed", trimB1: "#6366f1",
    preview: "#a855f7"
  }
];

// ---------------- BACKGROUND ANIMATIONS (Subway style) ----------------
const BackgroundAnimations = memo(function BackgroundAnimations({ theme, speedRef, playerRef, gameOver }) {
  const birds = useRef(Array.from({ length: 4 }, () => ({
    x: (Math.random() - 0.5) * 40,
    y: 8 + Math.random() * 6,
    z: -30 - Math.random() * 100,
    speed: 0.1 + Math.random() * 0.15,
    offset: Math.random() * Math.PI * 2
  })));

  const clouds = useRef(Array.from({ length: 6 }, () => ({
    x: (Math.random() - 0.5) * 100,
    y: 15 + Math.random() * 10,
    z: -50 - Math.random() * 200,
    scale: 2 + Math.random() * 4,
    speed: 0.05 + Math.random() * 0.05
  })));

  const groupRef = useRef();
  const cloudsRef = useRef();

  useFrame((state, delta) => {
    if (!groupRef.current || gameOver) return;
    const currentSpeed = speedRef?.current || 0.28;
    const pz = playerRef?.current?.z || 0;

    birds.current.forEach((b, i) => {
      b.z += (b.speed * 30 + currentSpeed * 20) * delta;
      if (b.z > pz + 20) b.z = pz - 120;
      b.y += Math.sin(state.clock.elapsedTime * 2 + b.offset) * 0.01;
      const child = groupRef.current.children[i];
      if (child) child.position.set(b.x, b.y, b.z);
    });

    if (cloudsRef.current) {
      clouds.current.forEach((c, i) => {
        c.z += (c.speed * 10 + currentSpeed * 5) * delta;
        if (c.z > pz + 50) c.z = pz - 250;
        const child = cloudsRef.current.children[i];
        if (child) child.position.set(c.x, c.y, c.z);
      });
    }
  });

  return (
    <group>
      <group ref={groupRef}>
        {birds.current.map((_, i) => (
          <group key={i}>
            <mesh castShadow>
              <boxGeometry args={[0.4, 0.05, 0.2]} />
              <meshStandardMaterial color={theme.id === 'night' ? "#1e293b" : "#334155"} />
            </mesh>
            <mesh position={[0.2, 0.05, 0]} rotation={[0, 0, 0.5]}>
              <boxGeometry args={[0.3, 0.02, 0.15]} />
              <meshStandardMaterial color={theme.id === 'night' ? "#1e293b" : "#334155"} />
            </mesh>
            <mesh position={[-0.2, 0.05, 0]} rotation={[0, 0, -0.5]}>
              <boxGeometry args={[0.3, 0.02, 0.15]} />
              <meshStandardMaterial color={theme.id === 'night' ? "#1e293b" : "#334155"} />
            </mesh>
          </group>
        ))}
      </group>

      <group ref={cloudsRef}>
        {clouds.current.map((c, i) => (
          <mesh key={i} position={[c.x, c.y, c.z]}>
            <sphereGeometry args={[c.scale, 8, 8]} />
            <meshStandardMaterial 
              color={theme.id === 'night' ? "#1e293b" : "#fff"} 
              transparent 
              opacity={theme.id === 'night' ? 0.2 : 0.4} 
              flatShading 
            />
          </mesh>
        ))}
      </group>
      
      <group position={[20, 20, -60]}>
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh key={i} rotation={[0, 0, 0.4]} position={[i * 3, 0, 0]}>
            <planeGeometry args={[1, 60]} />
            <meshBasicMaterial 
              color={theme.id === 'night' ? "#a855f7" : theme.id === 'desert' ? "#fbbf24" : "#fff"} 
              transparent 
              opacity={0.05} 
            />
          </mesh>
        ))}
      </group>

{theme.id === 'jungle' && <JungleLeaves playerRef={playerRef} gameOver={gameOver} />}
       <ParallaxScenery theme={theme} playerRef={playerRef} speedRef={speedRef} gameOver={gameOver} />
    </group>
  );
});

const ParallaxScenery = memo(function ParallaxScenery({ theme, playerRef, speedRef, gameOver }) {
  const items = useRef(Array.from({ length: 12 }, (_, i) => ({
    x: i % 2 === 0 ? -12 - Math.random() * 10 : 12 + Math.random() * 10,
    z: -i * 30,
    scaleY: 5 + Math.random() * 15,
    type: Math.random() > 0.5 ? 'building' : 'tree'
  })));
  const ref = useRef();

  useFrame((state, delta) => {
    if (!ref.current || !playerRef.current || gameOver) return;
    const pz = playerRef.current.z;
    const spd = speedRef.current || 0.28;

    items.current.forEach((item, i) => {
      if (item.z > pz + 60) {
        item.z = pz - 300;
        item.x = i % 2 === 0 ? -15 - Math.random() * 20 : 15 + Math.random() * 20;
      }
      
      const child = ref.current.children[i];
      if (child) {
        child.position.set(item.x, item.scaleY / 2, item.z);
      }
    });
  });

  return (
    <group ref={ref}>
      {items.current.map((item, i) => (
        <mesh key={i} castShadow receiveShadow>
          <boxGeometry args={[4, item.scaleY, 4]} />
          <meshStandardMaterial color={i % 2 ? theme.wall0 : theme.wall1} />
        </mesh>
      ))}
    </group>
  );
});

const SnowParticles = memo(function SnowParticles({ playerRef, gameOver }) {
  const particles = useRef(Array.from({ length: 50 }, () => ({
    x: (Math.random() - 0.5) * 30,
    y: Math.random() * 15,
    z: -Math.random() * 100,
    speed: 1 + Math.random() * 2
  })));
  const ref = useRef();

  useFrame((state, delta) => {
    if (!ref.current || gameOver) return;
    const pz = playerRef?.current?.z || 0;
    particles.current.forEach((p, i) => {
      p.y -= p.speed * delta;
      p.x += Math.sin(state.clock.elapsedTime + i) * 0.02;
      if (p.y < 0) {
        p.y = 15;
        p.z = pz - Math.random() * 100;
      }
      const child = ref.current.children[i];
      if (child) child.position.set(p.x, p.y, p.z);
    });
  });

  return (
    <group ref={ref}>
      {particles.current.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.05, 4, 4]} />
          <meshBasicMaterial color="#fff" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
});

const JungleLeaves = memo(function JungleLeaves({ playerRef, gameOver }) {
  const leaves = useRef(Array.from({ length: 40 }, () => ({
    x: (Math.random() - 0.5) * 40,
    y: 5 + Math.random() * 15,
    z: -Math.random() * 120,
    speed: 0.5 + Math.random() * 1.5,
    rotSpeed: (Math.random() - 0.5) * 2,
    rot: Math.random() * Math.PI * 2
  })));
  const ref = useRef();

  useFrame((state, delta) => {
    if (!ref.current || gameOver) return;
    const pz = playerRef?.current?.z || 0;
    leaves.current.forEach((l, i) => {
      l.y -= l.speed * delta;
      l.x += Math.sin(state.clock.elapsedTime * 0.5 + i) * 0.05;
      l.rot += l.rotSpeed * delta;
      if (l.y < 0) {
        l.y = 15 + Math.random() * 5;
        l.z = pz - Math.random() * 120;
      }
      const child = ref.current.children[i];
      if (child) {
        child.position.set(l.x, l.y, l.z);
        child.rotation.set(l.rot, l.rot, 0);
      }
    });
  });

  return (
    <group ref={ref}>
      {leaves.current.map((_, i) => (
        <mesh key={i}>
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial color="#4ade80" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
});


// ---------------- TRACK & ENVIRONMENT (colorful walls) ----------------
const Track = memo(function Track({ playerRef, theme, gameOver }) {
  const tiles = useRef(Array.from({ length: 24 }, (_, i) => ({ z: -i * 18 })));
  const groupRefs = useRef([]);
  const neonRefs = useRef([]);
  const archesRef = useRef([]);

  useFrame((state, delta) => {
    if (!playerRef.current || gameOver) return;
    const pz = playerRef.current.z;
    tiles.current.forEach((t, i) => {
      if (t.z > pz + 36) t.z -= 24 * 18;
      const g = groupRefs.current[i];
      if (g) g.position.set(0, 0, t.z);
    });

    // Pulsing neon effect
    const pulse = 0.6 + Math.sin(state.clock.elapsedTime * 4) * 0.4;
    neonRefs.current.forEach(ref => {
      if (ref && ref.material) {
        ref.material.emissiveIntensity = pulse;
      }
    });
  });

  return (
    <>
      {tiles.current.map((t, i) => (
        <group key={i} ref={(el) => (groupRefs.current[i] = el)} position={[0, 0, t.z]}>
          {/* Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[14, 18]} />
            <meshStandardMaterial color={i % 2 ? theme.floor1 : theme.floor0} />
          </mesh>

          {/* Side Walls */}
          <group position={[-6.4, 1.8, 0]}>
            <mesh>
              <boxGeometry args={[0.4, 3.6, 18]} />
              <meshStandardMaterial color={i % 2 ? theme.wall1 : theme.wall0} />
            </mesh>
            <mesh position={[0.45, 1.2, 0]} ref={el => neonRefs.current[i * 2] = el}>
              <boxGeometry args={[0.05, 0.4, 18]} />
              <meshStandardMaterial color={theme.trimA0} emissive={theme.trimA0} emissiveIntensity={1} />
            </mesh>
          </group>
          <group position={[6.4, 1.8, 0]}>
            <mesh>
              <boxGeometry args={[0.4, 3.6, 18]} />
              <meshStandardMaterial color={i % 2 ? theme.wall1 : theme.wall0} />
            </mesh>
            <mesh position={[-0.45, 1.2, 0]} ref={el => neonRefs.current[i * 2 + 1] = el}>
              <boxGeometry args={[0.05, 0.4, 18]} />
              <meshStandardMaterial color={theme.trimA1} emissive={theme.trimA1} emissiveIntensity={1} />
            </mesh>
          </group>

          {/* Ground Detail Lights */}
          <mesh position={[-5.8, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.4, 1]} />
            <meshStandardMaterial color={theme.trimA0} emissive={theme.trimA0} emissiveIntensity={0.8} transparent opacity={0.6} />
          </mesh>
          <mesh position={[5.8, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.4, 1]} />
            <meshStandardMaterial color={theme.trimB0} emissive={theme.trimB0} emissiveIntensity={0.8} transparent opacity={0.6} />
          </mesh>
        </group>
      ))}
    </>
  );
});

// ---------------- SOUND (safe audio refs, unlock & safe play) ----------------
function useGameAudio() {
  const coinRef = useRef(null);
  const jumpRef = useRef(null);
  const slideRef = useRef(null);
  const fallRef = useRef(null);
  const shieldRef = useRef(null); // optional
  const clickRef = useRef(null); // optional
  const powerupRef = useRef(null);
  const bgmRef = useRef(null);

  const unlockedRef = useRef(false);

  useEffect(() => {
    if (typeof Audio === "undefined") return;

    const createAudio = (candidates, volume = 1, loop = false) => {
      if (!Array.isArray(candidates) || candidates.length === 0) return null;
      let idx = 0;
      const a = new Audio(candidates[idx]);
      try {
        a.preload = "auto";
        a.volume = volume;
        a.loop = loop;
        a.setAttribute && a.setAttribute("playsinline", "true");
      } catch {}
      a.addEventListener("error", () => {
        idx += 1;
        if (idx < candidates.length) {
          try {
            a.src = candidates[idx];
            a.load();
          } catch {}
        }
      });
      try {
        a.load();
      } catch {}
      return a;
    };

    // support both expected and current actual filenames in /public
    coinRef.current = createAudio(["/coin.mp3.mp3", "/sounds/coin.mp3", "/coin.mp3"], 0.95, false);
    powerupRef.current = createAudio(["/coin.mp3.mp3", "/sounds/coin.mp3", "/coin.mp3"], 1.0, false);
    jumpRef.current = createAudio(["/jump.mp3.mp3", "/sounds/jump.mp3", "/jump.mp3"], 0.9, false);
    slideRef.current = createAudio(["/slide.mp3.mp3", "/sounds/slide.mp3", "/slide.mp3"], 0.9, false);
    fallRef.current = createAudio(["/crash.mp3.mp3", "/sounds/crash.mp3", "/crash.mp3", "/fall.mp3"], 1, false);
    shieldRef.current = createAudio(["/sounds/shield.mp3", "/shield.mp3"], 0.9, false);
    clickRef.current = createAudio(["/sounds/click.mp3", "/click.mp3"], 0.85, false);
    bgmRef.current = createAudio(["/bg.mp3.mp3", "/sounds/bgm.mp3", "/sounds/bg.mp3", "/bgm.mp3", "/bg.mp3"], 0.28, true);

    // pre-configure audio elements once
    const refs = [coinRef, powerupRef, jumpRef, slideRef, fallRef, shieldRef, clickRef, bgmRef];
    refs.forEach((r) => {
      const a = r.current;
      if (!a) return;
      try {
        a.preload = "auto";
        // mobile friendly attributes
        try {
          a.setAttribute && a.setAttribute("playsinline", "true");
        } catch {}
      } catch {}
    });

    function unlockHandler() {
      if (unlockedRef.current) return;
      unlockedRef.current = true;

      // Play muted briefly to unlock audio on mobile/browsers
      refs.forEach((r) => {
        const a = r.current;
        if (!a) return;
        try {
          a.muted = true;
          const p = a.play();
          if (p && p.catch) p.catch(() => {});
          // pause and reset so it's ready for later playback
          a.pause();
          try {
            a.currentTime = 0;
          } catch {}
          a.muted = false;
        } catch {}
      });
      if (bgmRef.current) {
        try {
          bgmRef.current.loop = true;
          bgmRef.current.volume = 0.28;
        } catch {}
      }

      // cleanup listeners when unlocked
      window.removeEventListener("pointerdown", unlockHandler);
      window.removeEventListener("touchstart", unlockHandler);
      window.removeEventListener("keydown", unlockHandler);
    }

    window.addEventListener("pointerdown", unlockHandler, { once: true, passive: true });
    window.addEventListener("touchstart", unlockHandler, { once: true, passive: true });
    window.addEventListener("keydown", unlockHandler, { once: true, passive: true });

    return () => {
      window.removeEventListener("pointerdown", unlockHandler);
      window.removeEventListener("touchstart", unlockHandler);
      window.removeEventListener("keydown", unlockHandler);
    };
  }, []);

  const playSound = useCallback((audioRef, opts = {}) => {
    if (!audioRef || !audioRef.current) return;
    try {
      const base = audioRef.current;
      if (opts.allowOverlap === false && !base.paused && base.currentTime > 0) return;
      base.volume = typeof opts.volume === "number" ? opts.volume : base.volume;
      base.currentTime = 0;
      const p = base.play();
      if (p && p.catch) p.catch(() => {});
    } catch {
      // ignore
    }
  }, []);

  return {
    refs: { coinRef, jumpRef, slideRef, fallRef, shieldRef, powerupRef },
    coinRef,
    jumpRef,
    slideRef,
    fallRef,
    shieldRef,
    powerupRef,
    bgmRef, // expose bgmRef for playback rate sync
    playCoin: () => playSound(coinRef),
    playPowerup: () => playSound(powerupRef),
    playJump: () => playSound(jumpRef),
    playSlide: () => playSound(slideRef),
    playFall: () => playSound(fallRef, { allowOverlap: false }),
    playShield: () => playSound(shieldRef),
    playClick: () => playSound(clickRef),
    playBgm: () => {
      if (!bgmRef.current) return;
      try {
        bgmRef.current.loop = true;
        bgmRef.current.volume = 0.28;
        if (!bgmRef.current.paused) return;
        const p = bgmRef.current.play();
        if (p && p.catch) p.catch(() => {});
      } catch {}
    },
    stopBgm: () => {
      if (!bgmRef.current) return;
      try {
        bgmRef.current.pause();
        // Reset playback rate on stop
        try { bgmRef.current.playbackRate = 1.0; } catch {}
      } catch {}
    },
    unlockedRef,
  };
}

// ---------------- FLOATING TEXT SYSTEM ----------------
// Lightweight DOM-based floating text — avoids Three.js overhead
const FloatingTextsContext = createContext(null);

function FloatingTextsProvider({ children }) {
  const [texts, setTexts] = useState([]);
  const counterRef = useRef(0);

  // Spawn a floating text at a screen position
  const spawnText = useCallback((msg, opts = {}) => {
    const id = ++counterRef.current;
    const x = opts.x ?? (40 + Math.random() * 20); // % from left
    const y = opts.y ?? 30;
    const color = opts.color ?? '#fff';
    const size = opts.size ?? 16;
    setTexts(prev => [...prev, { id, msg, x, y, color, size }]);
    // auto-remove after animation completes
    setTimeout(() => {
      setTexts(prev => prev.filter(t => t.id !== id));
    }, 1100);
  }, []);

  return (
    <FloatingTextsContext.Provider value={spawnText}>
      {children}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9500, overflow: 'hidden' }}>
        {texts.map(t => (
          <div
            key={t.id}
            className="floating-text"
            style={{
              left: `${t.x}%`,
              top: `${t.y}%`,
              color: t.color,
              fontSize: t.size,
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </FloatingTextsContext.Provider>
  );
}

function useSpawnText() {
  return useContext(FloatingTextsContext);
}

// ---------------- COINS ----------------
const COIN_PATTERNS = {
  STRAIGHT: 0,
  ARC: 1,
  LOW: 2,
  LANE_SHIFT: 3,
};

const Coins = memo(function Coins({ playerRef, addScoreRef, addCoinsRef, playCoinRef, magnet, speedRef, doubleActive, obstaclesRef, gameOver, spawnCoinsForObstacleRef }) {
  const coins = useRef(
    Array.from({ length: 48 }, () => ({
      x: 0,
      z: -9999,
      y: 0.82,
      rot: Math.random() * Math.PI * 2,
      inCluster: false,
    }))
  );

  const groupRefs = useRef([]);
  const coinScaleRefs = useRef(coins.current.map(() => ({ s: 1, t: 0 })));

  const spawnCoinsForObstacle = useCallback((anchorObs) => {
    const obsType = anchorObs.type;
    let pattern = [];

    if (obsType === "jump") {
      pattern = [
        { y: 0.82, z: 0 },
        { y: 1.8, z: 1 },
        { y: 2.5, z: 2 },
        { y: 1.8, z: 3 },
        { y: 0.82, z: 4 }
      ];
    } else if (obsType === "slide") {
      pattern = [
        { y: 0.45, z: 0 },
        { y: 0.45, z: 1 },
        { y: 0.45, z: 2 }
      ];
    } else if (obsType === "lane") {
      const blocked = anchorObs.lane;
      const safeLanes = [0, 1, 2].filter(l => l !== blocked);
      const safe = safeLanes[Math.floor(Math.random() * safeLanes.length)];
      const center = 1;
      pattern = [
        { lane: blocked, z: 0 },
        { lane: center, z: 1 },
        { lane: safe, z: 2 }
      ];
    }

    let placed = 0;
    const currentSpeed = speedRef.current || 0.28;
    const spacing = Math.max(1.8, 2.8 - (currentSpeed - 0.28) * 0.8);
    const baseZ = anchorObs.z - 8;

    for (let i = 0; i < coins.current.length && placed < pattern.length; i++) {
      const c = coins.current[i];
      if (c.inCluster) continue;

      const p = pattern[placed];
      c.inCluster = true;
      
      c.z = baseZ + (p.z * spacing);
      
      if (p.lane !== undefined) {
        c.x = LANES[p.lane];
        c.y = 0.82;
      } else {
        c.x = anchorObs.x;
        c.y = p.y !== undefined ? p.y : 0.82;
      }
      
      placed++;
    }
  }, [speedRef]);

  if (spawnCoinsForObstacleRef) {
    spawnCoinsForObstacleRef.current = spawnCoinsForObstacle;
  }

  useFrame((state, delta) => {
    if (!playerRef.current || gameOver) return;
    const speed = speedRef.current ?? 0.28;
    const pz = playerRef.current.z;

    coins.current.forEach((c, i) => {
      if (!c.inCluster) return;

      if (magnet && Math.abs(c.z - pz) < 10) {
        c.x += (playerRef.current.x - c.x) * 0.22;
        c.z += (playerRef.current.z - c.z) * 0.22;
        c.y += (playerRef.current.y + 0.5 - c.y) * 0.22;
      }

      const dx = Math.abs(c.x - playerRef.current.x);
      const dy = Math.abs(c.y - playerRef.current.y - 0.5);
      const dz = Math.abs(c.z - pz);

      c.rot += (0.06 + Math.max(0, (Math.abs(speed) - 0.28) * 0.02)) * Math.min(1, 60 * delta);

      if (dx < 0.9 && dz < 0.9 && dy < 0.9) {
        playCoinRef?.current && playCoinRef.current();
        addScoreRef?.current && addScoreRef.current(doubleActive ? 20 : 10, "coin");
        addCoinsRef?.current && addCoinsRef.current(1);
        if (coinScaleRefs.current[i]) coinScaleRefs.current[i] = { s: 1.9, t: 1 };
        c.inCluster = false;
        c.z = -9999;
      }

      const cs = coinScaleRefs.current[i];
      if (cs && cs.t > 0) {
        cs.t = Math.max(0, cs.t - delta * 5.5);
        cs.s = 1 + (cs.s - 1) * (1 - Math.pow(1 - cs.t, 2));
      }

      if (c.z > pz + 26) {
        c.inCluster = false;
        c.z = -9999;
      }

      const g = groupRefs.current[i];
      if (g) {
        g.visible = c.inCluster;
        g.position.set(c.x, c.y, c.z);
        g.rotation.set(0, c.rot, 0);
        g.scale.setScalar(coinScaleRefs.current[i]?.s ?? 1);
      }
    });
  });

  return coins.current.map((c, i) => (
    <group
      key={i}
      ref={(el) => (groupRefs.current[i] = el)}
      position={[c.x, c.y, c.z]}
    >
      <mesh>
        <torusGeometry args={[0.28, 0.08, 12, 20]} />
        <meshStandardMaterial color="#f6c85f" metalness={0.85} roughness={0.25} emissive="#fff2bf" emissiveIntensity={doubleActive ? 0.6 : 0.2} />
      </mesh>
    </group>
  ));
});

// ---------------- OBSTACLES (SMART PATTERNED) ----------------
const Obstacles = memo(function Obstacles({
  playerRef,
  gameOver,
  setGameOver,
  playFallRef,
  shield,
  setShield,
  slideRef,
  jumpStartRef,
  levelRef,
  hoverboardRef,
  onConsumeHoverboard,
  onCrash,
  addScoreRef,
  speedRef,
  crashFxRef,
  missionRef,
  finalizeMissionCompletion,
  obstaclesRef, // Shared ref
  spawnCoinsForObstacleRef,
  spawnDelay = 0, // NEW: Delay in ms
}) {
  // Types: jump (barrier), slide (tunnel), lane (train/wall)
  const obs = obstaclesRef;
  const crashPendingRef = useRef(false);
  const startTimeRef = useRef(performance.now());

  const patternQueueRef = useRef([]);
  const patternIndexRef = useRef(0);
  const groupRefs = useRef([]);

  const nearMissedRef = useRef([]);
  useEffect(() => {
    nearMissedRef.current = new Array(obs.current.length).fill(false);
  }, [obs.current.length]);

  useEffect(() => {
    if (!gameOver) {
      crashPendingRef.current = false;
    }
  }, [gameOver]);

  const lastNearMissAtRef = useRef(0);
  const nearSlowMoActiveRef = useRef(false);

  const NEAR_MISS_COOLDOWN = 0.3;
  const NEAR_MISS_DZ = 2.2;
  const NEAR_MISS_DX = 1.6;

  function triggerCrash() {
    if (crashPendingRef.current || gameOver) return;
    crashPendingRef.current = true;
    if (playFallRef.current) {
      try { playFallRef.current(); } catch (e) {}
    }
    onCrash && onCrash();
    setGameOver(true);
  }

  function generatePattern() {
    const steps = [];
    const types = ["jump", "slide", "lane", "lane"];
    const length = 60;

    for (let i = 0; i < length; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const lane = Math.floor(Math.random() * 3);
      
      // Prevent impossible patterns by ensuring at least one lane is clear or passable
      if (i > 0 && steps[i-1].type === "lane" && type === "lane" && steps[i-1].lane !== lane) {
        // Two lane obstacles in a row but different lanes is fine
      }
      
      steps.push({ type, lane });
    }
    return steps;
  }

  useEffect(() => {
    patternQueueRef.current = generatePattern();
    patternIndexRef.current = 0;
    const startZ = (playerRef.current ? playerRef.current.z : 0) - 60;
    const currentSpeed = speedRef.current || 0.28;
    const spacing = Math.max(14, 22 - (currentSpeed - 0.28) * 8);

    obs.current.forEach((o, i) => {
      const step = patternQueueRef.current[i % patternQueueRef.current.length];
      o.type = step.type;
      o.lane = step.lane;
      o.x = LANES[step.lane];
      o.z = startZ - i * spacing;
      if (spawnCoinsForObstacleRef?.current) {
        spawnCoinsForObstacleRef.current(o);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state, delta) => {
    if (!playerRef.current || gameOver) return;
    
      // NEW: Delay obstacle logic for spawnDelay duration
    const elapsed = performance.now() - startTimeRef.current;
    const isDelayed = elapsed < spawnDelay;

    const pz = playerRef.current.z;

    obs.current.forEach((o, i) => {
      let g = groupRefs.current[i];
      
      if (g) g.visible = true;
      // High-precision hitboxes
      let hitDx = 0.65; 
      let hitDz = 1.0;
      
      if (o.type === "lane") {
        hitDx = 0.75;
        hitDz = 1.8;
      }

      const dx = Math.abs(o.x - playerRef.current.x);
      const dz = Math.abs(o.z - pz);

      const collided = dz < hitDz && dx < hitDx;
      if (collided && !isDelayed) {
        const py = playerRef.current.y;
        const ps = playerRef.current.scaleY || 1;
        
        const handleHit = () => {
          if (shield) {
            setShield(false);
            respawn(o);
          } else if (hoverboardRef && hoverboardRef.current) {
            onConsumeHoverboard && onConsumeHoverboard();
            respawn(o);
          } else {
            triggerCrash();
          }
        };

        if (o.type === "jump") {
          if (py < 1.1) handleHit();
          else {
            const m = missionRef.current;
            if (m && m.type === "jumps" && !nearMissedRef.current[i]) {
              nearMissedRef.current[i] = true;
              m.progress += 1;
              if (m.progress >= m.target) finalizeMissionCompletion(m);
            }
          }
        } else if (o.type === "slide") {
          if (ps > 0.6) handleHit();
          else {
            const m = missionRef.current;
            if (m && (m.type === "slides" || m.type === "slides_run") && !nearMissedRef.current[i]) {
              nearMissedRef.current[i] = true;
              m.progress += 1;
              if (m.progress >= m.target) finalizeMissionCompletion(m);
            }
          }
        } else {
          handleHit();
        }
      } else if (!isDelayed) {
        const now = performance.now() / 1000;
        if (!nearMissedRef.current[i] && now - lastNearMissAtRef.current > NEAR_MISS_COOLDOWN) {
          if (dz < NEAR_MISS_DZ && dx < NEAR_MISS_DX) {
            nearMissedRef.current[i] = true;
            lastNearMissAtRef.current = now;
            addScoreRef?.current && addScoreRef.current(20, "near-miss");
            triggerNearMissSlowMo();
          }
        }
      }

      if (o.z > pz + 28) respawn(o);

      if (g) {
        const y = o.type === "lane" ? 1.0 : o.type === "jump" ? 0.45 : o.type === "slide" ? 1.7 : 0.85;
        g.position.set(o.x, y, o.z);
      }
    });
  });

  function respawn(o) {
    const idx = obs.current.indexOf(o);
    if (idx >= 0) nearMissedRef.current[idx] = false;
    
    if (!patternQueueRef.current || patternQueueRef.current.length === 0) {
      patternQueueRef.current = generatePattern();
    }
    const step = patternQueueRef.current[patternIndexRef.current % patternQueueRef.current.length];
    patternIndexRef.current++;

    let minZ = playerRef.current ? playerRef.current.z - 40 : -40;
    obs.current.forEach((other) => {
      if (other !== o && other.z < minZ) minZ = other.z;
    });

    const currentSpeed = speedRef.current || 0.28;
    const spacing = Math.max(15, 22 - (currentSpeed - 0.28) * 5);

    o.z = minZ - spacing;
    o.lane = step.lane;
    o.x = LANES[step.lane];
    o.type = step.type;

    console.log("Obstacle Respawned:", o.type, "at z:", o.z);

    if (spawnCoinsForObstacleRef?.current) {
      spawnCoinsForObstacleRef.current(o);
    }
  }

  function triggerNearMissSlowMo() {
    if (nearSlowMoActiveRef.current) return;
    nearSlowMoActiveRef.current = true;
    if (crashFxRef) crashFxRef.current = Math.max(crashFxRef.current || 0, 0.25);
    const totalMs = 300;
    const start = performance.now();
    const orig = speedRef.current;
    const target = orig * 0.6;
    const step = () => {
      const now = performance.now();
      const t = (now - start) / totalMs;
      if (t < 1) {
        speedRef.current = orig + (target - orig) * Math.sin(t * Math.PI);
        requestAnimationFrame(step);
      } else {
        speedRef.current = orig;
        nearSlowMoActiveRef.current = false;
      }
    };
    requestAnimationFrame(step);
  }

  return obs.current.map((o, i) => {
    if (o.type === "lane") {
      return (
        <group key={i} ref={(el) => (groupRefs.current[i] = el)}>
          <mesh castShadow position={[0, 0.4, 0]}>
            <boxGeometry args={[1.8, 1.8, 4.0]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
          <mesh position={[0, 0.6, -2.0]}>
            <boxGeometry args={[1.6, 0.8, 0.1]} />
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.6} />
          </mesh>
        </group>
      );
    }

    if (o.type === "jump") {
      return (
        <group key={i} ref={(el) => (groupRefs.current[i] = el)}>
          <mesh castShadow>
            <boxGeometry args={[1.8, 0.9, 0.5]} />
            <meshStandardMaterial color="#f59e0b" />
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[1.9, 0.15, 0.55]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} />
          </mesh>
        </group>
      );
    }

    if (o.type === "slide") {
      return (
        <group key={i} ref={(el) => (groupRefs.current[i] = el)}>
          <mesh castShadow position={[0, 0.6, 0]}>
            <boxGeometry args={[1.9, 0.6, 1.2]} />
            <meshStandardMaterial color="#7c3aed" emissive="#7c3aed" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[-0.85, -0.8, 0]}>
            <boxGeometry args={[0.2, 2.4, 0.2]} />
            <meshStandardMaterial color="#5b21b6" />
          </mesh>
          <mesh position={[0.85, -0.8, 0]}>
            <boxGeometry args={[0.2, 2.4, 0.2]} />
            <meshStandardMaterial color="#5b21b6" />
          </mesh>
        </group>
      );
    }

    return null;
  });
});

// ---------------- BOOSTERS ----------------
const Boosters = memo(function Boosters({ playerRef, activateMagnetRef, activateShieldRef, playShieldRef, playPowerupRef, gameOver }) {
  const boosters = useRef(
    Array.from({ length: 2 }, (_, i) => {
      const type = i === 0 ? "magnet" : "shield";
      return { type, x: LANES[Math.floor(Math.random() * 3)], z: -(200 + Math.random() * 800) };
    })
  );

  const groupRefs = useRef([]);

  useFrame((state, delta) => {
    if (!playerRef.current || gameOver) return;
    const pz = playerRef.current.z;

    boosters.current.forEach((b, i) => {
      const dx = Math.abs(b.x - playerRef.current.x);
      const dz = Math.abs(b.z - pz);

      if (dx < 0.9 && dz < 0.9) {
        playPowerupRef?.current && playPowerupRef.current();
        if (b.type === "magnet") {
          activateMagnetRef?.current && activateMagnetRef.current();
        } else {
          activateShieldRef?.current && activateShieldRef.current();
          playShieldRef?.current && playShieldRef.current();
        }
        b.z = pz - (2500 + Math.random() * 3500);
        b.x = LANES[Math.floor(Math.random() * 3)];
      }

      if (b.z > pz + 30) {
        b.z = pz - (2500 + Math.random() * 3500);
        b.x = LANES[Math.floor(Math.random() * 3)];
      }

      const g = groupRefs.current[i];
      if (g) g.position.set(b.x, 0.8, b.z);
    });
  });

  return boosters.current.map((b, i) => (
    <group key={i} ref={(el) => (groupRefs.current[i] = el)} position={[b.x, 0.8, b.z]}>
      {b.type === "magnet" ? (
        <>
          <mesh>
            <torusGeometry args={[0.38, 0.08, 12, 20]} />
            <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color="#fff" />
          </mesh>
        </>
      ) : (
        <>
          <mesh>
            <icosahedronGeometry args={[0.32, 0]} />
            <meshStandardMaterial color="#10b981" metalness={0.5} roughness={0.3} emissive="#10b981" emissiveIntensity={0.5} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.45, 0.06, 8, 24]} />
            <meshStandardMaterial color="#059669" />
          </mesh>
        </>
      )}
    </group>
  ));
});

// ---------------- POWER-UPS (Double Coins, Hoverboard) ----------------
const POWERUP_SPAWN_INTERVAL = 4500;
const POWERUP_SAFE_CLEARANCE = 30;

const PowerUps = memo(function PowerUps({ playerRef, activateDoubleRef, activateHoverRef, activateMysteryRef, playPowerupRef, gameOver, obstaclesRef, speedRef }) {
  const ups = useRef(
    Array.from({ length: 2 }, (_, i) => ({
      type: i === 0 ? "double" : "hover",
      x: LANES[Math.floor(Math.random() * 3)],
      z: -(600 + Math.random() * 1800),
      bob: 0,
      pattern: Math.floor(Math.random() * 4),
    }))
  );

  const groupRefs = useRef([]);
  const lastSpawnRef = useRef(0);
  const patternCooldownRef = useRef({ afterObstacleSeq: false });

  function findSafeLane(zPos, avoidLanes = []) {
    let safeLanes = [0, 1, 2].filter(l => !avoidLanes.includes(l));
    if (safeLanes.length === 0) safeLanes = [0, 1, 2];
    return safeLanes[Math.floor(Math.random() * safeLanes.length)];
  }

  function isPathClear(zPos, lane, obstacles) {
    const checkRange = POWERUP_SAFE_CLEARANCE;
    for (let obs of obstacles) {
      if (Math.abs(obs.z - zPos) < checkRange && obs.lane === lane) {
        if (obs.type === "lane") return false;
      }
    }
    return true;
  }

  useFrame((state) => {
    if (!playerRef.current || gameOver) return;
    const pz = playerRef.current.z;
    const now = state.clock.elapsedTime;
    const speed = speedRef.current || 0.28;

    ups.current.forEach((u, idx) => {
      u.bob = Math.sin((state.clock.elapsedTime + idx * 0.7) * 2.2) * 0.12;
      const dx = Math.abs(u.x - playerRef.current.x);
      const dz = Math.abs(u.z - pz);

      if (dx < 0.9 && dz < 0.9) {
        playPowerupRef?.current && playPowerupRef.current();
        if (u.type === "double") activateDoubleRef?.current && activateDoubleRef.current();
        else if (u.type === "hover") activateHoverRef?.current && activateHoverRef.current();
        else if (u.type === "mystery") activateMysteryRef?.current && activateMysteryRef.current();

        u.z = pz - (7000 + Math.random() * 10000);
        u.x = LANES[Math.floor(Math.random() * 3)];
        const rand = Math.random();
        u.type = rand < 0.1 ? "mystery" : rand < 0.6 ? "double" : "hover";
        u.pattern = Math.floor(Math.random() * 4);
        lastSpawnRef.current = now;
      }

      if (u.z > pz + 40) {
        const patternRoll = Math.random();
        if (patternRoll < 0.25 || now - lastSpawnRef.current > 8) {
          if (obstaclesRef?.current) {
            const obstacleSeqs = obstaclesRef.current.filter(o => o.z < pz - 40 && o.z > pz - 100);
            const recentLaneObs = obstacleSeqs.filter(o => o.type === "lane");
            if (recentLaneObs.length >= 2) {
              const gapZ = pz - (80 + Math.random() * 40);
              const avoidLanes = recentLaneObs.map(o => o.lane);
              let safeLane = findSafeLane(gapZ, avoidLanes);
              if (isPathClear(gapZ, safeLane, obstaclesRef.current)) {
                u.z = gapZ;
                u.x = LANES[safeLane];
                patternCooldownRef.current.afterObstacleSeq = true;
                lastSpawnRef.current = now;
              } else {
                u.z = pz - (5000 + Math.random() * 8000);
                u.x = LANES[Math.floor(Math.random() * 3)];
              }
            } else {
              u.z = pz - (5000 + Math.random() * 8000);
              u.x = LANES[Math.floor(Math.random() * 3)];
            }
          } else {
            u.z = pz - (5000 + Math.random() * 8000);
            u.x = LANES[Math.floor(Math.random() * 3)];
          }
        } else {
          u.z = pz - (5000 + Math.random() * 8000);
          u.x = LANES[Math.floor(Math.random() * 3)];
        }
        const rand = Math.random();
        u.type = rand < 0.1 ? "mystery" : rand < 0.6 ? "double" : "hover";
        u.pattern = Math.floor(Math.random() * 4);
      }

      const g = groupRefs.current[idx];
      if (g) g.position.set(u.x, 0.9 + (u.bob || 0), u.z);
    });
  });

  return ups.current.map((u, i) => {
    const y = 0.9 + (u.bob || 0);
    if (u.type === "double") {
      return (
        <group key={i} ref={(el) => (groupRefs.current[i] = el)} position={[u.x, y, u.z]}>
          <mesh>
            <torusGeometry args={[0.3, 0.07, 12, 20]} />
            <meshStandardMaterial color="#ffd166" emissive="#ffd166" emissiveIntensity={0.9} metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0.1, 0.06, 0]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color="#fff6e5" emissive="#fff6e5" emissiveIntensity={1} />
          </mesh>
        </group>
      );
    }
    if (u.type === "hover") {
      return (
        <group key={i} ref={(el) => (groupRefs.current[i] = el)} position={[u.x, y, u.z]}>
          <mesh>
            <boxGeometry args={[0.6, 0.06, 0.4]} />
            <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.9} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.6} />
          </mesh>
        </group>
      );
    }
    if (u.type === "mystery") {
      return (
        <group key={i} ref={(el) => (groupRefs.current[i] = el)} position={[u.x, y, u.z]}>
          <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
            <boxGeometry args={[0.35, 0.35, 0.35]} />
            <meshStandardMaterial color="#ec4899" emissive="#ec4899" emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.4, 0.05, 0.4]} />
            <meshStandardMaterial color="#fff" />
          </mesh>
        </group>
      );
    }
    return null;
  });
});

// ---------------- FX (Speed lines + particles) ----------------
const SpeedLines = memo(function SpeedLines({ playerRef, speedRef, gameOver }) {
  const lines = useRef(
    Array.from({ length: 22 }, () => ({
      x: -4.8 + Math.random() * 9.6,
      y: 0.6 + Math.random() * 2.4,
      z: -(20 + Math.random() * 180),
      len: 0.8 + Math.random() * 1.8,
    }))
  );
  const refs = useRef([]);

  useFrame(() => {
    if (!playerRef.current || gameOver) return;
    const pz = playerRef.current.z;
    const speed = Math.max(0.28, speedRef?.current || 0.28);
    const vis = Math.min(0.75, Math.max(0.06, (speed - 0.2) * 0.5));

    lines.current.forEach((l, i) => {
      if (l.z > pz + 10) {
        l.z = pz - (80 + Math.random() * 180);
        l.x = -4.8 + Math.random() * 9.6;
        l.y = 0.6 + Math.random() * 2.4;
      }
      const r = refs.current[i];
      if (r) {
        r.position.set(l.x, l.y, l.z);
        r.scale.z = l.len + speed * 0.4;
        r.material.opacity = vis;
      }
    });
  });

  return (
    <group>
      {lines.current.map((l, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} position={[l.x, l.y, l.z]}>
          <boxGeometry args={[0.04, 0.02, l.len]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.16} />
        </mesh>
      ))}
    </group>
  );
});

const RunnerFX = memo(function RunnerFX({ playerRef, speedRef, crashSignal, gameOver }) {
  const trail = useRef(
    Array.from({ length: 24 }, () => ({
      x: 0,
      y: 0.5,
      z: -9999,
      life: 0,
      vy: 0.2 + Math.random() * 0.2,
    }))
  );
  const sparks = useRef(
    Array.from({ length: 22 }, () => ({
      x: 0,
      y: 0.7,
      z: -9999,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
    }))
  );
  const trailRefs = useRef([]);
  const sparkRefs = useRef([]);
  const trailCursor = useRef(0);
  const burstCursor = useRef(0);
  const lastSignalRef = useRef(crashSignal);

  useFrame((state, delta) => {
    if (!playerRef.current || gameOver) return;
    const speed = Math.max(0.28, speedRef?.current || 0.28);

    // running dust/trail
    const spawnCount = speed > 0.45 ? 2 : 1;
    for (let s = 0; s < spawnCount; s++) {
      const i = trailCursor.current % trail.current.length;
      trailCursor.current += 1;
      trail.current[i].x = playerRef.current.x + (Math.random() - 0.5) * 0.45;
      trail.current[i].y = 0.34 + Math.random() * 0.18;
      trail.current[i].z = playerRef.current.z + 0.2 + Math.random() * 0.8;
      trail.current[i].life = 1;
      trail.current[i].vy = 0.2 + Math.random() * 0.24;
    }

    trail.current.forEach((p, i) => {
      if (p.life <= 0) return;
      p.life -= delta * 2.8;
      p.y += p.vy * delta;
      const r = trailRefs.current[i];
      if (r) {
        r.position.set(p.x, p.y, p.z);
        const s = 0.08 + p.life * 0.16;
        r.scale.setScalar(Math.max(0.03, s));
        r.material.opacity = Math.max(0, p.life * 0.36);
      }
    });

    if (crashSignal !== lastSignalRef.current) {
      lastSignalRef.current = crashSignal;
      for (let k = 0; k < 14; k++) {
        const i = burstCursor.current % sparks.current.length;
        burstCursor.current += 1;
        const angle = (k / 14) * Math.PI * 2;
        const v = 1.8 + Math.random() * 1.8;
        sparks.current[i].x = playerRef.current.x;
        sparks.current[i].y = playerRef.current.y + 0.5;
        sparks.current[i].z = playerRef.current.z - 0.2;
        sparks.current[i].vx = Math.cos(angle) * v * 0.5;
        sparks.current[i].vy = 1.2 + Math.random() * 1.4;
        sparks.current[i].vz = -Math.sin(angle) * v;
        sparks.current[i].life = 1;
      }
    }

    sparks.current.forEach((p, i) => {
      if (p.life <= 0) return;
      p.life -= delta * 2.2;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;
      p.vy -= 3.4 * delta;
      const r = sparkRefs.current[i];
      if (r) {
        r.position.set(p.x, p.y, p.z);
        r.material.opacity = Math.max(0, p.life * 0.9);
      }
    });
  });

  return (
    <group>
      {trail.current.map((p, i) => (
        <mesh key={`trail-${i}`} ref={(el) => (trailRefs.current[i] = el)} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshBasicMaterial color="#e0f2fe" transparent opacity={0} />
        </mesh>
      ))}
      {sparks.current.map((p, i) => (
        <mesh key={`spark-${i}`} ref={(el) => (sparkRefs.current[i] = el)} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[0.05, 6, 6]} />
          <meshBasicMaterial color="#f97316" transparent opacity={0} />
        </mesh>
      ))}
    </group>
  );
});

// ---------------- UI: Styles & Helpers ----------------
function UIStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');

      /* FIX 1: Prevent mobile swipe refresh / page scroll */
      html, body, #root {
        touch-action: none;
        overflow: hidden;
        overscroll-behavior: none;
        user-select: none;
        -webkit-user-select: none;
        position: fixed;
        width: 100%;
        height: 100%;
      }

      :root{
        --neon: #7c3aed;
        --accent: #ff006e;
        --muted: rgba(255,255,255,0.6);
      }

      .start-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9998;
        pointer-events: auto;
      }

      .start-bg {
        position: absolute;
        inset: 0;
        /* vivid RGB gradient with slow animation */
        background: linear-gradient(120deg, #ff006e, #7c3aed 25%, #0ea5e9 50%, #ffd703 75%, #ff006e 100%);
        background-size: 400% 400%;
        animation: gradientFlow 12s linear infinite;
        opacity: 0.98;
      }

      @keyframes gradientFlow {
        0% { background-position: 0% 50%; }
        25% { background-position: 50% 50%; }
        50% { background-position: 100% 50%; }
        75% { background-position: 50% 50%; }
        100% { background-position: 0% 50%; }
      }

      .start-card {
        position: relative;
        width: min(760px, 92%);
        max-width: 920px;
        padding: 36px;
        border-radius: 18px;
        text-align: center;
        color: white;
        box-shadow: 0 10px 40px rgba(2,6,23,0.6), 0 2px 8px rgba(124,58,237,0.08);
        border: 1px solid rgba(255,255,255,0.08);
        transform-origin: center;
        transition: opacity 420ms ease, transform 420ms cubic-bezier(.2,.9,.2,1);
        background: linear-gradient(180deg, rgba(255,0,110,0.12), rgba(124,58,237,0.12));
      }

      .start-card.hide {
        opacity: 0;
        transform: scale(0.92);
        pointer-events: none;
      }

      .start-title {
        font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
        font-weight: 800;
        letter-spacing: -1px;
        font-size: clamp(26px, 4.2vw, 48px);
        margin: 6px 0 8px;
        text-shadow: 0 6px 24px rgba(124,58,237,0.2);
      }

      .start-sub {
        color: var(--muted);
        margin-bottom: 12px;
        font-size: 15px;
      }

      .dev-note {
        color: rgba(255,255,255,0.82);
        font-size: 13px;
        margin-top: 10px;
        background: linear-gradient(90deg, rgba(255,0,110,0.08), rgba(124,58,237,0.08));
        padding: 8px 12px;
        border-radius: 10px;
        display: inline-block;
        font-weight: 600;
      }

      .start-cta {
        display: inline-flex;
        gap: 14px;
        align-items: center;
        justify-content: center;
        padding: 16px 28px;
        border-radius: 12px;
        background: linear-gradient(90deg, var(--accent), var(--neon));
        border: 1px solid rgba(255,255,255,0.06);
        color: white;
        cursor: pointer;
        font-weight: 700;
        font-size: 18px;
        transition: transform 160ms ease, box-shadow 160ms ease;
      }
      
      button {
        touch-action: manipulation;
        pointer-events: auto;
        position: relative;
        z-index: 99999;
      }

      .start-cta:active { transform: translateY(1px) scale(0.995); }
      .start-cta:hover { box-shadow: 0 8px 30px rgba(124,58,237,0.14); transform: translateY(-4px); }

      .hint {
        margin-top: 12px;
        color: rgba(255,255,255,0.8);
        font-size: 14px;
      }

      /* HUD */
      .hud-fade { animation: hudIn 320ms ease both; }
      @keyframes hudIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      .hud-run-coins {
        position: absolute;
        top: 18px;
        left: 72px;
        z-index: 999;
        display: flex;
        align-items: center;
        gap: 6px;
        color: white;
        padding: 6px 12px;
        border-radius: 12px;
        background: linear-gradient(90deg, rgba(255,215,0,0.15), rgba(255,215,0,0.05));
        border: 1px solid rgba(255,215,0,0.2);
        font-size: 16px;
        font-weight: 700;
        text-shadow: 0 1px 4px rgba(0,0,0,0.4);
        pointer-events: none;
        user-select: none;
      }
      .hud-score {
        position: absolute;
        top: 18px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999;
        color: white;
        font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial;
        font-size: clamp(20px, 3.5vw, 34px);
        font-weight: 800;
        letter-spacing: -0.04em;
        text-shadow: 0 2px 12px rgba(124,58,237,0.25);
        pointer-events: none;
        user-select: none;
      }
      .hud-coins {
        position: absolute;
        top: 18px;
        right: 18px;
        z-index: 999;
        display: flex;
        align-items: center;
        gap: 8px;
        color: white;
        padding: 8px 12px;
        border-radius: 12px;
        background: linear-gradient(90deg, rgba(255,215,0,0.14), rgba(124,58,237,0.14));
        border: 1px solid rgba(255,255,255,0.06);
        box-shadow: 0 8px 30px rgba(124,58,237,0.12);
        font-size: 18px;
        font-weight: 700;
        text-shadow: 0 2px 6px rgba(124,58,237,0.18);
        pointer-events: none;
        user-select: none;
      }
.hud-pause {
         position: relative;
         z-index: 10001;
         width: 44px;
         height: 44px;
         border: 1px solid rgba(255,255,255,0.25);
         border-radius: 12px;
         background: rgba(255,255,255,0.15);
         backdrop-filter: blur(8px);
         -webkit-backdrop-filter: blur(8px);
         color: white;
         font-size: 20px;
         font-weight: 800;
         cursor: pointer;
         display: grid;
         place-items: center;
         transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
         box-shadow: 0 4px 12px rgba(0,0,0,0.2);
       }
       .hud-pause:hover { transform: scale(1.1); background: rgba(255,255,255,0.25); border-color: rgba(255,255,255,0.4); }
       .hud-pause:active { transform: scale(0.92); }
      .hud-powerups {
        position: absolute;
        top: 70px;
        right: 18px;
        z-index: 1001;
        display: flex;
        gap: 10px;
        align-items: center;
        justify-content: flex-end;
      }
      .hud-powerup {
        min-width: 44px;
        height: 44px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        font-weight: 800;
        color: white;
        background: linear-gradient(135deg, var(--accent), var(--neon));
        box-shadow: 0 10px 30px rgba(124,58,237,0.12);
        border: 1px solid rgba(255,255,255,0.06);
        font-size: 18px;
      }
      .hud-powerup.active { transform: translateY(-1px); box-shadow: 0 12px 36px rgba(124,58,237,0.18); opacity: 1; animation: powerupPulse 1.5s infinite; }
      @keyframes powerupPulse {
        0% { filter: brightness(1); transform: translateY(-1px) scale(1); }
        50% { filter: brightness(1.2); transform: translateY(-3px) scale(1.05); box-shadow: 0 16px 42px rgba(124,58,237,0.3); }
        100% { filter: brightness(1); transform: translateY(-1px) scale(1); }
      }
      .hud-powerup.inactive { opacity: 0.38; filter: grayscale(0.28) brightness(.9); box-shadow: none; }
      .hud-combo {
        position: absolute;
        top: 64px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999;
        color: var(--accent);
        font-weight: 900;
        text-shadow: 0 8px 30px rgba(255,0,110,0.06);
        font-size: 16px;
        padding: 4px 10px;
        border-radius: 8px;
        background: linear-gradient(90deg, rgba(255,0,110,0.06), rgba(124,58,237,0.06));
      }
.pause-overlay {
         position: absolute;
         inset: 0;
         z-index: 1000;
         display: grid;
         place-items: center;
         background: rgba(15, 23, 42, 0.75);
         color: rgba(255,255,255,0.95);
         font-size: 18px;
         font-weight: 700;
         letter-spacing: 0.06em;
         cursor: pointer;
       }

      /* Level Complete toast */
      .level-toast {
        position: absolute;
        left: 50%;
        top: 18%;
        transform: translateX(-50%);
        z-index: 11000;
        pointer-events: none;
        padding: 10px 18px;
        border-radius: 12px;
        background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03));
        color: white;
        font-weight: 900;
        letter-spacing: -0.4px;
        border: 1px solid rgba(255,255,255,0.06);
        box-shadow: 0 12px 40px rgba(2,6,23,0.6);
      }

      /* Game over overlay */
      .gameover-overlay {
        position: absolute;
        inset: 0;
        z-index: 10000;
        display:flex;
        align-items:center;
        justify-content:center;
        pointer-events: auto;
      }

      .gameover-card {
        width: min(520px, 94%);
        background: linear-gradient(180deg, rgba(255,0,110,0.12), rgba(124,58,237,0.12));
        border-radius: 16px;
        padding: 28px;
        color: white;
        text-align:center;
        box-shadow: 0 20px 60px rgba(2,6,23,0.75);
        border: 1px solid rgba(255,255,255,0.04);
        transform-origin:center;
        transition: transform 360ms cubic-bezier(.2,.9,.2,1), opacity 280ms ease;
      }

      .gameover-card.hide {
        opacity: 0;
        transform: scale(0.95);
        pointer-events: none;
      }

      .go-score {
        font-size: 42px;
        font-weight: 900;
        margin: 8px 0 4px;
        color: var(--accent);
        text-shadow: 0 8px 30px rgba(255,0,110,0.08);
      }

      .go-sub {
        color: rgba(255,255,255,0.75);
        margin-bottom: 16px;
      }
      .go-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 14px;
        margin: 8px 0;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.07);
        background: rgba(255,255,255,0.03);
      }

      .btn-primary {
        padding: 12px 18px;
        border-radius: 12px;
        background: linear-gradient(90deg, var(--accent), #ff7aa2);
        border: none;
        color: white;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 10px 30px rgba(255,0,110,0.16);
        transition: transform 160ms ease, box-shadow 160ms ease, filter 160ms ease;
        font-size: 16px;
      }
      .btn-primary:hover { transform: translateY(-3px) scale(1.01); box-shadow: 0 18px 40px rgba(255,0,110,0.22); }
      .btn-primary:active { transform: scale(0.97); }
      .btn-ghost {
        padding: 10px 14px;
        border-radius: 10px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.04);
        color: rgba(255,255,255,0.94);
        cursor: pointer;
        font-weight:700;
        transition: transform 140ms ease, background 140ms ease;
      }
      .btn-ghost:hover { transform: scale(1.02); background: rgba(255,255,255,0.07); }
      .btn-ghost:active { transform: scale(0.97); }
      .btn-disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      @media (max-width: 640px) {
        .hud { padding: 8px 10px; gap:8px; }
        .hud-number { font-size: 16px; }
        .hud-icon { min-width:32px; min-height:32px; border-radius:8px; }
        .start-card { padding: 22px; border-radius:14px; }
      }

      /* Shop styles */
      .shop-overlay {
        position: absolute;
        inset: 0;
        z-index: 12000;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
      }
      .shop-card {
        width: min(560px, 94%);
        background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-radius: 14px;
        padding: 20px;
        color: white;
        border: 1px solid rgba(255,255,255,0.15);
        box-shadow: 0 18px 48px rgba(0,0,0,0.8);
      }
      .shop-list { display:flex; flex-direction:column; gap:12px; margin-top:12px; }
      .shop-item { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px; border-radius:10px; background: rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.03); }
      .shop-item .meta { display:flex; gap:10px; align-items:center; }
      .shop-cost { font-weight:900; color:#ffd166; }

      /* ===== JUICE EFFECTS: Floating Text ===== */
      .floating-text {
        position: absolute;
        font-family: 'Inter', system-ui, sans-serif;
        font-weight: 900;
        letter-spacing: -0.03em;
        text-shadow: 0 2px 8px rgba(0,0,0,0.55);
        pointer-events: none;
        user-select: none;
        white-space: nowrap;
        transform: translateX(-50%);
        animation: floatUp 1.05s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
      }
      @keyframes floatUp {
        0%   { opacity: 0; transform: translateX(-50%) translateY(0px) scale(0.7); }
        15%  { opacity: 1; transform: translateX(-50%) translateY(-8px) scale(1.18); }
        70%  { opacity: 1; transform: translateX(-50%) translateY(-34px) scale(1); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-54px) scale(0.88); }
      }

      /* ===== JUICE: Near-miss flash overlay ===== */
      .near-miss-flash {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 8500;
        background: radial-gradient(ellipse at center, rgba(255,220,0,0.22) 0%, transparent 70%);
        animation: nearMissFlash 0.38s ease-out forwards;
      }
      @keyframes nearMissFlash {
        0%   { opacity: 1; }
        100% { opacity: 0; }
      }

      /* ===== JUICE: Coin collect glow flash ===== */
      .coin-collect-flash {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 8400;
        background: radial-gradient(ellipse at 50% 60%, rgba(255,210,0,0.18) 0%, transparent 65%);
        animation: coinFlash 0.28s ease-out forwards;
      }
      @keyframes coinFlash {
        0%   { opacity: 1; }
        100% { opacity: 0; }
      }

      /* ===== JUICE: Combo badge pulse ===== */
      .hud-combo {
        transition: transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .hud-combo.bump {
        animation: comboBump 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      @keyframes comboBump {
        0%   { transform: translateX(-50%) scale(1); }
        50%  { transform: translateX(-50%) scale(1.35); }
        100% { transform: translateX(-50%) scale(1); }
      }

      /* ===== UI: Smooth fade-in for HUD elements ===== */
      .hud-fade { animation: hudIn 320ms ease both; }
      @keyframes hudIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      /* Theme Panel */
      .theme-panel {
        position: absolute;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.9);
        backdrop-filter: blur(12px);
        padding: 16px;
        border-radius: 20px;
        display: flex;
        gap: 12px;
        border: 1px solid rgba(255,255,255,0.1);
        z-index: 10005;
        animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      .theme-option {
        width: 60px;
        height: 60px;
        border-radius: 12px;
        cursor: pointer;
        border: 2px solid transparent;
        transition: transform 0.2s, border-color 0.2s;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 800;
        color: white;
        text-align: center;
      }
      .theme-option.active { border-color: var(--accent); transform: scale(1.1); }
      .theme-option:hover { transform: scale(1.05); }

      /* Mission HUD */
      .hud-mission {
        position: absolute;
        bottom: 24px;
        left: 24px;
        z-index: 1000;
        background: rgba(15, 23, 42, 0.8);
        backdrop-filter: blur(8px);
        padding: 10px 16px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.1);
        color: white;
        min-width: 180px;
      }
      .mission-label { font-size: 10px; text-transform: uppercase; color: var(--muted); font-weight: 800; }
      .mission-text { font-size: 14px; font-weight: 700; margin: 2px 0; }
      .mission-progress-bar { width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; margin-top: 6px; overflow: hidden; }
      .mission-fill { height: 100%; background: var(--accent); transition: width 0.3s ease; }
    `}</style>
  );
}


function ModernHUD({
  score,
  runCoins,
  paused,
  onTogglePause,
  onUIButtonClick,
  onToggleTheme,
  onOpenMissions,
  missionUI,
  combo = 0,
  magnet = false,
  doubleActive = false,
  shield = false,
  hoverboardActive = false,
}) {

  const comboBumpKey = useRef(0);
  const prevCombo = useRef(combo);
  if (combo !== prevCombo.current && combo > 0) {
    comboBumpKey.current += 1;
    prevCombo.current = combo;
  }

return (
    <>
      <div style={{ position: "absolute", top: 18, left: 18, zIndex: 10001, display: "flex", gap: 10 }}>
        <button
          className="hud-pause hud-fade"
          style={{ background: "rgba(0,0,0,0.5)", border: "2px solid rgba(255,255,255,0.2)", borderRadius: "12px", width: "44px", height: "44px", color: "white", fontSize: "20px", cursor: "pointer", backdropFilter: "blur(4px)" }}
          onClick={() => {
            onUIButtonClick && onUIButtonClick();
            onTogglePause && onTogglePause();
          }}
          aria-label={paused ? "Resume game" : "Pause game"}
        >
          {paused ? "▶" : "Ⅱ"}
        </button>

        <button
          className="hud-pause hud-fade"
          style={{ background: "rgba(0,0,0,0.5)", border: "2px solid rgba(255,255,255,0.2)", borderRadius: "12px", width: "44px", height: "44px", color: "white", fontSize: "20px", cursor: "pointer", backdropFilter: "blur(4px)" }}
          onClick={() => {
            onUIButtonClick && onUIButtonClick();
            onToggleTheme && onToggleTheme();
          }}
          title="Switch Theme"
        >
          🎨
        </button>

        <button
          className="hud-pause hud-fade"
          style={{ background: "rgba(0,0,0,0.5)", border: "2px solid rgba(255,255,255,0.2)", borderRadius: "12px", width: "44px", height: "44px", color: "white", fontSize: "20px", cursor: "pointer", backdropFilter: "blur(4px)" }}
          onClick={() => {
            onUIButtonClick && onUIButtonClick();
            onOpenMissions && onOpenMissions();
          }}
          title="Missions"
        >
          🎯
        </button>
      </div>

      {/* TOP HUD: Separate Score and Run Coins */}
      <div style={{ position: "absolute", top: 18, right: 18, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, zIndex: 1000 }}>
         <div className="hud-score hud-fade" style={{ position: "relative", top: 0, left: 0, transform: "none" }}>
            {Math.floor(score).toLocaleString()}
         </div>
         <div className="hud-run-coins hud-fade" style={{ position: "relative", top: 0, left: 0 }}>
            <span>🪙</span>
            <span style={{ fontSize: 20 }}>{runCoins}</span>
         </div>
      </div>

      <div className="hud-powerups hud-fade" style={{ top: 100 }}>
        <div className={`hud-powerup ${magnet ? "active" : "inactive"}`} title="Magnet">🧲</div>
        <div className={`hud-powerup ${doubleActive ? "active" : "inactive"}`} title="Double">x2</div>
        <div className={`hud-powerup ${shield ? "active" : "inactive"}`} title="Shield">🛡️</div>
        <div className={`hud-powerup ${hoverboardActive ? "active" : "inactive"}`} title="Hover">🛹</div>
      </div>

      {combo >= 2 && (
        <div
          key={comboBumpKey.current}
          className="hud-combo hud-fade bump"
          style={{
            top: 100,
            background: combo >= 5
              ? 'linear-gradient(90deg, rgba(255,165,0,0.16), rgba(255,0,110,0.16))'
              : 'linear-gradient(90deg, rgba(255,0,110,0.06), rgba(124,58,237,0.06))',
            color: combo >= 5 ? '#ffd166' : 'var(--accent)',
            fontSize: combo >= 8 ? 19 : 16,
          }}
        >
          🔥 x{combo} COMBO
        </div>
      )}

      {paused && <div className="pause-overlay" onClick={onTogglePause}>PAUSED - TAP TO RESUME</div>}
      
      {/* MISSION Progress HUD */}
      {!paused && (
        <div className="hud-mission hud-fade" style={{ left: "50%", bottom: 30, transform: "translateX(-50%)", textAlign: "center", minWidth: 240 }}>
          <div className="mission-label" style={{ letterSpacing: 1.5 }}>Active Goal</div>
          <div className="mission-text" style={{ fontSize: 16 }}>{missionUI.short}</div>
          <div className="mission-progress-bar" style={{ height: 8 }}>
            <div className="mission-fill" style={{ width: `${missionUI.percent || 0}%`, background: "linear-gradient(90deg, var(--accent), var(--neon))" }} />
          </div>
          <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8, fontWeight: 700 }}>{missionUI.progress}</div>
        </div>
      )}
    </>
  );
}

function ThemePanel({ current, onSelect }) {
  return (
    <div className="theme-panel">
      {THEMES.map((t, i) => (
        <div 
          key={t.id}
          className={`theme-option ${current === i ? 'active' : ''}`}
          style={{ background: t.preview }}
          onClick={() => onSelect(i)}
        >
          {t.name.split(' ')[0]}
        </div>
      ))}
    </div>
  );
}


function LevelToast({ level }) {
  return (
    <div className="level-toast" style={{ animation: "toastIn 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards" }}>
      <div style={{ fontSize: 14, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 2 }}>Mission Accomplished</div>
      <div style={{ fontSize: 26, color: "#ffd166" }}>Level {level} Complete!</div>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translate(-50%, -20px) scale(0.9); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
      `}</style>
    </div>
  );
}

function LevelIntro({ level }) {
  return (
    <div className="level-toast" style={{ top: "40%", background: "transparent", border: "none", boxShadow: "none", animation: "introIn 2s ease-out forwards" }}>
      <div style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 4 }}>GET READY</div>
      <div style={{ fontSize: 64, fontWeight: 900, color: "#fff", textShadow: "0 0 30px rgba(124,58,237,0.5)" }}>Level {level}</div>
      <style>{`
        @keyframes introIn {
          0% { opacity: 0; transform: translate(-50%, 20px) scale(0.8); }
          15% { opacity: 1; transform: translate(-50%, 0) scale(1.1); }
          30% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          80% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -40px) scale(1.2); }
        }
      `}</style>
    </div>
  );
}


// Start Screen
function StartScreen({ started, onStart, onOpenShop, onOpenMissions, onOpenCollection, onOpenLevels, onUIButtonClick, onToggleTheme, level, missionUI }) {
  useEffect(() => {
    console.log("StartScreen Active");
    function key(e) {
      if (started) return;
      if (e.code === "Space" || e.key === " ") {
        onStart && onStart();
      }
    }
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
    };
  }, [started, onStart]);

  return (
    <div className="start-overlay" style={{ pointerEvents: started ? "none" : "auto" }}>
      <div className="start-bg" />
      <div className={`start-card ${started ? "hide" : ""}`} role="dialog" aria-modal="true">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <div style={{ width: 68, height: 68, borderRadius: 12, background: "linear-gradient(135deg,#ff006e,#7c3aed)", display: "grid", placeItems: "center", boxShadow: "0 10px 30px rgba(124,58,237,0.18)" }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: "white" }}>🚆</div>
          </div>
          <div style={{ textAlign: "left" }}>
            <div className="start-title">SUBWAY RUNNER</div>
            <div style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: 15 }}>First Web Game of Ashish</div>
            {level && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: "#ffd166", fontWeight: 800, fontSize: 16 }}>LEVEL {level}</div>
                {missionUI?.short && <div style={{ color: "#a78bfa", fontWeight: 600, fontSize: 13 }}>Mission: {missionUI.short}</div>}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              className="start-cta"
              onClick={() => {
                onUIButtonClick && onUIButtonClick();
                onStart && onStart();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                onUIButtonClick && onUIButtonClick();
                onStart && onStart();
              }}
              aria-label="Start game"
              style={{ minWidth: 140 }}
            >
              <span style={{ display: "inline-block", width: 18 }}>▶</span>
              <span style={{ fontWeight: 800 }}>Play</span>
            </button>
            <button
              className="start-cta"
              onClick={() => {
                onUIButtonClick && onUIButtonClick();
                onOpenMissions && onOpenMissions();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                onUIButtonClick && onUIButtonClick();
                onOpenMissions && onOpenMissions();
              }}
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", minWidth: 140 }}
            >
              Missions
            </button>
            <button
              className="start-cta"
              onClick={() => {
                onUIButtonClick && onUIButtonClick();
                onOpenCollection && onOpenCollection();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                onUIButtonClick && onUIButtonClick();
                onOpenCollection && onOpenCollection();
              }}
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", minWidth: 140 }}
            >
              Collection
            </button>
            <button
              className="start-cta"
              onClick={() => {
                onUIButtonClick && onUIButtonClick();
                onOpenLevels && onOpenLevels();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                onUIButtonClick && onUIButtonClick();
                onOpenLevels && onOpenLevels();
              }}
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", minWidth: 140 }}
            >
              Levels
            </button>
          </div>

          <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 12 }}>
            <button
              className="btn-ghost"
              onClick={(e) => {
                e.stopPropagation();
                onUIButtonClick && onUIButtonClick();
                onOpenShop && onOpenShop();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                onUIButtonClick && onUIButtonClick();
                onOpenShop && onOpenShop();
              }}
              style={{ padding: "10px 20px", fontSize: 15 }}
            >
              🛒 Shop
            </button>
            <button
              className="btn-ghost"
              onClick={(e) => {
                e.stopPropagation();
                onUIButtonClick && onUIButtonClick();
                onToggleTheme && onToggleTheme();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                onUIButtonClick && onUIButtonClick();
                onToggleTheme && onToggleTheme();
              }}
              style={{ padding: "10px 20px", fontSize: 15 }}
            >
              🎨 Themes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Game Over overlay
function GameOverOverlay({
  gameOver,
  score,
  runCoins,
  totalCoins,
  reviveCost,
  reviveAvailable,
  canRevive,
  onRevive,
  onRetry,
  onUIButtonClick,
}) {
  const [showActions, setShowActions] = useState(false);
  const [localBest, setLocalBest] = useState(0);

  useEffect(() => {
    if (gameOver) {
      const stored = parseInt(localStorage.getItem("subway:best") || "0", 10);
      if (score > stored) {
        localStorage.setItem("subway:best", String(score));
        setLocalBest(score);
      } else {
        setLocalBest(stored);
      }
      setShowActions(false);
      const id = setTimeout(() => setShowActions(true), 500);
      return () => clearTimeout(id);
    }
  }, [gameOver, score]);

  if (!gameOver) return null;

  return (
    <div className="start-overlay" style={{ zIndex: 11000 }}>
      <div className="start-bg" style={{ opacity: 0.95, background: "radial-gradient(circle, #1e1b4b 0%, #020617 100%)" }} />
      <div className={`start-card ${!showActions ? "hide" : ""}`}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: "var(--accent)", letterSpacing: -2 }}>GAME OVER</div>
          <div style={{ color: "var(--muted)", fontWeight: 600 }}>Better luck next time!</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div className="go-row" style={{ flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, textTransform: "uppercase", opacity: 0.6 }}>Score</span>
            <span style={{ fontSize: 28, fontWeight: 900 }}>{Math.floor(score).toLocaleString()}</span>
          </div>
          <div className="go-row" style={{ flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, textTransform: "uppercase", opacity: 0.6 }}>Coins</span>
            <span style={{ fontSize: 28, fontWeight: 900, color: "#ffd166" }}>🪙 {runCoins}</span>
          </div>
        </div>

        <div style={{ marginBottom: 20, fontSize: 14, color: "var(--muted)" }}>
          Best Score: <strong>{localBest.toLocaleString()}</strong>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              className={`start-cta ${!canRevive ? "btn-disabled" : ""}`}
              style={{ flex: 2, background: "linear-gradient(90deg, #10b981, #059669)" }}
              onClick={() => canRevive && onRevive()}
            >
              <span style={{ fontWeight: 800 }}>REVIVE</span>
              <span style={{ fontSize: 12, opacity: 0.8 }}>({reviveCost} Coins)</span>
            </button>
            <button
              className="start-cta"
              style={{ flex: 1 }}
              onClick={() => onRetry()}
            >
              RETRY
            </button>
          </div>
          
          <button
            className="start-cta"
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={() => window.location.reload()}
          >
            🏠 HOME
          </button>
        </div>

        {!reviveAvailable && <div style={{ fontSize: 11, opacity: 0.5, marginTop: 12 }}>Revive already used</div>}
        {reviveAvailable && !canRevive && <div style={{ fontSize: 11, color: "#f87171", marginTop: 12 }}>Need {reviveCost - totalCoins} more coins to revive</div>}
      </div>
    </div>
  );
}


// ---------------- SHOP OVERLAY ----------------
function ShopOverlay({ open, onClose, coins, upgrades, onBuy, onUIButtonClick }) {
  const [tab, setTab] = useState("upgrades");
  if (!open) return null;

  const items = [
    { id: "magnet", title: "Magnet Upgrade", cost: 300, desc: "Increase magnet duration" },
    { id: "shield", title: "Shield Upgrade", cost: 300, desc: "Increase shield duration" },
    { id: "multiplier", title: "Score Multiplier", cost: 500, desc: "Permanent +0.5x score bonus" },
    { id: "speedBoost", title: "Initial Speed", cost: 400, desc: "Start with higher base speed" },
    { id: "hoverboard", title: "Hoverboard Pro", cost: 600, desc: "Extra 5s hoverboard duration" },
  ];

  return (
    <div className="shop-overlay" role="dialog" aria-modal="true">
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
        onClick={() => {
          onUIButtonClick && onUIButtonClick();
          onClose && onClose();
        }}
      />
      <div className="shop-card" onClick={(e) => e.stopPropagation()} style={{ zIndex: 12001, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 15 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Game Shop</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ color: "#ffd166", fontWeight: 900, fontSize: 18 }}>🪙 {Math.max(0, Math.floor(coins || 0))}</div>
            <button
              className="btn-ghost"
              onClick={() => {
                onUIButtonClick && onUIButtonClick();
                onClose && onClose();
              }}
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button 
            className={`btn-ghost ${tab === "upgrades" ? "active" : ""}`} 
            style={{ flex: 1, background: tab === "upgrades" ? "var(--accent)" : "rgba(255,255,255,0.05)" }}
            onClick={() => setTab("upgrades")}
          >
            Upgrades
          </button>
          <button 
            className={`btn-ghost ${tab === "skins" ? "active" : ""}`} 
            style={{ flex: 1, background: tab === "skins" ? "var(--accent)" : "rgba(255,255,255,0.05)" }}
            onClick={() => setTab("skins")}
          >
            Skins
          </button>
        </div>

        <div className="shop-list">
          {tab === "upgrades" ? (
            items.map((it) => {
              const owned = !!(upgrades && upgrades[it.id]);
              const afford = (coins || 0) >= it.cost;
              return (
                <div className="shop-item" key={it.id}>
                  <div className="meta" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.03)", display: "grid", placeItems: "center", fontSize: 24 }}>
                      {it.id === "magnet" ? "🧲" : it.id === "shield" ? "🛡️" : it.id === "multiplier" ? "✨" : "⚡"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 900 }}>{it.title}</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{it.desc}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div className="shop-cost">{it.cost}</div>
                    <button
                      className="btn-primary"
                      style={{ padding: "8px 12px", fontSize: 13 }}
                      onClick={() => {
                        onUIButtonClick && onUIButtonClick();
                        onBuy && onBuy(it.id, it.cost);
                      }}
                      disabled={owned || !afford}
                    >
                      {owned ? "Owned" : afford ? "Buy" : "Short"}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            SKINS.filter(s => s.id !== "default").map((skin) => {
              const cost = 500;
              const owned = !!(upgrades?.unlockedSkins?.includes(skin.id)) || false; // This check might need adjustment based on how unlockedSkins is stored
              // Actually use the passed prop or state from parent
              return (
                <div className="shop-item" key={skin.id}>
                  <div className="meta" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: skin.colors.body, display: "grid", placeItems: "center", fontSize: 24 }}>
                      🏃
                    </div>
                    <div>
                      <div style={{ fontWeight: 900 }}>{skin.name} Skin</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>Character visual</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div className="shop-cost">{cost}</div>
                    <button
                      className="btn-primary"
                      style={{ padding: "8px 12px", fontSize: 13 }}
                      onClick={() => {
                        onUIButtonClick && onUIButtonClick();
                        onBuy && onBuy(skin.id, cost, true);
                      }}
                      disabled={(coins || 0) < cost} // We don't have unlockedSkins here, so we rely on parent's handleBuy to check
                    >
                      Buy
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- MISSION OVERLAY ----------------
function MissionOverlay({ open, onClose, dailyMissions, lifetimeMilestones, lifetimeStats, streak, onClaimDaily, onClaimMilestone, onUIButtonClick }) {
  const [tab, setTab] = useState("daily");
  if (!open) return null;

  return (
    <div className="shop-overlay" style={{ zIndex: 12000 }}>
      <div className="start-bg" style={{ opacity: 0.9, background: "rgba(15, 23, 42, 0.95)" }} />
      <div className="shop-card" style={{ width: "min(600px, 94%)", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 24, fontWeight: 900 }}>Missions & Milestones</div>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button 
            className={`btn-ghost ${tab === "daily" ? "active" : ""}`} 
            style={{ flex: 1, background: tab === "daily" ? "var(--accent)" : "rgba(255,255,255,0.05)" }}
            onClick={() => setTab("daily")}
          >
            Daily
          </button>
          <button 
            className={`btn-ghost ${tab === "milestones" ? "active" : ""}`} 
            style={{ flex: 1, background: tab === "milestones" ? "var(--accent)" : "rgba(255,255,255,0.05)" }}
            onClick={() => setTab("milestones")}
          >
            Milestones
          </button>
        </div>

        {tab === "daily" ? (
          <div className="shop-list">
             <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>Streak: {streak} days (x{(1 + streak * 0.05).toFixed(2)} bonus)</div>
             {dailyMissions.map(m => (
               <div className="shop-item" key={m.id}>
                 <div style={{ textAlign: "left" }}>
                   <div style={{ fontWeight: 800 }}>{m.desc}</div>
                   <div style={{ fontSize: 12, color: "var(--muted)" }}>Reward: {m.reward} Coins</div>
                   <div className="mission-progress-bar" style={{ width: 120 }}>
                     <div className="mission-fill" style={{ width: `${(m.progress / m.target) * 100}%` }} />
                   </div>
                 </div>
                 <button 
                   className="btn-primary" 
                   disabled={!m.completed || m.claimed}
                   onClick={() => { onUIButtonClick(); onClaimDaily(m.id); }}
                 >
                   {m.claimed ? "Claimed" : m.completed ? "Claim" : `${m.progress}/${m.target}`}
                 </button>
               </div>
             ))}
          </div>
        ) : (
          <div className="shop-list">
            {lifetimeMilestones.map(m => {
              const val = lifetimeStats[m.type] || 0;
              const completed = val >= m.target;
              return (
                <div className="shop-item" key={m.id}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 800 }}>{m.desc}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Reward: {m.reward} Coins</div>
                    <div className="mission-progress-bar" style={{ width: 120 }}>
                      <div className="mission-fill" style={{ width: `${Math.min(100, (val / m.target) * 100)}%` }} />
                    </div>
                  </div>
                  <button 
                    className="btn-primary" 
                    disabled={!completed}
                    onClick={() => { onUIButtonClick(); onClaimMilestone(m.id); }}
                  >
                    {completed ? "Claimed" : `${val}/${m.target}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- MYSTERY BOX OVERLAY ----------------
function MysteryBoxOverlay({ open, reward, onOpen, onUIButtonClick }) {
  const [opening, setOpening] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (open) {
      setOpening(false);
      setRevealed(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="shop-overlay" style={{ zIndex: 13000 }}>
      <div className="start-bg" style={{ opacity: 0.95, background: "rgba(2, 6, 23, 0.98)" }} />
      <div className="start-card" style={{ transform: opening && !revealed ? "scale(1.1)" : "scale(1)", transition: "transform 0.5s" }}>
        <div style={{ fontSize: 80, marginBottom: 20, animation: opening && !revealed ? "boxShake 0.5s infinite" : "none" }}>
          {revealed ? "🎉" : "🎁"}
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 10 }}>
          {revealed ? `You won +${reward?.value || 0} Coins!` : "You found a Mystery Box!"}
        </div>
        <button 
          className="start-cta" 
          onClick={() => {
            onUIButtonClick();
            if (revealed) {
              onOpen();
            } else {
              setOpening(true);
              setTimeout(() => {
                setRevealed(true);
              }, 300);
            }
          }}
          disabled={opening && !revealed}
        >
          {revealed ? "CLAIM" : opening ? "Opening..." : "OPEN BOX"}
        </button>
        <style>{`
          @keyframes boxShake {
            0% { transform: rotate(0); }
            25% { transform: rotate(-10deg); }
            75% { transform: rotate(10deg); }
            100% { transform: rotate(0); }
          }
        `}</style>
      </div>
    </div>
  );
}

// ---------------- COLLECTION PANEL ----------------
function CollectionPanel({ open, onClose, unlockedSkins, selectedSkin, onSelectSkin, onUIButtonClick }) {
  if (!open) return null;
  return (
    <div className="shop-overlay" style={{ zIndex: 12000 }}>
      <div className="start-bg" style={{ opacity: 0.95 }} onClick={onClose} />
      <div className="start-card" style={{ maxWidth: 450, width: "90%", background: "rgba(15, 23, 42, 0.95)", border: "1px solid var(--accent)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: "var(--accent)", fontSize: 24, fontWeight: 900 }}>Collection</h2>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 28, padding: "0 10px" }}>×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 15, maxHeight: 400, overflowY: "auto", padding: "10px 5px" }}>
          {SKINS.map(skin => {
            const isUnlocked = unlockedSkins.includes(skin.id);
            const isSelected = selectedSkin === skin.id;
            return (
              <div 
                key={skin.id}
                onClick={() => isUnlocked && onSelectSkin(skin.id)}
                style={{
                  padding: "15px 10px",
                  borderRadius: 16,
                  background: isSelected ? "rgba(255, 0, 110, 0.2)" : "rgba(255, 255, 255, 0.05)",
                  border: isSelected ? "2px solid var(--accent)" : "2px solid rgba(255, 255, 255, 0.1)",
                  cursor: isUnlocked ? "pointer" : "default",
                  opacity: isUnlocked ? 1 : 0.4,
                  textAlign: "center",
                  transition: "all 0.2s",
                  transform: isSelected ? "scale(1.05)" : "scale(1)"
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8, filter: isUnlocked ? "none" : "grayscale(1) blur(2px)" }}>
                  {skin.id === "default" ? "🏃" : skin.id === "neon" ? "⚡" : skin.id === "sunset" ? "🌅" : skin.id === "shadow" ? "👤" : "🦸"}
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{skin.name}</div>
                {!isUnlocked && <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6 }}>Locked</div>}
                {isSelected && <div style={{ fontSize: 10, marginTop: 4, color: "var(--accent)", fontWeight: 800 }}>ACTIVE</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------- LEVELS PANEL ----------------
function LevelsPanel({ open, onClose, currentLevel, unlockedLevels, onSelectLevel, onUIButtonClick }) {
  if (!open) return null;
  return (
    <div className="shop-overlay" style={{ zIndex: 12000 }}>
      <div className="start-bg" style={{ opacity: 0.95 }} onClick={onClose} />
      <div className="start-card" style={{ maxWidth: 500, width: "95%", background: "rgba(15, 23, 42, 0.95)", border: "1px solid #ffd166" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: "#ffd166", fontSize: 24, fontWeight: 900 }}>Levels 1-100</h2>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 28, padding: "0 10px" }}>×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, maxHeight: 450, overflowY: "auto", padding: "10px 5px" }}>
          {Array.from({ length: 100 }, (_, i) => i + 1).map(lv => {
            const isUnlocked = unlockedLevels.includes(lv);
            const isCurrent = currentLevel === lv;
            return (
              <div 
                key={lv}
                onClick={() => isUnlocked && onSelectLevel(lv)}
                style={{
                  aspectRatio: "1/1",
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 12,
                  background: isCurrent ? "#ffd166" : isUnlocked ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.3)",
                  border: isCurrent ? "none" : isUnlocked ? "1px solid rgba(255, 255, 255, 0.2)" : "none",
                  cursor: isUnlocked ? "pointer" : "default",
                  opacity: isUnlocked ? 1 : 0.5,
                  fontWeight: 900,
                  fontSize: 18,
                  color: isCurrent ? "#000" : isUnlocked ? "#fff" : "#666",
                  transition: "all 0.2s",
                  transform: isCurrent ? "scale(1.1)" : "scale(1)",
                  boxShadow: isCurrent ? "0 0 20px rgba(255, 209, 102, 0.4)" : "none"
                }}
              >
                {isUnlocked ? lv : "🔒"}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------- EVENT BANNER ----------------
function EventBanner({ event }) {
  if (!event) return null;
  return (
    <div style={{ 
      position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)", 
      zIndex: 1000, background: "rgba(255, 0, 110, 0.2)", backdropFilter: "blur(4px)",
      padding: "4px 12px", borderRadius: "20px", border: "1px solid var(--accent)",
      color: "white", fontSize: 12, fontWeight: 800, textAlign: "center",
      display: "flex", alignItems: "center", gap: 8
    }}>
      <span style={{ color: "#ffd166" }}>EVENT:</span> {event.name} — {event.desc}
    </div>
  );
}

// ---------------- MAIN ----------------
export default function App() {
  // controls as refs to avoid extra re-renders
  const laneRef = useRef(1);
  const jumpRef = useRef(false);
  const jumpStartRef = useRef(0);
  const slideRef = useRef(0);

  const [unlockedLevels, setUnlockedLevels] = useState(() => {
    try {
      const stored = localStorage.getItem("game_unlocked_levels");
      return stored ? JSON.parse(stored) : [1];
    } catch { return [1]; }
  });

  const [selectedSkin, setSelectedSkin] = useState(() => localStorage.getItem("game_selected_skin") || "default");
  const [unlockedSkins, setUnlockedSkins] = useState(() => {
    try {
      const stored = localStorage.getItem("game_unlocked_skins");
      return stored ? JSON.parse(stored) : ["default"];
    } catch { return ["default"]; }
  });

  const [collectionOpen, setCollectionOpen] = useState(false);
  const [levelsOpen, setLevelsOpen] = useState(false);

  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);

  const [best, setBest] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const [, setMultiplier] = useState(1);
  const multiplierRef = useRef(1);
  const [combo, setCombo] = useState(0);
  const comboRef = useRef(0);
  const comboTimerRef = useRef(null);
  const slowMotionUntilRef = useRef(0);
  const crashFxRef = useRef(0);
  const [crashSignal, setCrashSignal] = useState(0);

   const [magnet, setMagnet] = useState(false);
  const [shield, setShield] = useState(false);
  const [themeIndex, setThemeIndex] = useState(0);
  const [showThemePanel, setShowThemePanel] = useState(false);

  const speedBeforeDeathRef = useRef(0.28);


  // NEW POWER-UP states & refs (use refs for logic, state for UI badges)
  const doubleRef = useRef(false);
  const doubleTimerRef = useRef(null);
  const [doubleActive, setDoubleActive] = useState(false);

  const hoverboardRef = useRef(false);
  const [hoverboardActive, setHoverboardActive] = useState(false);

  // LEVEL + MISSION
  const [level, setLevel] = useState(() => parseInt(localStorage.getItem("game_level") || "1", 10));
  const levelRef = useRef(parseInt(localStorage.getItem("game_level") || "1", 10));
  const [levelComplete, setLevelComplete] = useState(false);
  const [showLevelIntro, setShowLevelIntro] = useState(false);
  const spawnDelayRef = useRef(0);

  const missionRef = useRef(null);
  const [missionUI, setMissionUI] = useState({ short: "", desc: "", progress: "", percent: 0 });

  // ---------------- SHOP & COINS ----------------
  const coinsRef = useRef(0);
  const [coinsTotal, setCoinsTotal] = useState(0);
  const [shopOpen, setShopOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [runCoins, setRunCoins] = useState(0);
  const runCoinsRef = useRef(0);
  const [reviveUsed, setReviveUsed] = useState(false);
  const [isReviving, setIsReviving] = useState(false);
  const [upgrades, setUpgrades] = useState({
    magnet: false,
    shield: false,
    multiplier: false,
    speedBoost: false,
    hoverboard: false,
  });

  // ---------------- MISSION & EVENT SYSTEM ----------------
  const [runDistance, setRunDistance] = useState(0);
  const [runJumps, setRunJumps] = useState(0);
  const [runSlides, setRunSlides] = useState(0);
  const [runNearMisses, setRunNearMisses] = useState(0);
  const [missionsOpen, setMissionsOpen] = useState(false);

  const {
    dailyMissions,
    lifetimeStats,
    currentEvent,
    streak,
    lifetimeMilestones,
    updateEventProgress,
    claimMissionReward,
    incrementStreak,
    claimMilestone,
    setLifetimeStats,
  } = useMissionEventSystem(
    score,
    runCoins,
    runDistance,
    runJumps,
    runSlides,
    runNearMisses,
    (n) => addCoins(n)
  );

  const {
    showMysteryBox,
    mysteryBoxReward,
    triggerMysteryBox,
    openMysteryBox,
  } = useMysteryBoxSystem((n) => addCoins(n));

  // ----------------- EVENT EFFECTS -----------------
  const eventMultiplier = useMemo(() => {
    if (!currentEvent) return { coins: 1, speed: 1, score: 1 };
    return {
      coins: currentEvent.multiplier?.coins || 1,
      speed: currentEvent.multiplier?.speed || 1,
      score: currentEvent.effect?.scoreMult || 1,
    };
  }, [currentEvent]);

  // counters used for missions
  const coinCountRef = useRef(0);
  const jumpCountRef = useRef(0);
  const slideCountRef = useRef(0);
  const levelStartTimeRef = useRef(0);
  const missionCompletedRef = useRef(false);
  const levelTransitioningRef = useRef(false);

  const playerRef = useRef(null);
  const speedRef = useRef(0.28); 
  const obstaclesRef = useRef(Array.from({ length: 12 }, () => ({ x: 0, z: -999, type: "jump", lane: 1 })));
  const spawnCoinsForObstacleRef = useRef(null);

  // Floating text & flash refs
  const spawnTextRef = useRef(null);       // set by FloatingTextsProvider context (wired by SpawnTextWire)
  const coinFlashCountRef = useRef(0);     // throttle coin flash to every 3rd collect
  const [nearMissFlash, setNearMissFlash] = useState(0); // increments to re-trigger CSS animation
  const [coinFlash, setCoinFlash] = useState(0);         // increments to re-trigger glow flash

  const audio = useGameAudio();
  const { playCoin, playPowerup, playJump, playSlide, playFall, playShield, playClick, playBgm, stopBgm } = audio;

  const magnetTimerRef = useRef(null);
  const shieldTimerRef = useRef(null);

  // function refs to avoid re-rendering children when functions change
  const addScoreRef = useRef(null);
  const addCoinsRef = useRef(null);
  const playCoinRef = useRef(null);
  const playPowerupRef = useRef(null);
  const playFallRef = useRef(null);
  const playShieldRef = useRef(null);
  const activateMagnetRef = useRef(null);
  const activateShieldRef = useRef(null);
  const activateDoubleRef = useRef(null);
  const activateHoverRef = useRef(null);
  const activateMysteryRef = useRef(null);
  const playCoinAudioRef = useRef(null);

  // constants for durations (ms)
  const MAGNET_BASE = 5000;
  const MAGNET_BONUS = 4000; // when purchased
  const SHIELD_BASE = 12000;
  const SHIELD_BONUS = 8000; // when purchased

  const getMagnetDuration = (override) => {
    if (typeof override === "number") return override;
    return MAGNET_BASE + (upgrades?.magnet ? MAGNET_BONUS : 0);
  };
  const getShieldDuration = (override) => {
    if (typeof override === "number") return override;
    return SHIELD_BASE + (upgrades?.shield ? SHIELD_BONUS : 0);
  };

  // load coins and upgrades from localStorage on mount
  useEffect(() => {
    try {
      const stored = parseInt(localStorage.getItem("game_coins") || "0", 10);
      if (!isNaN(stored)) {
        coinsRef.current = stored;
        setCoinsTotal(stored);
      }
    } catch {
      coinsRef.current = 0;
      setCoinsTotal(0);
    }

    try {
      const raw = localStorage.getItem("game_upgrades");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setUpgrades((cur) => ({ ...cur, ...parsed }));
        }
      }
    } catch {
      // ignore
    }

try {
       const bestScore = parseInt(localStorage.getItem("subway:best") || "0", 10);
       if (!isNaN(bestScore)) setBest(bestScore);
     } catch {}

     try {
       const savedTheme = parseInt(localStorage.getItem("game_theme") || "0", 10);
       if (!isNaN(savedTheme) && savedTheme >= 0 && savedTheme < THEMES.length) {
         setThemeIndex(savedTheme);
       }
     } catch {}

     const loader = setTimeout(() => setLoading(false), 900);
     return () => clearTimeout(loader);
   }, []);

useEffect(() => {
     try {
       localStorage.setItem("game_upgrades", JSON.stringify(upgrades || {}));
     } catch {
       // ignore
     }
   }, [upgrades]);

   useEffect(() => {
     try {
       localStorage.setItem("game_theme", String(themeIndex));
     } catch {}
   }, [themeIndex]);

  function addCoins(n = 1) {
    const delta = Math.max(0, Math.floor(Number(n) || 0));
    coinsRef.current = (coinsRef.current || 0) + delta;
    setCoinsTotal(coinsRef.current);
    runCoinsRef.current += delta;
    setRunCoins(runCoinsRef.current);
    try {
      localStorage.setItem("game_coins", String(coinsRef.current));
    } catch {
      // ignore
    }
  }

  function handleBuy(itemId, cost, isSkin = false) {
    try {
      const owned = isSkin 
        ? unlockedSkins.includes(itemId)
        : !!(upgrades && upgrades[itemId]);
      if (owned) return;
      const c = Math.max(0, Math.floor(Number(coinsRef.current || 0)));
      const price = Math.max(0, Math.floor(Number(cost || 0)));
      if (c < price) {
        alert("Not enough coins.");
        return;
      }
      coinsRef.current = c - price;
      setCoinsTotal(coinsRef.current);
      localStorage.setItem("game_coins", String(coinsRef.current));

      if (isSkin) {
        const nextSkins = [...unlockedSkins, itemId];
        setUnlockedSkins(nextSkins);
        localStorage.setItem("game_unlocked_skins", JSON.stringify(nextSkins));
        // Auto-select new skin
        setSelectedSkin(itemId);
        localStorage.setItem("game_selected_skin", itemId);
      } else {
        const next = { ...(upgrades || {}), [itemId]: true };
        setUpgrades(next);
        localStorage.setItem("game_upgrades", JSON.stringify(next));
      }
      playClick();
    } catch (e) {
      console.error("Buy error", e);
    }
  }

  // existing booster activations
  const activateMagnet = useCallback((ms) => {
    const duration = getMagnetDuration(ms);
    if (magnetTimerRef.current) {
      clearTimeout(magnetTimerRef.current);
      magnetTimerRef.current = null;
    }
    setMagnet(true);
    magnetTimerRef.current = setTimeout(() => {
      setMagnet(false);
      magnetTimerRef.current = null;
    }, duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upgrades?.magnet]);

  const activateShield = useCallback((ms) => {
    const duration = getShieldDuration(ms);
    if (shieldTimerRef.current) {
      clearTimeout(shieldTimerRef.current);
      shieldTimerRef.current = null;
    }
    setShield(true);
    shieldTimerRef.current = setTimeout(() => {
      setShield(false);
      shieldTimerRef.current = null;
    }, duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upgrades?.shield]);

  // ---------------- NEW POWER-UP ACTIVATIONS ----------------
  const activateDoubleCoins = useCallback((overrideMs) => {
    const duration = typeof overrideMs === "number" ? overrideMs : 6000 + Math.floor(Math.random() * 4000);
    if (doubleTimerRef.current) {
      clearTimeout(doubleTimerRef.current);
      doubleTimerRef.current = null;
    }
    doubleRef.current = true;
    setDoubleActive(true);
    doubleTimerRef.current = setTimeout(() => {
      doubleRef.current = false;
      setDoubleActive(false);
      doubleTimerRef.current = null;
    }, duration);
  }, []);

  const activateHoverboard = useCallback((ms) => {
    const duration = typeof ms === "number" ? ms : (10000 + (upgrades?.hoverboard ? 5000 : 0));
    if (window.hoverboardTimeout) clearTimeout(window.hoverboardTimeout);
    
    hoverboardRef.current = true;
    setHoverboardActive(true);
    
    window.hoverboardTimeout = setTimeout(() => {
      hoverboardRef.current = false;
      setHoverboardActive(false);
      window.hoverboardTimeout = null;
    }, duration);
  }, [upgrades?.hoverboard]);

  const activateMysteryBox = useCallback(() => {
    const r = Math.random();
    let text = "";
    if (r < 0.33) {
      addCoins(100);
      text = "+100 Coins!";
    } else if (r < 0.66) {
      activateDoubleCoins(10000); 
      text = "2x Coins!";
    } else {
      activateHoverboard();
      text = "Hoverboard!";
    }
    if (spawnTextRef.current) {
      spawnTextRef.current(text, { x: 50, y: 30, color: "#ec4899", size: 28 });
    }
  }, [addCoins, activateDoubleCoins, activateHoverboard]);

  const triggerCombo = useCallback(() => {
    comboRef.current = Math.min(20, comboRef.current + 1);
    setCombo(comboRef.current);
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => {
      comboRef.current = 0;
      setCombo(0);
      comboTimerRef.current = null;
    }, 2200);
  }, []);

  const triggerCrashFX = useCallback(() => {
    speedBeforeDeathRef.current = speedRef.current;
    crashFxRef.current = 1;
    setCrashSignal((v) => v + 1);
    slowMotionUntilRef.current = performance.now() + 280;
    // Reset combo on crash
    comboRef.current = 0;
    setCombo(0);
    if (comboTimerRef.current) {
      clearTimeout(comboTimerRef.current);
      comboTimerRef.current = null;
    }
  }, []);


  const consumeHoverboard = useCallback(() => {
    try {
      hoverboardRef.current = false;
      setHoverboardActive(false);
      playShield && playShield();
    } catch {}
  }, [playShield]);

  // MISSION helpers
  function createMissionForLevel(lv) {
    missionCompletedRef.current = false;
    coinCountRef.current = 0;
    jumpCountRef.current = 0;
    slideCountRef.current = 0;
    levelStartTimeRef.current = Date.now();

    const lvCoins = 20 + Math.floor(lv * 2);
    const lvJumps = 5 + Math.floor(lv * 0.4);
    const lvSlides = 5 + Math.floor(lv * 0.4);
    const lvNearMisses = 2 + Math.floor(lv * 0.2);
    const lvTime = 20 + Math.floor(lv * 1);

    const pool = [
      { type: "coins", target: lvCoins, desc: `Collect ${lvCoins} coins`, short: `Collect ${lvCoins} coins` },
      { type: "jumps", target: lvJumps, desc: `Do ${lvJumps} jumps`, short: `${lvJumps} Jumps` },
      { type: "slides", target: lvSlides, desc: `Do ${lvSlides} slides`, short: `${lvSlides} Slides` },
      { type: "near_misses", target: lvNearMisses, desc: `Perform ${lvNearMisses} near-misses`, short: `${lvNearMisses} Near-Misses` },
      { type: "time", target: lvTime, desc: `Survive ${lvTime} seconds`, short: `Survive ${lvTime}s` }
    ];
    
    if (lv % 2 === 0) {
      const p1 = pool[(lv) % pool.length];
      const p2 = pool[(lv + 2) % pool.length];
      return {
         type: "mix",
         parts: [ { ...p1, progress: 0 }, { ...p2, progress: 0 } ],
         desc: `Complete 2 tasks: ${p1.short} & ${p2.short}`,
         short: `Mix: ${p1.short} & ${p2.short}`,
         progress: 0
      };
    }

    const m = pool[(lv - 1) % pool.length];
    return { ...m, progress: 0 };
  }

  const calculateLevelSpeed = (lv) => {
    const baseSpeed = 0.28;
    let increment = 0;
    if (lv <= 10) increment = lv * 0.002;
    else if (lv <= 50) increment = 0.02 + (lv - 10) * 0.005;
    else increment = 0.22 + (lv - 50) * 0.008;
    
    const speedBoost = upgrades?.speedBoost ? 0.05 : 0;
    return baseSpeed + increment + speedBoost;
  };

  function finalizeMissionCompletion(m) {
    if (!m || missionCompletedRef.current) return;
    missionCompletedRef.current = true;

    const bonus = 100; // Flat rewarding bonus
    scoreRef.current = (scoreRef.current || 0) + bonus;
    setScore((s) => s + bonus);

    setMissionUI((cur) => ({ ...cur, short: "MISSION COMPLETE", progress: "✓" }));

    // NEW Level Complete Flow
    setTimeout(() => {
      setPaused(true);
      setLevelComplete(true);
      
      const nextLevel = Math.max(1, (levelRef.current || 1) + 1);
      setLevel(nextLevel);
      levelRef.current = nextLevel;
      try { localStorage.setItem("game_level", String(nextLevel)); } catch {}

      // Unlock next level in grid
      setUnlockedLevels(prev => {
        if (!prev.includes(nextLevel)) {
          const next = [...prev, nextLevel];
          localStorage.setItem("game_unlocked_levels", JSON.stringify(next));
          return next;
        }
        return prev;
      });

      // Restart run after transition
      setTimeout(() => {
        setLevelComplete(false);
        setPaused(false);
        setRestartKey(k => k + 1);
        spawnDelayRef.current = 2000;
        setShowLevelIntro(true);
        startMissionForLevel(nextLevel);
        
        // Controlled level speed increment
        const nextSpeed = calculateLevelSpeed(nextLevel);
        speedRef.current = nextSpeed;
        console.log("Level Complete. New Level:", nextLevel, "Current Speed:", speedRef.current);

        // Hide level intro after 2 seconds
        setTimeout(() => setShowLevelIntro(false), 2000);
      }, 1800);
    }, 800);
  }

  useEffect(() => {
    let interval = null;
    interval = setInterval(() => {
      const m = missionRef.current;
      if (!m) {
        setMissionUI({ short: "", desc: "", progress: "", percent: 0 });
        return;
      }
      let progressText = "";
      let percent = 0;

      if (m.type === "coins") {
        progressText = `${m.progress}/${m.target}`;
        percent = (m.progress / m.target) * 100;
      } else if (m.type === "time") {
        const elapsed = Math.floor((Date.now() - levelStartTimeRef.current) / 1000);
        progressText = `${Math.min(elapsed, m.target)}/${m.target}s`;
        percent = (Math.min(elapsed, m.target) / m.target) * 100;
      } else if (m.type === "jumps") {
        progressText = `${m.progress}/${m.target}`;
        percent = (m.progress / m.target) * 100;
      } else if (m.type === "slides") {
        progressText = `${m.progress}/${m.target}`;
        percent = (m.progress / m.target) * 100;
      } else if (m.type === "near_misses") {
        progressText = `${m.progress}/${m.target}`;
        percent = (m.progress / m.target) * 100;
      } else if (m.type === "mix") {
        const p = m.parts.map((pt) => {
          if (pt.type === "time") {
            const elapsed = Math.floor((Date.now() - levelStartTimeRef.current) / 1000);
            return `${Math.min(elapsed, pt.target)}/${pt.target}s`;
          }
          return `${pt.progress}/${pt.target}`;
        });
        progressText = p.join(" • ");
        // Average percent for mix
        const avg = m.parts.reduce((acc, pt) => {
           if (pt.type === "time") {
             return acc + (Math.min(Math.floor((Date.now() - levelStartTimeRef.current) / 1000), pt.target) / pt.target);
           }
           return acc + (pt.progress / pt.target);
        }, 0) / m.parts.length;
        percent = avg * 100;
      }
      setMissionUI({ short: m.short || m.desc, desc: m.desc, progress: progressText, percent });
    }, 200);
    return () => clearInterval(interval);
  }, []);


  function startMissionForLevel(lv) {
    const m = createMissionForLevel(lv);
    missionRef.current = m;
    setMissionUI({
      short: m.short || m.desc,
      desc: m.desc,
      progress: m.type === "time" ? `0/${m.target}s` : m.type === "mix" ? m.parts.map((p) => (p.type === "time" ? `0/${p.target}s` : `0/${p.target}`)).join(" • ") : `0/${m.target}`,
    });
    missionCompletedRef.current = false;
    levelStartTimeRef.current = Date.now();
  }

  // keyboard + mobile swipe controls
  useEffect(() => {
    const keyHandler = (e) => {
      if (!started || gameOver || paused) return;
      if (e.key === "ArrowLeft") laneRef.current = Math.max(laneRef.current - 1, 0);
      if (e.key === "ArrowRight") laneRef.current = Math.min(laneRef.current + 1, 2);
      if (e.code === "Space" || e.key === " ") triggerJump();
      if (e.key === "ArrowUp") triggerJump();
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        triggerSlide();
      }
    };
    window.addEventListener("keydown", keyHandler);

    let startX = 0;
    let startY = 0;
    let swipeThreshold = 40;

    function touchStart(e) {
      if (e.target.closest('button')) return;
      if (e.cancelable) e.preventDefault();
      const t = e.touches ? e.touches[0] : e;
      startX = t.clientX;
      startY = t.clientY;
    }

    function touchMove(e) {
      if (e.target.closest('button')) return;
      if (e.cancelable) e.preventDefault();
    }

    function touchEnd(e) {
      if (e.target.closest('button')) return;
      if (e.cancelable) e.preventDefault();
      if (!started || gameOver || paused) return;
      const t = e.changedTouches ? e.changedTouches[0] : e;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (Math.max(absX, absY) > swipeThreshold) {
        if (absX > absY) {
          if (dx > 0) laneRef.current = Math.min(laneRef.current + 1, 2);
          else laneRef.current = Math.max(laneRef.current - 1, 0);
        } else {
          if (dy < 0) triggerJump();
          else triggerSlide();
        }
      }
    }

    window.addEventListener("touchstart", touchStart, { passive: false });
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("touchend", touchEnd, { passive: false });

    return () => {
      window.removeEventListener("keydown", keyHandler);
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("touchend", touchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, gameOver, paused]);

  function triggerJump() {
    jumpRef.current = true;
    jumpCountRef.current += 1;
    setRunJumps(prev => prev + 1);
    jumpStartRef.current = performance.now() / 1000;

    // play jump sound (safe)
    try {
      playJump && playJump();
    } catch {}

    const m = missionRef.current;
    if (!m) return;
    if (m.type === "jumps") {
      m.progress = (m.progress || 0) + 1;
      if (m.progress >= m.target && !missionCompletedRef.current) {
        finalizeMissionCompletion(m);
      }
    } else if (m.type === "mix") {
      const p = m.parts.find((pt) => pt.type === "jumps");
      if (p) {
        p.progress = (p.progress || 0) + 1;
        if (m.parts.every((pt) => (pt.type === "time" ? Math.floor((Date.now() - levelStartTimeRef.current) / 1000) >= pt.target : (pt.progress || 0) >= pt.target))) {
          finalizeMissionCompletion(m);
        }
      }
    }
  }

  function triggerSlide() {
    slideRef.current = performance.now() / 1000;
    slideCountRef.current += 1;
    setRunSlides(prev => prev + 1);

    // play slide sound (safe)
    try {
      playSlide && playSlide();
    } catch {}

    const m = missionRef.current;
    if (!m) return;
    if (m.type === "slides") {
      m.progress = (m.progress || 0) + 1;
      if (m.progress >= m.target && !missionCompletedRef.current) {
        finalizeMissionCompletion(m);
      }
    } else if (m.type === "mix") {
      const p = m.parts.find((pt) => pt.type === "slides");
      if (p) {
        p.progress = (p.progress || 0) + 1;
      }
    }
  }

  // Skill-based speed system: scales with survival time and performance
  useEffect(() => {
    let rafId = 0;
    let last = performance.now();
    const MAX_SPEED = 2.1; // Slightly higher cap for high-skill play
    let running = true;

    const loop = (now) => {
      if (!running) return;
      rafId = requestAnimationFrame(loop);
      const nowPerf = performance.now();
      const timeScale = nowPerf < slowMotionUntilRef.current ? 0.28 : 1;
      const delta = Math.min(0.05, (now - last) / 1000) * timeScale;
      last = now;

      if (!started || gameOver || paused) return;

      const s = scoreRef.current || 0;
      
      // Speed increases based on performance (score) and survival time (implicitly through constant drift)
      // REDUCED: Make it primarily level-based as requested
      const baseAcceleration = 0.0004; 
      const performanceFactor = Math.min(0.001, s * 0.0000001);
      
      const perSecond = baseAcceleration + performanceFactor;

      const proposed = Math.min(MAX_SPEED, speedRef.current + perSecond * delta * 60);
      speedRef.current += (proposed - speedRef.current) * Math.min(1, 4 * delta);
      
      // DEBUG LOG: Throttled to avoid console spam
      if (Math.random() < 0.01) {
        console.log("Current Speed:", speedRef.current.toFixed(4), "Level:", levelRef.current);
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(rafId);
    };
  }, [started, gameOver, paused]);

  // ... (skipped logic)

  const handleRetry = () => {
    // Increment streak on first run of the day
    incrementStreak();
    
    // clear active timers safely
    if (magnetTimerRef.current) {
      clearTimeout(magnetTimerRef.current);
      magnetTimerRef.current = null;
    }
    if (shieldTimerRef.current) {
      clearTimeout(shieldTimerRef.current);
      shieldTimerRef.current = null;
    }
    if (doubleTimerRef.current) {
      clearTimeout(doubleTimerRef.current);
      doubleTimerRef.current = null;
    }
    doubleRef.current = false;
    setDoubleActive(false);
    multiplierRef.current = 1;
    setMultiplier(1);
    comboRef.current = 0;
    setCombo(0);
    slowMotionUntilRef.current = 0;
    crashFxRef.current = 0;
    hoverboardRef.current = false;
    setHoverboardActive(false);
    jumpStartRef.current = 0;
    setPaused(false);
    setReviveUsed(false);
    setIsReviving(false);
    runCoinsRef.current = 0;
    setRunCoins(0);

    // reset key game state
    setGameOver(false);
    scoreRef.current = 0;
    setScore(0);
    setShield(false);
    setMagnet(false);
    
    const storedLevel = parseInt(localStorage.getItem("game_level") || "1", 10);
    speedRef.current = calculateLevelSpeed(storedLevel);
    console.log("Retry. Level:", storedLevel, "Speed:", speedRef.current);

    // reset player position if exists to avoid stuck state
    if (playerRef.current) {
      playerRef.current.x = 0;
      playerRef.current.y = 0.5;
      playerRef.current.z = 0;
    }

    // ensure input state reset
    laneRef.current = 1;
    jumpRef.current = false;
    slideRef.current = 0;

    // bump restart key to re-mount in-scene entities (safe restart)
    setRestartKey((k) => k + 1);

    // ensure started remains true so game resumes
    setStarted(true);
    playBgm && playBgm();

    // reset level & mission
    const storedLevelForMission = parseInt(localStorage.getItem("game_level") || "1", 10);
    setLevel(storedLevelForMission);
    levelRef.current = storedLevelForMission;
    startMissionForLevel(storedLevelForMission);
    missionCompletedRef.current = false;
  };

  const handleStart = () => {
    incrementStreak();
    setStarted(true);
    setRestartKey((k) => k + 1);
    const storedLevel = parseInt(localStorage.getItem("game_level") || "1", 10);
    setLevel(storedLevel);
    levelRef.current = storedLevel;
    startMissionForLevel(storedLevel);
    
    speedRef.current = calculateLevelSpeed(storedLevel);
    console.log("Start. Level:", storedLevel, "Speed:", speedRef.current);

    scoreRef.current = 0;
    setScore(0);
    laneRef.current = 1;
    jumpRef.current = false;
    slideRef.current = 0;
    setGameOver(false);
    setPaused(false);
    setReviveUsed(false);
    setIsReviving(false);
    runCoinsRef.current = 0;
    setRunCoins(0);
    multiplierRef.current = 1;
    setMultiplier(1);
    comboRef.current = 0;
    setCombo(0);
    playBgm && playBgm();
  };

  useEffect(() => {
    const storedLevel = parseInt(localStorage.getItem("game_level") || "1", 10);
    startMissionForLevel(storedLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skinColors = useMemo(
    () => {
      const skin = SKINS.find(s => s.id === selectedSkin) || SKINS[0];
      return skin.colors;
    },
    [selectedSkin]
  );

  const onSelectSkin = useCallback((id) => {
    setSelectedSkin(id);
    localStorage.setItem("game_selected_skin", id);
    setCollectionOpen(false);
  }, []);

  const onSelectLevel = useCallback((lv) => {
    setLevel(lv);
    levelRef.current = lv;
    localStorage.setItem("game_level", String(lv));
    setLevelsOpen(false);
    startMissionForLevel(lv);
  }, []);

  useEffect(() => {
    addScoreRef.current = addScore;
    addCoinsRef.current = addCoins;
    playCoinRef.current = playCoin;
    playPowerupRef.current = playPowerup;
    playFallRef.current = playFall;
    playShieldRef.current = playShield;
    activateMagnetRef.current = activateMagnet;
    activateShieldRef.current = activateShield;
    activateDoubleRef.current = activateDoubleCoins;
    activateHoverRef.current = activateHoverboard;
    activateMysteryRef.current = activateMysteryBox;
    playCoinAudioRef.current = audio.refs?.coinRef;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, upgrades]);

  // stable callbacks for children
  const onConsumeHoverboard = consumeHoverboard;
  const onOpenShop = useCallback(() => setShopOpen(true), []);
  const onCloseShop = useCallback(() => setShopOpen(false), []);
  const REVIVE_COST = 50;
  const canRevive = !reviveUsed && coinsTotal >= REVIVE_COST && !isReviving;

  const handleRevive = useCallback(() => {
    if (!canRevive) return;
    setIsReviving(true);
    coinsRef.current = Math.max(0, coinsRef.current - REVIVE_COST);
    setCoinsTotal(coinsRef.current);
    try {
      localStorage.setItem("game_coins", String(coinsRef.current));
    } catch {}
    setTimeout(() => {
      setReviveUsed(true);
      setGameOver(false);
      setIsReviving(false);
      activateShield(3000);
      playBgm && playBgm();
      // Resume at same speed
      speedRef.current = speedBeforeDeathRef.current;
      slowMotionUntilRef.current = performance.now() + 1500;
    }, 220);
  }, [canRevive, activateShield, playBgm]);


  function addScore(delta = 0, source = "") {
    scoreRef.current = (scoreRef.current || 0) + delta;

    if (source === "coin") {
      coinCountRef.current += 1;
      // triggerCombo(); // Commenting out until verified if available

      // === JUICE: coin collect floating text + glow flash ===
      try {
        const pts = comboRef.current >= 2 ? `+${delta} x${comboRef.current}` : `+${delta}`;
        spawnTextRef.current && spawnTextRef.current(pts, {
          x: 38 + Math.random() * 24,
          y: 28 + Math.random() * 12,
          color: comboRef.current >= 5 ? '#ffd166' : '#fff',
          size: comboRef.current >= 5 ? 20 : 15,
        });
        // Throttle coin flash to avoid blinding the player
        coinFlashCountRef.current += 1;
        if (coinFlashCountRef.current % 3 === 1) setCoinFlash(v => v + 1);
      } catch {}

      const m = missionRef.current;
      if (!m) return;
      if (m.type === "coins") {
        m.progress = (m.progress || 0) + 1;
        if (m.progress >= m.target && !missionCompletedRef.current) {
          finalizeMissionCompletion(m);
        }
      } else if (m.type === "mix") {
        const part = m.parts.find((p) => p.type === "coins");
        if (part) {
          part.progress = (part.progress || 0) + 1;
          if (m.parts.every((pt) => (pt.type === "time" ? Math.floor((Date.now() - levelStartTimeRef.current) / 1000) >= pt.target : (pt.progress || 0) >= pt.target))) {
            finalizeMissionCompletion(m);
          }
        }
      }
    } else if (source === "near-miss") {
      // === JUICE: near-miss floating text + flash ===
      try {
        spawnTextRef.current && spawnTextRef.current('⚡ Near Miss! +' + delta, {
          x: 35 + Math.random() * 30,
          y: 40 + Math.random() * 10,
          color: '#ffd166',
          size: 18,
        });
        setNearMissFlash(v => v + 1);
        setRunNearMisses(prev => prev + 1);
      } catch {}
    }
  }

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!started || gameOver || paused) return;
      const targetMulti = Math.min(4.2, 1 + (speedRef.current - 0.28) * 0.9 + comboRef.current * 0.08);
      multiplierRef.current += (targetMulti - multiplierRef.current) * Math.min(1, delta * 3.2);

      // Score with event multiplier
      scoreRef.current += delta * 14 * multiplierRef.current * (eventMultiplier?.score || 1);
      setScore(Math.max(0, Math.floor(scoreRef.current || 0)));

      // Distance tracking
      setRunDistance(prev => prev + (speedRef.current * delta * 60 * 0.1)); // Scale for "meters"
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started, gameOver, paused, eventMultiplier]);

  return (
    // Wrap everything in FloatingTextsProvider so spawnText is available globally
    <FloatingTextsProvider>
      {/* Wire spawnText ref so addScore can call it without re-renders */}
      <SpawnTextWire spawnTextRef={spawnTextRef} />
      <UIStyles />

      {!started && (
        <>
          <StartScreen 
            started={started} 
            onStart={handleStart} 
            onOpenShop={onOpenShop} 
            onOpenMissions={() => setMissionsOpen(true)}
            onOpenCollection={() => setCollectionOpen(true)}
            onOpenLevels={() => setLevelsOpen(true)}
            onUIButtonClick={playClick} 
            onToggleTheme={() => setShowThemePanel(v => !v)} 
            level={level}
            missionUI={missionUI}
          />
          {showThemePanel && (
            <ThemePanel 
              current={themeIndex} 
              onSelect={(i) => {
                setThemeIndex(i);
                setShowThemePanel(false);
                playClick();
              }} 
            />
          )}
        </>
      )}


      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20000,
            display: "grid",
            placeItems: "center",
            background: "radial-gradient(circle at center, #0f172a 0%, #020617 70%)",
            color: "white",
            fontFamily: "Inter, system-ui, sans-serif",
            letterSpacing: "0.02em",
            fontWeight: 800,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 26, marginBottom: 12 }}>Loading Run...</div>
            <div style={{ fontSize: 13, opacity: 0.76 }}>Optimizing shaders and assets</div>
          </div>
        </div>
      )}

      <Canvas shadows style={{ width: "100vw", height: "100vh", background: THEMES[themeIndex].bg, transition: "background 1s ease" }}>
        <fog attach="fog" args={[THEMES[themeIndex].fog, 30, 80]} />
        <ambientLight intensity={0.65} />
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={1.2} 
          castShadow 
          shadow-mapSize={[1024, 1024]} 
          shadow-camera-left={-10} 
          shadow-camera-right={10} 
          shadow-camera-top={20} 
          shadow-camera-bottom={-20} 
        />

        {started && (
          <group key={restartKey}>
            <Character
              laneRef={laneRef}
              jumpRef={jumpRef}
              jumpStartRef={jumpStartRef}
              slideRef={slideRef}
              playerRef={playerRef}
              speedRef={speedRef}
              gameOver={gameOver || paused}
              skinColors={skinColors}
              hoverboardActive={hoverboardActive}
            />
            <BackgroundAnimations theme={THEMES[themeIndex]} speedRef={speedRef} playerRef={playerRef} gameOver={gameOver || paused} />
            <Track playerRef={playerRef} theme={THEMES[themeIndex]} gameOver={gameOver || paused} />
            <Coins
              playerRef={playerRef}
              addScoreRef={addScoreRef}
              addCoinsRef={addCoinsRef}
              playCoinRef={playCoinRef}
              magnet={magnet}
              speedRef={speedRef}
              doubleActive={doubleActive}
              obstaclesRef={obstaclesRef}
              gameOver={gameOver || paused}
              spawnCoinsForObstacleRef={spawnCoinsForObstacleRef}
            />
            <Obstacles
              playerRef={playerRef}
              gameOver={gameOver || paused}
              setGameOver={(v) => {
                setGameOver(v);
              }}
              playFallRef={playFallRef}
              shield={shield}
              setShield={setShield}
              slideRef={slideRef}
              jumpStartRef={jumpStartRef}
              levelRef={levelRef}
              hoverboardRef={hoverboardRef}
              onConsumeHoverboard={onConsumeHoverboard}
              onCrash={triggerCrashFX}
              addScoreRef={addScoreRef}
              speedRef={speedRef}
              crashFxRef={crashFxRef}
              missionRef={missionRef}
              finalizeMissionCompletion={finalizeMissionCompletion}
              obstaclesRef={obstaclesRef}
              spawnCoinsForObstacleRef={spawnCoinsForObstacleRef}
              spawnDelay={spawnDelayRef.current}
            />
            <Boosters playerRef={playerRef} activateMagnetRef={activateMagnetRef} activateShieldRef={activateShieldRef} playShieldRef={playShieldRef} playPowerupRef={playPowerupRef} gameOver={gameOver || paused} />

            <PowerUps playerRef={playerRef} activateDoubleRef={activateDoubleRef} activateHoverRef={activateHoverRef} activateMysteryRef={activateMysteryRef} playPowerupRef={playPowerupRef} gameOver={gameOver || paused} obstaclesRef={obstaclesRef} speedRef={speedRef} />

            <SpeedLines playerRef={playerRef} speedRef={speedRef} gameOver={gameOver || paused} />
            <RunnerFX playerRef={playerRef} speedRef={speedRef} crashSignal={crashSignal} gameOver={gameOver || paused} />
            <CameraFollow playerRef={playerRef} speedRef={speedRef} crashFxRef={crashFxRef} />
          </group>
        )}
      </Canvas>

      {started && !gameOver && (
        <>
          <EventBanner event={currentEvent} />
          {levelComplete && <LevelToast level={level} />}
          {showLevelIntro && <LevelIntro level={level} />}
          <ModernHUD
            score={score}
            runCoins={runCoins}
            paused={paused}
            onTogglePause={() => setPaused((p) => !p)}
            onUIButtonClick={playClick}
            onToggleTheme={() => setShowThemePanel(v => !v)}
            onOpenMissions={() => setMissionsOpen(true)}
            missionUI={missionUI}
            combo={combo}
            magnet={magnet}
            doubleActive={doubleActive}
            shield={shield}
            hoverboardActive={hoverboardActive}
          />
          {showThemePanel && (
            <ThemePanel 
              current={themeIndex} 
              onSelect={(i) => {
                setThemeIndex(i);
                setShowThemePanel(false);
                playClick();
              }} 
            />
          )}
        </>
      )}

      <MissionOverlay 
        open={missionsOpen} 
        onClose={() => setMissionsOpen(false)}
        dailyMissions={dailyMissions}
        lifetimeMilestones={lifetimeMilestones}
        lifetimeStats={lifetimeStats}
        streak={streak}
        onClaimDaily={claimMissionReward}
        onClaimMilestone={claimMilestone}
        onUIButtonClick={playClick}
      />

      <MysteryBoxOverlay 
        open={showMysteryBox}
        reward={mysteryBoxReward}
        onOpen={openMysteryBox}
        onUIButtonClick={playClick}
      />

      <CollectionPanel 
        open={collectionOpen} 
        onClose={() => setCollectionOpen(false)}
        unlockedSkins={unlockedSkins}
        selectedSkin={selectedSkin}
        onSelectSkin={onSelectSkin}
        onUIButtonClick={playClick}
      />

      <LevelsPanel 
        open={levelsOpen} 
        onClose={() => setLevelsOpen(false)}
        currentLevel={level}
        unlockedLevels={unlockedLevels}
        onSelectLevel={onSelectLevel}
        onUIButtonClick={playClick}
      />




      <GameOverOverlay
        gameOver={gameOver}
        score={score}
        best={best}
        runCoins={runCoins}
        totalCoins={coinsTotal}
        reviveCost={REVIVE_COST}
        reviveAvailable={!reviveUsed}
        canRevive={canRevive}
        onRevive={handleRevive}
        onRetry={handleRetry}
        onUIButtonClick={playClick}
      />

      {/* Shop overlay */}
      <ShopOverlay open={shopOpen} onClose={onCloseShop} coins={coinsTotal} upgrades={upgrades} onBuy={handleBuy} onUIButtonClick={playClick} />

      {/* === JUICE: Near-miss screen flash overlay === */}
      {nearMissFlash > 0 && <div key={nearMissFlash} className="near-miss-flash" aria-hidden />}

      {/* === JUICE: Coin collect glow flash === */}
      {coinFlash > 0 && <div key={`cf-${coinFlash}`} className="coin-collect-flash" aria-hidden />}
    </FloatingTextsProvider>
  );
}

// Helper: wires spawnText from context into a ref so addScore (non-React fn) can call it
function SpawnTextWire({ spawnTextRef }) {
  const spawnText = useSpawnText();
  useEffect(() => {
    spawnTextRef.current = spawnText;
  }, [spawnText, spawnTextRef]);
  return null;
}
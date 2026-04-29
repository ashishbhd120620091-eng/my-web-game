import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useRef, useState, useMemo, memo, useCallback, createContext, useContext } from "react";

const LANES = [-2, 0, 2];

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
  const GRAVITY = 22; // units/s^2 (smoothed)
  const JUMP_V = 9.4; // stronger initial jump velocity
  const FORCE_FALL_V = -10; // clamp downwards to force landing
  const FORCE_FALL_S = 0.82; // seconds to force fall (longer airtime)

  useFrame((state, delta) => {
    if (!ref.current || gameOver) return;

    // snappy smooth lane follow
    const laneIndex = laneRef?.current ?? 1;
    const targetX = LANES[laneIndex] ?? 0;
    const moveFactor = 1 - Math.exp(-30 * delta); // instant lane response
    ref.current.position.x += (targetX - ref.current.position.x) * moveFactor;

    // Add tilt effect when switching lanes
    const currentVelocityX = (targetX - ref.current.position.x) * 30;
    ref.current.rotation.z = -currentVelocityX * 0.015;

    // forward motion - keep the same "per-second" behavior as before
    ref.current.position.z -= (speedRef.current || 0) * delta * 60;

    const nowS = performance.now() / 1000;

    // jump - consume jump request immediately
    if (jumpRef?.current) {
      if (ref.current.position.y <= 0.505) {
        vel.current = JUMP_V;
        if (jumpStartRef) jumpStartRef.current = nowS;
      }
      jumpRef.current = false;
    }

    // gravity integration (frame-rate independent, smoothed)
    const gravityMul = vel.current > 0 ? 0.92 : 1.6; // slower up, faster down
    vel.current -= GRAVITY * gravityMul * delta;
    ref.current.position.y += vel.current * delta;

    // force landing after fixed time window to avoid floatiness
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

    // sliding/crouch visual smooth lerp (frame-rate independent)
    const sliding = slideRef?.current && (nowS - slideRef.current < 0.6);
    const targetScaleY = sliding ? 0.45 : 1;
    const slideLerp = 1 - Math.exp(-30 * delta); // instantly responsive
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

    const swayStrength = Math.min(0.08, Math.max(0.015, (speedRef?.current || 0.28) * 0.05));
    const swayX = Math.sin(state.clock.elapsedTime * 1.8) * swayStrength;
    const swayY = Math.sin(state.clock.elapsedTime * 2.6) * swayStrength * 0.6;

    const crashFx = crashFxRef?.current || 0;
    // Enhanced screen shake
    const shake = crashFx > 0 ? crashFx * 0.6 : 0;
    const shakeX = (Math.random() - 0.5) * shake;
    const shakeY = (Math.random() - 0.5) * shake;
    const shakeZ = (Math.random() - 0.5) * shake * 0.5;

    // Camera follows player x slightly so it feels more dynamic
    posTarget.current.set(playerRef.current.x * 0.6 + swayX + shakeX, baseY + swayY + shakeY, baseZ + shakeZ);

    const lerpFactor = 1 - Math.exp(-10 * delta); // Faster camera follow
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
    id: "city", name: "Cyber City",
    bg: "linear-gradient(#0f172a, #334155)", fog: "#334155",
    floor0: "#1e293b", floor1: "#0f172a",
    wall0: "#334155", wall1: "#1e293b",
    trimA0: "#38bdf8", trimA1: "#818cf8", trimA2: "#f472b6",
    trimB0: "#22d3ee", trimB1: "#a78bfa",
    preview: "#38bdf8"
  },
  {
    id: "sunset", name: "Neon Sunset",
    bg: "linear-gradient(#f43f5e, #fbbf24)", fog: "#fbbf24",
    floor0: "#e11d48", floor1: "#fbbf24",
    wall0: "#be123c", wall1: "#f59e0b",
    trimA0: "#fff", trimA1: "#fde68a", trimA2: "#fca5a5",
    trimB0: "#fb7185", trimB1: "#facc15",
    preview: "#f43f5e"
  },
  {
    id: "desert", name: "Sahara Gold",
    bg: "linear-gradient(#fdba74, #fcd34d)", fog: "#fcd34d",
    floor0: "#fef08a", floor1: "#ffedd5",
    wall0: "#fde68a", wall1: "#fed7aa",
    trimA0: "#ef4444", trimA1: "#fb923c", trimA2: "#fcd34d",
    trimB0: "#f97316", trimB1: "#f59e0b",
    preview: "#fcd34d"
  }
];

// ---------------- BACKGROUND ANIMATIONS (Subway style) ----------------
const BackgroundAnimations = memo(function BackgroundAnimations({ theme }) {
  const birds = useRef(Array.from({ length: 4 }, () => ({
    x: (Math.random() - 0.5) * 30,
    y: 8 + Math.random() * 6,
    z: -30 - Math.random() * 60,
    speed: 0.05 + Math.random() * 0.1,
    offset: Math.random() * Math.PI * 2
  })));

  const groupRef = useRef();

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    birds.current.forEach((b, i) => {
      b.z += b.speed * 20 * delta;
      if (b.z > 20) b.z = -80;
      b.y += Math.sin(state.clock.elapsedTime * 2 + b.offset) * 0.01;
      const child = groupRef.current.children[i];
      if (child) child.position.set(b.x, b.y, b.z);
    });
  });

  return (
    <group ref={groupRef}>
      {/* Flying Birds */}
      {birds.current.map((_, i) => (
        <group key={i}>
          <mesh castShadow>
            <boxGeometry args={[0.4, 0.05, 0.2]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0.2, 0.1, 0]} rotation={[0, 0, Math.sin(Date.now() * 0.01) * 0.5]}>
            <boxGeometry args={[0.3, 0.02, 0.15]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[-0.2, 0.1, 0]} rotation={[0, 0, -Math.sin(Date.now() * 0.01) * 0.5]}>
            <boxGeometry args={[0.3, 0.02, 0.15]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </group>
      ))}
      
      {/* Sun Rays / Light Streaks */}
      <group position={[10, 15, -40]}>
        {Array.from({ length: 3 }).map((_, i) => (
          <mesh key={i} rotation={[0, 0, 0.4]} position={[i * 2, 0, 0]}>
            <planeGeometry args={[0.5, 40]} />
            <meshBasicMaterial color="#fff" transparent opacity={0.05} />
          </mesh>
        ))}
      </group>
    </group>
  );
});


// ---------------- TRACK & ENVIRONMENT (colorful walls) ----------------
const Track = memo(function Track({ playerRef, theme }) {
  const tiles = useRef(Array.from({ length: 20 }, (_, i) => ({ z: -i * 18 })));
  const groupRefs = useRef([]);
  const neonRefs = useRef([]);

  useFrame((state, delta) => {
    if (!playerRef.current) return;
    const pz = playerRef.current.z;
    tiles.current.forEach((t, i) => {
      if (t.z > pz + 26) t.z -= 20 * 18;
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
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[14, 18]} />
            <meshStandardMaterial color={i % 2 ? theme.floor1 : theme.floor0} />
          </mesh>

          {/* left wall panel */}
          <group position={[-6.4, 1.6, 0]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.4, 3.4, 18]} />
              <meshStandardMaterial color={i % 2 ? theme.wall1 : theme.wall0} />
            </mesh>
            {/* Animated Neon Bar */}
            <mesh position={[0.45, 0.8, 0]} ref={el => neonRefs.current[i * 2] = el}>
              <boxGeometry args={[0.05, 0.4, 18]} />
              <meshStandardMaterial color={theme.trimA0} emissive={theme.trimA0} emissiveIntensity={1} />
            </mesh>
          </group>

          {/* right wall panel */}
          <group position={[6.4, 1.6, 0]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.4, 3.4, 18]} />
              <meshStandardMaterial color={i % 2 ? theme.wall1 : theme.wall0} />
            </mesh>
            {/* Animated Neon Bar */}
            <mesh position={[-0.45, 0.8, 0]} ref={el => neonRefs.current[i * 2 + 1] = el}>
              <boxGeometry args={[0.05, 0.4, 18]} />
              <meshStandardMaterial color={theme.trimA1} emissive={theme.trimA1} emissiveIntensity={1} />
            </mesh>
          </group>

          {/* Ground side lights (disco feel) */}
          <mesh position={[-5.8, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.4, 1]} />
            <meshStandardMaterial color={i % 3 === 0 ? theme.trimA0 : theme.trimA2} emissive={i % 3 === 0 ? theme.trimA0 : theme.trimA2} emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[5.8, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.4, 1]} />
            <meshStandardMaterial color={i % 3 === 1 ? theme.trimB0 : theme.trimA1} emissive={i % 3 === 1 ? theme.trimB0 : theme.trimA1} emissiveIntensity={0.8} />
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
const Coins = memo(function Coins({ playerRef, addScoreRef, addCoinsRef, playCoinRef, magnet, speedRef, doubleActive }) {
  const coins = useRef(
    Array.from({ length: 8 }, () => ({
      x: LANES[Math.floor(Math.random() * 3)],
      z: -Math.random() * 360 - 40,
      rot: Math.random() * Math.PI * 2,
    }))
  );

  const groupRefs = useRef([]);
  // Scale-pulse animation state per coin (ref to avoid re-renders)
  const coinScaleRefs = useRef(coins.current.map(() => ({ s: 1, t: 0 })));

  useFrame((state, delta) => {
    if (!playerRef.current) return;
    const speed = speedRef.current ?? 0.28;
    const pz = playerRef.current.z;

    coins.current.forEach((c, i) => {
      // magnet attraction (smoothed)
      if (magnet && Math.abs(c.z - pz) < 8) {
        c.x += (playerRef.current.x - c.x) * 0.18;
        c.z += (playerRef.current.z - c.z) * 0.18;
      }

      const dx = Math.abs(c.x - playerRef.current.x);
      const dz = Math.abs(c.z - pz);

      // rotate coin (frame-rate independent)
      const rotSpeed = 0.06 + Math.max(0, (Math.abs(speed) - 0.28) * 0.02);
      c.rot += rotSpeed * Math.min(1, 60 * delta);

      if (dx < 0.9 && dz < 0.9) {
        playCoinRef?.current && playCoinRef.current();
        addScoreRef?.current && addScoreRef.current(doubleActive ? 20 : 10, "coin");
        addCoinsRef?.current && addCoinsRef.current(1);
        // Trigger scale-pulse on collected coin
        if (coinScaleRefs.current[i]) coinScaleRefs.current[i] = { s: 1.9, t: 1 };
        const prev = coins.current[i > 0 ? i - 1 : coins.current.length - 1];
        if (Math.random() < 0.25 && prev.z < pz - 80) {
          c.z = prev.z - 4;
          c.x = prev.x;
        } else {
          c.z = pz - (160 + Math.random() * 160);
          c.x = LANES[Math.floor(Math.random() * 3)];
        }
      }

      // Animate coin scale-pulse (collect bounce effect)
      const cs = coinScaleRefs.current[i];
      if (cs && cs.t > 0) {
        cs.t = Math.max(0, cs.t - delta * 5.5);
        // ease-out bounce: start big, spring back to 1
        cs.s = 1 + (cs.s - 1) * (1 - Math.pow(1 - cs.t, 2));
      }

      if (c.z > pz + 26) {
        const prev = coins.current[i > 0 ? i - 1 : coins.current.length - 1];
        if (Math.random() < 0.25 && prev.z < pz - 80) {
          // cluster with prev
          c.z = prev.z - 4;
          c.x = prev.x;
        } else {
          c.z = pz - (160 + Math.random() * 160);
          c.x = LANES[Math.floor(Math.random() * 3)];
        }
      }

      const g = groupRefs.current[i];
      if (g) {
        g.position.set(c.x, 0.82, c.z);
        g.rotation.set(0, c.rot, 0);
        // Apply scale-pulse (uniform scale for collect feedback)
        const sc = coinScaleRefs.current[i]?.s ?? 1;
        g.scale.setScalar(sc);
      }
    });
  });

  return coins.current.map((c, i) => (
    <group
      key={i}
      ref={(el) => (groupRefs.current[i] = el)}
      position={[c.x, 0.82, c.z]}
      rotation={[0, c.rot, 0]}
    >
      <mesh>
        <torusGeometry args={[0.28, 0.08, 12, 20]} />
        <meshStandardMaterial
          color="#f6c85f"
          metalness={0.85}
          roughness={0.25}
          emissive="#fff2bf"
          emissiveIntensity={doubleActive ? 0.6 : 0.2}
        />
      </mesh>
      <mesh position={[0.14, 0.06, 0]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#fff6e5" emissive="#fff6e5" emissiveIntensity={doubleActive ? 1.1 : 0.6} />
      </mesh>
    </group>
  ));
});

// ---------------- OBSTACLES (SMART PATTERNED) ----------------
const Obstacles = memo(function Obstacles({
  playerRef,
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
}) {
  // Reworked types: barrier (jump), tunnel (slide), wall (change lane), train (big change lane)
  const obs = useRef(Array.from({ length: 12 }, () => ({ x: 0, z: 0, type: "barrier" })));
  const crashPendingRef = useRef(false);


  const patternQueueRef = useRef([]);
  const patternIndexRef = useRef(0);
  const storedLevelRef = useRef(Math.max(1, levelRef?.current || 1));
  const groupRefs = useRef([]);

  // Near-miss tracking (refs to avoid re-renders)
  const nearMissedRef = useRef(Array.from({ length: obs.current.length }, () => false));
  const lastNearMissAtRef = useRef(0); // seconds
  const nearSlowMoActiveRef = useRef(false);

  // Tunable thresholds / cooldown
  const NEAR_MISS_COOLDOWN = 0.3; // seconds
  const NEAR_MISS_DZ = 2.2;
  const NEAR_MISS_DX = 1.6;

  function triggerCrash() {
    if (crashPendingRef.current) return;
    crashPendingRef.current = true;
    playFallRef?.current && playFallRef.current();
    onCrash && onCrash();
    setGameOver(true);
    crashPendingRef.current = false;
  }

  // FIX 3 & 5: Smart obstacle pattern generator
  // - Scales complexity with level (more obstacle variety at higher levels)
  // - NEVER creates impossible patterns (always one free lane)
  // - Enforces minimum spacing between hard obstacles
  // - Mixes easy + hard patterns with controlled randomness
  function generatePattern() {
    const steps = [];
    const types = ["barrier", "tunnel", "wall", "train"];
    const length = 40;

    let i = 0;
    while (i < length) {
      const r = Math.random();
      
      // Combo Patterns (Sequential)
      if (r > 0.85 && i < length - 2) {
        const lane = Math.floor(Math.random() * 3);
        if (Math.random() > 0.5) {
          // jump -> slide
          steps.push({ type: "barrier", lane });
          steps.push({ type: "gap", lane }); // spacing for reaction
          steps.push({ type: "tunnel", lane });
        } else {
          // slide -> jump
          steps.push({ type: "tunnel", lane });
          steps.push({ type: "gap", lane });
          steps.push({ type: "barrier", lane });
        }
        i += 3;
      } else {
        const lane = Math.floor(Math.random() * 3);
        const type = types[Math.floor(Math.random() * types.length)];
        steps.push({ type, lane });
        i++;
      }
    }
    return steps;
  }

  useEffect(() => {
    patternQueueRef.current = generatePattern(Math.max(1, levelRef.current || 1));
    patternIndexRef.current = 0;
    const startZ = (playerRef.current ? playerRef.current.z : 0) - 60;
    const currentSpeed = speedRef.current || 0.28;
    // Use the same safe-gap formula as respawn for consistency
    const MIN_SAFE_GAP = 14;
    const BASE_GAP = 22;
    const speedFactor = Math.max(0, currentSpeed - 0.28) * 8;
    const spacing = Math.max(MIN_SAFE_GAP, BASE_GAP - speedFactor);
    obs.current.forEach((o, i) => {
      const step = patternQueueRef.current[i % patternQueueRef.current.length];
      o.type = step.type || "barrier";
      o.x = LANES[step.lane ?? Math.floor(Math.random() * 3)];
      o.z = startZ - i * spacing;
    });
    storedLevelRef.current = Math.max(1, levelRef?.current || 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state, delta) => {
    if (!playerRef.current) return;
    const pz = playerRef.current.z;

    obs.current.forEach((o, i) => {
      if (o.type === "gap") {
        if (o.z > pz + 28) respawn(o);
        return;
      }

      // High-precision hitboxes
      let hitDx = 0.65; 
      let hitDz = 1.0;
      let hitDy = 1.5;
      
      if (o.type === "train") {
        hitDx = 0.85;
        hitDz = 2.0;
      }

      const dx = Math.abs(o.x - playerRef.current.x);
      const dz = Math.abs(o.z - pz);

      const collided = dz < hitDz && dx < hitDx;
      if (collided) {
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

        if (o.type === "barrier") {
          // Medium Jump Barrier (precise timing)
          if (py < 1.1) handleHit();
          else {
            // Success: clear mission
            const m = missionRef.current;
            if (m && m.type === "jumps" && !nearMissedRef.current[i]) {
              nearMissedRef.current[i] = true;
              m.progress += 1;
              if (m.progress >= m.target) finalizeMissionCompletion(m);
            }
          }
        } else if (o.type === "tunnel") {
          // High Slide Obstacle
          if (ps > 0.6) handleHit();
          else {
             // Success: clear mission
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

      } else {
        // NEAR-MISS detection
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

      const g = groupRefs.current[i];
      if (g) {
        const y = o.type === "train" ? 1.0 : o.type === "barrier" ? 0.45 : o.type === "tunnel" ? 1.7 : 0.85;
        g.position.set(o.x, y, o.z);
        g.visible = o.type !== "gap";
      }
    });
  });

  function respawn(o) {
    const idx = obs.current.indexOf(o);
    if (idx >= 0) nearMissedRef.current[idx] = false;
    
    if (!patternQueueRef.current || patternQueueRef.current.length === 0) {
      patternQueueRef.current = generatePattern();
      patternIndexRef.current = 0;
    }
    const step = patternQueueRef.current[patternIndexRef.current % patternQueueRef.current.length];
    patternIndexRef.current++;

    let minZ = playerRef.current ? playerRef.current.z - 40 : -40;
    obs.current.forEach((other) => {
      if (other !== o && other.z < minZ) minZ = other.z;
    });

    const currentSpeed = speedRef.current || 0.28;
    // Spacing scales slightly with speed but keeps minimum reaction gap
    const spacing = Math.max(15, 22 - (currentSpeed - 0.28) * 5);

    o.z = minZ - spacing;
    o.x = LANES[step.lane ?? 1];
    o.type = step.type || "barrier";
  }

  // FIX 5: Near-miss slow-mo + screen shake for addictive feedback
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
    if (o.type === "gap") return null;

    if (o.type === "train") {
      return (
        <group key={i} ref={(el) => (groupRefs.current[i] = el)}>
          <mesh castShadow position={[0, 0.4, 0]}>
            <boxGeometry args={[2.0, 1.8, 5.0]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
          <mesh position={[0, 0.6, -2.5]}>
            <boxGeometry args={[1.6, 0.8, 0.1]} />
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.6} />
          </mesh>
        </group>
      );
    }

    if (o.type === "barrier") {
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

    if (o.type === "tunnel") {
      return (
        <group key={i} ref={(el) => (groupRefs.current[i] = el)}>
          {/* Top Bar - Clearly HIGH */}
          <mesh castShadow position={[0, 0.6, 0]}>
            <boxGeometry args={[1.9, 0.6, 1.2]} />
            <meshStandardMaterial color="#7c3aed" emissive="#7c3aed" emissiveIntensity={0.3} />
          </mesh>
          {/* Side supports */}
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

    return (
      <group key={i} ref={(el) => (groupRefs.current[i] = el)}>
        <mesh castShadow>
          <boxGeometry args={[1.8, 2.2, 0.8]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      </group>
    );
  });
});

// ---------------- BOOSTERS ----------------
const Boosters = memo(function Boosters({ playerRef, activateMagnetRef, activateShieldRef, playShieldRef, playPowerupRef }) {
  const boosters = useRef(
    Array.from({ length: 4 }, (_, i) => {
      const type = i % 2 === 0 ? "magnet" : "shield";
      return { type, x: LANES[Math.floor(Math.random() * 3)], z: -(50 + Math.random() * 300) };
    })
  );

  const groupRefs = useRef([]);

  useFrame((state, delta) => {
    if (!playerRef.current) return;
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
        b.z = pz - (1000 + Math.random() * 1200);
        b.x = LANES[Math.floor(Math.random() * 3)];
      }

      if (b.z > pz + 30) {
        b.z = pz - (1000 + Math.random() * 1200);
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
            <meshStandardMaterial color="#60a5fa" />
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
            <meshStandardMaterial color="#10b981" metalness={0.5} roughness={0.3} />
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
const PowerUps = memo(function PowerUps({ playerRef, activateDoubleRef, activateHoverRef, playPowerupRef }) {
  const ups = useRef(
    Array.from({ length: 3 }, (_, i) => {
      const types = ["double", "hover"];
      const t = types[i % types.length];
      return { type: t, x: LANES[Math.floor(Math.random() * 3)], z: -(120 + Math.random() * 700), bob: 0 };
    })
  );

  const groupRefs = useRef([]);

  useFrame((state) => {
    if (!playerRef.current) return;
    const pz = playerRef.current.z;
    ups.current.forEach((u, idx) => {
      u.bob = Math.sin((state.clock.elapsedTime + idx) * 2.2) * 0.12;
      const dx = Math.abs(u.x - playerRef.current.x);
      const dz = Math.abs(u.z - pz);

      if (dx < 0.9 && dz < 0.9) {
        playPowerupRef?.current && playPowerupRef.current();
        if (u.type === "double") activateDoubleRef?.current && activateDoubleRef.current();
        else if (u.type === "hover") activateHoverRef?.current && activateHoverRef.current();

        u.z = pz - (1500 + Math.random() * 2000);
        u.x = LANES[Math.floor(Math.random() * 3)];
        const r = Math.random();
        u.type = r < 0.85 ? "double" : "hover";
      }

      if (u.z > pz + 40) {
        u.z = pz - (1500 + Math.random() * 2000);
        u.x = LANES[Math.floor(Math.random() * 3)];
        const r = Math.random();
        u.type = r < 0.85 ? "double" : "hover";
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
          <mesh rotation={[0, 0, 0]}>
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
    return null;
  });
});

// ---------------- FX (Speed lines + particles) ----------------
const SpeedLines = memo(function SpeedLines({ playerRef, speedRef }) {
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
    if (!playerRef.current) return;
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

const RunnerFX = memo(function RunnerFX({ playerRef, speedRef, crashSignal }) {
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
    if (!playerRef.current) return;
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
        padding: 12px 22px;
        border-radius: 12px;
        background: linear-gradient(90deg, var(--accent), var(--neon));
        border: 1px solid rgba(255,255,255,0.06);
        color: white;
        cursor: pointer;
        font-weight: 700;
        font-size: 16px;
        transition: transform 160ms ease, box-shadow 160ms ease;
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
        position: absolute;
        top: 18px;
        left: 18px;
        z-index: 1001;
        width: 42px;
        height: 42px;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        background: linear-gradient(90deg, var(--accent), var(--neon));
        color: white;
        font-size: 18px;
        font-weight: 800;
        cursor: pointer;
        transition: transform 140ms ease, background 140ms ease;
      }
      .hud-pause:hover { transform: scale(1.04); filter: brightness(1.06); }
      .hud-pause:active { transform: scale(0.97); }
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
        background: linear-gradient(180deg, rgba(255,0,110,0.12), rgba(124,58,237,0.12));
        color: rgba(255,255,255,0.95);
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 0.06em;
        pointer-events: none;
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
  totalCoins,
  runCoins,
  paused,
  onTogglePause,
  onUIButtonClick,
  onToggleTheme,
  missionUI,
  combo = 0,
  magnet = false,
  doubleActive = false,
  shield = false,
  hoverboardActive = false,
}) {

  const coins = Math.max(0, Math.floor(totalCoins || 0));
  const comboBumpKey = useRef(0);
  const prevCombo = useRef(combo);
  if (combo !== prevCombo.current && combo > 0) {
    comboBumpKey.current += 1;
    prevCombo.current = combo;
  }

  return (
    <>
      <div style={{ position: "absolute", top: 18, left: 18, zIndex: 1001, display: "flex", gap: 10 }}>
        <button
          className="hud-pause hud-fade"
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
          onClick={() => {
            onUIButtonClick && onUIButtonClick();
            onToggleTheme && onToggleTheme();
          }}
          title="Switch Theme"
        >
          🎨
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

      {paused && <div className="pause-overlay">PAUSED</div>}
      
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


// Start Screen
function StartScreen({ started, onStart, onOpenShop, onUIButtonClick, onToggleTheme }) {
  useEffect(() => {
    function key(e) {
      if (started) return;
      if (e.code === "Space" || e.key === " ") {
        onStart && onStart();
      }
    }
    function tap(e) {
      if (started) return;
      onStart && onStart();
    }
    window.addEventListener("keydown", key);
    window.addEventListener("touchstart", tap, { passive: true });
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("touchstart", tap);
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
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div className="start-sub">Jump, slide and dodge — collect coins and boosters. <br />Press Space or Tap to Start</div>

          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <button
              className="start-cta"
              onClick={() => {
                onUIButtonClick && onUIButtonClick();
                onStart && onStart();
              }}
              aria-label="Start game"
            >
              <span style={{ display: "inline-block", width: 18 }}>▶</span>
              <span style={{ fontWeight: 800 }}>Play</span>
            </button>
            <button
              className="start-cta"
              onClick={() => {
                onUIButtonClick && onUIButtonClick();
                alert("Tip: Use ← → to change lanes, ↑ to jump, ↓ to slide.");
              }}
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              How to Play
            </button>
            <button
              className="start-cta"
              onPointerDown={(e) => {
                e.stopPropagation();
                onUIButtonClick && onUIButtonClick();
                onOpenShop && onOpenShop();
              }}
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
              style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02))" }}
            >
              Shop
            </button>
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              className="btn-ghost"
              onClick={(e) => {
                e.stopPropagation();
                onUIButtonClick && onUIButtonClick();
                onToggleTheme && onToggleTheme();
              }}
            >
              🎨 Switch Theme
            </button>
          </div>

          <div className="hint">Press Space / Tap to start — or use the Play button</div>

          <div className="dev-note">This game is in development phase. Some bugs and faults may occur.</div>
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
  if (!open) return null;

  const items = [
    { id: "skin", title: "Character Skin", cost: 200, desc: "Change character color" },
    { id: "magnet", title: "Magnet Upgrade", cost: 300, desc: "Increase magnet duration" },
    { id: "shield", title: "Shield Upgrade", cost: 300, desc: "Increase shield duration" },
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
      <div className="shop-card" onClick={(e) => e.stopPropagation()} style={{ zIndex: 12001 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Shop</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ color: "#ffd166", fontWeight: 900 }}>Coins: {Math.max(0, Math.floor(coins || 0))}</div>
            <button
              className="btn-ghost"
              onClick={() => {
                onUIButtonClick && onUIButtonClick();
                onClose && onClose();
              }}
            >
              Close
            </button>
          </div>
        </div>

        <div className="shop-list">
          {items.map((it) => {
            const owned = !!(upgrades && upgrades[it.id]);
            const afford = (coins || 0) >= it.cost;
            return (
              <div className="shop-item" key={it.id}>
                <div className="meta" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.03)", display: "grid", placeItems: "center" }}>
                    {it.id === "skin" ? "🙂" : it.id === "magnet" ? "🧲" : "🛡️"}
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
                    {owned ? "Upgraded" : afford ? "Buy" : "Insufficient"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
  const [, setLevel] = useState(1);
  const levelRef = useRef(1);

  const missionRef = useRef(null);
  const [missionUI, setMissionUI] = useState({ short: "", desc: "", progress: "", percent: 0 });


  // counters used for missions
  const coinCountRef = useRef(0);
  const jumpCountRef = useRef(0);
  const slideCountRef = useRef(0);
  const levelStartTimeRef = useRef(0);
  const missionCompletedRef = useRef(false);
  const levelTransitioningRef = useRef(false);

  const playerRef = useRef(null);
  const speedRef = useRef(0.28); // slower start

  // Floating text & flash refs
  const spawnTextRef = useRef(null);       // set by FloatingTextsProvider context (wired by SpawnTextWire)
  const coinFlashCountRef = useRef(0);     // throttle coin flash to every 3rd collect
  const [nearMissFlash, setNearMissFlash] = useState(0); // increments to re-trigger CSS animation
  const [coinFlash, setCoinFlash] = useState(0);         // increments to re-trigger glow flash

  const audio = useGameAudio();
  const { playCoin, playPowerup, playJump, playSlide, playFall, playShield, playClick, playBgm, stopBgm } = audio;

  const magnetTimerRef = useRef(null);
  const shieldTimerRef = useRef(null);

  const [showLevelComplete, setShowLevelComplete] = useState(false);

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
    skin: false,
    magnet: false,
    shield: false,
  });

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

  function handleBuy(itemId, cost) {
    try {
      const owned = !!(upgrades && upgrades[itemId]);
      if (owned) return;
      const c = Math.max(0, Math.floor(Number(coinsRef.current || 0)));
      const price = Math.max(0, Math.floor(Number(cost || 0)));
      if (c < price) {
        try {
          alert("Not enough coins.");
        } catch {}
        return;
      }
      coinsRef.current = c - price;
      setCoinsTotal(coinsRef.current);
      localStorage.setItem("game_coins", String(coinsRef.current));

      const next = { ...(upgrades || {}), [itemId]: true };
      setUpgrades(next);
      try {
        localStorage.setItem("game_upgrades", JSON.stringify(next));
      } catch {}
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

  const activateHoverboard = useCallback(() => {
    hoverboardRef.current = true;
    setHoverboardActive(true);
  }, []);

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

    // Easy, quick-complete missions that rotate
    const missions = [
      { type: "coins", target: 25, desc: "Collect 25 coins", short: "Collect 25 coins" },
      { type: "jumps", target: 10, desc: "Clear 10 jump obstacles", short: "10 Jumps" },
      { type: "slides", target: 10, desc: "Clear 10 slide obstacles", short: "10 Slides" },
      { type: "time", target: 45, desc: "Survive 45 seconds", short: "Survive 45s" },
      { type: "slides_run", target: 5, desc: "Perform 5 slides in one run", short: "5 Slides" },
    ];
    
    const m = missions[(lv - 1) % missions.length];
    return { ...m, progress: 0 };
  }

  function finalizeMissionCompletion(m) {
    if (!m || missionCompletedRef.current) return;
    missionCompletedRef.current = true;

    const bonus = 100; // Flat rewarding bonus
    scoreRef.current = (scoreRef.current || 0) + bonus;
    setScore((s) => s + bonus);

    setMissionUI((cur) => ({ ...cur, short: "MISSION COMPLETE", progress: "✓" }));

    // Faster refresh for addictive feel
    setTimeout(() => {
      if (!levelTransitioningRef.current) {
        levelTransitioningRef.current = true;
        const nextLevel = Math.max(1, (levelRef.current || 1) + 1);
        setLevel(nextLevel);
        levelRef.current = nextLevel;
        startMissionForLevel(nextLevel);
        setTimeout(() => {
          levelTransitioningRef.current = false;
        }, 300);
      }
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

    // FIX 1: Use non-passive touchstart + touchmove to block page scroll/refresh
    function touchStart(e) {
      // Always prevent default to stop pull-to-refresh and page scroll
      try { e.preventDefault(); } catch {}
      const t = e.touches ? e.touches[0] : e;
      startX = t.clientX;
      startY = t.clientY;
    }
    function touchMove(e) {
      // Block all native scroll/overscroll during game
      try { e.preventDefault(); } catch {}
    }
    function touchEnd(e) {
      try { e.preventDefault(); } catch {}
      if (!started || gameOver || paused) return;
      const t = e.changedTouches ? e.changedTouches[0] : e;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const threshold = 32; // slightly more responsive

      if (absX > absY && absX > threshold) {
        if (dx > 0) laneRef.current = Math.min(laneRef.current + 1, 2);
        else laneRef.current = Math.max(laneRef.current - 1, 0);
      } else if (absY > absX && absY > threshold) {
        if (dy < 0) {
          triggerJump();
        } else {
          triggerSlide();
        }
      }
    }

    // passive: false is required to call preventDefault() on touch events
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
      // Base drift + score-based acceleration
      const baseAcceleration = 0.0012; 
      const performanceFactor = Math.min(0.002, s * 0.0000003);
      
      const perSecond = baseAcceleration + performanceFactor;

      const proposed = Math.min(MAX_SPEED, speedRef.current + perSecond * delta * 60);
      speedRef.current += (proposed - speedRef.current) * Math.min(1, 4 * delta);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(rafId);
    };
  }, [started, gameOver, paused]);

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
      scoreRef.current += delta * 14 * multiplierRef.current;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started, gameOver, paused]);

  function addScore(delta = 0, source = "") {
    scoreRef.current = (scoreRef.current || 0) + delta;

    if (source === "coin") {
      coinCountRef.current += 1;
      triggerCombo();

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
      } catch {}
    }
  }

  useEffect(() => {
    let id = null;
    const sync = () => {
      setScore(Math.max(0, Math.floor(scoreRef.current || 0)));
      setMultiplier(multiplierRef.current);
    };

    if (started && !gameOver) {
      id = setInterval(sync, 120);
    } else {
      sync();
    }

    return () => {
      if (id) clearInterval(id);
    };
  }, [started, gameOver]);

  useEffect(() => {
    if (gameOver) {
      setScore(Math.max(0, Math.floor(scoreRef.current || 0)));
      stopBgm && stopBgm();
    }
  }, [gameOver, stopBgm]);

  useEffect(() => {
    let id = null;
    id = setInterval(() => {
      const m = missionRef.current;
      if (!m || missionCompletedRef.current) return;

      if (m.type === "time") {
        const elapsed = Math.floor((Date.now() - levelStartTimeRef.current) / 1000);
        if (elapsed >= m.target) {
          finalizeMissionCompletion(m);
        }
      } else if (m.type === "mix") {
        const allDone = m.parts.every((p) => {
          if (p.type === "time") {
            const elapsed = Math.floor((Date.now() - levelStartTimeRef.current) / 1000);
            return elapsed >= p.target;
          }
          return (p.progress || 0) >= p.target;
        });
        if (allDone) finalizeMissionCompletion(m);
      }
    }, 400);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (magnetTimerRef.current) clearTimeout(magnetTimerRef.current);
      if (shieldTimerRef.current) clearTimeout(shieldTimerRef.current);
      magnetTimerRef.current = null;
      shieldTimerRef.current = null;
      if (doubleTimerRef.current) clearTimeout(doubleTimerRef.current);
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      doubleTimerRef.current = null;
    };
  }, []);

  const handleRetry = () => {
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
    speedRef.current = 0.28;

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
    setLevel(1);
    levelRef.current = 1;
    startMissionForLevel(1);
    missionCompletedRef.current = false;
  };

  const handleStart = () => {
    setStarted(true);
    setRestartKey((k) => k + 1);
    setLevel(1);
    levelRef.current = 1;
    startMissionForLevel(1);
    speedRef.current = 0.28;

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
    startMissionForLevel(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skinColors = useMemo(
    () =>
      upgrades?.skin
        ? { body: "#60a5fa", arm: "#4f46e5", head: "#ffd166", legs: "#0f172a" }
        : { body: "#ff4d6d", arm: "#ff7aa2", head: "#ffd166", legs: "#111827" },
    [upgrades?.skin]
  );

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


  // === BGM playback rate sync with speed (subtle, no distortion) ===
  // Runs separately so it doesn't interfere with speed logic
  useEffect(() => {
    if (!audio.bgmRef?.current) return;
    let rafId = 0;
    let running = true;
    const loop = () => {
      if (!running) return;
      rafId = requestAnimationFrame(loop);
      const bgm = audio.bgmRef?.current;
      if (!bgm || bgm.paused) return;
      // Map speed 0.28→1.85 to playbackRate 1.0→1.22 (very subtle — avoids pitch distortion)
      const spd = Math.max(0.28, Math.min(1.85, speedRef.current || 0.28));
      const t = (spd - 0.28) / (1.85 - 0.28);
      // Ease-in-out curve so early game feels normal
      const te = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const targetRate = 1.0 + te * 0.22;
      // Smooth lerp to avoid sudden jumps
      try {
        bgm.playbackRate += (targetRate - bgm.playbackRate) * 0.04;
      } catch {}
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      // Reset rate on cleanup
      try { if (audio.bgmRef?.current) audio.bgmRef.current.playbackRate = 1.0; } catch {}
    };
  }, [audio.bgmRef]);

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
            onUIButtonClick={playClick} 
            onToggleTheme={() => setShowThemePanel(v => !v)} 
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
            <BackgroundAnimations theme={THEMES[themeIndex]} />
            <Track playerRef={playerRef} theme={THEMES[themeIndex]} />
            <Obstacles
              playerRef={playerRef}
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
            />
            <Coins
              playerRef={playerRef}
              addScoreRef={addScoreRef}
              addCoinsRef={addCoinsRef}
              playCoinRef={playCoinRef}
              magnet={magnet}
              speedRef={speedRef}
              doubleActive={doubleActive}
            />
            <Boosters playerRef={playerRef} activateMagnetRef={activateMagnetRef} activateShieldRef={activateShieldRef} playShieldRef={playShieldRef} playPowerupRef={playPowerupRef} />

            <PowerUps playerRef={playerRef} activateDoubleRef={activateDoubleRef} activateHoverRef={activateHoverRef} playPowerupRef={playPowerupRef} />

            <SpeedLines playerRef={playerRef} speedRef={speedRef} />
            <RunnerFX playerRef={playerRef} speedRef={speedRef} crashSignal={crashSignal} />
            <CameraFollow playerRef={playerRef} speedRef={speedRef} crashFxRef={crashFxRef} />
          </group>
        )}
      </Canvas>

      {started && !gameOver && (
        <>
          <ModernHUD
            score={score}
            totalCoins={coinsTotal}
            runCoins={runCoins}
            paused={paused}
            onTogglePause={() => setPaused((p) => !p)}
            onUIButtonClick={playClick}
            onToggleTheme={() => setShowThemePanel(v => !v)}
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


      {showLevelComplete && !paused && !gameOver && (
        <div className="level-toast" aria-hidden>
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 16, color: "#fff", fontWeight: 900 }}>LEVEL {levelRef.current - 1} COMPLETE</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.86)", fontWeight: 700 }}>Advancing...</div>
          </div>
        </div>
      )}

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
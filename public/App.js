import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";

const LANES = [-2, 0, 2];

// ---------------- CHARACTER ----------------
function Character({
  laneRef,
  jumpRef,
  jumpTimerRef,
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

  useFrame((state, delta) => {
    if (!ref.current || gameOver) return;

    // smooth lane follow (frame-rate independent lerp)
    const laneIndex = laneRef?.current ?? 1;
    const targetX = LANES[laneIndex] ?? 0;
    const moveFactor = Math.min(1, 12 * delta);
    ref.current.position.x += (targetX - ref.current.position.x) * moveFactor;

    // forward motion based on speedRef (frame-rate independent)
    ref.current.position.z -= (speedRef.current || 0) * delta * 60;

    // jump - consume jump request once when on ground
    if (jumpRef?.current && ref.current.position.y <= 0.51) {
      vel.current = 0.52; // INCREASED JUMP HEIGHT
      jumpRef.current = false;
      if (jumpTimerRef?.current) {
        clearTimeout(jumpTimerRef.current);
        jumpTimerRef.current = null;
      }
    }

    // gravity
    vel.current -= 9.81 * delta * 0.6;
    ref.current.position.y += vel.current;

    // ground clamp
    if (ref.current.position.y < 0.5) {
      ref.current.position.y = 0.5;
      vel.current = 0;
    }

    // sliding/crouch visual smooth lerp
    const sliding = !!slideRef?.current;
    const targetScaleY = sliding ? 0.55 : 1;
    ref.current.scale.y += (targetScaleY - ref.current.scale.y) * 0.25;

    const targetY = sliding ? 0.35 : 0.5;
    ref.current.position.y += (targetY - ref.current.position.y) * 0.25;

    // limb swing (time-based, scaled by speed but clamped)
    const speedFactor = Math.max(0.8, Math.min(2.0, Math.abs(speedRef.current) * 2.2));
    swing.current += speedFactor * delta * 3.0;

    // legs
    if (ref.current.children[2]) ref.current.children[2].rotation.x = Math.sin(swing.current) * 0.6;
    if (ref.current.children[3]) ref.current.children[3].rotation.x = -Math.sin(swing.current) * 0.6;

    // hands
    if (ref.current.children[4]) ref.current.children[4].rotation.x = -Math.sin(swing.current) * 0.6;
    if (ref.current.children[5]) ref.current.children[5].rotation.x = Math.sin(swing.current) * 0.6;

    // when sliding, tuck arms
    if (sliding) {
      if (ref.current.children[4]) ref.current.children[4].rotation.x = -0.9;
      if (ref.current.children[5]) ref.current.children[5].rotation.x = -0.9;
    }

    // publish position for camera/collisions (use single object reference)
    if (!playerRef.current) playerRef.current = { x: 0, y: 0.5, z: 0 };
    playerRef.current.x = ref.current.position.x;
    playerRef.current.y = ref.current.position.y;
    playerRef.current.z = ref.current.position.z;
  });

  return (
    <group ref={ref} position={[0, 0.5, 0]}>
      {/* body */}
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[0.5, 1, 0.35]} />
        <meshStandardMaterial color={skinColors?.body || "#ff4d6d"} />
      </mesh>

      {/* head */}
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.32]} />
        <meshStandardMaterial color={skinColors?.head || "#ffd166"} />
      </mesh>

      {/* left leg */}
      <mesh position={[-0.15, 0.2, 0]}>
        <boxGeometry args={[0.2, 0.6, 0.2]} />
        <meshStandardMaterial color={skinColors?.legs || "#111827"} />
      </mesh>

      {/* right leg */}
      <mesh position={[0.15, 0.2, 0]}>
        <boxGeometry args={[0.2, 0.6, 0.2]} />
        <meshStandardMaterial color={skinColors?.legs || "#111827"} />
      </mesh>

      {/* left arm */}
      <mesh position={[-0.42, 0.9, 0]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color={skinColors?.arm || "#ff7aa2"} />
      </mesh>

      {/* right arm */}
      <mesh position={[0.42, 0.9, 0]}>
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
}

// ---------------- CAMERA ---------------- FIXED CAMERA - NO DYNAMIC ANGLE, ALWAYS FOLLOW PLAYER
function CameraFollow({ playerRef }) {
  const { camera } = useThree();
  const posTarget = useRef(new THREE.Vector3());
  const lookTarget = useRef(new THREE.Vector3());

  // initialize camera position
  useEffect(() => {
    camera.position.set(0, 4.5, 8);
    lookTarget.current.set(0, 1, -3);
    camera.lookAt(lookTarget.current);
  }, [camera]);

  useFrame((state, delta) => {
    if (!playerRef.current) return;

    // FIXED CAMERA POSITION RELATIVE TO PLAYER - NO ZOOM, NO ANGLE CHANGE
    const baseY = playerRef.current.y + 4.5;
    const baseZ = playerRef.current.z + 8;
    const baseX = 0; // Always centered, no lateral camera movement

    posTarget.current.set(baseX, baseY, baseZ);

    // SMOOTH LERP FOLLOW - STABLE NO SHAKE
    const lerpFactor = 1 - Math.exp(-5 * delta);
    camera.position.lerp(posTarget.current, lerpFactor);

    // ALWAYS LOOK DIRECTLY AT PLAYER WITH FIXED OFFSET
    lookTarget.current.set(
      playerRef.current.x,
      playerRef.current.y + 1.2,
      playerRef.current.z - 3
    );

    camera.lookAt(lookTarget.current);
  });

  return null;
}

// ---------------- TRACK & ENVIRONMENT (colorful walls) ----------------
function Track({ playerRef }) {
  const tiles = useRef(Array.from({ length: 20 }, (_, i) => ({ z: -i * 18 })));

  useFrame(() => {
    if (!playerRef.current) return;
    const pz = playerRef.current.z;
    tiles.current.forEach((t) => {
      if (t.z > pz + 26) t.z -= 20 * 18;
    });
  });

  return (
    <>
      {tiles.current.map((t, i) => (
        <group key={i} position={[0, 0, t.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <planeGeometry args={[14, 18]} />
            <meshStandardMaterial color={i % 2 ? "#fff7ed" : "#dbeafe"} />
          </mesh>

          {/* left wall panel - bright colorful base */}
          <group position={[-6.4, 1.6, 0]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.4, 3.4, 18]} />
              <meshStandardMaterial color={i % 2 ? "#f0f9ff" : "#fffbeb"} />
            </mesh>
            <mesh position={[0.6, 0.5, -4]}>
              <boxGeometry args={[1.4, 1.6, 0.12]} />
              <meshStandardMaterial color={i % 3 === 0 ? "#ffb4c6" : i % 3 === 1 ? "#7dd3fc" : "#fde68a"} />
            </mesh>
            <mesh position={[0.6, -0.6, 3]}>
              <boxGeometry args={[1.2, 1.1, 0.12]} />
              <meshStandardMaterial color={i % 2 ? "#86efac" : "#fb7185"} />
            </mesh>
          </group>

          {/* right wall panel - bright colorful base */}
          <group position={[6.4, 1.6, 0]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.4, 3.4, 18]} />
              <meshStandardMaterial color={i % 2 ? "#fff7ed" : "#e6fffb"} />
            </mesh>
            <mesh position={[-0.6, 0.5, -1]}>
              <boxGeometry args={[1.4, 1.6, 0.12]} />
              <meshStandardMaterial color={i % 3 === 0 ? "#7dd3fc" : i % 3 === 1 ? "#ffb4c6" : "#86efac"} />
            </mesh>
            <mesh position={[-0.6, -0.6, 4]}>
              <boxGeometry args={[1.2, 1.1, 0.12]} />
              <meshStandardMaterial color={i % 2 ? "#fde68a" : "#fb7185"} />
            </mesh>
          </group>

          {/* occasional banner */}
          {i % 5 === 0 && (
            <group position={[0, 2.6, -7]}>
              <mesh>
                <boxGeometry args={[9.2, 0.22, 1.8]} />
                <meshStandardMaterial color="#ffb703" />
              </mesh>
            </group>
          )}

          {/* small props */}
          <group position={[0, 0.35, 5]}>
            <mesh position={[-4.2, 0.45, -1]}>
              <cylinderGeometry args={[0.12, 0.12, 0.8, 12]} />
              <meshStandardMaterial color="#fb923c" />
            </mesh>
            <mesh position={[4.2, 0.55, 2]}>
              <boxGeometry args={[0.8, 0.6, 0.6]} />
              <meshStandardMaterial color="#60a5fa" />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}

// ---------------- SOUND (safe audio probing and error handling) ----------------
function useGameAudio() {
  const coinRef = useRef(null);
  const fallRef = useRef(null);
  const shieldRef = useRef(null);
  const unlockedRef = useRef(false);

  useEffect(() => {
    const unlock = async () => {
      const probe = async (path) => {
        try {
          const res = await fetch(path, { method: "HEAD" });
          if (!res.ok) return false;
          const a = document.createElement("audio");
          const can =
            a.canPlayType &&
            (a.canPlayType("audio/mpeg") || a.canPlayType("audio/mp3") || a.canPlayType("audio/wav"));
          return !!can;
        } catch {
          return false;
        }
      };

      try {
        const coinOk = await probe("/coin.mp3");
        if (coinOk) {
          coinRef.current = new Audio();
          coinRef.current.src = "/coin.mp3";
          coinRef.current.preload = "auto";
          coinRef.current.addEventListener("error", () => {
            coinRef.current = null;
          });
        }

        const fallOk = await probe("/fall.mp3");
        if (fallOk) {
          fallRef.current = new Audio();
          fallRef.current.src = "/fall.mp3";
          fallRef.current.preload = "auto";
          fallRef.current.addEventListener("error", () => {
            fallRef.current = null;
          });
        }

        const shieldOk = await probe("/shield.mp3");
        if (shieldOk) {
          shieldRef.current = new Audio();
          shieldRef.current.src = "/shield.mp3";
          shieldRef.current.preload = "auto";
          shieldRef.current.addEventListener("error", () => {
            shieldRef.current = null;
          });
        }
      } catch {
        // ignore
      } finally {
        unlockedRef.current = true;
        window.removeEventListener("click", unlock);
      }
    };

    window.addEventListener("click", unlock, { once: true });
    return () => window.removeEventListener("click", unlock);
  }, []);

  const safePlay = (audioRef) => {
    try {
      if (!audioRef || !audioRef.current) return;
      audioRef.current.currentTime = 0;
      const p = audioRef.current.play();
      if (p && p.catch) p.catch(() => {});
    } catch {
      // ignore
    }
  };

  // return refs so parent can bind stable functions
  return {
    refs: { coinRef, fallRef, shieldRef },
    playCoin: () => safePlay(coinRef),
    playFall: () => safePlay(fallRef),
    playShield: () => safePlay(shieldRef),
  };
}

// ---------------- COINS ----------------
function Coins({ playerRef, addScoreRef, addCoinsRef, playCoinRef, magnet, speedRef, doubleActive }) {
  const coins = useRef(
    Array.from({ length: 8 }, () => ({
      x: LANES[Math.floor(Math.random() * 3)],
      z: -Math.random() * 360 - 40,
      rot: Math.random() * Math.PI * 2,
    }))
  );

  useFrame((state, delta) => {
    if (!playerRef.current) return;
    const speed = speedRef.current ?? 0.28;
    const pz = playerRef.current.z;

    coins.current.forEach((c) => {
      // magnet attraction (smoothed)
      if (magnet && Math.abs(c.z - pz) < 8) {
        c.x += (playerRef.current.x - c.x) * 0.18;
        c.z += (playerRef.current.z - c.z) * 0.18;
      }

      const dx = Math.abs(c.x - playerRef.current.x);
      const dz = Math.abs(c.z - pz);

      // rotate coin (frame-rate independent, slight speed influence)
      const rotSpeed = 0.06 + Math.max(0, (Math.abs(speed) - 0.28) * 0.02);
      c.rot += rotSpeed * Math.min(1, 60 * delta);

      if (dx < 0.9 && dz < 0.9) {
        playCoinRef?.current && playCoinRef.current();
        addScoreRef?.current && addScoreRef.current(doubleActive ? 20 : 10, "coin");
        // increment persistent coin count (1 coin per pickup)
        addCoinsRef
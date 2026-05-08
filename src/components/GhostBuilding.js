import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import * as THREE from "three";

export function GhostBuilding({ motion, distance }) {
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current) {
      // 1. ANCHORING LOGIC
      const buildingHeight = 45;
      const groundLevel = -1.6 + buildingHeight / 2;

      // TILT PROTECTION
      const pitchOffset = Math.max(
        Math.min((motion.beta || 0) - 1.2, 0.4),
        -0.4,
      );

      meshRef.current.position.set(
        0,
        groundLevel - pitchOffset * 10,
        -distance,
      );

      // 2. SKY-FADE LOGIC (The Reset)
      // If motion.beta goes toward 0 (pointing at sky), we fade the building out
      if (meshRef.current.material) {
        const skyLimit = Math.max(0, Math.min(1, motion.beta - 0.5));
        const flicker = 0.25 + Math.sin(Date.now() * 0.002) * 0.1;
        meshRef.current.material.opacity = flicker * skyLimit;
      }
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[25, 45, 30]} />
      <meshBasicMaterial
        color="#00ffff"
        wireframe={true}
        transparent={true}
        opacity={0.3}
      />
    </mesh>
  );
}

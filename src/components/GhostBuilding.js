import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import * as THREE from "three";

export function GhostBuilding({ motion, distance }) {
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current) {
      // 1. DYNAMIC GROUNDING WITH TILT PROTECTION
      const groundLevel = -1.6;
      // Limits how much looking down 'drags' the building into your feet
      const pitchOffset = Math.max(
        Math.min((motion.beta || 0) - 1.2, 0.4),
        -0.4,
      );

      meshRef.current.position.set(
        0,
        groundLevel - pitchOffset * 10,
        -distance,
      );

      // 2. SPECTRAL ANIMATION
      if (meshRef.current.material) {
        meshRef.current.material.opacity =
          0.25 + Math.sin(Date.now() * 0.002) * 0.1;
      }
    }
  });

  return (
    <mesh ref={meshRef}>
      {/* 3. SCALE: Neo-Gothic Church Dimensions */}
      <boxGeometry args={[35, 45, 40]} />
      <meshBasicMaterial
        color="#00ffff"
        wireframe={true}
        transparent={true}
        opacity={0.3}
      />
    </mesh>
  );
}

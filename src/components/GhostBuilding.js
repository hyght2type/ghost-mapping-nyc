import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import * as THREE from "three";

export function GhostBuilding({ motion, distance }) {
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current) {
      // 1. ABSOLUTE GROUNDING
      const buildingHeight = 45;
      const basePosition = -1.6;
      const centerPosition = basePosition + buildingHeight / 2;

      // 2. STABILIZED HORIZON
      // Prevents the model from "crunching" into the ground when you tilt
      const pitchOffset = Math.max(
        Math.min((motion.beta || 0) - 1.2, 0.4),
        -0.4,
      );
      meshRef.current.position.set(
        0,
        centerPosition - pitchOffset * 10,
        -distance,
      );

      // 3. VISUAL FADE
      // Fades out if you look too far down or up
      if (meshRef.current.material) {
        const pitch = motion.beta || 0;
        const visibility = Math.max(0, Math.min(1, (pitch - 0.6) * 2));
        const flicker = 0.2 + Math.sin(Date.now() * 0.002) * 0.05;
        meshRef.current.material.opacity = flicker * visibility;
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

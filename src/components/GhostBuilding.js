import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import * as THREE from "three";

export function GhostBuilding({ motion, distance }) {
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current) {
      // 1. ANCHORING FOR A SKYSCRAPER/STADIUM SCALE
      // NY Life is ~180m tall, MSG II was ~90m with the tower.
      const buildingHeight = 120;
      const basePosition = -1.6;
      const centerPosition = basePosition + buildingHeight / 2;

      // 2. HORIZON STABILIZATION
      // We clamp the pitch so the building doesn't "slide" down the street
      const pitchOffset = Math.max(
        Math.min((motion.beta || 0) - 1.57, 0.3),
        -0.3,
      );

      meshRef.current.position.set(
        0,
        centerPosition - pitchOffset * 20,
        -distance,
      );

      if (meshRef.current.material) {
        // Only show if looking toward the horizon (motion.beta ~ 1.57)
        const visibility = Math.max(
          0,
          Math.min(1, 1 - Math.abs(motion.beta - 1.57)),
        );
        meshRef.current.material.opacity = 0.4 * visibility;
      }
    }
  });

  return (
    <mesh ref={meshRef}>
      {/* MSG II Footprint: Massive 60m x 130m block */}
      <boxGeometry args={[80, 120, 150]} />
      <meshBasicMaterial
        color="#00ffff"
        wireframe={true}
        transparent={true}
        opacity={0.3}
      />
    </mesh>
  );
}

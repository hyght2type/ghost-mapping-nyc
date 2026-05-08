import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import * as THREE from "three";

export function GhostBuilding({ motion, distance }) {
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current) {
      // THE ANCHOR FIX:
      // Half the height (22.5m) plus the ground offset (-1.6m)
      const buildingHeight = 45;
      const groundLevel = -1.6 + buildingHeight / 2;

      // TILT PROTECTION: Prevents the building from flying away when looking down
      const pitchOffset = Math.max(
        Math.min((motion.beta || 0) - 1.2, 0.4),
        -0.4,
      );

      meshRef.current.position.set(
        0,
        groundLevel - pitchOffset * 10,
        -distance,
      );

      // SPECTRAL FLICKER
      if (meshRef.current.material) {
        meshRef.current.material.opacity =
          0.25 + Math.sin(Date.now() * 0.002) * 0.1;
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

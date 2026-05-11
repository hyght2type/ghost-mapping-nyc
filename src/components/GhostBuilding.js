import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";

export function GhostBuilding({ distance }) {
  const meshRef = useRef();

  // Gentle floating animation to mimic AR holographic projection
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.2;
    }
  });

  // Calculate dynamic scale based on distance
  const scale = Math.max(0.5, 15 / Math.max(1, distance));

  return (
    <mesh
      ref={meshRef}
      position={[0, -1, -distance / 2]}
      scale={[scale, scale, scale]}
    >
      {/* Tall rectangular shape mimicking a historical tower or structure */}
      <boxGeometry args={[4, 12, 4]} />
      <meshStandardMaterial
        color="#00ffff"
        wireframe={true}
        transparent={true}
        opacity={0.6}
        emissive="#00ffff"
        emissiveIntensity={0.8}
      />
    </mesh>
  );
}

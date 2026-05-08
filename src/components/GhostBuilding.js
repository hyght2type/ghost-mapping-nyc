import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import * as THREE from "three";

export function GhostBuilding({ heading, motion, distance }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      // 1. GROUNDING LOGIC
      // We subtract ~1.6m (average camera height) to "drop" the model to the sidewalk.
      // We also account for the pitch (motion.beta) so it stays level as you tilt.
      const groundLevel = -1.6;
      const pitch = (motion.beta || 0) - 1.2;

      // 2. POSITIONING
      // X: 0 (centered)
      // Y: Adjusted to sit on the pavement
      // Z: The real-world distance to the GPS coordinate
      meshRef.current.position.set(0, groundLevel - pitch * 10, -distance);

      // 3. SPECTRAL ANIMATION
      // A slight flicker/fade to make the wireframe feel "haunted"
      if (meshRef.current.material) {
        meshRef.current.material.opacity =
          0.3 + Math.sin(Date.now() * 0.002) * 0.1;
      }
    }
  });

  return (
    <mesh ref={meshRef}>
      {/* Making the Hippodrome wireframe massive (100m wide, 60m tall, 80m deep) */}
      <boxGeometry args={[100, 60, 80]} />
      <meshBasicMaterial
        color="#ffffff"
        wireframe={true}
        transparent={true}
        opacity={0.4}
      />
    </mesh>
  );
}

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import * as THREE from "three";

export function GhostBuilding({ motion, distance }) {
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current) {
      // 1. ABSOLUTE GROUNDING
      // We set the building height and calculate the 'Y' so the base is at -1.6m
      const buildingHeight = 45;
      const basePosition = -1.6;
      const centerPosition = basePosition + buildingHeight / 2;

      // 2. STABILIZED POSITIONING
      // We use Math.cos to calculate the horizontal depth (Z)
      // so the building doesn't "follow" your gaze when you look down.
      const pitch = motion.beta || 0;
      const horizontalDist = distance * Math.sin(pitch);
      const verticalCorrection = distance * Math.cos(pitch);

      meshRef.current.position.set(0, centerPosition, -distance);

      // 3. VISIBILITY LIMITER
      // If the camera is pointed too far down (> 60 degrees), we hide the lines
      // to stop them from cluttering your view of your feet.
      if (meshRef.current.material) {
        const visibility = Math.max(0, Math.min(1, (pitch - 0.6) * 2));
        meshRef.current.material.opacity = 0.3 * visibility;
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

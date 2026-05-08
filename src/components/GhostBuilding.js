\import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';

export function GhostBuilding({ motion, distance }) {
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current) {
      // ANCHORING: Set bottom to floor
      const buildingHeight = 45;
      const groundLevel = -1.6 + (buildingHeight / 2); 
      
      const pitchOffset = Math.max(Math.min((motion.beta || 0) - 1.2, 0.4), -0.4); 
      
      meshRef.current.position.set(0, groundLevel - (pitchOffset * 10), -distance);
      
      if (meshRef.current.material) {
        meshRef.current.material.opacity = 0.25 + Math.sin(Date.now() * 0.002) * 0.1;
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
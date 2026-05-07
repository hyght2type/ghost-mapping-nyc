import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";

export function GhostBuilding({ heading, motion, distance }) {
  const groupRef = useRef();
  const TOWER_HEIGHT = 150;
  const FLOORS = 12;
  const WIDTH = 25;

  useFrame((state) => {
    if (groupRef.current) {
      // Atmospheric pulse effect
      const pulse = 0.4 + Math.sin(state.clock.elapsedTime * 1.5) * 0.2;
      groupRef.current.traverse((obj) => {
        if (obj.isMesh) obj.material.opacity = pulse;
      });
    }
  });

  return (
    <group
      rotation={[-motion.beta + Math.PI / 2, (-heading * Math.PI) / 180, 0]}
      rotation-order="YXZ"
    >
      {/* CRITICAL UPDATE: 
          The 'distance' prop from App.js is used for the Z-axis.
          This makes the building sit exactly on its real GPS coordinate.
      */}
      <group ref={groupRef} position={[0, 0, distance]}>
        {/* CORNER COLUMNS */}
        {[-WIDTH / 2, WIDTH / 2].map((x) =>
          [-WIDTH / 2, WIDTH / 2].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, TOWER_HEIGHT / 2, z]}>
              <cylinderGeometry args={[0.5, 0.5, TOWER_HEIGHT]} />
              <meshStandardMaterial
                color="#ffffff"
                transparent
                opacity={0.5}
                emissive="#00ffff"
              />
            </mesh>
          )),
        )}

        {/* FLOOR PLATES */}
        {Array.from({ length: FLOORS }).map((_, i) => (
          <mesh key={i} position={[0, (TOWER_HEIGHT / FLOORS) * i, 0]}>
            <boxGeometry args={[WIDTH, 0.2, WIDTH]} />
            <meshStandardMaterial
              color="#ffffff"
              transparent
              opacity={0.3}
              wireframe
            />
          </mesh>
        ))}
      </group>

      {/* Atmospheric Floor Grid remains centered on the user */}
      <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <gridHelper args={[2000, 40, 0x00ffff, 0x111111]} />
      </mesh>
    </group>
  );
}

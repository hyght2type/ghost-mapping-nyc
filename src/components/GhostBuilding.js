import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";

export function GhostBuilding({ distance, siteId, isCaptured }) {
  const meshRef = useRef();

  // Gentle floating and spinning animation
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.2 - 1;
      // If captured, it spins faster to show containment
      meshRef.current.rotation.y += isCaptured ? 0.02 : 0.005;
    }
  });

  const scale = Math.max(0.5, 15 / Math.max(1, distance));
  const glowColor = isCaptured ? "#ffd700" : "#00ffff"; // Gold if captured, Cyan if scanning

  // Render different geometry based on the historical site
  const renderGeometry = () => {
    switch (siteId) {
      case "ny-life":
        // Stanford White's MSG II Tower (Tall, imposing)
        return (
          <group>
            <mesh position={[0, 4, 0]}>
              <cylinderGeometry args={[0, 2, 8, 4]} />
              <meshStandardMaterial
                color={glowColor}
                wireframe={true}
                transparent={true}
                opacity={0.6}
                emissive={glowColor}
                emissiveIntensity={0.8}
              />
            </mesh>
            <mesh position={[0, -2, 0]}>
              <boxGeometry args={[4, 8, 4]} />
              <meshStandardMaterial
                color={glowColor}
                wireframe={true}
                transparent={true}
                opacity={0.6}
                emissive={glowColor}
                emissiveIntensity={0.8}
              />
            </mesh>
          </group>
        );
      case "grand-central":
        // Beaux-Arts Vaulted Hall (Wide, arched)
        return (
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[5, 5, 10, 16, 1, false, 0, Math.PI]} />
            <meshStandardMaterial
              color={glowColor}
              wireframe={true}
              transparent={true}
              opacity={0.6}
              emissive={glowColor}
              emissiveIntensity={0.8}
            />
          </mesh>
        );
      case "st-stephens":
      default:
        // Romanesque Revival (Blocky, sturdy)
        return (
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[5, 10, 6]} />
            <meshStandardMaterial
              color={glowColor}
              wireframe={true}
              transparent={true}
              opacity={0.6}
              emissive={glowColor}
              emissiveIntensity={0.8}
            />
          </mesh>
        );
    }
  };

  return (
    <group
      ref={meshRef}
      position={[0, 0, -distance / 2]}
      scale={[scale, scale, scale]}
    >
      {renderGeometry()}
    </group>
  );
}

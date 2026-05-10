import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Text, StatusBar, Animated } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Canvas } from "@react-three/fiber/native";
import { Magnetometer } from "expo-sensors";
import * as Location from "expo-location";

import { GhostBuilding } from "./src/components/GhostBuilding";
import { NavigationHUD } from "./src/components/NavigationHUD";

const GHOST_SITES = [
  {
    id: "ny-life",
    name: "NY LIFE / MSG II",
    coords: { latitude: 40.7427, longitude: -73.9856 },
    year: "1890",
    architect: "Stanford White",
    fact: "Former site of the second Madison Square Garden.",
  },
  {
    id: "st-stephens",
    name: "ST. STEPHEN'S CHURCH",
    coords: { latitude: 40.7421, longitude: -73.9798 },
    year: "1854",
    architect: "James Renwick Jr.",
    fact: "Renwick's first major commission; contains Brumidi murals.",
  },
  {
    id: "grand-central",
    name: "GRAND CENTRAL TERMINAL",
    coords: { latitude: 40.7527, longitude: -73.9772 },
    year: "1913",
    architect: "Reed and Stem",
    fact: "The celestial ceiling mural is actually painted backwards.",
  },
];

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [userLoc, setUserLoc] = useState(null);
  const [vpsHeading, setVpsHeading] = useState(0);
  const [magHeading, setMagHeading] = useState(0);
  const [vpsAccuracy, setVpsAccuracy] = useState(100);
  const [activeTarget, setActiveTarget] = useState(GHOST_SITES[1]);
  const [distanceToTarget, setDistanceToTarget] = useState(100);

  // WAYFINDER STATE (Isolated from North)
  const [wayfinderRotation, setWayfinderRotation] = useState(0);
  const [turnInstruction, setTurnInstruction] = useState("SCANNING");

  const lastHeadingRef = useRef(0);
  const wayfinderSmoothRef = useRef(0);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain)
      requestPermission();

    Magnetometer.setUpdateInterval(40);
    const magSub = Magnetometer.addListener((data) => {
      // 1. GOLDEN NORTH COMPASS (Strict Mapping)
      let angle = Math.atan2(data.z, -data.x) * (180 / Math.PI);
      let trueHeading = (angle + 360 + 13.0) % 360;
      lastHeadingRef.current = trueHeading;
      setMagHeading(trueHeading);

      // 2. WAYFINDER DAMPING (The "Water" feel - Isolated)
      const wayfinderDamping = 0.88;
      wayfinderSmoothRef.current =
        wayfinderSmoothRef.current * wayfinderDamping +
        trueHeading * (1 - wayfinderDamping);
    });

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 0.1,
          },
          (loc) => {
            setUserLoc(loc.coords);
            setVpsAccuracy(loc.coords.accuracy || 100);
            if (loc.coords.heading !== null) setVpsHeading(loc.coords.heading);
          },
        );
      }
    })();

    return () => magSub.remove();
  }, [permission]);

  useEffect(() => {
    if (!userLoc || !activeTarget) return;

    // Calculate Bearing & Distance
    const dy = activeTarget.coords.latitude - userLoc.latitude;
    const dx =
      Math.cos((userLoc.latitude * Math.PI) / 180) *
      (activeTarget.coords.longitude - userLoc.longitude);
    const bearing = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;

    // Relative rotation for the floating Wayfinder disc
    let relativeHeading = (bearing - wayfinderSmoothRef.current + 360) % 360;
    setWayfinderRotation(relativeHeading);

    // Turn-by-Turn Logic
    let diff = bearing - lastHeadingRef.current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    if (Math.abs(diff) < 20) setTurnInstruction("TARGET LOCKED");
    else if (diff < 0) setTurnInstruction("◀ TURN LEFT");
    else setTurnInstruction("TURN RIGHT ▶");

    const distY = (activeTarget.coords.latitude - userLoc.latitude) * 111320;
    const distX =
      (activeTarget.coords.longitude - userLoc.longitude) *
      (111320 * Math.cos((userLoc.latitude * Math.PI) / 180));
    setDistanceToTarget(Math.sqrt(distX * distX + distY * distY));
  }, [userLoc, magHeading]);

  if (!permission?.granted)
    return (
      <View style={styles.load}>
        <Text style={styles.loadText}>INITIALIZING...</Text>
      </View>
    );

  const isVpsLocked = vpsAccuracy < 45;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={StyleSheet.absoluteFill}>
        <CameraView style={{ flex: 1 }} facing="back" active={true} />
      </View>

      {/* 3D AR LAYER - Pinned to ground level */}
      {vpsAccuracy < 90 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Canvas gl={{ alpha: true }} camera={{ fov: 45 }}>
            <ambientLight intensity={1.5} />
            {/* Clamp distance so lines don't fly past you when you are 10ft away */}
            <GhostBuilding distance={Math.max(4, distanceToTarget)} />
          </Canvas>
        </View>
      )}

      {/* FIXED INFO BOX: Forced visible when close (under 40m) */}
      {distanceToTarget < 40 && (
        <View style={styles.infoPanel} pointerEvents="none">
          <Text style={styles.infoTitle}>{activeTarget.name}</Text>
          <Text style={styles.infoMeta}>
            {activeTarget.year} | {activeTarget.architect}
          </Text>
          <Text style={styles.infoFact}>{activeTarget.fact}</Text>
        </View>
      )}

      {/* GOLDEN HUD (North Compass) */}
      <NavigationHUD
        vpsHeading={vpsHeading}
        magHeading={magHeading}
        target={activeTarget}
        userLoc={userLoc}
        isApiLocked={isVpsLocked}
        distance={distanceToTarget}
      />

      {/* FLOATING WAYFINDER (Target Compass) */}
      <View style={styles.wayfinderLayer} pointerEvents="none">
        <View style={styles.compassBase}>
          <View style={styles.lubberLine} />
          <View
            style={[
              styles.floatingDisc,
              { transform: [{ rotate: `${wayfinderRotation}deg` }] },
            ]}
          >
            <Text style={styles.targetIcon}>✦</Text>
            <Text style={styles.targetLabel}>TARGET</Text>
          </View>
        </View>
        <View
          style={[styles.instructionPill, isVpsLocked && styles.pillActive]}
        >
          <Text style={styles.instructionText}>{turnInstruction}</Text>
          <Text style={styles.distanceText}>
            {Math.round(distanceToTarget)}m to entrance
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  load: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  loadText: {
    color: "#00ffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },

  // INFO BOX
  infoPanel: {
    position: "absolute",
    bottom: 380,
    alignSelf: "center",
    width: "85%",
    backgroundColor: "rgba(0,0,0,0.95)",
    padding: 20,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "#00ffff",
    zIndex: 6000,
  },
  infoTitle: {
    color: "#00ffff",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 5,
  },
  infoMeta: {
    color: "#fff",
    fontSize: 10,
    opacity: 0.6,
    marginBottom: 10,
    letterSpacing: 1,
  },
  infoFact: { color: "#fff", fontSize: 12, lineHeight: 18 },

  // WAYFINDER UI
  wayfinderLayer: {
    position: "absolute",
    bottom: 150,
    alignSelf: "center",
    alignItems: "center",
    zIndex: 5000,
  },
  compassBase: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderWidth: 1,
    borderColor: "rgba(0,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  lubberLine: {
    position: "absolute",
    top: 0,
    width: 4,
    height: 15,
    backgroundColor: "#ff3333",
    zIndex: 10,
    borderRadius: 2,
  },
  floatingDisc: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(0,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  targetIcon: { color: "#00ffff", fontSize: 32, fontWeight: "bold" },
  targetLabel: {
    color: "#00ffff",
    fontSize: 8,
    fontWeight: "900",
    marginTop: 2,
  },

  instructionPill: {
    marginTop: 15,
    backgroundColor: "rgba(0,0,0,0.9)",
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
  },
  pillActive: { borderColor: "#00ffff" },
  instructionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
  distanceText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
    fontWeight: "bold",
    marginTop: 2,
  },
});

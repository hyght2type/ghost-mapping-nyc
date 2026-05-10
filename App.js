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
  },
  {
    id: "st-stephens",
    name: "ST. STEPHEN'S CHURCH",
    coords: { latitude: 40.7421, longitude: -73.9798 },
  },
  {
    id: "grand-central",
    name: "GRAND CENTRAL TERMINAL",
    coords: { latitude: 40.7527, longitude: -73.9772 },
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

  // WAYFINDER SPECIFIC STATE
  const [wayfinderRotation, setWayfinderRotation] = useState(0);
  const [turnInstruction, setTurnInstruction] = useState("SCANNING");

  const lastHeadingRef = useRef(0);
  const wayfinderSmoothRef = useRef(0);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain)
      requestPermission();

    Magnetometer.setUpdateInterval(40);
    const magSub = Magnetometer.addListener((data) => {
      // 1. ORIGINAL COMPASS LOGIC (Leave Alone)
      let angle = Math.atan2(data.z, -data.x) * (180 / Math.PI);
      let trueHeading = (angle + 360 + 13.0) % 360;
      lastHeadingRef.current = trueHeading;
      setMagHeading(trueHeading);

      // 2. ISOLATED WAYFINDER LOGIC (The "Water" feel)
      // This damping is separate from the main compass to create that legacy lag.
      const wayfinderDamping = 0.85;
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

  // WAYFINDER CALCULATION ENGINE
  useEffect(() => {
    if (!userLoc || !activeTarget) return;

    // Calculate Bearing to Building
    const dy = activeTarget.coords.latitude - userLoc.latitude;
    const dx =
      Math.cos((userLoc.latitude * Math.PI) / 180) *
      (activeTarget.coords.longitude - userLoc.longitude);
    const bearing = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;

    // Calculate relative rotation (How far are we from looking at it?)
    let relativeHeading = (bearing - wayfinderSmoothRef.current + 360) % 360;
    setWayfinderRotation(relativeHeading);

    // Logic for the Turn-by-Turn Text
    let diff = bearing - lastHeadingRef.current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    if (Math.abs(diff) < 20) setTurnInstruction("TARGET LOCKED");
    else if (diff < 0) setTurnInstruction("◀ TURN LEFT");
    else setTurnInstruction("TURN RIGHT ▶");

    // Distance calculation
    const distY = (activeTarget.coords.latitude - userLoc.latitude) * 111320;
    const distX =
      (activeTarget.coords.longitude - userLoc.longitude) *
      (111320 * Math.cos((userLoc.latitude * Math.PI) / 180));
    setDistanceToTarget(Math.sqrt(distX * distX + distY * distY));
  }, [userLoc, magHeading]);

  if (!permission?.granted)
    return (
      <View style={styles.load}>
        <Text style={styles.loadText}>INITIALIZING WAYFINDER...</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={StyleSheet.absoluteFill}>
        <CameraView style={{ flex: 1 }} facing="back" active={true} />
      </View>

      {/* GOLDEN HUD (Upper Right Compass Stays Untouched) */}
      <NavigationHUD
        vpsHeading={vpsHeading}
        magHeading={magHeading}
        target={activeTarget}
        userLoc={userLoc}
        isApiLocked={vpsAccuracy < 35}
        distance={distanceToTarget}
      />

      {/* NEW: ISOLATED FLOATING WAYFINDER (Center) */}
      <View style={styles.wayfinderLayer} pointerEvents="none">
        <View style={styles.compassBase}>
          {/* Static Sight: The physical "lubber line" of the ship */}
          <View style={styles.lubberLine} />

          {/* Floating Disc: This represents the Building's direction */}
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

        {/* Turn-by-Turn Wayfinder Text */}
        <View style={styles.instructionPill}>
          <Text style={styles.instructionText}>{turnInstruction}</Text>
          <Text style={styles.distanceText}>
            {Math.round(distanceToTarget)}m
          </Text>
        </View>
      </View>

      {/* 3D AR LAYER */}
      {vpsAccuracy < 35 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Canvas gl={{ alpha: true }} camera={{ fov: 45 }}>
            <ambientLight intensity={1.5} />
            <GhostBuilding distance={15} />
          </Canvas>
        </View>
      )}
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

  // WAYFINDER UI
  wayfinderLayer: {
    position: "absolute",
    bottom: 180,
    alignSelf: "center",
    alignItems: "center",
  },
  compassBase: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderWidth: 2,
    borderColor: "rgba(0,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  lubberLine: {
    position: "absolute",
    top: 0,
    width: 4,
    height: 20,
    backgroundColor: "#ff3333",
    zIndex: 10,
    borderRadius: 2,
  },
  floatingDisc: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(0,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,255,255,0.1)",
  },
  targetIcon: { color: "#00ffff", fontSize: 40, fontWeight: "bold" },
  targetLabel: {
    color: "#00ffff",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 5,
  },

  instructionPill: {
    marginTop: 20,
    backgroundColor: "rgba(0,0,0,0.9)",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
  },
  instructionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2,
  },
  distanceText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 4,
  },
});

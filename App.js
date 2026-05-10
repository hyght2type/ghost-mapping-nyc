import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Text, StatusBar } from "react-native";
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
  const [distanceToTarget, setDistanceToTarget] = useState(5);

  const [wayfinderRotation, setWayfinderRotation] = useState(0);
  const [turnInstruction, setTurnInstruction] = useState("SCANNING");

  const lastHeadingRef = useRef(0);
  const wayfinderSmoothRef = useRef(0);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain)
      requestPermission();

    Magnetometer.setUpdateInterval(40);
    const magSub = Magnetometer.addListener((data) => {
      let angle = Math.atan2(data.z, -data.x) * (180 / Math.PI);
      let trueHeading = (angle + 360 + 13.0) % 360;
      lastHeadingRef.current = trueHeading;
      setMagHeading(trueHeading);

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

  useEffect(() => {
    if (!userLoc || !activeTarget) return;

    const dy = activeTarget.coords.latitude - userLoc.latitude;
    const dx =
      Math.cos((userLoc.latitude * Math.PI) / 180) *
      (activeTarget.coords.longitude - userLoc.longitude);
    const bearing = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;

    let relativeHeading = (bearing - wayfinderSmoothRef.current + 360) % 360;
    setWayfinderRotation(relativeHeading);

    let diff = bearing - lastHeadingRef.current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    // Hyper-sensitive targeting for 15ft range
    if (Math.abs(diff) < 35) setTurnInstruction("TARGET LOCKED");
    else if (diff < 0) setTurnInstruction("◀ TURN LEFT");
    else setTurnInstruction("TURN RIGHT ▶");

    const distY = (activeTarget.coords.latitude - userLoc.latitude) * 111320;
    const distX =
      (activeTarget.coords.longitude - userLoc.longitude) *
      (111320 * Math.cos((userLoc.latitude * Math.PI) / 180));
    const realDist = Math.sqrt(distX * distX + distY * distY);
    setDistanceToTarget(realDist);
  }, [userLoc, magHeading]);

  if (!permission?.granted)
    return (
      <View style={styles.load}>
        <Text style={styles.loadText}>INITIALIZING...</Text>
      </View>
    );

  const isLocked = Math.abs(distanceToTarget) < 50;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={StyleSheet.absoluteFill}>
        <CameraView style={{ flex: 1 }} facing="back" active={true} />
      </View>

      {/* 1. NEAREST SIGNAL BAR (TOP LEFT) */}
      <View style={styles.headerBar}>
        <Text style={styles.headerLabel}>GHOST MAPPING // NYC</Text>
        <Text style={styles.signalSub}>NEAREST SIGNAL:</Text>
        <Text style={styles.signalName}>{activeTarget.name}</Text>
        <Text style={styles.signalDist}>{Math.round(distanceToTarget)}m</Text>
      </View>

      {/* 2. GOLDEN COMPASS (TOP RIGHT) */}
      <View style={styles.compassPosition}>
        <View
          style={[
            styles.ring,
            { transform: [{ rotate: `${(360 - magHeading) % 360}deg` }] },
          ]}
        >
          <View style={styles.northMarker}>
            <Text style={styles.nText}>N</Text>
          </View>
        </View>
        <View style={styles.fixedIndicator} />
      </View>

      {/* 3. INFO/TARGET BOX (CENTER) */}
      <View style={styles.centerContainer} pointerEvents="none">
        <View
          style={[
            styles.targetBox,
            turnInstruction === "TARGET LOCKED" && styles.targetBoxActive,
          ]}
        >
          <Text style={styles.boxName}>{activeTarget.name}</Text>
          <Text
            style={[
              styles.boxArrow,
              turnInstruction === "TARGET LOCKED" && { color: "#00ffff" },
            ]}
          >
            ▲
          </Text>
          <Text style={styles.boxStatus}>{turnInstruction}</Text>
        </View>
      </View>

      {/* 4. FLOATING WAYFINDER & TURN PILL (BOTTOM) */}
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
        <View style={styles.instructionPill}>
          <Text style={styles.instructionText}>{turnInstruction}</Text>
          <Text style={styles.distanceText}>
            {Math.round(distanceToTarget)}m to entrance
          </Text>
        </View>
      </View>

      {/* 3D AR CANVAS (ONLY WHEN FACING TARGET) */}
      {turnInstruction === "TARGET LOCKED" && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Canvas gl={{ alpha: true }} camera={{ fov: 45 }}>
            <ambientLight intensity={1.5} />
            <GhostBuilding distance={Math.max(5, distanceToTarget)} />
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

  // TOP LEFT BAR
  headerBar: {
    position: "absolute",
    top: 50,
    left: 20,
    width: "65%",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: "#fff",
    zIndex: 10,
  },
  headerLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 5,
  },
  signalSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 9,
    fontWeight: "bold",
  },
  signalName: { color: "#fff", fontSize: 18, fontWeight: "900" },
  signalDist: { color: "#fff", fontSize: 22, fontWeight: "300" },

  // TOP RIGHT COMPASS
  compassPosition: { position: "absolute", top: 60, right: 30, zIndex: 10 },
  ring: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#00ffff",
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  northMarker: { position: "absolute", top: 2 },
  nText: { color: "#00ffff", fontSize: 14, fontWeight: "900" },
  fixedIndicator: {
    position: "absolute",
    top: -4,
    left: 28,
    width: 4,
    height: 12,
    backgroundColor: "#ff3333",
    borderRadius: 2,
  },

  // CENTER BOX
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  targetBox: {
    width: 220,
    height: 220,
    backgroundColor: "rgba(0,255,255,0.05)",
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(0,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  targetBoxActive: {
    borderColor: "#00ffff",
    backgroundColor: "rgba(0,255,255,0.15)",
  },
  boxName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
    paddingHorizontal: 10,
  },
  boxArrow: { color: "#fff", fontSize: 40, marginVertical: 10 },
  boxStatus: { color: "#fff", fontSize: 10, fontWeight: "bold" },

  // BOTTOM WAYFINDER
  wayfinderLayer: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    alignItems: "center",
    zIndex: 20,
  },
  compassBase: {
    width: 120,
    height: 120,
    borderRadius: 60,
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
    width: 3,
    height: 12,
    backgroundColor: "#ff3333",
    zIndex: 10,
  },
  floatingDisc: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  targetIcon: { color: "#00ffff", fontSize: 28 },
  targetLabel: { color: "#00ffff", fontSize: 7, fontWeight: "900" },
  instructionPill: {
    marginTop: 15,
    backgroundColor: "rgba(0,0,0,0.9)",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "#fff",
    alignItems: "center",
  },
  instructionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
  },
  distanceText: { color: "rgba(255,255,255,0.6)", fontSize: 9, marginTop: 2 },
});

import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Canvas } from "@react-three/fiber/native";
import { Magnetometer } from "expo-sensors";
import * as Location from "expo-location";

import { GhostBuilding } from "./src/components/GhostBuilding";

const { width, height } = Dimensions.get("window");

const GHOST_SITES = [
  {
    id: "st-stephens",
    name: "ST. STEPHEN THE FIRST MARTYR",
    address: "149 East 28th Street",
    coords: { latitude: 40.74245, longitude: -73.98045 },
    year: "EST. 1854",
    architect: "JAMES RENWICK JR.",
    heritage: "ROMANESQUE REVIVAL // BRUMIDI MURALS",
    fact: "Commissioned by Dr. Jeremiah Cummings; the interior houses the largest collection of Brumidi's religious works in America.",
  },
];

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [userLoc, setUserLoc] = useState(null);
  const [magHeading, setMagHeading] = useState(0);
  const [vpsAccuracy, setVpsAccuracy] = useState(100);
  const [activeTarget, setActiveTarget] = useState(GHOST_SITES[0]);

  // Now tracks raw live distance without freezing
  const [distanceToTarget, setDistanceToTarget] = useState(0);
  const [wayfinderRotation, setWayfinderRotation] = useState(0);
  const [turnInstruction, setTurnInstruction] = useState("SCANNING");

  const lastHeadingRef = useRef(0);
  const wayfinderSmoothRef = useRef(0);
  const ghostAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain)
      requestPermission();

    Magnetometer.setUpdateInterval(40);
    const magSub = Magnetometer.addListener((data) => {
      // THE GOLDEN COMPASS LOGIC (Preserved perfectly)
      let angle = Math.atan2(data.z, -data.x) * (180 / Math.PI);
      let trueHeading = (angle + 360 + 13.0) % 360;
      lastHeadingRef.current = trueHeading;
      setMagHeading(trueHeading);

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
          },
        );
      }
    })();

    Animated.loop(
      Animated.timing(ghostAnimation, {
        toValue: 1,
        duration: 11000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    return () => {
      magSub.remove();
      ghostAnimation.stopAnimation();
    };
  }, [permission]);

  useEffect(() => {
    if (!userLoc || !activeTarget) return;

    // 1. BEARING MATH (Fixed with strict latitude Cosine adjustment)
    const dLat = activeTarget.coords.latitude - userLoc.latitude;
    const dLon = activeTarget.coords.longitude - userLoc.longitude;

    const dy = dLat;
    const dx = dLon * Math.cos(userLoc.latitude * (Math.PI / 180));

    // Exact bearing to target
    const bearing = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;

    // Relative heading for the Wayfinder disc (Removed the 180 hack)
    let relHeading = (bearing - wayfinderSmoothRef.current + 360) % 360;
    setWayfinderRotation(relHeading);

    // 2. TURN INSTRUCTIONS
    let diff = bearing - lastHeadingRef.current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    if (Math.abs(diff) < 35) setTurnInstruction("TARGET LOCKED");
    else if (diff < 0) setTurnInstruction("◀ TURN LEFT");
    else setTurnInstruction("TURN RIGHT ▶");

    // 3. LIVE DISTANCE TRACKING (Removed the 6m snap bug)
    const distY = dLat * 111320;
    const distX = dLon * 111320 * Math.cos(userLoc.latitude * (Math.PI / 180));
    const realDist = Math.sqrt(distX * distX + distY * distY);

    setDistanceToTarget(realDist);
  }, [userLoc, magHeading, vpsAccuracy]);

  if (!permission?.granted) return <View style={styles.load} />;

  // Display calculations
  const distFeet = Math.round(distanceToTarget * 3.28084);
  const distMeters = Math.round(distanceToTarget);

  const ghostX = ghostAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, width + 200],
  });
  const ghostY = ghostAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [height * 0.2, height * 0.1, height * 0.2],
  });
  const ghostOpacity = ghostAnimation.interpolate({
    inputRange: [0, 0.1, 0.9, 1],
    outputRange: [0, 0.6, 0.6, 0],
  });

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={StyleSheet.absoluteFill}>
        <CameraView style={{ flex: 1 }} facing="back" active={true} />
      </View>

      {/* FUN: THE GHOST OVERLAY */}
      <Animated.View
        style={[
          styles.ghostContainer,
          {
            transform: [{ translateX: ghostX }, { translateY: ghostY }],
            opacity: ghostOpacity,
          },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.ghostSymbol}>👤</Text>
        <Text style={styles.ghostText}>// RESIDUAL SIGNAL...</Text>
      </Animated.View>

      {/* HEADER BAR WITH LIVE FEET/METERS */}
      <View style={styles.headerBar}>
        <Text style={styles.headerLabel}>{activeTarget.heritage}</Text>
        <View style={styles.signalContent}>
          <Text style={styles.signalSub}>{activeTarget.year}</Text>
          <Text style={styles.signalName}>{activeTarget.name}</Text>
          <Text style={styles.signalDist}>
            {distFeet} FT // {distMeters} M
          </Text>
        </View>
      </View>

      {/* GOLDEN COMPASS (TOP RIGHT) */}
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

      {/* WAYFINDER WITH LIVE FEET */}
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
            <Text style={styles.targetLabel}>FRONT DOOR</Text>
          </View>
        </View>
        <View style={styles.instructionPill}>
          <Text style={styles.instructionText}>{turnInstruction}</Text>
          <Text style={styles.distanceText}>{distFeet} ft to entrance</Text>
        </View>
      </View>

      {/* INFO PANEL */}
      {distanceToTarget < 25 && (
        <View style={styles.infoPanel} pointerEvents="none">
          <Text style={styles.infoTitle}>{activeTarget.name}</Text>
          <Text style={styles.infoMeta}>
            {activeTarget.year} | {activeTarget.architect}
          </Text>
          <Text style={styles.infoFact}>{activeTarget.fact}</Text>
        </View>
      )}

      {/* 3D AR CANVAS */}
      {turnInstruction === "TARGET LOCKED" && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Canvas gl={{ alpha: true }} camera={{ fov: 45 }}>
            <ambientLight intensity={1.5} />
            <GhostBuilding distance={Math.max(6, distanceToTarget)} />
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
  ghostContainer: {
    position: "absolute",
    width: 250,
    height: 250,
    zIndex: 10000,
    justifyContent: "center",
    alignItems: "center",
  },
  ghostSymbol: { fontSize: 120, color: "rgba(0, 255, 255, 0.4)" },
  ghostText: {
    position: "absolute",
    bottom: 30,
    color: "rgba(0, 255, 255, 0.6)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2,
  },
  headerBar: {
    position: "absolute",
    top: 50,
    left: 20,
    width: "65%",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: "#00ffff",
    zIndex: 10,
  },
  headerLabel: {
    color: "#00ffff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  signalSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 9,
    fontWeight: "bold",
  },
  signalName: { color: "#fff", fontSize: 13, fontWeight: "900" },
  signalDist: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "300",
    marginTop: 2,
    letterSpacing: 1,
  },
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
    borderColor: "#00ffff",
    alignItems: "center",
  },
  instructionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
  },
  distanceText: { color: "rgba(255,255,255,0.6)", fontSize: 9, marginTop: 2 },
  infoPanel: {
    position: "absolute",
    bottom: 300,
    alignSelf: "center",
    width: "85%",
    backgroundColor: "rgba(0,0,0,0.95)",
    padding: 20,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "#00ffff",
    zIndex: 30,
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
});

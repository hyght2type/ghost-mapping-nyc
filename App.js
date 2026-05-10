import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Text, StatusBar } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Canvas } from "@react-three/fiber/native";
import { Magnetometer } from "expo-sensors";
import * as Location from "expo-location";

import { GhostBuilding } from "./src/components/GhostBuilding";
import { NavigationHUD } from "./src/components/NavigationHUD";

/** * THE GHOST REGISTRY
 * Expanded to include Grand Central Terminal and St. Stephen's.
 */
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

  const lastHeading = useRef(0);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }

    /** * GOLDEN SENSOR LOGIC (LOCKED)
     * Verified for Portrait/Vertical orientation.
     * Math: atan2(z, -x)
     */
    Magnetometer.setUpdateInterval(100);
    const magSub = Magnetometer.addListener((data) => {
      let angle = Math.atan2(data.z, -data.x) * (180 / Math.PI);
      let heading = (angle + 360 + 13.0) % 360;
      const smoothed = lastHeading.current * 0.7 + heading * 0.3;
      lastHeading.current = smoothed;
      setMagHeading(smoothed);
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

  // PROXIMITY ENGINE & NEAREST SIGNAL LOGIC
  useEffect(() => {
    if (!userLoc) return;

    let closest = GHOST_SITES[0];
    let minDistance = Infinity;

    GHOST_SITES.forEach((site) => {
      const dy = (site.coords.latitude - userLoc.latitude) * 111320;
      const dx =
        (site.coords.longitude - userLoc.longitude) *
        (111320 * Math.cos((userLoc.latitude * Math.PI) / 180));
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDistance) {
        minDistance = dist;
        closest = site;
      }
    });

    setActiveTarget(closest);
    setDistanceToTarget(minDistance);
  }, [userLoc]);

  if (!permission) return <View style={styles.load} />;
  if (!permission.granted)
    return (
      <View style={styles.load}>
        <Text style={styles.loadText}>CAMERA PERMISSION REQUIRED</Text>
      </View>
    );

  const isVpsLocked = vpsAccuracy < 40;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* BACKGROUND: CAMERA LAYER */}
      <View style={StyleSheet.absoluteFill}>
        <CameraView style={{ flex: 1 }} facing="back" active={true} />
      </View>

      {/* 3D AR LAYER: Ghost Lines appear only when proximity and accuracy are high */}
      {vpsAccuracy < 100 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Canvas gl={{ alpha: true }} camera={{ fov: 45 }}>
            <ambientLight intensity={1.5} />
            <GhostBuilding distance={Math.max(5, distanceToTarget)} />
          </Canvas>
        </View>
      )}

      {/* UNIFIED HUD: Contains Nearest Signal Bar, Center Target Box, Compass, and Nav Pill */}
      <NavigationHUD
        vpsHeading={vpsHeading}
        magHeading={magHeading}
        target={activeTarget}
        userLoc={userLoc}
        isApiLocked={isVpsLocked}
        distance={distanceToTarget}
      />

      {/* SYSTEM STATUS PILL */}
      <View style={styles.statusPill} pointerEvents="none">
        <View
          style={[
            styles.dot,
            { backgroundColor: isVpsLocked ? "#00ffff" : "#ffaa00" },
          ]}
        />
        <Text style={styles.pillText}>
          {isVpsLocked ? "POLES ALIGNED" : "STREET CALIBRATION..."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
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
  statusPill: {
    position: "absolute",
    top: 60,
    left: 20,
    zIndex: 3000,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  pillText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
});

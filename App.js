import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Text, StatusBar } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Canvas } from "@react-three/fiber/native";
import { Magnetometer } from "expo-sensors";
import * as Location from "expo-location";

import { GhostBuilding } from "./src/components/GhostBuilding";
import { NavigationHUD } from "./src/components/NavigationHUD";

/** * THE GHOST REGISTRY
 * Add any new historical or haunted sites here.
 */
const GHOST_SITES = [
  {
    id: "ny-life",
    name: "NY LIFE / MSG II",
    coords: { latitude: 40.7427, longitude: -73.9856 },
  },
  {
    id: "st-stephens",
    name: "ST. STEPHEN'S CHURCH",
    coords: { latitude: 40.742, longitude: -73.9794 }, // 142 E 28th St
  },
];

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [userLoc, setUserLoc] = useState(null);
  const [vpsHeading, setVpsHeading] = useState(0);
  const [magHeading, setMagHeading] = useState(0);
  const [vpsAccuracy, setVpsAccuracy] = useState(100);
  const [isVpsLocked, setIsVpsLocked] = useState(false);
  const [activeTarget, setActiveTarget] = useState(GHOST_SITES[0]);

  const lastHeading = useRef(0);

  useEffect(() => {
    if (permission && !permission.granted) requestPermission();

    // GOLDEN SENSOR LOGIC (LOCKED)
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
            setIsVpsLocked(loc.coords.accuracy < 25);
          },
        );
      }
    })();

    return () => magSub.remove();
  }, [permission]);

  /** * PROXIMITY ENGINE:
   * Automatically switches the HUD target to the nearest Ghost Site.
   */
  useEffect(() => {
    if (!userLoc) return;

    let closest = GHOST_SITES[0];
    let minDistance = Infinity;

    GHOST_SITES.forEach((site) => {
      const dy = (site.coords.latitude - userLoc.latitude) * 111320;
      const dx =
        (site.coords.longitude - userLoc.longitude) *
        (111320 * Math.cos((userLoc.latitude * Math.PI) / 180));
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < minDistance) {
        minDistance = distance;
        closest = site;
      }
    });

    setActiveTarget(closest);
  }, [userLoc]);

  if (!permission?.granted)
    return (
      <View style={styles.load}>
        <Text style={styles.loadText}>LOCATING GHOSTS...</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <View style={StyleSheet.absoluteFill}>
        <CameraView style={{ flex: 1 }} facing="back" active={true} />
      </View>

      {isVpsLocked && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Canvas gl={{ alpha: true }} camera={{ fov: 45 }}>
            <ambientLight intensity={1.5} />
            <GhostBuilding distance={15} />
          </Canvas>
        </View>
      )}

      <NavigationHUD
        vpsHeading={vpsHeading}
        magHeading={magHeading}
        target={activeTarget}
        userLoc={userLoc}
        isApiLocked={isVpsLocked}
      />

      <View style={styles.statusPill} pointerEvents="none">
        <View
          style={[
            styles.dot,
            { backgroundColor: isVpsLocked ? "#00ffff" : "#ff3333" },
          ]}
        />
        <Text style={styles.pillText}>
          {isVpsLocked
            ? "AR ANCHOR ACTIVE"
            : `SCANNING FOR: ${activeTarget.name}`}
        </Text>
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
  statusPill: {
    position: "absolute",
    top: 60,
    left: 20,
    zIndex: 3000,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.85)",
    padding: 10,
    borderRadius: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  pillText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
});

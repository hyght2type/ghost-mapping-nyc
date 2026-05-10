import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text, StatusBar } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Canvas } from "@react-three/fiber/native";
import { Magnetometer } from "expo-sensors";
import * as Location from "expo-location";

import { GhostBuilding } from "./src/components/GhostBuilding";
import { NavigationHUD } from "./src/components/NavigationHUD";

const TARGET_SITE = {
  name: "NY LIFE / MSG II",
  coords: { latitude: 40.7427, longitude: -73.9856 },
};

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [userLoc, setUserLoc] = useState(null);
  const [vpsHeading, setVpsHeading] = useState(0);
  const [magHeading, setMagHeading] = useState(0);
  const [vpsAccuracy, setVpsAccuracy] = useState(100);
  const [isVpsLocked, setIsVpsLocked] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted) requestPermission();

    /** * FIXED ORIENTATION MATH:
     * Swapping x and y (atan2(x, y)) is the standard fix for Portrait mode
     * compasses on iOS to ensure East/West aren't rotated by 90 degrees.
     */
    Magnetometer.setUpdateInterval(100);
    const magSub = Magnetometer.addListener((data) => {
      let angle = Math.atan2(data.x, data.y) * (180 / Math.PI);
      // Offset for NYC Declination
      setMagHeading((angle + 360 + 13.0) % 360);
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

  if (!permission?.granted)
    return (
      <View style={styles.load}>
        <Text style={{ color: "#0ff" }}>SYNCING AR SYSTEM...</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* 1. CAMERA */}
      <View style={StyleSheet.absoluteFill}>
        <CameraView style={{ flex: 1 }} facing="back" active={true} />
      </View>

      {/* 2. 3D GHOST */}
      {isVpsLocked && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Canvas gl={{ alpha: true }} camera={{ fov: 45 }}>
            <ambientLight intensity={1.5} />
            <GhostBuilding distance={15} />
          </Canvas>
        </View>
      )}

      {/* 3. NAVIGATION HUD */}
      <NavigationHUD
        vpsHeading={vpsHeading}
        magHeading={magHeading}
        target={TARGET_SITE}
        userLoc={userLoc}
        isApiLocked={isVpsLocked}
      />

      {/* 4. API STATUS PILL */}
      <View style={styles.statusPill} pointerEvents="none">
        <View
          style={[
            styles.dot,
            { backgroundColor: isVpsLocked ? "#00ffff" : "#ff3333" },
          ]}
        />
        <Text style={styles.pillText}>
          {isVpsLocked ? "VPS LOCKED" : "VPS LOCALIZING..."}
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
  statusPill: {
    position: "absolute",
    top: 60,
    left: 20,
    zIndex: 3000,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
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

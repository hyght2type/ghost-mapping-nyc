import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text, StatusBar } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Canvas } from "@react-three/fiber/native";
import { Magnetometer } from "expo-sensors";
import * as Location from "expo-location";

import { GhostBuilding } from "./src/components/GhostBuilding";
import { NavigationHUD } from "./src/components/NavigationHUD";

const SITE = {
  name: "NY LIFE / MSG II",
  coords: { latitude: 40.7427, longitude: -73.9856 },
};

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [userLoc, setUserLoc] = useState(null);
  const [vpsHeading, setVpsHeading] = useState(0);
  const [magHeading, setMagHeading] = useState(0);
  const [vpsAccuracy, setVpsAccuracy] = useState(100);
  const [activeSite, setActiveSite] = useState(null);

  useEffect(() => {
    if (permission && !permission.granted) requestPermission();

    // The 6AM Magnetometer Logic (Standard Axis)
    Magnetometer.setUpdateInterval(100);
    const magSub = Magnetometer.addListener((data) => {
      let angle = Math.atan2(data.y, data.x) * (180 / Math.PI);
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
          },
        );
      }
    })();
    return () => magSub.remove();
  }, [permission]);

  useEffect(() => {
    if (!userLoc) return;
    const dy = (SITE.coords.latitude - userLoc.latitude) * 111320;
    const dx =
      (SITE.coords.longitude - userLoc.longitude) *
      (111320 * Math.cos((userLoc.latitude * Math.PI) / 180));
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 45ft Rule (14m)
    if (dist < 14 || vpsAccuracy < 25) setActiveSite(SITE);
    else setActiveSite(null);
  }, [userLoc, vpsHeading, vpsAccuracy]);

  if (!permission?.granted)
    return (
      <View style={styles.center}>
        <Text>Initializing...</Text>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar hidden />

      {/* LAYER 1: CAMERA */}
      <CameraView style={StyleSheet.absoluteFill} facing="back" active={true} />

      {/* LAYER 2: 3D CANVAS */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Canvas gl={{ alpha: true }} camera={{ fov: 45 }}>
          <ambientLight intensity={1.5} />
          {activeSite && <GhostBuilding distance={15} />}
        </Canvas>
      </View>

      {/* LAYER 3: API STATUS (Small Pill) */}
      <View style={styles.apiPill} pointerEvents="none">
        <View
          style={[
            styles.dot,
            { backgroundColor: vpsAccuracy < 25 ? "#00ffff" : "#ff3333" },
          ]}
        />
        <Text style={styles.pillText}>
          {vpsAccuracy < 25 ? "API LOCKED" : "API SCANNING"}
        </Text>
      </View>

      {/* LAYER 4: HUD (The 6 AM Logic) */}
      <NavigationHUD
        vpsHeading={vpsHeading}
        magHeading={magHeading}
        target={SITE}
        userLoc={userLoc}
        isActive={!!activeSite}
        isApiLocked={vpsAccuracy < 25}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  apiPill: {
    position: "absolute",
    top: 60,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
    borderRadius: 2,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  pillText: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
});

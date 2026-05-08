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
  const [activeSite, setActiveSite] = useState(null);

  useEffect(() => {
    if (permission && !permission.granted) requestPermission();

    // Resetting North Math: Inverting the axes to fix the "Backwards" bug
    Magnetometer.setUpdateInterval(100);
    const magSub = Magnetometer.addListener((data) => {
      let angle = Math.atan2(data.y, data.x) * (180 / Math.PI);
      // Adjusted for NYC Declination (13°)
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
    const dy = (TARGET_SITE.coords.latitude - userLoc.latitude) * 111320;
    const dx =
      (TARGET_SITE.coords.longitude - userLoc.longitude) *
      (111320 * Math.cos((userLoc.latitude * Math.PI) / 180));
    const dist = Math.sqrt(dx * dx + dy * dy);

    // API Lock or 45ft proximity
    if (dist < 14 || vpsAccuracy < 25) setActiveSite(TARGET_SITE);
    else setActiveSite(null);
  }, [userLoc, vpsHeading, vpsAccuracy]);

  if (!permission?.granted)
    return (
      <View style={styles.center}>
        <Text>Initializing API...</Text>
      </View>
    );

  return (
    <View style={styles.mainWrapper}>
      <StatusBar hidden />

      {/* SECTION A: THE WORLD (CAMERA & 3D) */}
      <View style={styles.worldLayer}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          active={true}
        />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Canvas gl={{ alpha: true }} camera={{ fov: 45 }}>
            <ambientLight intensity={1.5} />
            {activeSite && <GhostBuilding distance={15} />}
          </Canvas>
        </View>
      </View>

      {/* SECTION B: THE INTERFACE (HUD & STATUS) */}
      <NavigationHUD
        vpsHeading={vpsHeading}
        magHeading={magHeading}
        target={TARGET_SITE}
        userLoc={userLoc}
        isActive={!!activeSite}
        isApiLocked={vpsAccuracy < 25}
      />

      <View style={styles.apiIndicator} pointerEvents="none">
        <View
          style={[
            styles.statusDot,
            { backgroundColor: vpsAccuracy < 25 ? "#00ffff" : "#ff0000" },
          ]}
        />
        <Text style={styles.apiLabel}>
          {vpsAccuracy < 25 ? "VPS LOCKED" : "VPS SCANNING"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  worldLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  apiIndicator: {
    position: "absolute",
    top: 60,
    left: 20,
    zIndex: 10000,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 8,
    borderRadius: 2,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  apiLabel: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
});

import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Canvas } from "@react-three/fiber/native";
import { DeviceMotion, Magnetometer } from "expo-sensors";
import * as Location from "expo-location";

import { GhostBuilding } from "./src/components/GhostBuilding";

const GHOST_SITES = [
  {
    id: "hippo",
    name: "THE HIPPODROME",
    year: "1905-1939",
    coords: { latitude: 40.7554, longitude: -73.9828 },
    description: "6th Ave & 43rd St. A legendary theatre for spectacles.",
  },
  {
    id: "astor",
    name: "THE ASTOR LIBRARY",
    year: "1854-1911",
    coords: { latitude: 40.7292, longitude: -73.9921 },
    description: "Lafayette & 4th. Now the Public Theater.",
  },
];

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [heading, setHeading] = useState(0);
  const [motion, setMotion] = useState({ beta: 1.5 });
  const [userLoc, setUserLoc] = useState(null);
  const [activeSite, setActiveSite] = useState(null);
  const [nearestSite, setNearestSite] = useState(null);

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  useEffect(() => {
    if (permission && !permission.granted) requestPermission();

    // SENSOR DAMPING (Fixes the Jitter)
    Magnetometer.setUpdateInterval(16);
    const magSub = Magnetometer.addListener((data) => {
      let angle = Math.atan2(-data.x, data.y) * (180 / Math.PI);
      if (angle < 0) angle += 360;
      setHeading((prev) => {
        let diff = angle + 12.0 - prev;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return prev + diff * 0.12;
      });
    });

    DeviceMotion.setUpdateInterval(16);
    const motionSub = DeviceMotion.addListener((data) => {
      if (data?.rotation) setMotion({ beta: data.rotation.beta });
    });

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 1,
          },
          (loc) => setUserLoc(loc.coords),
        );
      }
    })();

    return () => {
      magSub.remove();
      motionSub.remove();
    };
  }, [permission]);

  useEffect(() => {
    if (!userLoc) return;
    let closest = null;
    let minFinishDist = Infinity;
    let viewing = null;

    GHOST_SITES.forEach((site) => {
      const dist = getDistance(
        userLoc.latitude,
        userLoc.longitude,
        site.coords.latitude,
        site.coords.longitude,
      );
      if (dist < minFinishDist) {
        minFinishDist = dist;
        closest = { ...site, dist };
      }

      const dy = site.coords.latitude - userLoc.latitude;
      const dx =
        Math.cos((userLoc.latitude * Math.PI) / 180) *
        (site.coords.longitude - userLoc.longitude);
      const angleToSite = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;
      const angleDiff = Math.abs(angleToSite - heading);

      if (angleDiff < 30 || angleDiff > 330) {
        viewing = { ...site, dist };
      }
    });

    setNearestSite(closest);
    setActiveSite(viewing);
  }, [userLoc, heading]);

  if (!permission?.granted)
    return (
      <View style={styles.center}>
        <Text>Grant Camera Access...</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        <CameraView style={{ flex: 1 }} facing="back" active={true} />
      </View>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Canvas
          gl={{ alpha: true, antialias: false }}
          camera={{ fov: 45, near: 0.1, far: 10000 }}
        >
          <ambientLight intensity={1.5} />
          {activeSite && (
            <GhostBuilding
              heading={heading}
              motion={motion}
              distance={activeSite.dist}
            />
          )}
        </Canvas>
      </View>

      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.brand}>GHOST MAPPING // NYC</Text>
        <View style={styles.radarBox}>
          <Text style={styles.label}>NEAREST SIGNAL:</Text>
          <Text style={styles.value}>
            {nearestSite ? nearestSite.name : "SCANNING..."}
          </Text>
          <Text style={styles.distValue}>
            {nearestSite ? `${nearestSite.dist.toFixed(0)}m` : "---"}
          </Text>
        </View>

        {activeSite && (
          <View style={styles.lockBox}>
            <Text style={styles.lockLabel}>TARGET LOCKED</Text>
            <Text style={styles.lockValue}>{activeSite.year}</Text>
            <Text style={styles.smallDesc}>{activeSite.description}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  hud: { position: "absolute", top: 60, left: 20, right: 20 },
  brand: {
    color: "#ffffff",
    fontWeight: "900",
    letterSpacing: 2,
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 10,
  },
  radarBox: {
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  lockBox: {
    marginTop: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: "#00ffff",
    backgroundColor: "rgba(0,255,255,0.2)",
  },
  label: { color: "#ffffff", fontSize: 9, opacity: 0.6, letterSpacing: 1 },
  lockLabel: {
    color: "#00ffff",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  value: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
  distValue: { color: "#ffffff", fontSize: 24, fontWeight: "200" },
  lockValue: { color: "#00ffff", fontSize: 18, fontWeight: "bold" },
  smallDesc: { color: "#ffffff", fontSize: 11, marginTop: 4, opacity: 0.8 },
});

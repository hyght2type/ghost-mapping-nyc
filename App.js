import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Canvas } from "@react-three/fiber/native";
import { DeviceMotion } from "expo-sensors";
import * as Location from "expo-location";

// Components
import { GhostBuilding } from "./src/components/GhostBuilding";
import { NavigationArrows } from "./src/components/NavigationArrows";

// CONFIG: MSG II / NY Life Building
// This is the site of the former Garden Theatre (Madison Ave & 27th/28th)
const GHOST_SITES = [
  {
    id: "ny-life-building",
    name: "NY LIFE / MSG II",
    year: "1890-1925 (MSG)",
    coords: { latitude: 40.7427, longitude: -73.9856 },
    description: "Geospatial Lock: Site of Stanford White's MSG II.",
  },
];

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [vpsPose, setVpsPose] = useState(null);
  const [motion, setMotion] = useState({ beta: 1.5 });
  const [userLoc, setUserLoc] = useState(null);
  const [activeSite, setActiveSite] = useState(null);
  const [nearestSite, setNearestSite] = useState(null);

  // Haversine formula for distance calculation
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

    // SENSOR FUSION: Monitor Device Pitch (beta)
    DeviceMotion.setUpdateInterval(16);
    const motionSub = DeviceMotion.addListener((data) => {
      if (data?.rotation) setMotion({ beta: data.rotation.beta });
    });

    // GEOSPATIAL HANDSHAKE: Initializing VPS Logic
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 0.5,
          },
          (loc) => {
            setUserLoc(loc.coords);
            // Syncing VPS data with Location Heading
            setVpsPose({
              heading: loc.coords.heading || 0,
              horizontalAccuracy: loc.coords.accuracy || 100,
              altitude: loc.coords.altitude,
            });
          },
        );
      }
    })();

    return () => motionSub.remove();
  }, [permission]);

  useEffect(() => {
    if (!userLoc || !vpsPose) return;
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

      // TIGHTENING LOCK: Using VPS Accuracy + Pitch Gate
      // Google VPS is considered 'Locked' when accuracy < 10m
      const isPositionPrecise = vpsPose.horizontalAccuracy < 15;

      if (dist < 800 && isPositionPrecise) {
        const dy = site.coords.latitude - userLoc.latitude;
        const dx =
          Math.cos((userLoc.latitude * Math.PI) / 180) *
          (site.coords.longitude - userLoc.longitude);
        const angleToSite = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;
        const angleDiff = Math.abs(angleToSite - vpsPose.heading);

        // ORIENTATION GATE: Phone must be held upright (face level)
        // beta 1.57 is perfect vertical. 1.1 to 2.0 allows for natural tilt.
        const isLevelWithFace = motion.beta > 1.1 && motion.beta < 2.0;

        if ((angleDiff < 20 || angleDiff > 340) && isLevelWithFace) {
          viewing = { ...site, dist };
        }
      }
    });

    setNearestSite(closest);
    setActiveSite(viewing);
  }, [userLoc, vpsPose, motion.beta]);

  if (!permission?.granted)
    return (
      <View style={styles.center}>
        <Text>Initializing VPS Sensors...</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      {/* Camera Layer */}
      <View style={StyleSheet.absoluteFill}>
        <CameraView style={{ flex: 1 }} facing="back" active={true} />
      </View>

      {/* 3D Ghost Layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Canvas
          gl={{ alpha: true, antialias: false }}
          camera={{ fov: 45, near: 0.1, far: 10000 }}
        >
          <ambientLight intensity={1.5} />
          {activeSite && (
            <GhostBuilding motion={motion} distance={activeSite.dist} />
          )}
        </Canvas>
      </View>

      {/* Navigation Arrow (Guides to NY Life/MSG II) */}
      <NavigationArrows
        currentHeading={vpsPose?.heading || 0}
        targetCoords={GHOST_SITES[0].coords}
        userLoc={userLoc}
        isActive={!!activeSite}
      />

      {/* HUD Layer */}
      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.brand}>GHOST MAPPING // NYC</Text>

        {/* VPS PRECISION INDICATOR */}
        <View style={styles.vpsStatus}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  vpsPose?.horizontalAccuracy < 15 ? "#00ffff" : "#ff3333",
              },
            ]}
          />
          <Text style={styles.vpsText}>
            VPS:{" "}
            {vpsPose?.horizontalAccuracy < 15
              ? "PRECISION LOCK"
              : "LOCALIZING..."}
          </Text>
        </View>

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
            <Text style={styles.lockLabel}>GEOSPATIAL TARGET LOCKED</Text>
            <Text style={styles.lockValue}>{activeSite.name}</Text>
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
  vpsStatus: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
    shadowColor: "#00ffff",
    shadowRadius: 5,
    shadowOpacity: 0.5,
  },
  vpsText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1,
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
    borderLeftWidth: 3,
    borderLeftColor: "#00ffff",
    backgroundColor: "rgba(0,255,255,0.1)",
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

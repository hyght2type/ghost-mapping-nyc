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
import { Magnetometer, Accelerometer, Gyroscope } from "expo-sensors";
import * as Location from "expo-location";
import AHRS from "ahrs";

import { GhostBuilding } from "./src/components/GhostBuilding";

const { width, height } = Dimensions.get("window");

// 1. RESTORED THE FULL GHOST DATABASE
const GHOST_SITES = [
  {
    id: "ny-life",
    name: "NY LIFE / MSG II",
    address: "26 Madison Ave",
    coords: { latitude: 40.7427, longitude: -73.9856 },
    year: "EST. 1890",
    architect: "STANFORD WHITE",
    heritage: "BEAUX-ARTS // LOST ARENA",
    fact: "Former site of the second Madison Square Garden, where architect Stanford White was famously murdered on the rooftop.",
  },
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
  {
    id: "grand-central",
    name: "GRAND CENTRAL TERMINAL",
    address: "89 E 42nd Street",
    coords: { latitude: 40.7527, longitude: -73.9772 },
    year: "EST. 1913",
    architect: "REED AND STEM",
    heritage: "BEAUX-ARTS // CELESTIAL MURAL",
    fact: "The famous celestial ceiling mural over the main concourse is actually painted backwards.",
  },
];

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [userLoc, setUserLoc] = useState(null);
  const [vpsAccuracy, setVpsAccuracy] = useState(100);

  const [trueHeading, setTrueHeading] = useState(0);
  const [flatHeading, setFlatHeading] = useState(0);

  // 2. ACTIVE TARGET IS NOW DYNAMIC STATE, NOT HARDCODED
  const [activeTarget, setActiveTarget] = useState(GHOST_SITES[0]);

  const [distanceToTarget, setDistanceToTarget] = useState(0);
  const [wayfinderRotation, setWayfinderRotation] = useState(0);
  const [turnInstruction, setTurnInstruction] = useState(
    "CALIBRATING SENSORS...",
  );

  const lastHeadingRef = useRef(0);
  const wayfinderSmoothRef = useRef(0);
  const ghostAnimation = useRef(new Animated.Value(0)).current;

  // Optimized Madgwick Filter
  const madgwick = useRef(
    new AHRS({ sampleInterval: 33, algorithm: "Madgwick", beta: 0.04 }),
  ).current;
  const sensors = useRef({
    ax: 0,
    ay: 0,
    az: 1,
    gx: 0,
    gy: 0,
    gz: 0,
    mx: 0,
    my: 0,
    mz: 0,
  }).current;

  // MASTER CALIBRATION (-15.0 pulls UI Left)
  const GLOBAL_YAW_OFFSET = -15.0;

  const lowPass = (current, previous, alpha = 0.2) => {
    if (current === undefined || current === null || isNaN(current))
      return previous;
    return previous + alpha * (current - previous);
  };

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain)
      requestPermission();

    Accelerometer.setUpdateInterval(33);
    Gyroscope.setUpdateInterval(33);
    Magnetometer.setUpdateInterval(33);

    const accSub = Accelerometer.addListener((data) => {
      sensors.ax = lowPass(data.x, sensors.ax);
      sensors.ay = lowPass(data.y, sensors.ay);
      sensors.az = lowPass(data.z, sensors.az);
    });
    const gyroSub = Gyroscope.addListener((data) => {
      sensors.gx = lowPass(data.x, sensors.gx, 0.5);
      sensors.gy = lowPass(data.y, sensors.gy, 0.5);
      sensors.gz = lowPass(data.z, sensors.gz, 0.5);
    });
    const magSub = Magnetometer.addListener((data) => {
      sensors.mx = lowPass(data.x, sensors.mx, 0.1);
      sensors.my = lowPass(data.y, sensors.my, 0.1);
      sensors.mz = lowPass(data.z, sensors.mz, 0.1);

      let angle = Math.atan2(sensors.mz, -sensors.mx) * (180 / Math.PI);
      let heading = (angle + 360 + 13.0 + GLOBAL_YAW_OFFSET) % 360;

      if (!isNaN(heading)) setFlatHeading(heading);
    });

    const fusionLoop = setInterval(() => {
      madgwick.update(
        sensors.gx,
        sensors.gy,
        sensors.gz,
        sensors.ax,
        sensors.ay,
        sensors.az,
        sensors.mx,
        sensors.my,
        sensors.mz,
      );

      const euler = madgwick.getEulerAngles();
      let fusedHeading =
        (euler.heading * (180 / Math.PI) +
          90 +
          360 +
          13.0 +
          GLOBAL_YAW_OFFSET) %
        360;

      if (!isNaN(fusedHeading)) {
        lastHeadingRef.current = fusedHeading;
        setTrueHeading(fusedHeading);

        const wayfinderDamping = 0.85;
        wayfinderSmoothRef.current =
          wayfinderSmoothRef.current * wayfinderDamping +
          fusedHeading * (1 - wayfinderDamping);
      }
    }, 33);

    let locSub;
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        locSub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 0.1,
          },
          (loc) => {
            if (loc?.coords) {
              setUserLoc(loc.coords);
              setVpsAccuracy(loc.coords.accuracy || 100);
            }
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
      accSub.remove();
      gyroSub.remove();
      magSub.remove();
      clearInterval(fusionLoop);
      if (locSub) locSub.remove();
      ghostAnimation.stopAnimation();
    };
  }, [permission]);

  // 3. THE AUTO-TARGETING RADAR LOOP
  // This constantly scans the array for the closest building to your current GPS point.
  useEffect(() => {
    if (!userLoc) return;

    let closestSite = activeTarget;
    let shortestDistance = Infinity;

    GHOST_SITES.forEach((site) => {
      const dLat = site.coords.latitude - userLoc.latitude;
      const dLon = site.coords.longitude - userLoc.longitude;
      const distY = dLat * 111320;
      const distX =
        dLon * 111320 * Math.cos(userLoc.latitude * (Math.PI / 180));
      const realDist = Math.sqrt(distX * distX + distY * distY);

      if (realDist < shortestDistance) {
        shortestDistance = realDist;
        closestSite = site;
      }
    });

    // Only switch targets if we found a new closest ghost
    if (closestSite.id !== activeTarget.id) {
      setActiveTarget(closestSite);
    }
  }, [userLoc]); // Runs every time your GPS location updates

  // 4. WAYFINDER MATH (Now uses dynamic activeTarget)
  useEffect(() => {
    if (!userLoc || !activeTarget) return;

    const dLat = activeTarget.coords.latitude - userLoc.latitude;
    const dLon = activeTarget.coords.longitude - userLoc.longitude;
    const dy = dLat;
    const dx = dLon * Math.cos(userLoc.latitude * (Math.PI / 180));
    const bearing = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;

    let relHeading = (bearing - wayfinderSmoothRef.current + 360) % 360;
    if (!isNaN(relHeading)) setWayfinderRotation(relHeading);

    let diff = bearing - lastHeadingRef.current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    if (Math.abs(diff) < 20) setTurnInstruction("TARGET LOCKED");
    else if (diff < 0) setTurnInstruction("◀ TURN LEFT");
    else setTurnInstruction("TURN RIGHT ▶");

    const distY = dLat * 111320;
    const distX = dLon * 111320 * Math.cos(userLoc.latitude * (Math.PI / 180));
    const realDist = Math.sqrt(distX * distX + distY * distY);

    if (!isNaN(realDist)) setDistanceToTarget(realDist);
  }, [userLoc, trueHeading, activeTarget]); // Updates immediately if activeTarget swaps

  if (!permission?.granted) return <View style={styles.load} />;

  const safeDist = distanceToTarget || 0;
  const distFeet = Math.round(safeDist * 3.28084) || 0;
  const distMeters = Math.round(safeDist) || 0;

  const safeFlatHeading = flatHeading || 0;
  const safeWayfinderRot = wayfinderRotation || 0;

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

      <View style={styles.compassPosition}>
        <View
          style={[
            styles.ring,
            { transform: [{ rotate: `${(360 - safeFlatHeading) % 360}deg` }] },
          ]}
        >
          <View style={styles.northMarker}>
            <Text style={styles.nText}>N</Text>
          </View>
        </View>
        <View style={styles.fixedIndicator} />
      </View>

      <View style={styles.wayfinderLayer} pointerEvents="none">
        <View style={styles.compassBase}>
          <View style={styles.lubberLine} />
          <View
            style={[
              styles.floatingDisc,
              { transform: [{ rotate: `${safeWayfinderRot}deg` }] },
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

      {safeDist < 25 && safeDist > 0 && (
        <View style={styles.infoPanel} pointerEvents="none">
          <Text style={styles.infoTitle}>{activeTarget.name}</Text>
          <Text style={styles.infoMeta}>
            {activeTarget.year} | {activeTarget.architect}
          </Text>
          <Text style={styles.infoFact}>{activeTarget.fact}</Text>
        </View>
      )}

      {turnInstruction === "TARGET LOCKED" && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Canvas gl={{ alpha: true }} camera={{ fov: 45 }}>
            <ambientLight intensity={1.5} />
            <GhostBuilding distance={Math.max(6, safeDist)} />
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

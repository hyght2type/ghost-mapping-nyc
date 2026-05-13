import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  Animated,
  Easing,
  Dimensions,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Canvas } from "@react-three/fiber/native";
import { Magnetometer, Accelerometer, Gyroscope } from "expo-sensors";
import * as Location from "expo-location";
import AHRS from "ahrs";

import { GhostBuilding } from "./src/components/GhostBuilding";

const { width, height } = Dimensions.get("window");

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
    coords: { latitude: 40.74222, longitude: -73.98038 },
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
  {
    id: "jefferson-market",
    name: "JEFFERSON MARKET LIBRARY",
    address: "425 Avenue of the Americas",
    coords: { latitude: 40.7345, longitude: -73.9986 },
    year: "EST. 1877",
    architect: "FREDERICK CLARKE WITHERS",
    heritage: "VICTORIAN GOTHIC // OLD COURTHOUSE",
    fact: "Originally a courthouse and prison, its iconic clock tower once served as a firewatcher's lookout before it was saved from demolition to become a library.",
  },
];

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [userLoc, setUserLoc] = useState(null);
  const userLocRef = useRef(null);

  const [trueHeading, setTrueHeading] = useState(0);
  const [flatHeading, setFlatHeading] = useState(0);

  const [activeTarget, setActiveTarget] = useState(GHOST_SITES[0]);
  const [autoRadarActive, setAutoRadarActive] = useState(true);
  const [inRange, setInRange] = useState(false);

  const [capturedGhosts, setCapturedGhosts] = useState([]);

  const [distanceToTarget, setDistanceToTarget] = useState(0);
  const [wayfinderRotation, setWayfinderRotation] = useState(0);
  const [turnInstruction, setTurnInstruction] = useState("CALIBRATING...");

  // NEW: More descriptive routing state
  const [currentStep, setCurrentStep] = useState("AWAITING GPS...");
  const [nextStep, setNextStep] = useState("");
  const [stepDistance, setStepDistance] = useState("");

  const lastHeadingRef = useRef(0);
  const wayfinderSmoothRef = useRef(0);
  const ghostAnimation = useRef(new Animated.Value(0)).current;

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
  const compassSensors = useRef({ x: 0, z: 0 }).current;

  const GLOBAL_YAW_OFFSET = -15.0;
  const MAX_DETECTION_RADIUS = 150;
  const CAPTURE_RADIUS = 15;

  const GOOGLE_API_KEY = "AIzaSyDTIVetes1xe40R8d6e7bsI8vL7VXh1p_U";

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
      sensors.ay = lowPass(-data.z, sensors.ay);
      sensors.az = lowPass(data.y, sensors.az);
    });

    const gyroSub = Gyroscope.addListener((data) => {
      sensors.gx = lowPass(data.x, sensors.gx, 0.5);
      sensors.gy = lowPass(-data.z, sensors.gy, 0.5);
      sensors.gz = lowPass(data.y, sensors.gz, 0.5);
    });

    const magSub = Magnetometer.addListener((data) => {
      sensors.mx = lowPass(data.x, sensors.mx, 0.1);
      sensors.my = lowPass(-data.z, sensors.my, 0.1);
      sensors.mz = lowPass(data.y, sensors.mz, 0.1);
      compassSensors.x = lowPass(data.x, compassSensors.x, 0.1);
      compassSensors.z = lowPass(data.z, compassSensors.z, 0.1);

      let angle =
        Math.atan2(-compassSensors.x, -compassSensors.z) * (180 / Math.PI);
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
        (-euler.heading * (180 / Math.PI) + 360 + 13.0 + GLOBAL_YAW_OFFSET) %
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
              userLocRef.current = loc.coords;
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

  // ENHANCED ROUTING ENGINE: Grabs current and next step
  useEffect(() => {
    if (!GOOGLE_API_KEY) {
      setCurrentStep("AIzaSyDTIVetes1xe40R8d6e7bsI8vL7VXh1p_U");
      return;
    }

    const fetchRoute = async () => {
      if (!userLocRef.current || !activeTarget) return;

      try {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${userLocRef.current.latitude},${userLocRef.current.longitude}&destination=${activeTarget.coords.latitude},${activeTarget.coords.longitude}&mode=walking&key=${GOOGLE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const steps = data.routes[0].legs[0].steps;
          if (steps && steps.length > 0) {
            // Parse Current Step
            let currentRaw = steps[0].html_instructions.replace(
              /<[^>]*>?/gm,
              "",
            );
            setCurrentStep(currentRaw.toUpperCase());
            setStepDistance(steps[0].distance.text);

            // Parse Next Step if it exists
            if (steps.length > 1) {
              let nextRaw = steps[1].html_instructions.replace(
                /<[^>]*>?/gm,
                "",
              );
              setNextStep(`THEN: ${nextRaw.toUpperCase()}`);
            } else {
              setNextStep("DESTINATION AHEAD");
            }
          }
        } else {
          setCurrentStep("SIGNAL LOST // NO PATH FOUND");
          setNextStep("");
        }
      } catch (error) {
        setCurrentStep("NETWORK ERROR");
      }
    };

    fetchRoute();
    const routeInterval = setInterval(fetchRoute, 8000); // Slightly faster polling for city walking
    return () => clearInterval(routeInterval);
  }, [activeTarget]);

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

    if (autoRadarActive && closestSite.id !== activeTarget.id) {
      setActiveTarget(closestSite);
    }
  }, [userLoc, autoRadarActive, activeTarget]);

  useEffect(() => {
    if (!userLoc || !activeTarget) return;
    const dLat = activeTarget.coords.latitude - userLoc.latitude;
    const dLon = activeTarget.coords.longitude - userLoc.longitude;
    const realDist = Math.sqrt(
      Math.pow(dLat * 111320, 2) +
        Math.pow(
          dLon * 111320 * Math.cos(userLoc.latitude * (Math.PI / 180)),
          2,
        ),
    );

    setDistanceToTarget(realDist);
    const currentInRange = realDist <= MAX_DETECTION_RADIUS;
    setInRange(currentInRange);

    const bearing =
      (Math.atan2(dLon * Math.cos(userLoc.latitude * (Math.PI / 180)), dLat) *
        (180 / Math.PI) +
        360) %
      360;
    setWayfinderRotation((bearing - wayfinderSmoothRef.current + 360) % 360);

    let diff = bearing - lastHeadingRef.current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    if (!currentInRange) setTurnInstruction("SEARCHING...");
    else if (capturedGhosts.includes(activeTarget.id))
      setTurnInstruction("CONTAINED");
    else {
      if (Math.abs(diff) < 20) setTurnInstruction("LOCKED");
      else if (diff < 0) setTurnInstruction("◀ LEFT");
      else setTurnInstruction("RIGHT ▶");
    }
  }, [userLoc, trueHeading, activeTarget, capturedGhosts]);

  const cycleTarget = () => {
    setAutoRadarActive(false);
    const currentIndex = GHOST_SITES.findIndex((s) => s.id === activeTarget.id);
    setActiveTarget(GHOST_SITES[(currentIndex + 1) % GHOST_SITES.length]);
  };

  if (!permission?.granted) return <View style={styles.load} />;

  const isCaptured = capturedGhosts.includes(activeTarget.id);
  const readyToCapture =
    inRange && distanceToTarget <= CAPTURE_RADIUS && !isCaptured;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <CameraView style={StyleSheet.absoluteFill} facing="back" active={true} />

      {/* HEADER HUD */}
      <TouchableOpacity
        style={[
          styles.headerBar,
          !inRange && styles.headerOut,
          isCaptured && styles.headerCaptured,
        ]}
        onPress={cycleTarget}
      >
        <Text style={styles.headerLabel}>
          {autoRadarActive ? "AUTO-RADAR" : "MANUAL"} //{" "}
          {isCaptured ? "ARCHIVED" : inRange ? "LOCKED" : "SCANNING"}
        </Text>
        <Text style={styles.signalName}>{activeTarget.name}</Text>
        <Text style={styles.signalDist}>
          {Math.round(distanceToTarget * 3.28084)} FT
        </Text>
      </TouchableOpacity>

      {/* MINI COMPASS */}
      <View style={styles.compassPosition}>
        <View
          style={[
            styles.ring,
            { transform: [{ rotate: `${(360 - flatHeading) % 360}deg` }] },
          ]}
        >
          <Text style={styles.nText}>N</Text>
        </View>
        <View style={styles.fixedIndicator} />
      </View>

      {/* CENTRAL WAYFINDER & STEP-BY-STEP HUD */}
      <View style={[styles.wayfinderLayer, !inRange && { opacity: 0.5 }]}>
        <View
          style={[styles.compassBase, isCaptured && { borderColor: "#ffd700" }]}
        >
          <View style={styles.lubberLine} />
          <View
            style={[
              styles.floatingDisc,
              {
                transform: [
                  { rotate: `${inRange ? wayfinderRotation : 0}deg` },
                ],
              },
            ]}
          >
            <Text
              style={[styles.targetIcon, isCaptured && { color: "#ffd700" }]}
            >
              {isCaptured ? "✔" : "✦"}
            </Text>
          </View>
        </View>

        {readyToCapture ? (
          <TouchableOpacity
            style={styles.captureButton}
            onPress={() =>
              setCapturedGhosts([...capturedGhosts, activeTarget.id])
            }
          >
            <Text style={styles.captureText}>⚡ CAPTURE ⚡</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.instructionPill, !inRange && styles.pillOut]}>
            {/* PRIMARY DIRECTION (GEOMETRIC) */}
            <Text style={styles.instructionText}>{turnInstruction}</Text>

            {/* GOOGLE STREET INSTRUCTIONS */}
            <View style={styles.routeContainer}>
              <Text style={styles.routeCurrent}>
                {isCaptured
                  ? "TARGET SECURED"
                  : `${currentStep} (${stepDistance})`}
              </Text>
              {!isCaptured && nextStep ? (
                <Text style={styles.routeNext}>{nextStep}</Text>
              ) : null}
            </View>
          </View>
        )}
      </View>

      {/* AR OVERLAY */}
      {inRange && turnInstruction === "LOCKED" && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Canvas gl={{ alpha: true }} camera={{ fov: 45 }}>
            <ambientLight intensity={1.5} />
            <GhostBuilding
              distance={Math.max(6, distanceToTarget)}
              siteId={activeTarget.id}
              isCaptured={isCaptured}
            />
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
  headerBar: {
    position: "absolute",
    top: 50,
    left: 20,
    width: "65%",
    backgroundColor: "rgba(0,0,0,0.85)",
    padding: 15,
    borderRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: "#00ffff",
    zIndex: 10,
  },
  headerOut: { borderLeftColor: "#ff3333" },
  headerCaptured: { borderLeftColor: "#ffd700" },
  headerLabel: {
    color: "#00ffff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  signalName: { color: "#fff", fontSize: 14, fontWeight: "900" },
  signalDist: { color: "#fff", fontSize: 22, fontWeight: "300" },
  compassPosition: { position: "absolute", top: 60, right: 30, zIndex: 10 },
  ring: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#00ffff",
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  nText: { color: "#00ffff", fontSize: 12, fontWeight: "900" },
  fixedIndicator: {
    position: "absolute",
    top: -4,
    left: 23,
    width: 4,
    height: 10,
    backgroundColor: "#ff3333",
    borderRadius: 2,
  },
  wayfinderLayer: {
    position: "absolute",
    bottom: 80,
    alignSelf: "center",
    alignItems: "center",
    zIndex: 20,
  },
  compassBase: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderWidth: 1,
    borderColor: "rgba(0,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  lubberLine: {
    position: "absolute",
    top: 0,
    width: 3,
    height: 10,
    backgroundColor: "#ff3333",
  },
  floatingDisc: {
    width: 90,
    height: 90,
    justifyContent: "center",
    alignItems: "center",
  },
  targetIcon: { color: "#00ffff", fontSize: 24 },
  instructionPill: {
    marginTop: 15,
    width: width * 0.85,
    backgroundColor: "rgba(0,0,0,0.9)",
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#00ffff",
    alignItems: "center",
  },
  pillOut: { borderColor: "#ff3333" },
  instructionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 8,
  },
  routeContainer: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,255,255,0.2)",
    paddingTop: 8,
    alignItems: "center",
  },
  routeCurrent: {
    color: "#00ffff",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  routeNext: { color: "#fff", fontSize: 9, opacity: 0.6, textAlign: "center" },
  captureButton: {
    marginTop: 15,
    backgroundColor: "rgba(0,255,255,0.2)",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#00ffff",
  },
  captureText: { color: "#fff", fontSize: 18, fontWeight: "900" },
});

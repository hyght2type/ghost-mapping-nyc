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
    // FIX: Shifted the GPS coordinate South from the center of the structure directly onto the 28th Street front steps
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
  const [turnInstruction, setTurnInstruction] = useState(
    "CALIBRATING SENSORS...",
  );

  const [routeInstruction, setRouteInstruction] = useState(
    "AWAITING NETWORK...",
  );

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

  const GOOGLE_API_KEY = "YOUR_API_KEY_HERE";

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

  useEffect(() => {
    if (GOOGLE_API_KEY === "YOUR_API_KEY_HERE" || !GOOGLE_API_KEY) {
      setRouteInstruction("ROUTING OFFLINE // API KEY REQUIRED");
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
            let cleanInstruction = steps[0].html_instructions.replace(
              /<[^>]*>?/gm,
              "",
            );
            let distanceStr = steps[0].distance.text;
            setRouteInstruction(
              `${cleanInstruction.toUpperCase()} (${distanceStr})`,
            );
          } else {
            setRouteInstruction("PROCEED DIRECTLY TO TARGET");
          }
        } else {
          setRouteInstruction("SIGNAL LOST // NO ROUTE FOUND");
        }
      } catch (error) {
        setRouteInstruction("NETWORK ERROR");
      }
    };

    fetchRoute();
    const routeInterval = setInterval(fetchRoute, 10000);
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

    if (shortestDistance <= MAX_DETECTION_RADIUS) {
      setInRange(true);
    } else {
      setInRange(false);
    }
  }, [userLoc, autoRadarActive, activeTarget]);

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

    const hasBeenCaptured = capturedGhosts.includes(activeTarget.id);

    if (!inRange) {
      setTurnInstruction("APPROACHING TARGET REGION");
    } else if (hasBeenCaptured) {
      setTurnInstruction("SIGNAL CONTAINED");
    } else {
      if (Math.abs(diff) < 20) setTurnInstruction("TARGET LOCKED");
      else if (diff < 0) setTurnInstruction("◀ TURN LEFT");
      else setTurnInstruction("TURN RIGHT ▶");
    }

    const distY = dLat * 111320;
    const distX = dLon * 111320 * Math.cos(userLoc.latitude * (Math.PI / 180));
    const realDist = Math.sqrt(distX * distX + distY * distY);

    if (!isNaN(realDist)) setDistanceToTarget(realDist);
  }, [userLoc, trueHeading, activeTarget, inRange, capturedGhosts]);

  const cycleTarget = () => {
    setAutoRadarActive(false);
    const currentIndex = GHOST_SITES.findIndex(
      (site) => site.id === activeTarget.id,
    );
    const nextIndex = (currentIndex + 1) % GHOST_SITES.length;
    setActiveTarget(GHOST_SITES[nextIndex]);
  };

  const handleCapture = () => {
    if (!capturedGhosts.includes(activeTarget.id)) {
      setCapturedGhosts([...capturedGhosts, activeTarget.id]);
    }
  };

  if (!permission?.granted) return <View style={styles.load} />;

  const safeDist = distanceToTarget || 0;
  const distFeet = Math.round(safeDist * 3.28084) || 0;
  const distMeters = Math.round(safeDist) || 0;

  const safeFlatHeading = flatHeading || 0;
  const safeWayfinderRot = wayfinderRotation || 0;

  const isCaptured = capturedGhosts.includes(activeTarget.id);
  const readyToCapture = inRange && safeDist <= CAPTURE_RADIUS && !isCaptured;

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

      {inRange && !isCaptured && (
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
        </Animated.View>
      )}

      <TouchableOpacity
        style={[
          styles.headerBar,
          !inRange && styles.headerOut,
          isCaptured && styles.headerCaptured,
        ]}
        activeOpacity={0.7}
        onPress={cycleTarget}
      >
        <Text
          style={[
            styles.headerLabel,
            !inRange && styles.textOut,
            isCaptured && styles.textCaptured,
          ]}
        >
          {autoRadarActive ? "RADAR: AUTO" : "RADAR: MANUAL"}
          {isCaptured
            ? " // CONTAINED"
            : inRange
              ? " // LOCKED"
              : " // OUT OF RANGE"}
        </Text>
        <View style={styles.signalContent}>
          <Text style={[styles.signalSub, !inRange && styles.textOut]}>
            {activeTarget.year}
          </Text>
          <Text
            style={[
              styles.signalName,
              !inRange && styles.textOut,
              isCaptured && styles.textCaptured,
            ]}
          >
            {activeTarget.name}
          </Text>
          <Text style={[styles.signalDist, !inRange && styles.textOut]}>
            {distFeet} FT // {distMeters} M
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.compassPosition} pointerEvents="none">
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

      <View
        style={[styles.wayfinderLayer, !inRange && styles.wayfinderDim]}
        pointerEvents={readyToCapture ? "auto" : "none"}
      >
        <View
          style={[styles.compassBase, isCaptured && styles.compassCaptured]}
        >
          <View style={styles.lubberLine} />
          <View
            style={[
              styles.floatingDisc,
              {
                transform: [{ rotate: `${inRange ? safeWayfinderRot : 0}deg` }],
              },
            ]}
          >
            <Text
              style={[
                styles.targetIcon,
                !inRange && styles.iconOut,
                isCaptured && styles.iconCaptured,
              ]}
            >
              {isCaptured ? "✔" : "✦"}
            </Text>
            <Text
              style={[
                styles.targetLabel,
                !inRange && styles.textOut,
                isCaptured && styles.textCaptured,
              ]}
            >
              {isCaptured ? "ARCHIVED" : inRange ? "FRONT DOOR" : "NO SIGNAL"}
            </Text>
          </View>
        </View>

        {readyToCapture ? (
          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCapture}
            activeOpacity={0.8}
          >
            <Text style={styles.captureText}>⚡ CAPTURE SIGNAL ⚡</Text>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.instructionPill,
              !inRange && styles.pillOut,
              isCaptured && styles.pillCaptured,
            ]}
          >
            <Text
              style={[
                styles.instructionText,
                !inRange && styles.textOut,
                isCaptured && styles.textCaptured,
              ]}
            >
              {turnInstruction}
            </Text>
            <Text
              style={[
                styles.routeInstructionText,
                !inRange && styles.textOut,
                isCaptured && styles.textCaptured,
              ]}
            >
              {isCaptured ? "TARGET SECURED" : routeInstruction}
            </Text>
          </View>
        )}
      </View>

      {inRange && turnInstruction === "TARGET LOCKED" && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Canvas gl={{ alpha: true }} camera={{ fov: 45 }}>
            <ambientLight intensity={1.5} />
            <GhostBuilding
              distance={Math.max(6, safeDist)}
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
  ghostContainer: {
    position: "absolute",
    width: 250,
    height: 250,
    zIndex: 10000,
    justifyContent: "center",
    alignItems: "center",
  },
  ghostSymbol: { fontSize: 120, color: "rgba(0, 255, 255, 0.4)" },

  headerBar: {
    position: "absolute",
    top: 50,
    left: 20,
    width: "65%",
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 15,
    borderRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: "#00ffff",
    zIndex: 10,
  },
  headerOut: {
    borderLeftColor: "#ff3333",
    backgroundColor: "rgba(50,0,0,0.8)",
  },
  headerCaptured: {
    borderLeftColor: "#ffd700",
    backgroundColor: "rgba(50,40,0,0.8)",
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
  wayfinderDim: { opacity: 0.5 },
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
  compassCaptured: { borderColor: "rgba(255,215,0,0.4)" },
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
  iconOut: { color: "#ff3333" },
  iconCaptured: { color: "#ffd700" },
  textOut: { color: "#ffaaaa" },
  textCaptured: { color: "#ffd700" },

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
  pillOut: { borderColor: "#ff3333" },
  pillCaptured: { borderColor: "#ffd700" },
  instructionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
  },
  routeInstructionText: {
    color: "#00ffff",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginTop: 4,
    opacity: 0.8,
    textAlign: "center",
  },

  captureButton: {
    marginTop: 15,
    backgroundColor: "rgba(0,255,255,0.2)",
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#00ffff",
    alignItems: "center",
    shadowColor: "#00ffff",
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  captureText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2,
  },

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

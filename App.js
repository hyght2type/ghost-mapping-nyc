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

  const [currentStep, setCurrentStep] = useState("AWAITING GPS...");
  const [nextStep, setNextStep] = useState("");
  const [stepDistance, setStepDistance] = useState("");

  const lastHeadingRef = useRef(0);
  const wayfinderSmoothRef = useRef(0);
  const ghostAnimation = useRef(new Animated.Value(0)).current;

  const madgwick = useRef(new AHRS({ sampleInterval: 33, algorithm: "Madgwick", beta: 0.04 })).current;
  const sensors = useRef({ ax: 0, ay: 0, az: 1, gx: 0, gy: 0, gz: 0, mx: 0, my: 0, mz: 0 }).current;
  const compassSensors = useRef({ x: 0, z: 0 }).current;

  const GLOBAL_YAW_OFFSET = -15.0;
  const MAX_DETECTION_RADIUS = 150;
  const CAPTURE_RADIUS = 15;

  const GOOGLE_API_KEY = "AIzaSyDTIVetes1xe40R8d6e7bsI8vL7VXh1p_U";

  const lowPass = (current, previous, alpha = 0.2) => {
    if (current === undefined || current === null || isNaN(current)) return previous;
    return previous + alpha * (current - previous);
  };

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();

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

      let angle = Math.atan2(-compassSensors.x, -compassSensors.z) * (180 / Math.PI);
      let heading = (angle + 360 + 13.0 + GLOBAL_YAW_OFFSET) % 360;
      if (!isNaN(heading)) setFlatHeading(heading);
    });

    const fusionLoop = setInterval(() => {
      madgwick.update(sensors.gx, sensors.gy, sensors.gz, sensors.ax, sensors.ay, sensors.az, sensors.mx, sensors.my, sensors.mz);
      const euler = madgwick.getEulerAngles();
      let fusedHeading = (-euler.heading * (180 / Math.PI) + 360 + 13.0 + GLOBAL_YAW_OFFSET) % 360;
      if (!isNaN(fusedHeading)) {
        lastHeadingRef.current = fusedHeading;
        setTrueHeading(fusedHeading);
        const wayfinderDamping = 0.85;
        wayfinderSmoothRef.current = wayfinderSmoothRef.current * wayfinderDamping + fusedHeading * (1 - wayfinderDamping);
      }
    }, 33);

    let locSub;
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        locSub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 0.1 }, (loc) => {
          if (loc?.coords) {
            setUserLoc(loc.coords);
            userLocRef.current = loc.coords;
          }
        });
      }
    })();

    Animated.loop(Animated.timing(ghostAnimation, { toValue: 1, duration: 11000, easing: Easing.linear, useNativeDriver: true })).start();

    return () => {
      accSub.remove(); gyroSub.remove(); magSub.remove();
      clearInterval(fusionLoop); if (locSub) locSub.remove();
      ghostAnimation.stopAnimation();
    };
  }, [permission]);

  useEffect(() => {
    if (!GOOGLE_API_KEY) {
      setCurrentStep("API KEY REQUIRED");
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
            let currentRaw = steps[0].html_instructions.replace(/<[^>]*>?/gm, "");
            setCurrentStep(currentRaw.toUpperCase());
            setStepDistance(steps[0].distance.text);

            if (steps.length > 1) {
              let nextRaw = steps[1].html_instructions.replace(/<[^>]*>?/gm, "");
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
    const routeInterval = setInterval(fetchRoute, 8000);
    return () => clearInterval(routeInterval);
  }, [activeTarget]);

  useEffect(() => {
    if (!userLoc) return;
    let closestSite = activeTarget;
    let shortest
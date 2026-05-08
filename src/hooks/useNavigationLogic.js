import { useState, useEffect } from "react";
import * as Location from "expo-location";

export const useNavigationLogic = (targetCoords) => {
  const [navState, setNavState] = useState({
    trueNorth: 0,
    bearingToTarget: 0,
    distance: Infinity,
    isWithinRange: false,
  });

  useEffect(() => {
    let headingSub;
    let locationSub;

    const startTracking = async () => {
      // Request Permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      // 1. Independent True North Tracking
      headingSub = await Location.watchHeadingAsync((h) => {
        setNavState((prev) => ({ ...prev, trueNorth: h.trueHeading }));
      });

      // 2. Real-time Distance & Bearing Tracking
      locationSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1 },
        (loc) => {
          if (targetCoords) {
            const bearing = calculateBearing(
              loc.coords.latitude,
              loc.coords.longitude,
              targetCoords.lat,
              targetCoords.lng,
            );
            const dist = calculateDistance(
              loc.coords.latitude,
              loc.coords.longitude,
              targetCoords.lat,
              targetCoords.lng,
            );
            setNavState((prev) => ({
              ...prev,
              bearingToTarget: bearing,
              distance: dist,
              isWithinRange: dist <= 13.7, // Approx 45 feet
            }));
          }
        },
      );
    };

    startTracking();
    return () => {
      headingSub?.remove();
      locationSub?.remove();
    };
  }, [targetCoords]);

  return navState;
};

// Math: Haversine & Bearing
const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const toRad = (v) => (v * Math.PI) / 180;
  const toDeg = (v) => (v * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // meters
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 3.28084; // Result in Feet
};

// src/services/LocationService.js
import * as Location from "expo-location";

export const getPreciseLocation = async () => {
  // ... your code
};

export function getRelativePosition(userLat, userLon, targetLat, targetLon) {
  const R = 6378137;
  const dLat = (targetLat - userLat) * (Math.PI / 180);
  const dLon = (targetLon - userLon) * (Math.PI / 180);
  const x = R * dLon * Math.cos(userLat * (Math.PI / 180));
  const z = R * dLat;
  return [x, 0, -z];
}

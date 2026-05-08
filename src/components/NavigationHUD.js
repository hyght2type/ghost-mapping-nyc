import React from "react";
import { View, StyleSheet, Text } from "react-native";

export function NavigationHUD({
  vpsHeading,
  magHeading,
  target,
  userLoc,
  isActive,
  isApiLocked,
}) {
  if (!userLoc || !target) return null;

  // 6AM Simple Compass Math
  const compassRotation = (360 - magHeading) % 360;

  // Bearing Math
  const dy = target.coords.latitude - userLoc.latitude;
  const dx =
    Math.cos((userLoc.latitude * Math.PI) / 180) *
    (target.coords.longitude - userLoc.longitude);
  const bearingToTarget = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;

  let diff = bearingToTarget - vpsHeading;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  const isOnTarget = isApiLocked || Math.abs(diff) < 25;
  const arrowRotation = isOnTarget ? 0 : diff < 0 ? -90 : 90;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* COMPASS */}
      <View style={styles.compassContainer}>
        <View
          style={[
            styles.compassRing,
            { transform: [{ rotate: `${compassRotation}deg` }] },
          ]}
        >
          <Text style={styles.nLabel}>N</Text>
          <View style={styles.needle} />
        </View>
      </View>

      {/* TARGETING BOX */}
      {!isActive && (
        <View style={styles.centerBox}>
          <View style={[styles.reticle, isOnTarget && styles.activeReticle]}>
            <Text style={styles.siteName}>{target.name}</Text>
            <View
              style={{
                transform: [{ rotate: `${arrowRotation}deg` }],
                marginVertical: 15,
              }}
            >
              <Text style={[styles.arrow, isOnTarget && { color: "#00ffff" }]}>
                ▲
              </Text>
            </View>
            <Text style={styles.statusText}>
              {isOnTarget
                ? "TARGET LOCKED"
                : diff < 0
                  ? "SCAN LEFT"
                  : "SCAN RIGHT"}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  compassContainer: { position: "absolute", top: 50, right: 25 },
  compassRing: {
    width: 55,
    height: 55,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#00ffff",
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  nLabel: {
    color: "#00ffff",
    fontSize: 10,
    fontWeight: "900",
    position: "absolute",
    top: 2,
  },
  needle: { width: 2, height: 22, backgroundColor: "#ff3333", marginTop: 10 },
  centerBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  reticle: {
    width: 220,
    padding: 25,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
  },
  activeReticle: { borderColor: "#00ffff" },
  siteName: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },
  statusText: { color: "#fff", fontSize: 9, fontWeight: "bold", opacity: 0.6 },
  arrow: { color: "#fff", fontSize: 36 },
});

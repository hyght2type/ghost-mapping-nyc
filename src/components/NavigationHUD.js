import React from "react";
import { View, StyleSheet, Text, Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

export function NavigationHUD({
  vpsHeading,
  magHeading,
  target,
  userLoc,
  isActive,
  isApiLocked,
}) {
  if (!userLoc || !target) return null;

  // Compass: Simple, non-inverted rotation
  const compassRotation = (360 - magHeading) % 360;

  // Bearing Calculation
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
    <View style={styles.overlay} pointerEvents="box-none">
      {/* COMPASS */}
      <View style={styles.compassContainer}>
        <View
          style={[
            styles.ring,
            { transform: [{ rotate: `${compassRotation}deg` }] },
          ]}
        >
          <Text style={styles.n}>N</Text>
          <View style={styles.needle} />
        </View>
      </View>

      {/* TARGET BOX */}
      {!isActive && (
        <View style={styles.center} pointerEvents="none">
          <View style={[styles.box, isOnTarget && styles.boxActive]}>
            <Text style={styles.title}>{target.name}</Text>
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
            <Text style={styles.instr}>
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
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000 },
  compassContainer: { position: "absolute", top: 60, right: 30 },
  ring: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#00ffff",
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  n: {
    color: "#00ffff",
    fontSize: 12,
    fontWeight: "900",
    position: "absolute",
    top: 4,
  },
  needle: { width: 2, height: 26, backgroundColor: "#ff3333", marginTop: 10 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  box: {
    width: 240,
    padding: 30,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
  },
  boxActive: { borderColor: "#00ffff" },
  title: { color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  instr: { color: "#fff", fontSize: 10, fontWeight: "bold", opacity: 0.7 },
  arrow: { color: "#fff", fontSize: 42 },
});

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

  // COMPASS: North correction
  const compassRotation = (360 - magHeading) % 360;

  // DIRECTIONAL BOX MATH
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
    <View style={styles.hudWrapper} pointerEvents="box-none">
      {/* INDEPENDENT COMPASS: TOP RIGHT */}
      <View style={styles.compassContainer}>
        <View
          style={[
            styles.compassRing,
            { transform: [{ rotate: `${compassRotation}deg` }] },
          ]}
        >
          <Text style={styles.northText}>N</Text>
          <View style={styles.needle} />
        </View>
      </View>

      {/* CENTER TARGETING BOX */}
      {!isActive && (
        <View style={styles.reticleContainer} pointerEvents="none">
          <View style={[styles.targetBox, isOnTarget && styles.activeBox]}>
            <Text style={styles.buildingTitle}>{target.name}</Text>
            <View
              style={{
                transform: [{ rotate: `${arrowRotation}deg` }],
                marginVertical: 20,
              }}
            >
              <Text
                style={[styles.arrowIcon, isOnTarget && { color: "#00ffff" }]}
              >
                ▲
              </Text>
            </View>
            <Text style={styles.statusLabel}>
              {isOnTarget
                ? "TARGET IDENTIFIED"
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
  hudWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 10,
  },
  compassContainer: {
    position: "absolute",
    top: 60,
    right: 25,
  },
  compassRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#00ffff",
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  northText: {
    color: "#00ffff",
    fontSize: 12,
    fontWeight: "900",
    position: "absolute",
    top: 4,
  },
  needle: { width: 2, height: 25, backgroundColor: "#ff3333", marginTop: 10 },
  reticleContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  targetBox: {
    width: 240,
    padding: 25,
    backgroundColor: "rgba(0,0,0,0.9)",
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
  },
  activeBox: { borderColor: "#00ffff" },
  buildingTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
  statusLabel: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
    opacity: 0.6,
  },
  arrowIcon: { color: "#fff", fontSize: 40 },
});

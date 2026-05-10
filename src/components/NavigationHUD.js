import React from "react";
import { View, StyleSheet, Text, Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

export function NavigationHUD({
  vpsHeading,
  magHeading,
  target,
  userLoc,
  isApiLocked,
}) {
  if (!userLoc || !target) return null;

  // HEADING-UP: The ring rotates to keep 'N' pointing at the real North.
  // We use a negative rotation so the world stays still while the phone turns.
  const ringRotation = (360 - magHeading) % 360;

  // TARGETING MATH
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
      {/* COMPASS CONTAINER */}
      <View style={styles.compassPosition}>
        <View
          style={[
            styles.ring,
            { transform: [{ rotate: `${ringRotation}deg` }] },
          ]}
        >
          <View style={styles.northMarker}>
            <Text style={styles.nText}>N</Text>
          </View>
          <View style={styles.dotMarker} />
        </View>
        {/* FIXED INDICATOR (Your Forward View) */}
        <View style={styles.fixedIndicator} />
      </View>

      {/* TARGETING BOX */}
      <View style={styles.centerContainer} pointerEvents="none">
        <View style={[styles.targetBox, isOnTarget && styles.targetBoxActive]}>
          <Text style={styles.buildingName}>{target.name}</Text>
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
          <Text style={styles.instructionText}>
            {isOnTarget
              ? "TARGET LOCKED"
              : diff < 0
                ? "SCAN LEFT"
                : "SCAN RIGHT"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hudWrapper: {
    position: "absolute",
    width: width,
    height: height,
    top: 0,
    left: 0,
    zIndex: 2000,
  },
  compassPosition: {
    position: "absolute",
    top: 60,
    right: 30,
    width: 75,
    height: 75,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    borderWidth: 3,
    borderColor: "#00ffff",
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  northMarker: { position: "absolute", top: 4, alignItems: "center" },
  nText: { color: "#00ffff", fontSize: 16, fontWeight: "900" },
  dotMarker: {
    position: "absolute",
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  fixedIndicator: {
    position: "absolute",
    top: -4,
    width: 4,
    height: 16,
    backgroundColor: "#ff3333",
    borderRadius: 2,
    zIndex: 2001,
  },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  targetBox: {
    width: 240,
    padding: 30,
    backgroundColor: "rgba(0,0,0,0.9)",
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
  },
  targetBoxActive: {
    borderColor: "#00ffff",
    backgroundColor: "rgba(0,255,255,0.1)",
  },
  buildingName: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
  instructionText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
    opacity: 0.8,
  },
  arrowIcon: { color: "#fff", fontSize: 48 },
});

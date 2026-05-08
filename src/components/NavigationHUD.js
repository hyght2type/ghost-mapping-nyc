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

  // COMPASS: Fixed North Logic
  const compassRotation = (360 - magHeading) % 360;

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
    <View style={styles.nuclearWrapper} pointerEvents="box-none">
      {/* INDEPENDENT COMPASS */}
      <View
        style={[
          styles.compassBox,
          { transform: [{ rotate: `${compassRotation}deg` }] },
        ]}
      >
        <Text style={styles.n}>N</Text>
        <View style={styles.needle} />
      </View>

      {/* CENTER RETICLE */}
      {!isActive && (
        <View style={styles.centerContainer} pointerEvents="none">
          <View style={[styles.reticle, isOnTarget && styles.active]}>
            <Text style={styles.siteTitle}>{target.name}</Text>
            <View
              style={{
                transform: [{ rotate: `${arrowRotation}deg` }],
                marginVertical: 20,
              }}
            >
              <Text style={[styles.arrow, isOnTarget && { color: "#00ffff" }]}>
                ▲
              </Text>
            </View>
            <Text style={styles.status}>
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
  nuclearWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    width: width,
    height: height,
    zIndex: 999999, // Force to very top
    elevation: 999,
  },
  compassBox: {
    position: "absolute",
    top: 70,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#00ffff",
    backgroundColor: "rgba(0,0,0,0.85)",
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
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  reticle: {
    width: 250,
    padding: 35,
    backgroundColor: "rgba(0,0,0,0.9)",
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
  },
  active: { borderColor: "#00ffff", borderWidth: 2 },
  siteTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2,
  },
  status: { color: "#fff", fontSize: 10, fontWeight: "bold", opacity: 0.7 },
  arrow: { color: "#fff", fontSize: 48 },
});

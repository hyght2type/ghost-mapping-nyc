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

  // COMPASS: Corrected for True North in NYC
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
    <View style={styles.absoluteLayer} pointerEvents="box-none">
      {/* INDEPENDENT COMPASS: Fixed to top right */}
      <View style={styles.compassBox}>
        <View
          style={[
            styles.ring,
            { transform: [{ rotate: `${compassRotation}deg` }] },
          ]}
        >
          <Text style={styles.nText}>N</Text>
          <View style={styles.needle} />
        </View>
      </View>

      {/* CENTER TARGETING: Fixed to middle */}
      {!isActive && (
        <View style={styles.centerAim}>
          <View style={[styles.reticle, isOnTarget && styles.reticleActive]}>
            <Text style={styles.name}>{target.name}</Text>
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
            <Text style={styles.msg}>
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
  absoluteLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: width,
    height: height,
    zIndex: 99999,
  },
  compassBox: { position: "absolute", top: 60, right: 30 },
  ring: {
    width: 65,
    height: 65,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: "#00ffff",
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  nText: {
    color: "#00ffff",
    fontSize: 14,
    fontWeight: "900",
    position: "absolute",
    top: 4,
  },
  needle: { width: 2, height: 28, backgroundColor: "#ff3333", marginTop: 10 },
  centerAim: { flex: 1, justifyContent: "center", alignItems: "center" },
  reticle: {
    width: 260,
    padding: 35,
    backgroundColor: "rgba(0,0,0,0.9)",
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
  },
  reticleActive: {
    borderColor: "#00ffff",
    shadowColor: "#00ffff",
    shadowRadius: 10,
    shadowOpacity: 0.5,
  },
  name: { color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 2 },
  msg: { color: "#fff", fontSize: 11, fontWeight: "bold", opacity: 0.8 },
  arrow: { color: "#fff", fontSize: 48 },
});

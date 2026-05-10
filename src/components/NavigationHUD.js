import React from "react";
import { View, StyleSheet, Text, Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

export function NavigationHUD({
  vpsHeading,
  magHeading,
  target,
  userLoc,
  isApiLocked,
  distance,
}) {
  if (!userLoc || !target) return null;

  // 1. LEAVE COMPASS ALONE (Golden Build)
  const ringRotation = (360 - magHeading) % 360;

  // 2. TARGETING MATH
  const dy = target.coords.latitude - userLoc.latitude;
  const dx =
    Math.cos((userLoc.latitude * Math.PI) / 180) *
    (target.coords.longitude - userLoc.longitude);
  const bearingToTarget = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;

  let diff = bearingToTarget - vpsHeading;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  const isOnTarget = isApiLocked || Math.abs(diff) < 25;

  return (
    <View style={styles.hudWrapper} pointerEvents="box-none">
      {/* HEADER: NEAREST SIGNAL BAR (From Image 2) */}
      <View style={styles.headerBar}>
        <Text style={styles.headerLabel}>GHOST MAPPING // NYC</Text>
        <View style={styles.signalContent}>
          <Text style={styles.signalSub}>NEAREST SIGNAL:</Text>
          <Text style={styles.signalName}>{target.name.toUpperCase()}</Text>
          <Text style={styles.signalDist}>{Math.round(distance)}m</Text>
        </View>
      </View>

      {/* COMPASS: (Upper Right - Untouched) */}
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
        </View>
        <View style={styles.fixedIndicator} />
      </View>

      {/* CENTER: TARGETING BOX (From Image 1) */}
      <View style={styles.centerContainer} pointerEvents="none">
        <View style={[styles.targetBox, isOnTarget && styles.targetBoxActive]}>
          <Text style={styles.boxName}>{target.name}</Text>
          <Text style={[styles.boxArrow, isOnTarget && { color: "#00ffff" }]}>
            ▲
          </Text>
          <Text style={styles.boxStatus}>
            {isOnTarget ? "TARGET LOCKED" : "ALIGNING..."}
          </Text>
        </View>
      </View>

      {/* FOOTER: DIRECTIONAL NAVIGATION PILL (From Image 2) */}
      {!isOnTarget && (
        <View style={styles.navPill}>
          <Text style={styles.navText}>
            {diff < 0 ? `◀◀ BLUE SIGNAL LEFT` : `BLUE SIGNAL RIGHT ▶▶`}
          </Text>
        </View>
      )}
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
  headerBar: {
    position: "absolute",
    top: 50,
    left: 20,
    width: "60%",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: "#fff",
  },
  headerLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 10,
  },
  signalSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 9,
    fontWeight: "bold",
  },
  signalName: { color: "#fff", fontSize: 18, fontWeight: "900" },
  signalDist: { color: "#fff", fontSize: 24, fontWeight: "300", opacity: 0.8 },
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
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  northMarker: { position: "absolute", top: 4, alignItems: "center" },
  nText: { color: "#00ffff", fontSize: 16, fontWeight: "900" },
  fixedIndicator: {
    position: "absolute",
    top: -4,
    width: 4,
    height: 16,
    backgroundColor: "#ff3333",
    borderRadius: 2,
  },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  targetBox: {
    width: 240,
    height: 240,
    padding: 20,
    backgroundColor: "rgba(0,255,255,0.05)",
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(0,255,255,0.3)",
    alignItems: "center",
    justifyContent: "space-around",
  },
  targetBoxActive: {
    borderColor: "#00ffff",
    backgroundColor: "rgba(0,255,255,0.15)",
  },
  boxName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 2,
  },
  boxArrow: { color: "#fff", fontSize: 48 },
  boxStatus: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  navPill: {
    position: "absolute",
    bottom: 250,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 2,
  },
  navText: {
    color: "#00ffff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
});

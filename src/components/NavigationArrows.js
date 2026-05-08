import React from "react";
import { View, StyleSheet, Text } from "react-native";

export function NavigationArrows({
  currentHeading,
  targetCoords,
  userLoc,
  isActive,
}) {
  // If we are locked on the target, hide the guide
  if (isActive || !userLoc || !targetCoords) return null;

  // 1. CALCULATE BEARING (Angle to the building)
  const dy = targetCoords.latitude - userLoc.latitude;
  const dx =
    Math.cos((userLoc.latitude * Math.PI) / 180) *
    (targetCoords.longitude - userLoc.longitude);
  const angleToSite = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;

  // 2. CALCULATE RELATIVE ANGLE
  // This is the degree difference between where you face and where the ghost is
  const relativeAngle = angleToSite - currentHeading;

  return (
    <View style={styles.container}>
      <View style={styles.compassCircle}>
        <View
          style={[
            styles.arrowWrapper,
            { transform: [{ rotate: `${relativeAngle}deg` }] },
          ]}
        >
          {/* The Blue Needle */}
          <View style={styles.arrowHead} />
          <View style={styles.arrowBody} />
        </View>
      </View>
      <Text style={styles.hint}>FOLLOW SIGNAL</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 100, // Positioned above the bottom of the screen
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  compassCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "rgba(0, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  arrowWrapper: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  arrowHead: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 20,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#00ffff",
  },
  arrowBody: {
    width: 4,
    height: 20,
    backgroundColor: "#00ffff",
  },
  hint: {
    color: "#00ffff",
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 10,
    letterSpacing: 2,
    opacity: 0.8,
  },
});

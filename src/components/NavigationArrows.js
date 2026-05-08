import React from "react";
import { View, StyleSheet, Text } from "react-native";

export function NavigationArrows({
  currentHeading,
  targetCoords,
  userLoc,
  isActive,
}) {
  if (isActive || !userLoc || !targetCoords) return null;

  // Calculate the angle to the target
  const dy = targetCoords.latitude - userLoc.latitude;
  const dx =
    Math.cos((userLoc.latitude * Math.PI) / 180) *
    (targetCoords.longitude - userLoc.longitude);
  const angleToSite = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;

  // Find the shortest rotation to the target
  let diff = angleToSite - currentHeading;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  // Only show arrows if the target is more than 20 degrees off-center
  if (Math.abs(diff) < 20) return null;

  return (
    <View style={styles.container}>
      {diff < 0 ? (
        <Text style={styles.arrow}>{"◀◀ BLUE SIGNAL LEFT"}</Text>
      ) : (
        <Text style={styles.arrow}>{"BLUE SIGNAL RIGHT ▶▶"}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: "50%",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: {
    color: "#00ffff",
    fontSize: 14,
    fontWeight: "900",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    letterSpacing: 2,
    textShadowColor: "cyan",
    textShadowRadius: 10,
  },
});

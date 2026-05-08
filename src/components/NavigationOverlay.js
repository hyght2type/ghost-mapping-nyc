import React from "react";
import { View, StyleSheet, Text, Image } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

const NavigationOverlay = ({ navState }) => {
  const { trueNorth, bearingToTarget, isWithinRange, distance } = navState;

  // COMPASS: Rotates to True North
  const compassStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-trueNorth}deg` }],
  }));

  // NAV ARROW: Rotates relative to phone facing
  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${bearingToTarget - trueNorth}deg` }],
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      {/* 3. The Tower: Appears only when within 45ft */}
      {isWithinRange && (
        <View style={styles.towerContainer}>
          <View style={styles.tower} />
          <Text style={styles.towerText}>DESTINATION REACHED</Text>
        </View>
      )}

      {/* 2. Independent True North Compass (Top Right) */}
      <Animated.View style={[styles.compass, compassStyle]}>
        <Text style={styles.northLetter}>N</Text>
        <View style={styles.needle} />
      </Animated.View>

      {/* 1. Center Nav Panel */}
      <View style={styles.centerHUD}>
        <Animated.View style={arrowStyle}>
          <Ionicons name="navigate" size={60} color="#00FFCC" />
        </Animated.View>
        <Text style={styles.distText}>{Math.round(distance)} FT</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999, // Force to front
    alignItems: "center",
    justifyContent: "center",
  },
  centerHUD: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 2,
    borderColor: "#00FFCC",
    alignItems: "center",
    justifyContent: "center",
  },
  compass: {
    position: "absolute",
    top: 60,
    right: 30,
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#fff",
    alignItems: "center",
  },
  northLetter: { color: "#FF4444", fontWeight: "bold", fontSize: 12 },
  needle: { width: 2, height: 20, backgroundColor: "#fff" },
  towerContainer: { position: "absolute", bottom: 100, alignItems: "center" },
  tower: {
    width: 80,
    height: 200,
    backgroundColor: "rgba(0, 255, 204, 0.3)",
    borderWidth: 1,
    borderColor: "#00FFCC",
  },
  towerText: { color: "#00FFCC", marginTop: 10, fontWeight: "bold" },
  distText: { color: "#fff", fontSize: 12, marginTop: 5 },
});

export default NavigationOverlay;

// ... existing imports ...

export default function App() {
  // ... existing state ...

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* 1. BACKGROUND: CAMERA */}
      <View style={StyleSheet.absoluteFill}>
        <CameraView style={{ flex: 1 }} facing="back" active={true} />
      </View>

      {/* 2. MID-GROUND: 3D GHOST (Only appears when in range/locked) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Canvas gl={{ alpha: true }} camera={{ fov: 45 }}>
          <ambientLight intensity={1.5} />
          {activeSite && <GhostBuilding distance={15} />}
        </Canvas>
      </View>

      {/* 3. FOREGROUND: HUD (Always On) */}
      <NavigationHUD
        vpsHeading={vpsHeading}
        magHeading={magHeading}
        target={SITE}
        userLoc={userLoc}
        isApiLocked={vpsAccuracy < 25}
      />

      {/* 4. STATUS PILL */}
      <View style={styles.statusPill} pointerEvents="none">
        <View
          style={[
            styles.dot,
            { backgroundColor: vpsAccuracy < 25 ? "#00ffff" : "#ff3333" },
          ]}
        />
        <Text style={styles.pillText}>
          {vpsAccuracy < 25 ? "VPS ACTIVE" : "SCANNING STREET..."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  statusPill: {
    position: "absolute",
    top: 60,
    left: 20,
    zIndex: 2000,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 10,
    borderRadius: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  pillText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
});

# Ghost Mapping Sensor Logic (Locked)

## The Problem

Standard mobile compasses use (X, Y) plane for flat table-top navigation.
AR requires Vertical (Face-up) orientation where the Z-axis (camera) becomes
the primary depth vector.

## The Winning Formula

To align the Manhattan street grid with the iPhone Pro magnetometer in
Portrait mode:

**Math:** `Math.atan2(data.z, -data.x)`

**Why:** 1. `Z`: Points out of the back camera (Forward). 2. `-X`: Inverts the horizontal axis to correct for the camera's mirror. 3. `13.0`: NYC Magnetic Declination.

**DO NOT REVERT TO ATAN2(X, Y) - IT WILL BREAK VERTICAL HUD.**

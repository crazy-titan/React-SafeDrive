import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Vibration,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as Location from "expo-location";
import {
  Shield,
  Clock,
  AlertTriangle,
  Play,
  Square,
  Activity,
  Zap,
  RotateCw,
  PhoneOff,
  Sparkles,
} from "lucide-react-native";
import { GBubble } from "../components/GBubble";
import { TelemetryChart } from "../components/TelemetryChart";
import { DetectorService } from "../services/detectorService";
import { DriveSimulationService, SimulationProfileType } from "../services/driveSimulationService";
import { sensorService } from "../services/sensorService";
import { storageService, DrivingEvent, DriveCoordinate, DriveSession } from "../services/storageService";

export default function DriveHUD() {
  const params = useLocalSearchParams();
  const mode = params.mode as "real" | "simulation";
  const profile = params.profile as SimulationProfileType;

  // Active state
  const [isRunning, setIsRunning] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentScore, setCurrentScore] = useState(100);
  const [speed, setSpeed] = useState(0);
  const [activeAlert, setActiveAlert] = useState<string | null>(null);

  // G-Force and Telemetry values
  const [gForce, setGForce] = useState({ x: 0, y: 0, z: 0 });
  const [linearAccelMag, setLinearAccelMag] = useState<number[]>([]);
  const [eventCount, setEventCount] = useState(0);

  // references to log data during session
  const eventsLog = useRef<DrivingEvent[]>([]);
  const routeLog = useRef<DriveCoordinate[]>([]);
  const currentCoords = useRef<{ latitude: number; longitude: number }>({
    latitude: 37.7749,
    longitude: -122.4194,
  });

  // Services
  const simulationService = useRef(new DriveSimulationService());
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const sensorTimer = useRef<NodeJS.Timeout | null>(null);
  const clockTimer = useRef<NodeJS.Timeout | null>(null);

  // Detector Initialization
  const detector = useRef(
    new DetectorService((event) => {
      // Points deductions
      let deduction = 0;
      switch (event.type) {
        case "harsh_brake":
          deduction = 5;
          break;
        case "harsh_accel":
          deduction = 5;
          break;
        case "sharp_turn":
          deduction = 3;
          break;
        case "aggressive_steer":
          deduction = 4;
          break;
        case "excessive_movement":
          deduction = 2;
          break;
        case "phone_handling":
          deduction = 10;
          break;
      }

      setCurrentScore((prev) => Math.max(0, prev - deduction));
      setEventCount((prev) => prev + 1);

      const newEvent: DrivingEvent = {
        id: Math.random().toString(),
        type: event.type,
        timestamp: elapsedTime, // elapsed seconds
        magnitude: event.magnitude,
        title: event.title,
        description: event.description,
        latitude: currentCoords.current.latitude,
        longitude: currentCoords.current.longitude,
      };

      eventsLog.current.push(newEvent);
      triggerAlertNotification(event.title);
      playWarningChime();
    })
  );

  // Alert Flash Timer
  const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerAlertNotification = (title: string) => {
    setActiveAlert(title);
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    alertTimeoutRef.current = setTimeout(() => {
      setActiveAlert(null);
    }, 2500);
  };

  // Warning alert feedback using haptics
  const playWarningChime = () => {
    try {
      // Trigger a distinct double vibration pulse: wait 0ms, vibrate 150ms, wait 100ms, vibrate 150ms
      Vibration.vibrate([0, 150, 100, 150]);
    } catch (e) {
      console.warn("Failed to vibrate device:", e);
    }
  };

  // 1. Hook up listeners (sensors or simulator)
  useEffect(() => {
    detector.current.reset();
    simulationService.current.reset();

    // Start 1-second elapsed clock timer
    clockTimer.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    if (mode === "simulation") {
      simulationService.current.setProfile(profile);

      // Start 20Hz updates
      sensorTimer.current = setInterval(() => {
        const step = simulationService.current.getNextStep();
        
        // update simulation position
        currentCoords.current = {
          latitude: step.latitude,
          longitude: step.longitude,
        };

        // log coordinates to route trace (every 1 second/20 steps for memory optimization)
        if (simulationService.current["stepCount"] % 20 === 0) {
          routeLog.current.push({
            latitude: step.latitude,
            longitude: step.longitude,
            speed: step.speed,
            timestamp: Math.round(simulationService.current["stepCount"] * 0.05),
          });
        }

        // Process data
        const processed = detector.current.processTelemetry(
          step.accel,
          step.gyro,
          null,
          simulationService.current["stepCount"] * 0.05
        );

        setSpeed(step.speed);
        setGForce(processed.gForce);
        
        // Update live graph history buffer
        setLinearAccelMag((prev) => {
          const updated = [...prev, processed.horizontalG];
          if (updated.length > 40) updated.shift();
          return updated;
        });

      }, 50); // 20Hz (50ms)
    } else {
      // REAL DEVICE HARDWARE MODE
      // Setup GPS Location tracking
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          locationSubscription.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.BestForNavigation,
              timeInterval: 1000,
              distanceInterval: 2,
            },
            (location) => {
              const speedKmH = location.coords.speed 
                ? Math.round(location.coords.speed * 3.6) 
                : 0;

              setSpeed(Math.max(0, speedKmH));
              
              currentCoords.current = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              };

              routeLog.current.push({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                speed: Math.max(0, speedKmH),
                timestamp: elapsedTime,
              });
            }
          );
        }
      })();

      // Start hardware sensors
      sensorService.startListening((data) => {
        const processed = detector.current.processTelemetry(
          data.accel,
          data.gyro,
          data.motion,
          elapsedTime
        );

        setGForce(processed.gForce);
        
        setLinearAccelMag((prev) => {
          const updated = [...prev, processed.horizontalG];
          if (updated.length > 40) updated.shift();
          return updated;
        });
      });
    }

    return () => {
      stopSessionListening();
    };
  }, [mode, profile]);

  const stopSessionListening = () => {
    if (sensorTimer.current) {
      clearInterval(sensorTimer.current);
      sensorTimer.current = null;
    }
    if (clockTimer.current) {
      clearInterval(clockTimer.current);
      clockTimer.current = null;
    }
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    sensorService.stopListening();
  };

  const handleEndDrive = async () => {
    setIsRunning(false);
    stopSessionListening();

    // Final calculations
    const finalDuration = elapsedTime;
    const finalScore = currentScore;
    
    // Calculate simulated or raw distance
    // average speed * time
    let distanceKm = 0;
    if (routeLog.current.length > 0) {
      const avgSpeed = routeLog.current.reduce((sum, c) => sum + c.speed, 0) / routeLog.current.length;
      distanceKm = (avgSpeed * (finalDuration / 3600)); // speed in km/h * time in hours
    }

    // Safety checks: if routeLog is empty (e.g. static/sim issues), make mock points
    if (routeLog.current.length === 0) {
      // Inject a static point
      routeLog.current.push({
        latitude: currentCoords.current.latitude,
        longitude: currentCoords.current.longitude,
        speed: 0,
        timestamp: finalDuration,
      });
    }

    const rating = currentScore >= 90 
      ? "Excellent" 
      : currentScore >= 75 
        ? "Good" 
        : currentScore >= 50 
          ? "Average" 
          : "Poor";

    const session: DriveSession = {
      id: Math.random().toString(36).substring(7),
      date: new Date().toISOString(),
      duration: finalDuration,
      score: finalScore,
      rating,
      distance: parseFloat(distanceKm.toFixed(2)),
      events: eventsLog.current,
      route: routeLog.current,
      mode: mode === "simulation" ? "simulated" : "real",
      simulationProfile: mode === "simulation" ? profile : undefined,
    };

    // Save session to storage
    await storageService.saveSession(session);

    // Redirect to Summary Screen with session ID
    router.replace({
      pathname: "/summary",
      params: { id: session.id },
    });
  };

  // Helper to format MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Interactive buttons for simulated custom profiles
  const triggerSimEvent = (type: "brake" | "accel" | "turn" | "swerve" | "handling" | "sliding") => {
    if (mode === "simulation") {
      simulationService.current.injectEvent(type);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Active Alert Banner */}
      {activeAlert && (
        <View style={styles.alertBanner}>
          <AlertTriangle size={18} color="#EF4444" />
          <Text style={styles.alertText}>{activeAlert} Warning</Text>
        </View>
      )}

      {/* Main HUD Display */}
      <View style={styles.hudHeader}>
        <View>
          <Text style={styles.hudSubtitle}>DRIVING HUD ({mode.toUpperCase()})</Text>
          <Text style={styles.hudTime}>
            <Clock size={16} color="#9CA3AF" style={{ marginRight: 6 }} />
            {formatTime(elapsedTime)}
          </Text>
        </View>
        <View style={styles.hudScoreContainer}>
          <Text style={styles.hudScoreVal}>{currentScore}</Text>
          <Text style={styles.hudScoreLabel}>SCORE</Text>
        </View>
      </View>

      <View style={styles.telemetryGrid}>
        {/* Speedometer card */}
        <View style={styles.telemetryCard}>
          <Text style={styles.cardLabel}>SPEED</Text>
          <View style={styles.speedContainer}>
            <Text style={styles.speedVal}>{speed}</Text>
            <Text style={styles.speedUnit}>km/h</Text>
          </View>
          <View style={styles.miniStats}>
            <Activity size={10} color="#6B7280" />
            <Text style={styles.miniStatsText}>{eventCount} Alerts Logged</Text>
          </View>
        </View>

        {/* G-Force crosshair bubble */}
        <GBubble gx={gForce.x} gy={gForce.y} size={150} />
      </View>

      {/* Rolling Acceleration Line Graph */}
      <View style={styles.graphWrapper}>
        <Text style={styles.graphTitle}>HORIZONTAL ACCELERATION FORCE (G)</Text>
        <TelemetryChart data={linearAccelMag} height={80} color="#3B82F6" />
      </View>

      {/* Manual Simulator Injection Controls (Shown only in Simulated - Custom Mode) */}
      {mode === "simulation" && profile === "custom" && (
        <View style={styles.simControlsCard}>
          <View style={styles.simHeader}>
            <Sparkles size={14} color="#3B82F6" />
            <Text style={styles.simTitle}>SIMULATOR CONTROL PANEL</Text>
          </View>
          <View style={styles.simButtonsGrid}>
            <TouchableOpacity
              style={[styles.simBtn, { borderColor: "#EF4444" }]}
              onPress={() => triggerSimEvent("brake")}
            >
              <Text style={[styles.simBtnText, { color: "#EF4444" }]}>Harsh Brake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.simBtn, { borderColor: "#10B981" }]}
              onPress={() => triggerSimEvent("accel")}
            >
              <Text style={[styles.simBtnText, { color: "#10B981" }]}>Harsh Accel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.simBtn, { borderColor: "#3B82F6" }]}
              onPress={() => triggerSimEvent("turn")}
            >
              <Text style={[styles.simBtnText, { color: "#3B82F6" }]}>Sharp Turn</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.simBtn, { borderColor: "#F59E0B" }]}
              onPress={() => triggerSimEvent("swerve")}
            >
              <Text style={[styles.simBtnText, { color: "#F59E0B" }]}>Swerve / Jerk</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.simBtn, { borderColor: "#EC4899" }]}
              onPress={() => triggerSimEvent("handling")}
            >
              <Text style={[styles.simBtnText, { color: "#EC4899" }]}>Pick Up Phone</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.simBtn, { borderColor: "#8B5CF6" }]}
              onPress={() => triggerSimEvent("sliding")}
            >
              <Text style={[styles.simBtnText, { color: "#8B5CF6" }]}>Slide / Shake</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Floating Info / Fallback Alert for Web/Simulator on Real mode */}
      {mode === "real" && (
        <View style={styles.realDeviceHint}>
          <Shield size={12} color="#10B981" />
          <Text style={styles.hintText}>
            Telemetry logging is active. Secure device in a vehicle mount to calibrate.
          </Text>
        </View>
      )}

      {/* Footer Controls */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.endBtn} onPress={handleEndDrive}>
          <Square size={16} color="#FFFFFF" fill="#FFFFFF" />
          <Text style={styles.endBtnText}>End Drive Session</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F19",
    paddingHorizontal: 20,
    justifyContent: "space-between",
  },
  alertBanner: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "#EF4444",
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    zIndex: 99,
    gap: 8,
  },
  alertText: {
    color: "#EF4444",
    fontWeight: "700",
    fontSize: 14,
  },
  hudHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 10,
  },
  hudSubtitle: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  hudTime: {
    color: "#F3F4F6",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 4,
    alignItems: "center",
  },
  hudScoreContainer: {
    alignItems: "center",
  },
  hudScoreVal: {
    color: "#10B981",
    fontSize: 36,
    fontWeight: "900",
  },
  hudScoreLabel: {
    color: "#6B7280",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: -4,
  },
  telemetryGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  telemetryCard: {
    flex: 1,
    height: 180,
    backgroundColor: "rgba(17, 24, 39, 0.7)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#374151",
    padding: 16,
    justifyContent: "space-between",
  },
  cardLabel: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  speedContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  speedVal: {
    color: "#FFFFFF",
    fontSize: 54,
    fontWeight: "900",
  },
  speedUnit: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  miniStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  miniStatsText: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "600",
  },
  graphWrapper: {
    marginTop: 10,
  },
  graphTitle: {
    color: "#6B7280",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  simControlsCard: {
    backgroundColor: "rgba(17, 24, 39, 0.6)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 14,
    marginTop: 10,
  },
  simHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  simTitle: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  simButtonsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },
  simBtn: {
    width: "48%",
    paddingVertical: 8,
    borderWidth: 1.5,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "rgba(17, 24, 39, 0.4)",
  },
  simBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
  realDeviceHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  hintText: {
    color: "#10B981",
    fontSize: 10,
    fontWeight: "600",
    flex: 1,
  },
  footer: {
    marginVertical: 20,
    alignItems: "center",
  },
  endBtn: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: "#EF4444", // Red
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  endBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});

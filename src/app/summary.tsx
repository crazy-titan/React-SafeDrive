import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import {
  Shield,
  Clock,
  Car,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Award,
  AlertCircle,
} from "lucide-react-native";
import { CircularProgress } from "../components/CircularProgress";
import { RouteMap } from "../components/RouteMap";
import { storageService, DriveSession, getSafetyRating } from "../services/storageService";
import { coachingService } from "../services/coachingService";

export default function DriveSummary() {
  const { id } = useLocalSearchParams();
  const [session, setSession] = useState<DriveSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      if (!id) return;
      const sessions = await storageService.getSessions();
      const found = sessions.find((s) => s.id === id);
      setSession(found || null);
      setLoading(false);
    };

    fetchSession();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Analyzing Telemetry...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.errorContainer}>
        <AlertTriangle size={48} color="#EF4444" />
        <Text style={styles.errorText}>Failed to load drive summary.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace("/")}>
          <Text style={styles.backBtnText}>Return to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Generate coaching report
  const coaching = coachingService.generateReport(session.score, session.events);

  // Group events by type
  const eventCounts = session.events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getRatingColor = (rating: DriveSession["rating"]) => {
    switch (rating) {
      case "Excellent":
        return "#10B981";
      case "Good":
        return "#3B82F6";
      case "Average":
        return "#F59E0B";
      case "Poor":
        return "#EF4444";
    }
  };

  const getEventName = (type: string) => {
    switch (type) {
      case "harsh_brake":
        return "Harsh Braking";
      case "harsh_accel":
        return "Harsh Accel";
      case "sharp_turn":
        return "Sharp Turning";
      case "aggressive_steer":
        return "Aggressive Swerve";
      case "excessive_movement":
        return "Phone Sliding";
      case "phone_handling":
        return "Phone Handling";
      default:
        return "Safety Event";
    }
  };

  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatTimelineTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Score Circular Progress Card */}
      <View style={styles.scoreCard}>
        <CircularProgress score={session.score} size={150} />
        
        <View style={styles.scoreMeta}>
          <Text style={styles.ratingSubtitle}>DRIVING EFFICIENCY RATING</Text>
          <Text style={[styles.ratingTitle, { color: getRatingColor(session.rating) }]}>
            {session.rating}
          </Text>
          <Text style={styles.tripMeta}>
            Mode: {session.mode === "simulated" ? "Simulated Profile" : "Real Telemetry"}
          </Text>
        </View>
      </View>

      {/* 2. Key Metrics Stats Cards */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricItem}>
          <Clock size={16} color="#9CA3AF" />
          <Text style={styles.metricVal}>{formatElapsedTime(session.duration)}</Text>
          <Text style={styles.metricLabel}>Duration</Text>
        </View>
        <View style={styles.metricItem}>
          <Car size={16} color="#9CA3AF" />
          <Text style={styles.metricVal}>{session.distance.toFixed(1)} km</Text>
          <Text style={styles.metricLabel}>Distance</Text>
        </View>
        <View style={styles.metricItem}>
          <AlertTriangle size={16} color="#EF4444" />
          <Text style={styles.metricVal}>{session.events.length}</Text>
          <Text style={styles.metricLabel}>Alerts Logged</Text>
        </View>
      </View>

      {/* 3. Event Breakdown Matrix */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Event Breakdown</Text>
        <View style={styles.breakdownGrid}>
          {[
            { type: "harsh_brake", label: "Harsh Braking", iconColor: "#EF4444" },
            { type: "harsh_accel", label: "Harsh Accel", iconColor: "#10B981" },
            { type: "sharp_turn", label: "Sharp Turning", iconColor: "#3B82F6" },
            { type: "aggressive_steer", label: "Swerve/Steer", iconColor: "#F59E0B" },
            { type: "excessive_movement", label: "Phone Sliding", iconColor: "#8B5CF6" },
            { type: "phone_handling", label: "Phone Usage", iconColor: "#EC4899" },
          ].map((item) => (
            <View key={item.type} style={styles.breakdownItem}>
              <View style={styles.breakdownItemHeader}>
                <View style={[styles.dot, { backgroundColor: item.iconColor }]} />
                <Text style={styles.breakdownLabel}>{item.label}</Text>
              </View>
              <Text style={styles.breakdownVal}>{eventCounts[item.type] || 0}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 4. Interactive Route Heatmap */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Route Heatmap Replay</Text>
        <RouteMap route={session.route} events={session.events} height={180} />
        <View style={styles.mapLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: "#10B981" }]} />
            <Text style={styles.legendText}>Gentle Driving</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: "#EF4444" }]} />
            <Text style={styles.legendText}>Harsh Telemetry</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendPin}><Text style={styles.legendPinText}>B</Text></View>
            <Text style={styles.legendText}>Event Location</Text>
          </View>
        </View>
      </View>

      {/* 5. AI Coach Report Card */}
      <View style={styles.sectionCard}>
        <View style={styles.coachTitleContainer}>
          <Award size={18} color="#10B981" />
          <Text style={styles.sectionTitle}>AI Safety Coach Review</Text>
        </View>
        
        <Text style={styles.coachVerdict}>{coaching.verdict}</Text>
        
        {coaching.strengths.length > 0 && (
          <View style={styles.feedbackBlock}>
            <Text style={styles.feedbackBlockTitle}>Key Strengths</Text>
            {coaching.strengths.map((str, idx) => (
              <View key={`strength-${idx}`} style={styles.bulletItem}>
                <View style={[styles.bulletPoint, { backgroundColor: "#10B981" }]} />
                <Text style={styles.bulletText}>{str}</Text>
              </View>
            ))}
          </View>
        )}

        {coaching.improvements.length > 0 && (
          <View style={styles.feedbackBlock}>
            <Text style={styles.feedbackBlockTitle}>Areas for Improvement</Text>
            {coaching.improvements.map((imp, idx) => (
              <View key={`improve-${idx}`} style={styles.bulletItem}>
                <View style={[styles.bulletPoint, { backgroundColor: "#EF4444" }]} />
                <Text style={styles.bulletText}>{imp}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.feedbackBlock}>
          <Text style={styles.feedbackBlockTitle}>Safe Driving Tips</Text>
          {coaching.recommendations.map((rec, idx) => (
            <View key={`rec-${idx}`} style={styles.bulletItem}>
              <ChevronRight size={14} color="#3B82F6" />
              <Text style={styles.bulletText}>{rec}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 6. Event Timeline */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Session Timeline</Text>
        {session.events.length === 0 ? (
          <Text style={styles.emptyTimelineText}>No warnings logged during this session.</Text>
        ) : (
          <View style={styles.timelineWrapper}>
            {session.events.map((event, index) => {
              const isLast = index === session.events.length - 1;
              return (
                <View key={event.id} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <Text style={styles.timelineTime}>{formatTimelineTime(event.timestamp)}</Text>
                    <View style={styles.timelineLineWrapper}>
                      <View style={styles.timelineCircle} />
                      {!isLast && <View style={styles.timelineLine} />}
                    </View>
                  </View>
                  <View style={styles.timelineBody}>
                    <View style={styles.timelineHeaderRow}>
                      <Text style={styles.timelineEventTitle}>{event.title}</Text>
                      <Text style={styles.deductionText}>-5</Text>
                    </View>
                    <Text style={styles.timelineEventDesc}>{event.description}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Footer Save & Exit Button */}
      <TouchableOpacity style={styles.saveBtn} onPress={() => router.replace("/")}>
        <Text style={styles.saveBtnText}>Save Trip & Exit</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F19",
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0B0F19",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#9CA3AF",
    marginTop: 12,
    fontSize: 14,
    fontWeight: "600",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#0B0F19",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "700",
    marginVertical: 14,
  },
  backBtn: {
    backgroundColor: "#1F2937",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backBtnText: {
    color: "#F3F4F6",
    fontWeight: "700",
  },
  scoreCard: {
    backgroundColor: "rgba(17, 24, 39, 0.6)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    flexDirection: "row",
    gap: 20,
  },
  scoreMeta: {
    flex: 1,
    justifyContent: "center",
  },
  ratingSubtitle: {
    color: "#6B7280",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
  },
  ratingTitle: {
    fontSize: 28,
    fontWeight: "900",
    marginVertical: 2,
  },
  tripMeta: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "500",
  },
  metricsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  metricItem: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.5)",
    borderWidth: 1,
    borderColor: "#1F2937",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  metricVal: {
    color: "#F3F4F6",
    fontSize: 15,
    fontWeight: "800",
    marginVertical: 4,
  },
  metricLabel: {
    color: "#6B7280",
    fontSize: 9,
    fontWeight: "500",
  },
  sectionCard: {
    backgroundColor: "rgba(17, 24, 39, 0.5)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 18,
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  breakdownGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  breakdownItem: {
    width: "48%",
    backgroundColor: "#111827",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1F2937",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  breakdownLabel: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "600",
  },
  breakdownVal: {
    color: "#F3F4F6",
    fontSize: 14,
    fontWeight: "800",
  },
  mapLegend: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 3,
    borderRadius: 1.5,
  },
  legendPin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "#FFFFFF",
  },
  legendPinText: {
    color: "#FFFFFF",
    fontSize: 6.5,
    fontWeight: "900",
  },
  legendText: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "600",
  },
  coachTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  coachVerdict: {
    color: "#D1D5DB",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
    marginBottom: 14,
  },
  feedbackBlock: {
    marginBottom: 12,
  },
  feedbackBlockTitle: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 4,
    paddingLeft: 4,
  },
  bulletPoint: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  bulletText: {
    color: "#9CA3AF",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    flex: 1,
  },
  emptyTimelineText: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
    marginVertical: 10,
  },
  timelineWrapper: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 14,
  },
  timelineLeft: {
    width: 60,
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  timelineTime: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "700",
    width: 34,
  },
  timelineLineWrapper: {
    alignItems: "center",
    height: "100%",
    width: 10,
    position: "relative",
  },
  timelineCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    zIndex: 1,
    marginTop: 4,
  },
  timelineLine: {
    width: 1.5,
    backgroundColor: "#1F2937",
    position: "absolute",
    top: 10,
    bottom: -15,
    left: 3.2,
  },
  timelineBody: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1F2937",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timelineHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timelineEventTitle: {
    color: "#F3F4F6",
    fontSize: 12,
    fontWeight: "700",
  },
  deductionText: {
    color: "#EF4444",
    fontSize: 10,
    fontWeight: "800",
  },
  timelineEventDesc: {
    color: "#6B7280",
    fontSize: 10,
    marginTop: 2,
    fontWeight: "500",
  },
  saveBtn: {
    backgroundColor: "#10B981", // Emerald
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 10,
  },
  saveBtnText: {
    color: "#0B0F19",
    fontSize: 16,
    fontWeight: "800",
  },
});

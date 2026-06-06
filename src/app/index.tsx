import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
} from "react-native";
import { useFocusEffect, router } from "expo-router";
import {
  Shield,
  Play,
  Car,
  Trash2,
  Calendar,
  Clock,
  AlertTriangle,
  RotateCcw,
} from "lucide-react-native";
import { storageService, DriveSession, getSafetyRating } from "../services/storageService";

export default function Index() {
  const [sessions, setSessions] = useState<DriveSession[]>([]);
  const [useSimulation, setUseSimulation] = useState(true);
  const [simProfile, setSimProfile] = useState<"safe" | "aggressive" | "distracted" | "custom">("safe");

  // Load drives when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [])
  );

  const loadSessions = async () => {
    const data = await storageService.getSessions();
    setSessions(data);
  };

  const handleDeleteSession = (id: string) => {
    Alert.alert(
      "Delete Drive",
      "Are you sure you want to delete this drive from history?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await storageService.deleteSession(id);
            loadSessions();
          },
        },
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      "Clear All History",
      "This will permanently delete all logged drives. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            await storageService.clearAllHistory();
            loadSessions();
          },
        },
      ]
    );
  };

  const handleStartDrive = () => {
    router.push({
      pathname: "/drive",
      params: {
        mode: useSimulation ? "simulation" : "real",
        profile: simProfile,
      },
    });
  };

  // Compute lifetime metrics
  const totalDrives = sessions.length;
  const avgScore = totalDrives
    ? Math.round(sessions.reduce((sum, s) => sum + s.score, 0) / totalDrives)
    : 100;
  const totalHours = totalDrives
    ? (sessions.reduce((sum, s) => sum + s.duration, 0) / 3600).toFixed(1)
    : "0.0";
  const totalDistance = totalDrives
    ? sessions.reduce((sum, s) => sum + s.distance, 0).toFixed(1)
    : "0.0";

  const lifetimeRating = getSafetyRating(avgScore);

  const getRatingColor = (rating: DriveSession["rating"]) => {
    switch (rating) {
      case "Excellent":
        return "#10B981"; // Emerald
      case "Good":
        return "#3B82F6"; // Blue
      case "Average":
        return "#F59E0B"; // Amber
      case "Poor":
        return "#EF4444"; // Red
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Lifetime Stats Panel */}
      <View style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <View>
            <Text style={styles.statsHeaderSubtitle}>LIFETIME SAFETY SCORE</Text>
            <Text style={[styles.statsHeaderTitle, { color: getRatingColor(lifetimeRating) }]}>
              {avgScore}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: getRatingColor(lifetimeRating) + "20" }]}>
            <Shield size={16} color={getRatingColor(lifetimeRating)} />
            <Text style={[styles.badgeText, { color: getRatingColor(lifetimeRating) }]}>
              {lifetimeRating}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{totalDrives}</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{totalDistance} km</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{totalHours} hr</Text>
            <Text style={styles.statLabel}>Time Spent</Text>
          </View>
        </View>
      </View>

      {/* 2. Start Drive Pane */}
      <View style={styles.drivePanel}>
        <Text style={styles.panelTitle}>Setup Session</Text>
        
        {/* Mode Selector */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, useSimulation && styles.toggleBtnActive]}
            onPress={() => setUseSimulation(true)}
          >
            <Text style={[styles.toggleText, useSimulation && styles.toggleTextActive]}>
              Simulated Route
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !useSimulation && styles.toggleBtnActive]}
            onPress={() => setUseSimulation(false)}
          >
            <Text style={[styles.toggleText, !useSimulation && styles.toggleTextActive]}>
              Real Hardware
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sim Profile Dropdown (Only visible if using simulation) */}
        {useSimulation && (
          <View style={styles.dropdownContainer}>
            <Text style={styles.inputLabel}>Simulation Profile</Text>
            <View style={styles.profileGrid}>
              {[
                { id: "safe", label: "Safe Commute" },
                { id: "aggressive", label: "Aggressive" },
                { id: "distracted", label: "Distracted" },
                { id: "custom", label: "Interactive HUD" },
              ].map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.profileBtn,
                    simProfile === p.id && styles.profileBtnActive,
                  ]}
                  onPress={() => setSimProfile(p.id as any)}
                >
                  <Text
                    style={[
                      styles.profileBtnText,
                      simProfile === p.id && styles.profileBtnTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.startBtn} onPress={handleStartDrive}>
          <Play size={20} color="#0B0F19" fill="#0B0F19" />
          <Text style={styles.startBtnText}>Start New Drive</Text>
        </TouchableOpacity>
      </View>

      {/* 3. History List */}
      <View style={styles.historyContainer}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Driving History</Text>
          {sessions.length > 0 && (
            <TouchableOpacity onPress={handleClearHistory} style={styles.clearBtn}>
              <RotateCcw size={14} color="#EF4444" />
              <Text style={styles.clearBtnText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        {sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Car size={48} color="#1F2937" />
            <Text style={styles.emptyText}>No drives logged yet</Text>
            <Text style={styles.emptySubtitle}>
              Configure your drive above and tap "Start New Drive" to track safety metrics.
            </Text>
          </View>
        ) : (
          sessions.map((session) => {
            const dateStr = new Date(session.date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            const minutes = Math.floor(session.duration / 60);
            const seconds = session.duration % 60;
            const durationStr = `${minutes}m ${seconds}s`;

            return (
              <View key={session.id} style={styles.historyCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardMeta}>
                    <Calendar size={12} color="#6B7280" />
                    <Text style={styles.cardDate}>{dateStr}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteSession(session.id)}
                    style={styles.deleteBtn}
                  >
                    <Trash2 size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardScoreContainer}>
                    <Text style={[styles.cardScore, { color: getRatingColor(session.rating) }]}>
                      {session.score}
                    </Text>
                    <Text style={styles.cardScoreLabel}>Score</Text>
                  </View>

                  <View style={styles.cardStatsGrid}>
                    <View style={styles.cardStat}>
                      <Clock size={12} color="#9CA3AF" />
                      <Text style={styles.cardStatVal}>{durationStr}</Text>
                    </View>
                    <View style={styles.cardStat}>
                      <Car size={12} color="#9CA3AF" />
                      <Text style={styles.cardStatVal}>{session.distance.toFixed(1)} km</Text>
                    </View>
                    <View style={styles.cardStat}>
                      <AlertTriangle size={12} color="#9CA3AF" />
                      <Text style={styles.cardStatVal}>{session.events.length} alerts</Text>
                    </View>
                  </View>
                  
                  <View style={[styles.miniBadge, { borderColor: getRatingColor(session.rating) }]}>
                    <Text style={[styles.miniBadgeText, { color: getRatingColor(session.rating) }]}>
                      {session.rating}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>
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
  statsCard: {
    backgroundColor: "rgba(17, 24, 39, 0.6)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 20,
    marginBottom: 20,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statsHeaderSubtitle: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  statsHeaderTitle: {
    fontSize: 54,
    fontWeight: "900",
    marginTop: -4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#1F2937",
    marginVertical: 16,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statVal: {
    color: "#F3F4F6",
    fontSize: 18,
    fontWeight: "800",
  },
  statLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  drivePanel: {
    backgroundColor: "rgba(17, 24, 39, 0.6)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 20,
    marginBottom: 24,
  },
  panelTitle: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: "#1F2937",
  },
  toggleText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
  },
  toggleTextActive: {
    color: "#FFFFFF",
  },
  dropdownContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
  },
  profileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  profileBtn: {
    flex: 1,
    minWidth: "45%",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
  },
  profileBtnActive: {
    borderColor: "#3B82F6",
    backgroundColor: "rgba(59, 130, 246, 0.08)",
  },
  profileBtnText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
  },
  profileBtnTextActive: {
    color: "#3B82F6",
  },
  startBtn: {
    flexDirection: "row",
    backgroundColor: "#10B981", // Emerald
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  startBtnText: {
    color: "#0B0F19",
    fontSize: 16,
    fontWeight: "800",
  },
  historyContainer: {
    marginTop: 8,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyTitle: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  clearBtnText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    backgroundColor: "rgba(17, 24, 39, 0.3)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(31, 41, 55, 0.4)",
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: "center",
    marginTop: 4,
  },
  emptyText: {
    color: "#D1D5DB",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
  },
  emptySubtitle: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  historyCard: {
    backgroundColor: "rgba(17, 24, 39, 0.5)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardDate: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "500",
  },
  deleteBtn: {
    padding: 4,
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardScoreContainer: {
    alignItems: "center",
    width: 50,
  },
  cardScore: {
    fontSize: 24,
    fontWeight: "800",
  },
  cardScoreLabel: {
    color: "#6B7280",
    fontSize: 9,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: -2,
  },
  cardStatsGrid: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingLeft: 12,
    paddingRight: 8,
  },
  cardStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardStatVal: {
    color: "#D1D5DB",
    fontSize: 12,
    fontWeight: "600",
  },
  miniBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  miniBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});

import AsyncStorage from "@react-native-async-storage/async-storage";

export type DrivingEventType =
  | "harsh_brake"
  | "harsh_accel"
  | "sharp_turn"
  | "aggressive_steer"
  | "excessive_movement"
  | "phone_handling";

export interface DrivingEvent {
  id: string;
  type: DrivingEventType;
  timestamp: number; // elapsed time in seconds from start of drive
  magnitude: number; // peak value recorded during the event (e.g. in m/s^2 or rad/s)
  title: string;
  description: string;
  latitude?: number;
  longitude?: number;
}

export interface DriveCoordinate {
  latitude: number;
  longitude: number;
  speed: number; // in km/h
  timestamp: number; // elapsed time in seconds
}

export interface DriveSession {
  id: string;
  date: string; // ISO string
  duration: number; // in seconds
  score: number; // 0-100
  rating: "Excellent" | "Good" | "Average" | "Poor";
  distance: number; // in km
  events: DrivingEvent[];
  route: DriveCoordinate[];
  mode: "real" | "simulated";
  simulationProfile?: string;
}

const STORAGE_KEY = "@SafeDrive:sessions";

export const getSafetyRating = (score: number): DriveSession["rating"] => {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Average";
  return "Poor";
};

export const storageService = {
  /**
   * Fetch all saved driving sessions
   */
  async getSessions(): Promise<DriveSession[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const sessions: DriveSession[] = JSON.parse(data);
      // Sort by date descending
      return sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error("Failed to load drive sessions from storage:", error);
      return [];
    }
  },

  /**
   * Save a completed driving session
   */
  async saveSession(session: DriveSession): Promise<boolean> {
    try {
      const sessions = await this.getSessions();
      sessions.push(session);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      return true;
    } catch (error) {
      console.error("Failed to save drive session to storage:", error);
      return false;
    }
  },

  /**
   * Delete a single drive session by ID
   */
  async deleteSession(id: string): Promise<boolean> {
    try {
      const sessions = await this.getSessions();
      const filtered = sessions.filter((s) => s.id !== id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error(`Failed to delete session ${id}:`, error);
      return false;
    }
  },

  /**
   * Clear all driving history
   */
  async clearAllHistory(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      console.error("Failed to clear driving history:", error);
      return false;
    }
  },
};

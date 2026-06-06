import { DrivingEvent, DrivingEventType } from "./storageService";

export interface SensorDataPoint {
  x: number;
  y: number;
  z: number;
}

export interface DeviceMotionDataPoint {
  acceleration: SensorDataPoint | null;
  accelerationIncludingGravity: SensorDataPoint;
  rotationRate: SensorDataPoint | null;
  orientation: {
    alpha: number; // yaw
    beta: number;  // pitch
    gamma: number; // roll
  } | null;
}

// Cooldown period in milliseconds to prevent double triggering
const EVENT_COOLDOWN = 3000;

export class DetectorService {
  private gravity = { x: 0, y: 0, z: 0 };
  private initialized = false;
  private alpha = 0.96; // gravity filter constant

  // Rolling buffers for sliding window computations
  private accelMagnitudeBuffer: number[] = [];
  private gyroMagnitudeBuffer: number[] = [];
  private lateralAccelBuffer: number[] = [];
  private bufferSize = 20; // 1 second of data at 20Hz

  // Cooldown timers for each event type
  private lastEventTimes: Record<DrivingEventType, number> = {
    harsh_brake: 0,
    harsh_accel: 0,
    sharp_turn: 0,
    aggressive_steer: 0,
    excessive_movement: 0,
    phone_handling: 0,
  };

  // Callback to notify UI of detected events
  private onEventDetected: (event: Omit<DrivingEvent, "id" | "timestamp">) => void;

  constructor(onEventDetected: (event: Omit<DrivingEvent, "id" | "timestamp">) => void) {
    this.onEventDetected = onEventDetected;
  }

  /**
   * Resets the detector state for a new driving session
   */
  public reset(): void {
    this.gravity = { x: 0, y: 0, z: 0 };
    this.initialized = false;
    this.accelMagnitudeBuffer = [];
    this.gyroMagnitudeBuffer = [];
    this.lateralAccelBuffer = [];
    this.lastEventTimes = {
      harsh_brake: 0,
      harsh_accel: 0,
      sharp_turn: 0,
      aggressive_steer: 0,
      excessive_movement: 0,
      phone_handling: 0,
    };
  }

  /**
   * Ingests sensor data point and runs detection checks.
   * Runs at ~20Hz.
   * @param accel Accelerometer reading (with gravity, in m/s^2)
   * @param gyro Gyroscope reading (rotation rate, in rad/s)
   * @param motion DeviceMotion data (optional, used if available for orientation)
   * @param elapsedSeconds Time elapsed since the start of the drive
   */
  public processTelemetry(
    accel: SensorDataPoint,
    gyro: SensorDataPoint,
    motion: DeviceMotionDataPoint | null,
    elapsedSeconds: number
  ): {
    linearAccel: SensorDataPoint;
    gForce: { x: number; y: number; z: number };
    horizontalG: number;
  } {
    const now = Date.now();

    // 1. Gravity low-pass filtering
    if (!this.initialized) {
      this.gravity = { ...accel };
      this.initialized = true;
    } else {
      this.gravity.x = this.alpha * this.gravity.x + (1 - this.alpha) * accel.x;
      this.gravity.y = this.alpha * this.gravity.y + (1 - this.alpha) * accel.y;
      this.gravity.z = this.alpha * this.gravity.z + (1 - this.alpha) * accel.z;
    }

    // 2. Linear Acceleration (subtract gravity)
    const linear = {
      x: accel.x - this.gravity.x,
      y: accel.y - this.gravity.y,
      z: accel.z - this.gravity.z,
    };

    // 3. Compute magnitudes
    const linearMag = Math.sqrt(linear.x * linear.x + linear.y * linear.y + linear.z * linear.z);
    const gyroMag = Math.sqrt(gyro.x * gyro.x + gyro.y * gyro.y + gyro.z * gyro.z);

    // G-forces (m/s^2 divided by standard gravity 9.80665)
    const gForce = {
      x: linear.x / 9.8,
      y: linear.y / 9.8,
      z: linear.z / 9.8,
    };
    // Horizontal G-force in phone's flat coordinate plane
    const horizontalG = Math.sqrt(gForce.x * gForce.x + gForce.y * gForce.y);

    // 4. Update rolling buffers
    this.accelMagnitudeBuffer.push(linearMag);
    this.gyroMagnitudeBuffer.push(gyroMag);
    this.lateralAccelBuffer.push(linear.x);

    if (this.accelMagnitudeBuffer.length > this.bufferSize) {
      this.accelMagnitudeBuffer.shift();
      this.gyroMagnitudeBuffer.shift();
      this.lateralAccelBuffer.shift();
    }

    // Wait until buffer is full before running windowed statistics
    if (this.accelMagnitudeBuffer.length < this.bufferSize) {
      return { linearAccel: linear, gForce, horizontalG };
    }

    // 5. Run Detection Algorithms

    // A. Possible Phone Handling
    // Criteria: High rotation rate on X or Y axis (tilt/pitch/roll rate)
    // combined with a shift in the gravity alignment (significant rotation in space)
    const gyroXYMag = Math.sqrt(gyro.x * gyro.x + gyro.y * gyro.y);
    if (
      gyroXYMag >= 1.2 && // Fast tilt / rotation rate
      now - this.lastEventTimes.phone_handling > EVENT_COOLDOWN
    ) {
      // Check if gravity vector changed significantly (tilt offset)
      // On real devices, picking up a phone causes high pitch/roll rate.
      this.triggerEvent("phone_handling", gyroXYMag, now);
    }

    // B. Excessive Device Movement (rattling/sliding)
    // Criteria: High variance in linear acceleration magnitude
    const accelVariance = this.calculateVariance(this.accelMagnitudeBuffer);
    if (
      accelVariance >= 2.2 &&
      now - this.lastEventTimes.excessive_movement > EVENT_COOLDOWN &&
      now - this.lastEventTimes.phone_handling > EVENT_COOLDOWN // suppress if already phone handling
    ) {
      this.triggerEvent("excessive_movement", accelVariance, now);
    }

    // C. Harsh Braking (Deceleration)
    // Criteria: Deceleration along Y-axis is strongly negative (under standard vertical mounting)
    // or overall linear magnitude is high in deceleration direction.
    // In our coordinate space: negative Y is braking, positive Y is acceleration.
    if (
      linear.y <= -3.2 &&
      now - this.lastEventTimes.harsh_brake > EVENT_COOLDOWN
    ) {
      this.triggerEvent("harsh_brake", Math.abs(linear.y), now);
    }

    // D. Harsh Acceleration
    // Criteria: Acceleration along Y-axis is strongly positive.
    if (
      linear.y >= 2.8 &&
      now - this.lastEventTimes.harsh_accel > EVENT_COOLDOWN
    ) {
      this.triggerEvent("harsh_accel", linear.y, now);
    }

    // E. Sharp Turn (Cornering)
    // Criteria: High lateral acceleration (X-axis) and yaw rate (Z-gyro) simultaneously
    const lateralG = Math.abs(linear.x);
    const yawRate = Math.abs(gyro.z);
    if (
      lateralG >= 3.0 &&
      yawRate >= 0.65 &&
      now - this.lastEventTimes.sharp_turn > EVENT_COOLDOWN
    ) {
      this.triggerEvent("sharp_turn", lateralG, now);
    }

    // F. Aggressive Steering / Swerving
    // Criteria: Rapid oscillation of lateral acceleration (e.g. standard swerve left then right).
    // We measure this by counting zero-crossings or high variance in lateral acceleration
    // combined with a high derivative (jerk).
    const lateralJerk = Math.abs(linear.x - this.lateralAccelBuffer[this.lateralAccelBuffer.length - 2]) * 20; // JERK: da/dt at 20Hz
    if (
      lateralJerk >= 6.5 &&
      this.calculateVariance(this.lateralAccelBuffer) > 1.8 &&
      now - this.lastEventTimes.aggressive_steer > EVENT_COOLDOWN &&
      now - this.lastEventTimes.sharp_turn > EVENT_COOLDOWN // suppress if it is a major sharp turn
    ) {
      this.triggerEvent("aggressive_steer", lateralJerk, now);
    }

    return { linearAccel: linear, gForce, horizontalG };
  }

  /**
   * Triggers the event detection callback and updates the cooldown timer
   */
  private triggerEvent(type: DrivingEventType, magnitude: number, now: number): void {
    this.lastEventTimes[type] = now;

    let title = "";
    let description = "";

    switch (type) {
      case "harsh_brake":
        title = "Harsh Braking";
        description = "Sudden, rapid deceleration detected.";
        break;
      case "harsh_accel":
        title = "Harsh Acceleration";
        description = "Sudden, rapid speed increase detected.";
        break;
      case "sharp_turn":
        title = "Sharp Turn";
        description = "Aggressive cornering force detected.";
        break;
      case "aggressive_steer":
        title = "Aggressive Swerve";
        description = "Sudden lateral swerve or weave detected.";
        break;
      case "excessive_movement":
        title = "Phone Sliding";
        description = "Device is sliding around or shaking.";
        break;
      case "phone_handling":
        title = "Phone Handling";
        description = "Device rotation suggests it was picked up.";
        break;
    }

    this.onEventDetected({
      type,
      magnitude,
      title,
      description,
    });
  }

  /**
   * Helper to compute variance of a list of numbers
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const sqDiffs = values.map((val) => Math.pow(val - mean, 2));
    return sqDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }
}

import { SensorDataPoint, DeviceMotionDataPoint } from "./detectorService";

export type SimulationProfileType = "safe" | "aggressive" | "distracted" | "custom";

export interface SimulationStep {
  accel: SensorDataPoint;
  gyro: SensorDataPoint;
  speed: number; // in km/h
  latitude: number;
  longitude: number;
}

export class DriveSimulationService {
  private profile: SimulationProfileType = "safe";
  
  // Simulated vehicle state
  private speed = 0; // m/s
  private heading = 0; // rad (0 is North)
  private latitude = 37.7749; // San Francisco start
  private longitude = -122.4194;
  private timeStep = 0.05; // 20Hz (50ms)
  private stepCount = 0;

  // Active manual injection state (for Custom Interactive Mode)
  private injectionActive: {
    type: "brake" | "accel" | "turn" | "swerve" | "handling" | "sliding" | null;
    remainingSteps: number;
  } = { type: null, remainingSteps: 0 };

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.speed = 0;
    this.heading = 0;
    this.latitude = 37.7749 + (Math.random() - 0.5) * 0.01; // slightly random start point
    this.longitude = -122.4194 + (Math.random() - 0.5) * 0.01;
    this.stepCount = 0;
    this.injectionActive = { type: null, remainingSteps: 0 };
  }

  public setProfile(profile: SimulationProfileType): void {
    this.profile = profile;
    this.reset();
  }

  /**
   * Inject a manual event for Custom Mode
   */
  public injectEvent(type: "brake" | "accel" | "turn" | "swerve" | "handling" | "sliding"): void {
    this.injectionActive = {
      type,
      remainingSteps: 15, // 15 steps @ 20Hz = 0.75 seconds of spike
    };
  }

  /**
   * Generates the next telemetry step (sensor readings + location) at 20Hz
   */
  public getNextStep(): SimulationStep {
    this.stepCount++;
    const totalSeconds = this.stepCount * this.timeStep;

    // Default base noise (vibrations of normal driving)
    let accelX = (Math.random() - 0.5) * 0.4;
    let accelY = (Math.random() - 0.5) * 0.4;
    let accelZ = 9.8 + (Math.random() - 0.5) * 0.4; // gravity + road noise

    let gyroX = (Math.random() - 0.5) * 0.05;
    let gyroY = (Math.random() - 0.5) * 0.05;
    let gyroZ = (Math.random() - 0.5) * 0.05;

    // Apply simulation rules based on profile & time or active injection
    let targetAccelY = 0.5; // gentle acceleration to start
    let targetYawRate = 0.0;

    // 1. Process active injections (takes precedence over profiles)
    if (this.injectionActive.type !== null && this.injectionActive.remainingSteps > 0) {
      const type = this.injectionActive.type;
      this.injectionActive.remainingSteps--;

      switch (type) {
        case "accel":
          accelY = 3.2 + Math.random() * 0.5; // > 2.8 threshold
          this.speed += 0.8; // increase speed quickly
          break;
        case "brake":
          accelY = -3.8 - Math.random() * 0.5; // < -3.2 threshold
          this.speed = Math.max(0, this.speed - 1.2); // stop quickly
          break;
        case "turn":
          accelX = 3.5 + Math.random() * 0.5; // lateral G
          gyroZ = 0.85 + Math.random() * 0.1; // yaw rate > 0.65 threshold
          this.heading += gyroZ * this.timeStep;
          break;
        case "swerve":
          // Oscillate lateral accel
          const wavePhase = this.injectionActive.remainingSteps % 6;
          accelX = wavePhase < 3 ? 3.4 : -3.4;
          gyroZ = wavePhase < 3 ? 0.4 : -0.4;
          this.heading += gyroZ * this.timeStep;
          break;
        case "handling":
          // Pick up phone: rotate on X and Y, add shaking
          gyroX = 1.6 + Math.random() * 0.4;
          gyroY = 1.4 + Math.random() * 0.4;
          accelX = (Math.random() - 0.5) * 1.5;
          accelY = (Math.random() - 0.5) * 1.5;
          break;
        case "sliding":
          // High variance on all axes
          accelX = (Math.random() - 0.5) * 4.0;
          accelY = (Math.random() - 0.5) * 4.0;
          accelZ = 9.8 + (Math.random() - 0.5) * 4.0;
          break;
      }

      if (this.injectionActive.remainingSteps === 0) {
        this.injectionActive.type = null;
      }
    } else {
      // 2. Process profile behaviors if no manual injection is active
      if (this.profile === "safe") {
        // Safe Commute Profile
        // Accelerate to ~50 km/h (14 m/s), cruise, turn slightly, cruise, slow down, stop.
        const cycle = Math.floor(totalSeconds) % 60; // 60-second repeating loop
        if (cycle < 10) {
          // Gentle accel
          targetAccelY = 1.2;
        } else if (cycle >= 10 && cycle < 25) {
          // Cruise
          targetAccelY = 0.0;
        } else if (cycle >= 25 && cycle < 30) {
          // Gentle turn
          targetAccelY = -0.1;
          targetYawRate = 0.25; // below 0.65 threshold
        } else if (cycle >= 30 && cycle < 45) {
          // Cruise
          targetAccelY = 0.0;
        } else if (cycle >= 45 && cycle < 55) {
          // Gentle braking
          targetAccelY = -1.2;
        } else {
          // Stop
          targetAccelY = 0;
          this.speed = 0;
        }

        accelY = targetAccelY + (Math.random() - 0.5) * 0.2;
        gyroZ = targetYawRate + (Math.random() - 0.5) * 0.02;
        accelX = (this.speed * targetYawRate) + (Math.random() - 0.5) * 0.2; // lateral centrifugal force
      } else if (this.profile === "aggressive") {
        // Aggressive Commute Profile
        const cycle = Math.floor(totalSeconds) % 50;
        if (cycle < 6) {
          // Harsh Accel
          targetAccelY = 3.2; // triggers Harsh Accel
        } else if (cycle >= 6 && cycle < 15) {
          // High speed cruise
          targetAccelY = 0.0;
        } else if (cycle >= 15 && cycle < 18) {
          // Harsh braking
          targetAccelY = -4.0; // triggers Harsh Brake
        } else if (cycle >= 18 && cycle < 28) {
          // Cruise
          targetAccelY = 0.0;
        } else if (cycle >= 28 && cycle < 32) {
          // Sharp fast turn
          targetAccelY = -0.4;
          targetYawRate = 0.85; // triggers Sharp Turn (>0.65)
          accelX = -3.8; // lateral force >3.0
        } else if (cycle >= 32 && cycle < 38) {
          // Aggressive weaving (swerving)
          const swerveCycle = Math.floor(this.stepCount / 4) % 2;
          accelX = swerveCycle === 0 ? 3.5 : -3.5; // triggers Swerving
          targetYawRate = swerveCycle === 0 ? 0.35 : -0.35;
        } else {
          // Cruise / Slow
          targetAccelY = -1.5;
        }

        accelY += targetAccelY;
        gyroZ += targetYawRate;
      } else if (this.profile === "distracted") {
        // Distracted Driver Profile (Phone picking and sliding)
        const cycle = Math.floor(totalSeconds) % 40;
        
        if (cycle >= 8 && cycle < 12) {
          // Picking up phone to text (high gyro on roll/pitch)
          gyroX = 1.5 + (Math.random() - 0.5) * 0.3;
          gyroY = 1.3 + (Math.random() - 0.5) * 0.3;
          accelX = (Math.random() - 0.5) * 1.0;
          accelY = (Math.random() - 0.5) * 1.0;
        } else if (cycle >= 20 && cycle < 24) {
          // Phone sliding on console (high acceleration variance)
          accelX = (Math.random() - 0.5) * 3.5;
          accelY = (Math.random() - 0.5) * 3.5;
          accelZ = 9.8 + (Math.random() - 0.5) * 3.5;
        } else {
          // Normal driving
          targetAccelY = 0.4;
          if (this.speed > 10) targetAccelY = 0;
        }
        
        accelY += targetAccelY;
      } else {
        // Custom interactive mode background driving
        // Accelerates slowly to 40 km/h and cruises, waiting for triggers
        if (this.speed < 11.1) {
          accelY += 0.8; // gentle acceleration
        } else {
          accelY += 0.0; // cruise
        }
      }
    }

    // 3. Update speed (v = v + a_y * dt), capped between 0 and 110 km/h (30.5 m/s)
    this.speed = Math.max(0, Math.min(30.5, this.speed + accelY * this.timeStep));

    // 4. Update heading (theta = theta + w_z * dt)
    this.heading += gyroZ * this.timeStep;

    // 5. Update GPS position based on speed and heading
    // 1 degree latitude = ~111,111 meters
    // 1 degree longitude = ~111,111 * cos(latitude) meters
    const dist = this.speed * this.timeStep;
    const dLat = (dist * Math.cos(this.heading)) / 111111;
    const dLng = (dist * Math.sin(this.heading)) / (111111 * Math.cos((this.latitude * Math.PI) / 180));

    this.latitude += dLat;
    this.longitude += dLng;

    // Convert speed to km/h for dashboard display
    const speedKmH = Math.round(this.speed * 3.6);

    return {
      accel: { x: accelX, y: accelY, z: accelZ },
      gyro: { x: gyroX, y: gyroY, z: gyroZ },
      speed: speedKmH,
      latitude: this.latitude,
      longitude: this.longitude,
    };
  }
}

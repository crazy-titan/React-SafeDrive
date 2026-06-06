import { Accelerometer, Gyroscope, DeviceMotion } from "expo-sensors";
import { SensorDataPoint, DeviceMotionDataPoint } from "./detectorService";

export interface SensorUpdatePayload {
  accel: SensorDataPoint;
  gyro: SensorDataPoint;
  motion: DeviceMotionDataPoint | null;
}

export type SensorCallback = (data: SensorUpdatePayload) => void;

class SensorService {
  private accelSubscription: any = null;
  private gyroSubscription: any = null;
  private motionSubscription: any = null;

  private currentAccel: SensorDataPoint = { x: 0, y: 0, z: 9.8 };
  private currentGyro: SensorDataPoint = { x: 0, y: 0, z: 0 };
  private currentMotion: DeviceMotionDataPoint | null = null;

  private callback: SensorCallback | null = null;
  private updateIntervalMs = 50; // 20Hz

  /**
   * Checks if necessary sensors are available on the device
   */
  public async checkAvailability(): Promise<{
    accelerometer: boolean;
    gyroscope: boolean;
    deviceMotion: boolean;
  }> {
    try {
      const accelerometer = await Accelerometer.isAvailableAsync();
      const gyroscope = await Gyroscope.isAvailableAsync();
      const deviceMotion = await DeviceMotion.isAvailableAsync();

      return { accelerometer, gyroscope, deviceMotion };
    } catch (error) {
      console.warn("Error checking sensor availability:", error);
      return { accelerometer: false, gyroscope: false, deviceMotion: false };
    }
  }

  /**
   * Start listening to physical sensors
   */
  public async startListening(callback: SensorCallback): Promise<boolean> {
    this.callback = callback;
    const availability = await this.checkAvailability();

    if (!availability.accelerometer && !availability.gyroscope) {
      console.warn("Sensors are not available on this device.");
      return false;
    }

    // Set sample intervals
    Accelerometer.setUpdateInterval(this.updateIntervalMs);
    Gyroscope.setUpdateInterval(this.updateIntervalMs);
    DeviceMotion.setUpdateInterval(this.updateIntervalMs);

    // Subscribe to Accelerometer
    if (availability.accelerometer) {
      this.accelSubscription = Accelerometer.addListener((data) => {
        // Expo accelerometer returns values in Gs. We multiply by 9.80665 to get m/s^2.
        this.currentAccel = {
          x: data.x * 9.80665,
          y: data.y * 9.80665,
          z: data.z * 9.80665,
        };
        this.notifyCallback();
      });
    }

    // Subscribe to Gyroscope
    if (availability.gyroscope) {
      this.gyroSubscription = Gyroscope.addListener((data) => {
        // Expo gyroscope returns rotation rate in rad/s
        this.currentGyro = {
          x: data.x,
          y: data.y,
          z: data.z,
        };
        this.notifyCallback();
      });
    }

    // Subscribe to DeviceMotion (provides linear acceleration without gravity, and orientation)
    if (availability.deviceMotion) {
      this.motionSubscription = DeviceMotion.addListener((data) => {
        this.currentMotion = {
          acceleration: data.acceleration
            ? {
                x: data.acceleration.x * 9.80665,
                y: data.acceleration.y * 9.80665,
                z: data.acceleration.z * 9.80665,
              }
            : null,
          accelerationIncludingGravity: {
            x: data.accelerationIncludingGravity.x * 9.80665,
            y: data.accelerationIncludingGravity.y * 9.80665,
            z: data.accelerationIncludingGravity.z * 9.80665,
          },
          rotationRate: data.rotationRate
            ? {
                x: data.rotationRate.beta,
                y: data.rotationRate.gamma,
                z: data.rotationRate.alpha,
              }
            : null,
          orientation: data.rotation
            ? {
                alpha: data.rotation.alpha,
                beta: data.rotation.beta,
                gamma: data.rotation.gamma,
              }
            : null,
        };
        
        // If device motion linear acceleration is available, we can sync our currentAccel to match it
        if (data.accelerationIncludingGravity) {
          this.currentAccel = {
            x: data.accelerationIncludingGravity.x * 9.80665,
            y: data.accelerationIncludingGravity.y * 9.80665,
            z: data.accelerationIncludingGravity.z * 9.80665,
          };
        }
        
        if (data.rotationRate) {
          this.currentGyro = {
            x: data.rotationRate.beta,
            y: data.rotationRate.gamma,
            z: data.rotationRate.alpha,
          };
        }
        
        this.notifyCallback();
      });
    }

    return true;
  }

  /**
   * Stop listening to sensors and unsubscribe
   */
  public stopListening(): void {
    if (this.accelSubscription) {
      this.accelSubscription.remove();
      this.accelSubscription = null;
    }
    if (this.gyroSubscription) {
      this.gyroSubscription.remove();
      this.gyroSubscription = null;
    }
    if (this.motionSubscription) {
      this.motionSubscription.remove();
      this.motionSubscription = null;
    }
    this.callback = null;
    this.currentMotion = null;
  }

  /**
   * Throttles notifications to UI callback to match sampling rate
   */
  private notifyCallback(): void {
    if (this.callback) {
      this.callback({
        accel: this.currentAccel,
        gyro: this.currentGyro,
        motion: this.currentMotion,
      });
    }
  }
}

export const sensorService = new SensorService();

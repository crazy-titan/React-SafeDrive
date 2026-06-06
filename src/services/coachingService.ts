import { DrivingEvent } from "./storageService";

export interface CoachingReport {
  verdict: string;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
}

export const coachingService = {
  /**
   * Generates coaching feedback based on score and events logged
   */
  generateReport(score: number, events: DrivingEvent[]): CoachingReport {
    const report: CoachingReport = {
      verdict: "",
      strengths: [],
      improvements: [],
      recommendations: [],
    };

    // 1. Group events by type
    const counts = events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 2. Determine Verdict based on Score
    if (score >= 95) {
      report.verdict = "Outstanding drive! You demonstrated exemplary defensive driving behavior, smooth controls, and full focus. Keep up this professional standard.";
      report.strengths.push("Excellent speed control and anticipation");
      report.strengths.push("Device remained secure and untouched");
    } else if (score >= 85) {
      report.verdict = "Great drive overall! You maintained safe driving habits with only minor, isolated spikes. A few small adjustments will make your trips perfect.";
      report.strengths.push("Good vehicle stabilization");
    } else if (score >= 70) {
      report.verdict = "Decent drive, but several safety thresholds were crossed. Improving focus and planning your maneuvers earlier will significantly lower your risk profile.";
    } else if (score >= 50) {
      report.verdict = "Caution: Multiple aggressive events detected. Your telemetry profile shows elevated risk. We recommend practicing gentler braking and leaving more space.";
    } else {
      report.verdict = "High-Risk Telemetry: Your driving profile showed multiple severe events, including potential distraction. Please prioritize safety, secure your device, and avoid sudden control adjustments.";
    }

    // 3. Evaluate strengths based on lack of events
    if (!counts.phone_handling) {
      report.strengths.push("Distraction-free driving (device was untouched)");
    }
    if (!counts.harsh_brake && !counts.harsh_accel) {
      report.strengths.push("Smooth longitudinal control (excellent braking and acceleration)");
    }
    if (!counts.sharp_turn && !counts.aggressive_steer) {
      report.strengths.push("Controlled cornering (smooth, stable steering)");
    }
    if (!counts.excessive_movement) {
      report.strengths.push("Phone was securely mounted/stabilized");
    }

    // Make sure we have at least 1 strength if not already added
    if (report.strengths.length === 0) {
      report.strengths.push("Completed the drive safely to the destination");
    }

    // 4. Evaluate areas of improvement and recommendations based on event counts
    if (counts.phone_handling) {
      report.improvements.push(`Detected phone handling ${counts.phone_handling} time(s).`);
      report.recommendations.push("Avoid picking up or looking at your phone while moving. Set up navigation and music before starting your drive.");
    }

    if (counts.harsh_brake) {
      report.improvements.push(`Harsh braking occurred ${counts.harsh_brake} time(s).`);
      report.recommendations.push("Maintain a 3-4 second following distance behind vehicles. Looking further ahead helps you anticipate stops and brake progressively.");
    }

    if (counts.harsh_accel) {
      report.improvements.push(`Harsh acceleration detected ${counts.harsh_accel} time(s).`);
      report.recommendations.push("Apply gentle, linear pressure on the throttle. Smooth acceleration improves fuel economy and reduces tire wear.");
    }

    if (counts.sharp_turn || counts.aggressive_steer) {
      const turnCount = (counts.sharp_turn || 0) + (counts.aggressive_steer || 0);
      report.improvements.push(`Aggressive lateral forces (sharp turns/swerves) detected ${turnCount} time(s).`);
      report.recommendations.push("Slow down *before* entering corners rather than while turning. Steer with smooth, continuous adjustments rather than sudden jerks.");
    }

    if (counts.excessive_movement) {
      report.improvements.push("Device was sliding or vibrating excessively.");
      report.recommendations.push("Invest in a sturdy dashboard phone mount. A loose phone is a safety hazard and creates false telemetry alerts.");
    }

    // General recommendation fallback
    if (report.recommendations.length === 0) {
      report.recommendations.push("Maintain your current driving style. Consistent, gentle driving is the key to safety and efficiency.");
    }

    return report;
  },
};

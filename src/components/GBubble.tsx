import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";

interface GBubbleProps {
  gx: number; // lateral G-force (typically -0.8 to 0.8)
  gy: number; // longitudinal G-force (typically -0.8 to 0.8)
  size?: number;
}

export const GBubble: React.FC<GBubbleProps> = ({ gx, gy, size = 180 }) => {
  const animatedX = useRef(new Animated.Value(0)).current;
  const animatedY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animatedX, {
      toValue: gx,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    }).start();

    Animated.spring(animatedY, {
      toValue: gy,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [gx, gy]);

  const maxG = 0.8; // Max G force scale
  const radius = size / 2;
  const padding = 15;
  const chartRadius = radius - padding;

  // Interpolate animated values to coordinate offsets
  // Capping the values so the dot doesn't leave the circle
  const translateX = animatedX.interpolate({
    inputRange: [-maxG, maxG],
    outputRange: [-chartRadius, chartRadius],
    extrapolate: "clamp",
  });

  const translateY = animatedY.interpolate({
    inputRange: [-maxG, maxG],
    // In screen coordinates: Y goes down.
    // In G-bubble: acceleration (positive gy) moves the bubble down (backward force), 
    // braking (negative gy) moves the bubble up (forward inertia force).
    outputRange: [chartRadius, -chartRadius],
    extrapolate: "clamp",
  });

  // Calculate magnitude of current Gs
  const currentGMag = Math.sqrt(gx * gx + gy * gy).toFixed(2);

  return (
    <View style={styles.container}>
      <View style={[styles.card, { width: size + 20, height: size + 50 }]}>
        <Text style={styles.title}>G-Force Meter</Text>
        
        <View style={{ width: size, height: size, position: "relative" }}>
          <Svg width={size} height={size}>
            {/* Outer Ring */}
            <Circle
              cx={radius}
              cy={radius}
              r={chartRadius}
              stroke="#374151"
              strokeWidth="1.5"
              fill="transparent"
            />
            {/* 0.6G Ring */}
            <Circle
              cx={radius}
              cy={radius}
              r={chartRadius * 0.75}
              stroke="#1F2937"
              strokeDasharray="4 4"
              strokeWidth="1"
              fill="transparent"
            />
            {/* 0.4G Ring */}
            <Circle
              cx={radius}
              cy={radius}
              r={chartRadius * 0.5}
              stroke="#374151"
              strokeWidth="1"
              fill="transparent"
            />
            {/* 0.2G Ring */}
            <Circle
              cx={radius}
              cy={radius}
              r={chartRadius * 0.25}
              stroke="#1F2937"
              strokeDasharray="4 4"
              strokeWidth="1"
              fill="transparent"
            />

            {/* Axes */}
            <Line
              x1={padding}
              y1={radius}
              x2={size - padding}
              y2={radius}
              stroke="#374151"
              strokeWidth="1.5"
            />
            <Line
              x1={radius}
              y1={padding}
              x2={radius}
              y2={size - padding}
              stroke="#374151"
              strokeWidth="1.5"
            />

            {/* Labels */}
            <SvgText
              x={radius}
              y={padding + 10}
              fill="#9CA3AF"
              fontSize="9"
              textAnchor="middle"
              fontWeight="bold"
            >
              BRAKE (FORWARD)
            </SvgText>
            <SvgText
              x={radius}
              y={size - padding - 4}
              fill="#9CA3AF"
              fontSize="9"
              textAnchor="middle"
              fontWeight="bold"
            >
              ACCEL (BACKWARD)
            </SvgText>
            <SvgText
              x={size - padding - 35}
              y={radius - 4}
              fill="#9CA3AF"
              fontSize="9"
              textAnchor="end"
              fontWeight="bold"
            >
              RIGHT
            </SvgText>
            <SvgText
              x={padding + 5}
              y={radius - 4}
              fill="#9CA3AF"
              fontSize="9"
              textAnchor="start"
              fontWeight="bold"
            >
              LEFT
            </SvgText>

            {/* G markers */}
            <SvgText
              x={radius + 4}
              y={radius - chartRadius * 0.5 + 10}
              fill="#4B5563"
              fontSize="8"
            >
              0.4G
            </SvgText>
            <SvgText
              x={radius + 4}
              y={radius - chartRadius + 10}
              fill="#4B5563"
              fontSize="8"
            >
              0.8G
            </SvgText>
          </Svg>

          {/* Animated Glowing G Dot */}
          <Animated.View
            style={[
              styles.bubbleDot,
              {
                left: radius - 8,
                top: radius - 8,
                transform: [{ translateX }, { translateY }],
              },
            ]}
          >
            <View style={styles.bubbleInner} />
          </Animated.View>
        </View>

        <Text style={styles.gValue}>{currentGMag} G</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "rgba(17, 24, 39, 0.7)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#374151",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  title: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  bubbleDot: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 5,
  },
  bubbleInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  gValue: {
    color: "#F3F4F6",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },
});

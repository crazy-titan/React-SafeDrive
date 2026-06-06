import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

interface CircularProgressProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const CircularProgress: React.FC<CircularProgressProps> = ({
  score,
  size = 180,
  strokeWidth = 12,
  showText = true,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: score,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [score]);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  // Determine colors based on score
  const getColors = (val: number) => {
    if (val >= 90) {
      return {
        text: "#10B981", // Emerald
        gradient: ["#10B981", "#34D399"],
        bg: "rgba(16, 185, 129, 0.1)",
        label: "Excellent",
      };
    } else if (val >= 75) {
      return {
        text: "#3B82F6", // Blue / Good
        gradient: ["#3B82F6", "#60A5FA"],
        bg: "rgba(59, 130, 246, 0.1)",
        label: "Good",
      };
    } else if (val >= 50) {
      return {
        text: "#F59E0B", // Amber
        gradient: ["#F59E0B", "#FBBF24"],
        bg: "rgba(245, 158, 11, 0.1)",
        label: "Average",
      };
    } else {
      return {
        text: "#EF4444", // Red
        gradient: ["#EF4444", "#F87171"],
        bg: "rgba(239, 68, 68, 0.1)",
        label: "Poor",
      };
    }
  };

  const activeColors = getColors(score);

  // Animated score text
  const [displayScore, setDisplayScore] = React.useState(0);
  useEffect(() => {
    const listener = animatedValue.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });
    return () => {
      animatedValue.removeListener(listener);
    };
  }, []);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={activeColors.gradient[0]} />
            <Stop offset="100%" stopColor={activeColors.gradient[1]} />
          </LinearGradient>
        </Defs>

        {/* Background Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1F2937" // Dark slate
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Foreground Progress Circle */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#scoreGradient)"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>

      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.scoreText, { color: activeColors.text }]}>
            {displayScore}
          </Text>
          <Text style={styles.maxText}>/ 100</Text>
          <Text style={[styles.labelText, { color: activeColors.text }]}>
            {activeColors.label}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  textContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  scoreText: {
    fontSize: 48,
    fontWeight: "800",
    fontFamily: "System",
  },
  maxText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
    marginTop: -4,
  },
  labelText: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});

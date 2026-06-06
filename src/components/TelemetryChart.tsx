import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from "react-native-svg";

interface TelemetryChartProps {
  data: number[]; // rolling history of values (G-force or acceleration magnitude)
  maxDataPoints?: number;
  height?: number;
  color?: string;
  fillColor?: string;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  data,
  maxDataPoints = 40,
  height = 100,
  color = "#3B82F6", // Default Blue
  fillColor = "rgba(59, 130, 246, 0.15)",
}) => {
  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - 48; // Padding on sides

  // Pad data if it's less than maxDataPoints
  const paddedData = [...data];
  while (paddedData.length < maxDataPoints) {
    paddedData.unshift(0);
  }
  if (paddedData.length > maxDataPoints) {
    paddedData.splice(0, paddedData.length - maxDataPoints);
  }

  // Find max value in data to scale dynamically, but establish a minimum ceiling of 0.5G
  const maxVal = Math.max(...paddedData, 0.5);

  // Map points to SVG coordinates
  const points = paddedData.map((val, index) => {
    const x = (index / (maxDataPoints - 1)) * chartWidth;
    // Y points down in SVG, so subtract from height
    const y = height - (val / maxVal) * (height - 10) - 5;
    return { x, y };
  });

  // Build SVG Path string
  let pathStr = "";
  if (points.length > 0) {
    pathStr = `M ${points[0].x} ${points[0].y} ` + 
      points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
  }

  // Build the closed area path for the gradient fill under the line
  const fillPathStr = pathStr 
    ? `${pathStr} L ${chartWidth} ${height} L 0 ${height} Z` 
    : "";

  return (
    <View style={[styles.container, { height }]}>
      <Svg width={chartWidth} height={height}>
        <Defs>
          <LinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Shaded Area Under Curve */}
        {fillPathStr !== "" && (
          <Path d={fillPathStr} fill="url(#chartGradient)" />
        )}

        {/* Rolling Line */}
        {pathStr !== "" && (
          <Path
            d={pathStr}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(17, 24, 39, 0.4)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
    overflow: "hidden",
  },
});

import React from "react";
import { View, StyleSheet, Dimensions, Text } from "react-native";
import Svg, { Path, Circle, Rect, Text as SvgText, G } from "react-native-svg";
import { DrivingEvent, DriveCoordinate } from "../services/storageService";

interface RouteMapProps {
  route: DriveCoordinate[];
  events: DrivingEvent[];
  height?: number;
}

export const RouteMap: React.FC<RouteMapProps> = ({
  route,
  events,
  height = 200,
}) => {
  const screenWidth = Dimensions.get("window").width;
  const width = screenWidth - 48; // Padding on sides
  const padding = 25; // Padding inside map bounds

  if (route.length === 0) {
    return (
      <View style={[styles.container, { height }, styles.empty]}>
        <Text style={styles.emptyText}>No route data available</Text>
      </View>
    );
  }

  // 1. Find bounding box of the route coordinates
  const lats = route.map((c) => c.latitude);
  const lngs = route.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latRange = maxLat - minLat || 0.0001;
  const lngRange = maxLng - minLng || 0.0001;

  // 2. Coordinate transformation helper
  const transform = (lat: number, lng: number) => {
    // Normalize to 0-1
    const normX = (lng - minLng) / lngRange;
    const normY = (lat - minLat) / latRange;

    // Scale to dimensions (preserving padding)
    const x = padding + normX * (width - 2 * padding);
    const y = height - (padding + normY * (height - 2 * padding)); // Invert Y

    return { x, y };
  };

  // 3. Map route waypoints to screen points
  const points = route.map((c) => ({
    ...transform(c.latitude, c.longitude),
    timestamp: c.timestamp,
  }));

  // Helper to check if a waypoint timestamp is close to any safety event
  const isNearEvent = (timestamp: number): boolean => {
    return events.some(
      (e) => Math.abs(e.timestamp - timestamp) <= 6 // within 6 seconds
    );
  };

  // 4. Group points into continuous segments of similar safety states
  // This allows us to draw multi-colored polylines (Green/Red)
  const segments: Array<{ points: typeof points; isSafe: boolean }> = [];
  let currentSegment: typeof points = [points[0]];
  let currentSafe = !isNearEvent(points[0].timestamp);

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const safe = !isNearEvent(p.timestamp);

    if (safe === currentSafe) {
      currentSegment.push(p);
    } else {
      currentSegment.push(p); // Include boundary point in both to join paths
      segments.push({ points: currentSegment, isSafe: currentSafe });
      currentSegment = [p];
      currentSafe = safe;
    }
  }
  if (currentSegment.length > 0) {
    segments.push({ points: currentSegment, isSafe: currentSafe });
  }

  // Helper to construct SVG Path string from a point array
  const getPathStr = (segmentPoints: typeof points): string => {
    if (segmentPoints.length < 2) return "";
    return (
      `M ${segmentPoints[0].x} ${segmentPoints[0].y} ` +
      segmentPoints.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ")
    );
  };

  // Start & End markers
  const startPoint = points[0];
  const endPoint = points[points.length - 1];

  // Map events to screen coordinates
  // Sort events by timestamp so markers draw nicely
  const eventMarkers = events.map((e) => {
    // Find closest coordinate point in route
    let closestPoint = points[0];
    let minDiff = Infinity;
    for (const p of points) {
      const diff = Math.abs(p.timestamp - e.timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closestPoint = p;
      }
    }
    return {
      ...e,
      x: closestPoint.x,
      y: closestPoint.y,
    };
  });

  const getEventLetter = (type: string) => {
    switch (type) {
      case "harsh_brake":
        return "B";
      case "harsh_accel":
        return "A";
      case "sharp_turn":
        return "T";
      case "aggressive_steer":
        return "S";
      case "excessive_movement":
        return "M";
      case "phone_handling":
        return "P";
      default:
        return "!";
    }
  };

  return (
    <View style={[styles.container, { height }]}>
      <Svg width={width} height={height}>
        {/* Grid lines to make it look like a high-tech mapping UI */}
        {[...Array(5)].map((_, i) => {
          const gridY = padding + (i / 4) * (height - 2 * padding);
          return (
            <Path
              key={`gridy-${i}`}
              d={`M 10 ${gridY} L ${width - 10} ${gridY}`}
              stroke="#1F2937"
              strokeWidth="0.5"
            />
          );
        })}
        {[...Array(5)].map((_, i) => {
          const gridX = padding + (i / 4) * (width - 2 * padding);
          return (
            <Path
              key={`gridx-${i}`}
              d={`M ${gridX} 10 L ${gridX} ${height - 10}`}
              stroke="#1F2937"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Draw Route Segments */}
        {segments.map((seg, index) => {
          const pathStr = getPathStr(seg.points);
          if (!pathStr) return null;
          return (
            <Path
              key={`seg-${index}`}
              d={pathStr}
              fill="none"
              stroke={seg.isSafe ? "#10B981" : "#EF4444"} // Green/Red
              strokeWidth={seg.isSafe ? "3.5" : "5"} // Unsafe sections are bolder
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={seg.isSafe ? 0.75 : 0.9}
            />
          );
        })}

        {/* Start Marker */}
        <G>
          <Circle
            cx={startPoint.x}
            cy={startPoint.y}
            r="8"
            fill="#10B981"
            stroke="#111827"
            strokeWidth="1.5"
          />
          <SvgText
            x={startPoint.x}
            y={startPoint.y + 3}
            fill="#FFFFFF"
            fontSize="8"
            textAnchor="middle"
            fontWeight="bold"
          >
            S
          </SvgText>
        </G>

        {/* End Marker */}
        <G>
          <Circle
            cx={endPoint.x}
            cy={endPoint.y}
            r="8"
            fill="#EF4444"
            stroke="#111827"
            strokeWidth="1.5"
          />
          <SvgText
            x={endPoint.x}
            y={endPoint.y + 3}
            fill="#FFFFFF"
            fontSize="8"
            textAnchor="middle"
            fontWeight="bold"
          >
            E
          </SvgText>
        </G>

        {/* Draw Safety Event Markers */}
        {eventMarkers.map((marker) => (
          <G key={marker.id}>
            {/* outer pulse circle */}
            <Circle
              cx={marker.x}
              cy={marker.y}
              r="12"
              fill="rgba(239, 68, 68, 0.2)"
            />
            {/* inner pin */}
            <Circle
              cx={marker.x}
              cy={marker.y}
              r="7"
              fill="#EF4444"
              stroke="#FFFFFF"
              strokeWidth="1"
            />
            {/* letter marker */}
            <SvgText
              x={marker.x}
              y={marker.y + 2.5}
              fill="#FFFFFF"
              fontSize="7.5"
              textAnchor="middle"
              fontWeight="bold"
            >
              {getEventLetter(marker.type)}
            </SvgText>
          </G>
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "rgba(17, 24, 39, 0.7)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#374151",
    overflow: "hidden",
  },
  empty: {
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "500",
  },
});

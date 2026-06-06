import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#0B0F19" }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#0B0F19",
          },
          headerTintColor: "#F3F4F6",
          headerTitleStyle: {
            fontWeight: "800",
            fontSize: 18,
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: "#0B0F19",
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: "SafeDrive HUD",
          }}
        />
        <Stack.Screen
          name="drive"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="summary"
          options={{
            title: "Drive Analysis",
            headerLeft: () => null,
            gestureEnabled: false,
          }}
        />
      </Stack>
    </View>
  );
}


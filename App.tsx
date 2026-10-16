import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Home, Luggage, Compass } from "lucide-react-native";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthStateChange } from "./src/lib/supabase";
import { colors } from "./src/theme";
import AuthScreen from "./src/screens/AuthScreen";
import PlaceholderScreen from "./src/screens/PlaceholderScreen";
import TripsScreen from "./src/screens/TripsScreen";
import TripHubScreen from "./src/screens/TripHubScreen";

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.stamp,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen
        name="Home"
        options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      >
        {() => <PlaceholderScreen label="Your next adventure starts here." />}
      </Tab.Screen>
      <Tab.Screen
        name="Trips"
        component={TripsScreen}
        options={{ tabBarIcon: ({ color, size }) => <Luggage color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Explore"
        options={{ tabBarIcon: ({ color, size }) => <Compass color={color} size={size} /> }}
      >
        {() => <PlaceholderScreen label="Explore is coming soon." />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    getSession().then(setSession);
    const unsubscribe = onAuthStateChange(setSession);
    return unsubscribe;
  }, []);

  if (session === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primaryBg} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          {session ? (
            <RootStack.Navigator screenOptions={{ headerShown: false }}>
              <RootStack.Screen name="MainTabs" component={MainTabs} />
              <RootStack.Screen name="TripHub" component={TripHubScreen} />
            </RootStack.Navigator>
          ) : (
            <AuthScreen />
          )}
        </NavigationContainer>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, TouchableOpacity, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Home, Luggage, Compass, Plus } from "lucide-react-native";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthStateChange } from "./src/lib/supabase";
import { colors } from "./src/theme";
import AuthScreen from "./src/screens/AuthScreen";
import HomeScreen from "./src/screens/HomeScreen";
import PlaceholderScreen from "./src/screens/PlaceholderScreen";
import TripsScreen from "./src/screens/TripsScreen";
import TripHubScreen from "./src/screens/TripHubScreen";
import NewTripScreen from "./src/screens/NewTripScreen";
import TemplatePreviewScreen from "./src/screens/TemplatePreviewScreen";

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

// The center tab never actually shows a screen — tapping it just opens
// NewTrip as a modal on the root stack, same as the web app's raised "+"
// FAB on the Dashboard's bottom bar.
function CreateTabPlaceholder() {
  return null;
}

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
        component={HomeScreen}
        options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Trips"
        component={TripsScreen}
        options={{ tabBarIcon: ({ color, size }) => <Luggage color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Create"
        component={CreateTabPlaceholder}
        options={{
          tabBarIcon: () => (
            <View style={styles.fab}>
              <Plus color="#fff" size={26} strokeWidth={2.5} />
            </View>
          ),
          tabBarLabel: () => null,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.getParent()?.navigate("NewTrip");
          },
        })}
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
              <RootStack.Screen name="NewTrip" component={NewTripScreen} options={{ presentation: "modal" }} />
              <RootStack.Screen name="TemplatePreview" component={TemplatePreviewScreen} options={{ presentation: "modal" }} />
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

const styles = StyleSheet.create({
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});

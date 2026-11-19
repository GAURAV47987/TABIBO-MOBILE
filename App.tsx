import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, TouchableOpacity, StyleSheet } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
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
import ProfileScreen from "./src/screens/ProfileScreen";
import AdminScreen from "./src/screens/AdminScreen";
import LegalScreen from "./src/screens/LegalScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import { loadFromStorage, saveToStorage } from "./src/lib/storage";
import { initNotifications } from "./src/lib/reminders";
import { initMonitoring, setMonitoringUser, wrapRoot } from "./src/lib/monitoring";

initMonitoring();
initNotifications();

const ONBOARDING_KEY = "onboardingSeen";

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef<any>();

// Tapping a trip reminder opens that trip — whether the app was running or
// launched cold from the notification.
function openTripFromNotification(response: Notifications.NotificationResponse | null) {
  const tripId = response?.notification.request.content.data?.tripId;
  if (typeof tripId === "string" && navigationRef.isReady()) {
    navigationRef.navigate("TripHub", { tripId });
  }
}

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

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    getSession().then(setSession);
    const unsubscribe = onAuthStateChange(setSession);
    loadFromStorage<boolean>(ONBOARDING_KEY).then((seen) => setOnboardingSeen(!!seen));
    return unsubscribe;
  }, []);

  useEffect(() => {
    setMonitoringUser(session?.user?.id ?? null);
  }, [session?.user?.id]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(openTripFromNotification);
    return () => sub.remove();
  }, []);

  const finishOnboarding = () => {
    setOnboardingSeen(true);
    saveToStorage(ONBOARDING_KEY, true);
  };

  if (session === undefined || onboardingSeen === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primaryBg} size="large" />
      </View>
    );
  }

  if (session && !onboardingSeen) {
    return (
      <SafeAreaProvider>
        <OnboardingScreen onDone={finishOnboarding} />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer
          ref={navigationRef}
          onReady={() => Notifications.getLastNotificationResponseAsync().then(openTripFromNotification).catch(() => {})}
        >
          {session ? (
            <RootStack.Navigator screenOptions={{ headerShown: false }}>
              <RootStack.Screen name="MainTabs" component={MainTabs} />
              <RootStack.Screen name="TripHub" component={TripHubScreen} />
              <RootStack.Screen name="NewTrip" component={NewTripScreen} options={{ presentation: "modal" }} />
              <RootStack.Screen name="TemplatePreview" component={TemplatePreviewScreen} options={{ presentation: "modal" }} />
              <RootStack.Screen name="Profile" options={{ presentation: "modal" }}>
                {({ navigation }) => <ProfileScreen session={session} navigation={navigation} />}
              </RootStack.Screen>
              <RootStack.Screen name="Admin" component={AdminScreen} options={{ presentation: "modal" }} />
              <RootStack.Screen name="Legal" component={LegalScreen} options={{ presentation: "modal" }} />
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

export default wrapRoot(App);

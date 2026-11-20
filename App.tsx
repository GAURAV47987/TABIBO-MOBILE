import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer, createNavigationContainerRef, useNavigation } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
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
import ShareScreen from "./src/screens/ShareScreen";
import LegalScreen from "./src/screens/LegalScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import { loadFromStorage, saveToStorage } from "./src/lib/storage";
import { initNotifications } from "./src/lib/reminders";
import { setMonitoringUser, wrapRoot } from "./src/lib/monitoring";
import { haptics } from "./src/lib/haptics";
import PressScale from "./src/components/PressScale";

// Sentry itself is initialized earlier, in instrument.ts (imported first
// in index.ts) — by the time this module runs, it's already live.
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

// The "+" isn't one of the flex tabs — with Home/Trips/Explore as real
// tabs, a 4th tab for it would sit at the 3rd-of-4 slot (62.5% across),
// not screen center. It's rendered as a sibling overlay instead, always
// centered regardless of how many tabs are either side of it.
function MainTabs() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.stamp,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        }}
        screenListeners={{ tabPress: () => haptics.select() }}
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
          name="Explore"
          options={{ tabBarIcon: ({ color, size }) => <Compass color={color} size={size} /> }}
        >
          {() => <PlaceholderScreen label="Explore is coming soon." />}
        </Tab.Screen>
      </Tab.Navigator>
      <PressScale
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => navigation.getParent()?.navigate("NewTrip")}
        accessibilityLabel="Create new trip"
      >
        <Plus color="#fff" size={26} strokeWidth={2.5} />
      </PressScale>
    </View>
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
              <RootStack.Screen name="Share" component={ShareScreen} options={{ presentation: "modal" }} />
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
    position: "absolute",
    left: "50%",
    marginLeft: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});

export default wrapRoot(App);

import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Trash2 } from "lucide-react-native";
import { colors, radius, spacing } from "../theme";
import { listTrips, deleteTrip, updateTrip } from "../lib/supabase";
import { getEffectiveStops } from "../lib/stops";
import PlaceBanner from "../components/PlaceBanner";

// A joined multi-stop label ("Athens -> Paris") won't resolve to any one
// photo, so photos always key off the first stop's plain name.
function photoQuery(trip: any) {
  return getEffectiveStops(trip)[0]?.name || trip.destination_name;
}

function dateRangeLabel(start?: string | null, end?: string | null) {
  return start && end ? `${start} — ${end}` : "Dates not set yet";
}

type Trip = {
  id: string;
  destination_name: string;
  start_date: string | null;
  end_date: string | null;
  photo_url: string | null;
  stops: any[];
};

export default function TripsScreen() {
  const navigation = useNavigation<any>();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await listTrips();
      setTrips(data as Trip[]);
      setError("");
    } catch (err: any) {
      setError(err.message || "Could not load your trips");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Re-fetch every time this tab comes into focus, so a trip created or
  // deleted elsewhere always shows up current.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const confirmDelete = (trip: Trip) => {
    Alert.alert("Delete trip?", `"${trip.destination_name}" and everything in it — itinerary, budget, packing list — will be gone for good.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTrip(trip.id);
            setTrips((prev) => prev.filter((t) => t.id !== trip.id));
          } catch (err: any) {
            Alert.alert("Couldn't delete trip", err.message || "Something went wrong");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryBg} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Couldn't load your trips: {error}</Text>
      </View>
    );
  }

  if (trips.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No trips yet — tap + below to plan your first one.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={trips}
      keyExtractor={(t) => t.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refresh(); }} tintColor={colors.primaryBg} />}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.tile}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("TripHub", { tripId: item.id })}
        >
          <PlaceBanner
            placeName={photoQuery(item)}
            savedUrl={item.photo_url}
            onResolved={(url) => updateTrip(item.id, { photo_url: url })}
            height={140}
            style={{ borderRadius: radius.lg }}
          >
            <TouchableOpacity
              onPress={() => confirmDelete(item)}
              style={styles.deleteButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 size={14} color="#fff" />
            </TouchableOpacity>
            <View style={styles.tileText}>
              <Text style={styles.tileTitle} numberOfLines={1}>
                {item.destination_name}
              </Text>
              <Text style={styles.tileDate}>{dateRangeLabel(item.start_date, item.end_date)}</Text>
            </View>
          </PlaceBanner>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing(6),
    backgroundColor: colors.bg,
  },
  errorText: {
    color: colors.stamp,
    textAlign: "center",
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: "center",
  },
  list: {
    padding: spacing(3),
    backgroundColor: colors.bg,
  },
  row: {
    gap: spacing(3),
  },
  tile: {
    flex: 1,
    marginBottom: spacing(3),
    borderRadius: radius.lg,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  deleteButton: {
    position: "absolute",
    top: spacing(2),
    right: spacing(2),
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    padding: spacing(1.5),
    zIndex: 10,
  },
  tileText: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing(3),
  },
  tileTitle: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  tileDate: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    marginTop: 2,
  },
});

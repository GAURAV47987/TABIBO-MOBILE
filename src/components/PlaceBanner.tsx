import { useEffect, useState } from "react";
import { View, Image, StyleSheet, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius } from "../theme";
import { getPlacePhoto } from "../lib/photos";

// A photo banner for a place. savedUrl is the trip's own persisted
// photo_url: null/undefined means never looked up (look it up now and
// report back via onResolved so the caller can save it forever), "" means
// already looked up with nothing found, and a string is the cached photo
// to use directly — so a trip only ever costs one API call, ever.
export default function PlaceBanner({
  placeName,
  savedUrl,
  onResolved,
  height = 140,
  style,
  children,
}: {
  placeName?: string;
  savedUrl?: string | null;
  onResolved?: (url: string) => void;
  height?: number;
  style?: ViewStyle;
  children?: React.ReactNode;
}) {
  const [url, setUrl] = useState<string | null | undefined>(savedUrl ?? null);

  useEffect(() => {
    if (savedUrl) {
      setUrl(savedUrl);
      return;
    }
    if (savedUrl === "") {
      setUrl(null);
      return;
    }
    if (!placeName) return;
    let cancelled = false;
    setUrl(undefined);
    getPlacePhoto(placeName).then((found: string | null) => {
      if (cancelled) return;
      setUrl(found);
      onResolved?.(found || "");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeName, savedUrl]);

  return (
    <View style={[styles.wrap, { height, borderRadius: style?.borderRadius ?? radius.lg }, style]}>
      {url ? (
        <>
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient
            colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0.05)"]}
            start={{ x: 0, y: 1 }}
            end={{ x: 0, y: 0.4 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <LinearGradient colors={[colors.stamp, colors.primaryBg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    overflow: "hidden",
    position: "relative",
  },
});

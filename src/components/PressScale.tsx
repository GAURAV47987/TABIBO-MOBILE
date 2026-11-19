import { useRef, type ReactNode } from "react";
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { haptics } from "../lib/haptics";

// A drop-in press target that scales down slightly on touch and springs
// back on release, with a light haptic tap — the "feel" that separates a
// tappable-but-static button from one that feels alive. Uses RN's core
// Animated API (no react-native-reanimated dependency).
//
// style/children are narrowed to plain (non-render-prop) values since
// they're forwarded straight into Animated.View, which doesn't accept
// Pressable's function-of-press-state form.
type Props = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  haptic?: boolean;
  scaleTo?: number;
};

export default function PressScale({ children, style, onPressIn, onPressOut, haptic = true, scaleTo = 0.96, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPressIn={(e) => {
        Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
        if (haptic) haptics.tap();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
        onPressOut?.(e);
      }}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

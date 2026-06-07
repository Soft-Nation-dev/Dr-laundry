import { useRef } from "react";
import {
    Animated,
    Pressable,
    PressableProps,
    StyleProp,
    ViewStyle,
} from "react-native";

type SoftPressableProps = PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pressScale?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SoftPressable({
  children,
  style,
  pressScale = 0.98,
  onPressIn,
  onPressOut,
  ...props
}: SoftPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 24,
      bounciness: 5,
    }).start();
  };

  return (
    <AnimatedPressable
      {...props}
      style={[style, { transform: [{ scale }] }]}
      onPressIn={(event) => {
        animateTo(pressScale);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(1);
        onPressOut?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

import { AuthNotice, type AuthNoticeState } from "@/components/auth-notice";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import {
  login,
  register,
  syncCurrentUserProfile,
} from "@/lib/auth-api";
import { saveAuthSession } from "@/lib/auth-storage";
import {
  clearPendingEmailVerification,
  savePendingEmailVerification,
} from "@/lib/pending-email-verification";
import {
  type AddressSuggestion,
  resolvePickupAddress,
  reversePickupAddress,
  searchPickupAddresses,
} from "@/lib/new-order-api";
import { getProfile } from "@/lib/profile-api";
import {
  OperationTimeoutError,
  withTimeout,
} from "@/lib/promise-timeout";
import { getLandingRoute } from "@/lib/role-routing";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AuthMode = "signIn" | "create";
type RegisterStep = 0 | 1 | 2;
const AUTH_TIMEOUT_MS = 30_000;

function createAddressSessionToken() {
  return `signup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function formatDeviceAddress(address: Location.LocationGeocodedAddress) {
  const candidates = [
    address.name,
    address.street,
    address.district,
    address.subregion,
    address.city,
    address.region,
    address.postalCode,
    address.country,
  ];
  const seen = new Set<string>();
  return candidates
    .flatMap((value) => {
      const normalized = value?.trim();
      if (!normalized || seen.has(normalized.toLowerCase())) return [];
      seen.add(normalized.toLowerCase());
      return [normalized];
    })
    .join(", ");
}

async function getAuthenticatedLandingRoute() {
  const profile = await getProfile();
  return getLandingRoute(profile.data?.role ?? "customer");
}

async function openAuthenticatedHome() {
  const landingRoute = await getAuthenticatedLandingRoute();
  router.replace(landingRoute as never);
}

const REGISTER_STEPS = [
  {
    eyebrow: "Step 1 of 3",
    title: "Let’s get acquainted",
    copy: "Tell us who you are and where to send account updates.",
  },
  {
    eyebrow: "Step 2 of 3",
    title: "Pickup details",
    copy: "Add the number and address our laundry team should use.",
  },
  {
    eyebrow: "Step 3 of 3",
    title: "Secure your account",
    copy: "Choose a strong password. You’re one tap away from fresh clothes.",
  },
] as const;

type AuthInputProps = TextInputProps & {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  trailing?: React.ReactNode;
};

function AuthInput({ icon, label, trailing, style, ...props }: AuthInputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <Ionicons name={icon} size={19} color="#776B91" />
        <TextInput
          {...props}
          placeholderTextColor="#A29AB1"
          style={[styles.input, style]}
        />
        {trailing}
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const { height: screenHeight } = useWindowDimensions();
  const [authMode, setAuthMode] = useState<AuthMode>("signIn");
  const [registerStep, setRegisterStep] = useState<RegisterStep>(0);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressPlaceId, setAddressPlaceId] = useState("");
  const [addressPoint, setAddressPoint] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<
    AddressSuggestion[]
  >([]);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [addressSearching, setAddressSearching] = useState(false);
  const [addressResolving, setAddressResolving] = useState(false);
  const [isUsingCurrentLocation, setIsUsingCurrentLocation] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<AuthNoticeState | null>(null);
  const screenFade = useRef(new Animated.Value(0)).current;
  const screenRise = useRef(new Animated.Value(20)).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepSlide = useRef(new Animated.Value(0)).current;
  const authScrollRef = useRef<ScrollView>(null);
  const addressSessionToken = useRef(createAddressSessionToken());

  const keepFocusedInputVisible = () => {
    setTimeout(
      () => authScrollRef.current?.scrollToEnd({ animated: true }),
      Platform.OS === "android" ? 220 : 100,
    );
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(screenFade, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.spring(screenRise, {
        toValue: 0,
        speed: 14,
        bounciness: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, [screenFade, screenRise]);

  useEffect(() => {
    if (
      authMode !== "create" ||
      registerStep !== 1 ||
      !suggestionsVisible ||
      address.trim().length < 2 ||
      addressPlaceId
    ) {
      setAddressSuggestions([]);
      setAddressSearching(false);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setAddressSearching(true);
      try {
        const suggestions = await searchPickupAddresses(
          address.trim(),
          addressSessionToken.current,
          { auth: false },
        );
        if (active) setAddressSuggestions(suggestions);
      } catch (error) {
        if (active) {
          setAddressSuggestions([]);
          showNotice(
            "Address search unavailable",
            error instanceof Error
              ? error.message
              : "We could not search addresses. Please try again.",
          );
        }
      } finally {
        if (active) setAddressSearching(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [address, addressPlaceId, authMode, registerStep, suggestionsVisible]);

  const animateStep = (next: RegisterStep, direction: 1 | -1) => {
    Animated.parallel([
      Animated.timing(stepOpacity, {
        toValue: 0,
        duration: 130,
        useNativeDriver: true,
      }),
      Animated.timing(stepSlide, {
        toValue: -18 * direction,
        duration: 130,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setRegisterStep(next);
      stepSlide.setValue(18 * direction);
      Animated.parallel([
        Animated.timing(stepOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(stepSlide, {
          toValue: 0,
          speed: 18,
          bounciness: 2,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const changeMode = (next: AuthMode) => {
    setAuthMode(next);
    setRegisterStep(0);
    stepOpacity.setValue(1);
    stepSlide.setValue(0);
  };

  const handleAddressChange = (value: string) => {
    setAddress(value);
    setAddressPlaceId("");
    setAddressPoint(null);
    setSuggestionsVisible(value.trim().length >= 2);
  };

  const handleSelectAddress = async (suggestion: AddressSuggestion) => {
    setAddress(suggestion.label);
    setSuggestionsVisible(false);
    setAddressSuggestions([]);
    setAddressResolving(true);
    try {
      const resolved = await withTimeout(
        resolvePickupAddress(
          {
            placeId: suggestion.id,
            sessionToken: addressSessionToken.current,
          },
          { auth: false },
        ),
        AUTH_TIMEOUT_MS,
        "Address confirmation timed out.",
      );
      setAddress(resolved.address);
      setAddressPlaceId(resolved.placeId);
      setAddressPoint({
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      });
      addressSessionToken.current = createAddressSessionToken();
    } catch (error) {
      setAddressPlaceId("");
      setAddressPoint(null);
      showNotice(
        "Address not confirmed",
        error instanceof Error
          ? error.message
          : "Choose another nearby address.",
      );
    } finally {
      setAddressResolving(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    if (isUsingCurrentLocation || addressResolving) return;

    setIsUsingCurrentLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        showNotice(
          "Location permission needed",
          "Allow location while using Dr Laundry, or enter and select your pickup address manually.",
        );
        return;
      }

      const position = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }),
        20_000,
        "Finding your current location timed out.",
      );
      const geocoded = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const addressHint = geocoded[0]
        ? formatDeviceAddress(geocoded[0])
        : undefined;
      const resolved = await withTimeout(
        reversePickupAddress(
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            addressHint,
            sessionToken: addressSessionToken.current,
          },
          { auth: false },
        ),
        AUTH_TIMEOUT_MS,
        "Confirming your current address timed out.",
      );

      setAddress(resolved.address);
      setAddressPlaceId(resolved.placeId);
      setAddressPoint({
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      });
      setSuggestionsVisible(false);
      setAddressSuggestions([]);
      addressSessionToken.current = createAddressSessionToken();
      showNotice(
        "Current address confirmed",
        "This address will be saved to your profile and prefilled for new orders.",
        "success",
      );
    } catch (error) {
      showNotice(
        "Could not use current location",
        error instanceof OperationTimeoutError
          ? "Location took too long. Check that location is enabled, then try again or enter the address manually."
          : error instanceof Error
            ? error.message
            : "Enter and select your pickup address manually instead.",
      );
    } finally {
      setIsUsingCurrentLocation(false);
    }
  };

  const ensureRegistrationAddress = async () => {
    if (addressPlaceId && addressPoint) return true;
    if (!address.trim()) return false;

    setAddressResolving(true);
    try {
      const resolved = await withTimeout(
        resolvePickupAddress(
          {
            address: address.trim(),
            sessionToken: addressSessionToken.current,
          },
          { auth: false },
        ),
        AUTH_TIMEOUT_MS,
        "Address confirmation timed out.",
      );
      setAddress(resolved.address);
      setAddressPlaceId(resolved.placeId);
      setAddressPoint({
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      });
      addressSessionToken.current = createAddressSessionToken();
      return true;
    } catch (error) {
      setSuggestionsVisible(true);
      showNotice(
        "Choose a real pickup address",
        `${error instanceof Error ? error.message : "We could not confirm this address."} Select one of the nearby suggestions to continue.`,
      );
      return false;
    } finally {
      setAddressResolving(false);
    }
  };

  const showNotice = (
    title: string,
    message: string,
    tone: AuthNoticeState["tone"] = "error",
    onDismiss?: () => void,
  ) => {
    setNotice({ title, message, tone, onDismiss });
  };

  const validateRegistrationStep = () => {
    if (registerStep === 0) {
      if (!fullName.trim() || !email.trim()) {
        showNotice("A little more info", "Enter your full name and email.");
        return false;
      }
      if (!email.includes("@")) {
        showNotice("Check your email", "Enter a valid email address.");
        return false;
      }
    }

    if (registerStep === 1 && (!phone.trim() || !address.trim())) {
      showNotice(
        "Pickup details needed",
        "Enter your phone number and address.",
      );
      return false;
    }

    if (registerStep === 2) {
      if (password.length < 6) {
        showNotice("Password too short", "Use at least 6 characters.");
        return false;
      }
      if (password !== confirmPassword) {
        showNotice("Passwords do not match", "Please re-enter your password.");
        return false;
      }
    }

    return true;
  };

  const handlePrimaryAction = async () => {
    if (isSubmitting) return;

    if (authMode === "create" && registerStep < 2) {
      if (!validateRegistrationStep()) return;
      if (registerStep === 1 && !(await ensureRegistrationAddress())) return;
      animateStep((registerStep + 1) as RegisterStep, 1);
      return;
    }

    if (authMode === "signIn") {
      if (!email.trim() || !password) {
        showNotice("Missing info", "Enter your email and password.");
        return;
      }

      setIsSubmitting(true);
      const loginStartedAt = Date.now();
      const waitForLogin = <T,>(operation: Promise<T>) =>
        withTimeout(
          operation,
          Math.max(1, AUTH_TIMEOUT_MS - (Date.now() - loginStartedAt)),
          "Sign in timed out.",
        );

      try {
        // Pressing Sign in is an explicit new auth attempt. Any older pending
        // signup marker must not hijack this attempt or future app launches.
        await clearPendingEmailVerification();
        const result = await waitForLogin(
          login({ email: email.trim(), password }),
        );
        if (!result.success || !result.data?.accessToken) {
          if (result.data?.requiresEmailConfirmation) {
            const normalizedEmail = email.trim().toLowerCase();
            let pendingVerification = null;
            try {
              pendingVerification = await withTimeout(
                savePendingEmailVerification(
                  normalizedEmail,
                  "unverified-login",
                ),
                2_000,
                "Saving verification state timed out.",
              );
            } catch {
              // The route still carries the email, so verification can continue.
            }
            router.replace({
              pathname: "/verify-email",
              params: {
                email: normalizedEmail,
                flowId: pendingVerification?.flowId,
                status: "unverified",
                autoResend: "true",
              },
            });
            return;
          }
          showNotice("Sign in failed", result.message);
          return;
        }
        await clearPendingEmailVerification();
        await saveAuthSession({
          accessToken: result.data.accessToken,
          refreshToken: result.data.refreshToken,
          email: email.trim(),
        });
        const landingRoute = await waitForLogin(
          getAuthenticatedLandingRoute(),
        );
        router.replace(landingRoute as never);
      } catch (error) {
        showNotice(
          error instanceof OperationTimeoutError
            ? "Sign in timed out"
            : "Sign in failed",
          error instanceof OperationTimeoutError
            ? "The server took longer than 30 seconds to respond. Check your connection and try again."
            : error instanceof Error
              ? error.message
              : "We could not complete sign in. Please try again.",
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!validateRegistrationStep()) return;

    setIsSubmitting(true);
    try {
      const result = await withTimeout(
        register({
          email: email.trim().toLowerCase(),
          password,
          phoneNumber: phone.trim(),
          name: fullName.trim(),
          address: address.trim(),
          addressPlaceId,
          latitude: addressPoint!.latitude,
          longitude: addressPoint!.longitude,
        }),
        AUTH_TIMEOUT_MS,
        "Registration timed out.",
      );
      if (!result.success) {
        showNotice("Sign up failed", result.message);
        return;
      }

      if (!result.data.requiresEmailConfirmation) {
        await clearPendingEmailVerification();
        await syncCurrentUserProfile();
        showNotice("Account created", result.message, "success", () => void openAuthenticatedHome());
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const pendingVerification = await savePendingEmailVerification(
        normalizedEmail,
        "signup",
      );
      router.replace({
        pathname: "/verify-email",
        params: {
          email: normalizedEmail,
          flowId: pendingVerification?.flowId,
          status: "registered",
          message: result.message,
        },
      });
    } catch (error) {
      showNotice(
        error instanceof OperationTimeoutError
          ? "Sign up timed out"
          : "Sign up failed",
        error instanceof OperationTimeoutError
          ? "The server took longer than 30 seconds to respond. Check your connection and try again."
          : error instanceof Error
            ? error.message
            : "We could not create your account. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRegisterFields = () => {
    if (registerStep === 0) {
      return (
        <>
          <AuthInput
            label="Full name"
            icon="person-outline"
            value={fullName}
            onChangeText={setFullName}
            placeholder="your full name"
            autoComplete="name"
            onFocus={keepFocusedInputVisible}
          />
          <AuthInput
            label="Email address"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            onFocus={keepFocusedInputVisible}
          />
        </>
      );
    }

    if (registerStep === 1) {
      return (
        <>
          <AuthInput
            label="Phone number"
            icon="call-outline"
            value={phone}
            onChangeText={setPhone}
            placeholder="+234 800 000 0000"
            keyboardType="phone-pad"
            autoComplete="tel"
            onFocus={keepFocusedInputVisible}
          />
          <AuthInput
            label="Pickup address"
            icon="location-outline"
            value={address}
            onChangeText={handleAddressChange}
            placeholder="Start typing your street or landmark"
            autoComplete="street-address"
            onFocus={keepFocusedInputVisible}
          />
          <SoftPressable
            onPress={() => void handleUseCurrentLocation()}
            disabled={isUsingCurrentLocation || addressResolving}
            style={[
              styles.locationButton,
              (isUsingCurrentLocation || addressResolving) &&
                styles.buttonDisabled,
            ]}
          >
            {isUsingCurrentLocation ? (
              <ActivityIndicator
                color={LaundryTheme.colors.primaryDark}
                size="small"
              />
            ) : (
              <Ionicons
                name="navigate-outline"
                size={18}
                color={LaundryTheme.colors.primaryDark}
              />
            )}
            <View style={styles.locationButtonCopy}>
              <Text style={styles.locationButtonTitle}>
                Use my current location
              </Text>
              <Text style={styles.locationButtonMeta}>
                We’ll identify and confirm the nearest real address.
              </Text>
            </View>
          </SoftPressable>
          {addressSearching || addressResolving ? (
            <View style={styles.addressStatusRow}>
              <ActivityIndicator
                color={LaundryTheme.colors.primary}
                size="small"
              />
              <Text style={styles.addressStatusText}>
                {addressResolving
                  ? "Confirming this pickup address…"
                  : "Finding nearby addresses…"}
              </Text>
            </View>
          ) : null}
          {suggestionsVisible && addressSuggestions.length > 0 ? (
            <View style={styles.suggestionsCard}>
              {addressSuggestions.map((suggestion, index) => (
                <SoftPressable
                  key={suggestion.id}
                  onPress={() => void handleSelectAddress(suggestion)}
                  style={[
                    styles.suggestionRow,
                    index < addressSuggestions.length - 1 &&
                      styles.suggestionRowBorder,
                  ]}
                >
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={LaundryTheme.colors.primary}
                  />
                  <View style={styles.suggestionCopy}>
                    <Text style={styles.suggestionTitle} numberOfLines={1}>
                      {suggestion.mainText}
                    </Text>
                    <Text style={styles.suggestionMeta} numberOfLines={2}>
                      {suggestion.secondaryText}
                    </Text>
                  </View>
                </SoftPressable>
              ))}
            </View>
          ) : null}
          {addressPlaceId && addressPoint ? (
            <View style={styles.confirmedAddressPill}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color="#11875D"
              />
              <Text style={styles.confirmedAddressText}>
                Real pickup address confirmed
              </Text>
            </View>
          ) : null}
          <View style={styles.infoPill}>
            <Ionicons
              name="shield-checkmark-outline"
              size={17}
              color={LaundryTheme.colors.primaryDark}
            />
            <Text style={styles.infoText}>
              Your details are only used for pickup and delivery updates.
            </Text>
          </View>
        </>
      );
    }

    return (
      <>
        <AuthInput
          label="Password"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          autoCapitalize="none"
          secureTextEntry={!showPassword}
          onFocus={keepFocusedInputVisible}
          trailing={
            <SoftPressable
              onPress={() => setShowPassword((visible) => !visible)}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={19}
                color="#776B91"
              />
            </SoftPressable>
          }
        />
        <AuthInput
          key={
            showConfirmPassword
              ? "confirm-password-visible"
              : "confirm-password-hidden"
          }
          label="Confirm password"
          icon="checkmark-circle-outline"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Type it one more time"
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          secureTextEntry={!showConfirmPassword}
          onFocus={keepFocusedInputVisible}
          trailing={
            <SoftPressable
              onPress={() => setShowConfirmPassword((visible) => !visible)}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                size={19}
                color="#776B91"
              />
            </SoftPressable>
          }
        />
        <View style={styles.reviewCard}>
          <View style={styles.reviewIcon}>
            <Text style={styles.reviewInitial}>
              {fullName.trim().charAt(0).toUpperCase() || "D"}
            </Text>
          </View>
          <View style={styles.reviewCopy}>
            <Text style={styles.reviewName}>{fullName}</Text>
            <Text style={styles.reviewMeta}>{phone}</Text>
          </View>
          <Ionicons name="sparkles" size={18} color="#F59E0B" />
        </View>
      </>
    );
  };

  return (
    <LinearGradient
      colors={["#F3F0FF", "#FBFAFF", "#FFFFFF"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            ref={authScrollRef}
            contentContainerStyle={styles.scrollContent}
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={{
                opacity: screenFade,
                transform: [{ translateY: screenRise }],
              }}
            >
              <View style={[styles.visual, { height: screenHeight / 3 }]}>
                <Image
                  source={require("@/assets/images/login image.webp")}
                  style={styles.heroImage}
                  contentFit="cover"
                  transition={250}
                />
                <LinearGradient
                  colors={["transparent", "rgba(32,20,62,0.84)"]}
                  style={styles.imageShade}
                />
                <View style={styles.brandRow}>
                  <Image
                    source={require("@/assets/images/logo.jpeg")}
                    style={styles.logo}
                    contentFit="cover"
                  />
                  <View>
                    <Text style={styles.brandName}>DR LAUNDRY</Text>
                    <Text style={styles.brandPromise}>
                      Fast · Fresh · Clean
                    </Text>
                  </View>
                </View>
                <View style={styles.visualCopy}>
                  <Text style={styles.visualTitle}>
                    Laundry day,{"\n"}beautifully handled.
                  </Text>
                  <Text style={styles.visualSubtitle}>
                  Flexible Doorstep Service. Expert care. Fresh clothes returned.
                  </Text>
                </View>
              </View>

              <View style={styles.sheet}>
                {authMode === "signIn" ? (
                  <>
                    <View style={styles.sheetHeader}>
                      <View>
                        <Text style={styles.eyebrow}>WELCOME BACK</Text>
                        <Text style={styles.title}>Sign in</Text>
                      </View>
                      <View style={styles.freshBadge}>
                        <Ionicons name="sparkles" size={15} color="#F59E0B" />
                        <Text style={styles.freshText}>Stay fresh</Text>
                      </View>
                    </View>
                    <Text style={styles.subtitle}>
                      Pick up right where you left off.
                    </Text>
                    <View style={styles.fields}>
                      <AuthInput
                        label="Email address"
                        icon="mail-outline"
                        value={email}
                        onChangeText={setEmail}
                        placeholder="name@example.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        onFocus={keepFocusedInputVisible}
                      />
                      <AuthInput
                        label="Password"
                        icon="lock-closed-outline"
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Enter your password"
                        autoCapitalize="none"
                        secureTextEntry={!showPassword}
                        onFocus={keepFocusedInputVisible}
                        trailing={
                          <SoftPressable
                            onPress={() =>
                              setShowPassword((visible) => !visible)
                            }
                            style={styles.eyeButton}
                          >
                            <Ionicons
                              name={
                                showPassword ? "eye-off-outline" : "eye-outline"
                              }
                              size={19}
                              color="#776B91"
                            />
                          </SoftPressable>
                        }
                      />
                    </View>
                    <SoftPressable
                      onPress={() => router.push("/forgot-password")}
                      style={styles.forgotButton}
                    >
                      <Text style={styles.forgotText}>Forgot password?</Text>
                    </SoftPressable>
                  </>
                ) : (
                  <>
                    <View style={styles.progressRow}>
                      {[0, 1, 2].map((step) => (
                        <View
                          key={step}
                          style={[
                            styles.progressTrack,
                            step <= registerStep && styles.progressTrackActive,
                          ]}
                        />
                      ))}
                    </View>
                    <Animated.View
                      style={{
                        opacity: stepOpacity,
                        transform: [{ translateX: stepSlide }],
                      }}
                    >
                      <Text style={styles.eyebrow}>
                        {REGISTER_STEPS[registerStep].eyebrow}
                      </Text>
                      <Text style={styles.title}>
                        {REGISTER_STEPS[registerStep].title}
                      </Text>
                      <Text style={styles.subtitle}>
                        {REGISTER_STEPS[registerStep].copy}
                      </Text>
                      <View style={styles.fields}>
                        {renderRegisterFields()}
                      </View>
                    </Animated.View>
                  </>
                )}

                <View style={styles.actionRow}>
                  {authMode === "create" && registerStep > 0 ? (
                    <SoftPressable
                      onPress={() =>
                        animateStep((registerStep - 1) as RegisterStep, -1)
                      }
                      style={styles.backButton}
                    >
                      <Ionicons
                        name="arrow-back"
                        size={20}
                        color={LaundryTheme.colors.primaryDark}
                      />
                    </SoftPressable>
                  ) : null}
                  <SoftPressable
                    onPress={handlePrimaryAction}
                    disabled={isSubmitting}
                    style={[
                      styles.primaryButton,
                      authMode === "create" &&
                        registerStep > 0 &&
                        styles.primaryButtonWithBack,
                      isSubmitting && styles.buttonDisabled,
                    ]}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Text style={styles.primaryText}>
                          {authMode === "signIn"
                            ? "Sign in"
                            : registerStep < 2
                              ? "Continue"
                              : "Create account"}
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={19}
                          color="#FFFFFF"
                        />
                      </>
                    )}
                  </SoftPressable>
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchPrompt}>
                    {authMode === "signIn"
                      ? "New to Dr Laundry?"
                      : "Already have an account?"}
                  </Text>
                  <SoftPressable
                    onPress={() =>
                      changeMode(authMode === "signIn" ? "create" : "signIn")
                    }
                  >
                    <Text style={styles.switchLink}>
                      {authMode === "signIn" ? "Create account" : "Sign in"}
                    </Text>
                  </SoftPressable>
                </View>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <AuthNotice notice={notice} onClose={() => setNotice(null)} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 0,
    justifyContent: "flex-start",
  },
  visual: {
    overflow: "hidden",
    backgroundColor: "#30215B",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  imageShade: {
    ...StyleSheet.absoluteFillObject,
  },
  brandRow: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
  },
  brandName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  brandPromise: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  visualCopy: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 23,
  },
  visualTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 31,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  visualSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 7,
    maxWidth: 285,
  },
  sheet: {
    marginTop: -16,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 23,
    paddingBottom: 19,
    shadowColor: "#3B1B71",
    shadowOpacity: 0.13,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  eyebrow: {
    color: LaundryTheme.colors.primary,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "900",
    marginBottom: 5,
    textTransform: "uppercase",
  },
  title: {
    color: "#231833",
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  subtitle: {
    color: "#786E88",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  freshBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFF8E6",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  freshText: {
    color: "#9A6500",
    fontSize: 10,
    fontWeight: "800",
  },
  fields: { marginTop: 19 },
  inputGroup: { marginBottom: 14 },
  label: {
    color: "#3D334C",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 7,
  },
  inputShell: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: "#F7F5FA",
    borderWidth: 1,
    borderColor: "#ECE7F2",
    paddingLeft: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    color: "#231833",
    fontSize: 14,
    paddingHorizontal: 11,
    paddingVertical: 14,
  },
  eyeButton: {
    width: 44,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginTop: -3,
  },
  forgotText: {
    color: LaundryTheme.colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 19,
  },
  primaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: LaundryTheme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    shadowColor: LaundryTheme.colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  primaryButtonWithBack: { flex: 1 },
  backButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: LaundryTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  buttonDisabled: { opacity: 0.65 },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    marginTop: 17,
  },
  switchPrompt: { color: "#8A8196", fontSize: 12 },
  switchLink: {
    color: LaundryTheme.colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  progressRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 20,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#ECE8F3",
  },
  progressTrackActive: {
    backgroundColor: LaundryTheme.colors.primary,
  },
  locationButton: {
    minHeight: 60,
    marginTop: -3,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#DED4F0",
    backgroundColor: LaundryTheme.colors.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  locationButtonCopy: { flex: 1 },
  locationButtonTitle: {
    color: LaundryTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
  },
  locationButtonMeta: {
    color: "#76668A",
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  addressStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: -3,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  addressStatusText: {
    color: LaundryTheme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  suggestionsCard: {
    marginTop: -5,
    marginBottom: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E8E1F0",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  suggestionRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  suggestionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8E1F0",
  },
  suggestionCopy: { flex: 1 },
  suggestionTitle: {
    color: LaundryTheme.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  suggestionMeta: {
    color: LaundryTheme.colors.muted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  confirmedAddressPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: -4,
    marginBottom: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#EAF8F2",
  },
  confirmedAddressText: {
    color: "#117052",
    fontSize: 11,
    fontWeight: "800",
  },
  infoPill: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    backgroundColor: LaundryTheme.colors.primarySoft,
  },
  infoText: {
    flex: 1,
    color: LaundryTheme.colors.primaryDark,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
  },
  reviewCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#F8F6FB",
    borderWidth: 1,
    borderColor: "#ECE7F2",
  },
  reviewIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: LaundryTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewInitial: { color: "#FFFFFF", fontWeight: "900" },
  reviewCopy: { flex: 1, marginLeft: 10 },
  reviewName: { color: "#2A2037", fontSize: 12, fontWeight: "800" },
  reviewMeta: { color: "#8A8196", fontSize: 10, marginTop: 2 },
});

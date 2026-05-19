import { useRef } from "react";
import { StyleSheet, TextInput, View, Text } from "react-native";

const palette = {
  bg: "#F7FBFF",
  surface: "#FFFFFF",
  blue700: "#2171B5",
  blue400: "#6BAED6",
  blue900: "#08306B",
  textMuted: "#5D7394",
  border: "#D6E5F2",
  dangerBg: "#EDEBF7",
  danger: "#D24B5A"
};

export function PINEntry({
  value = "",
  onChangeText = () => {},
  label = "",
  error = "",
  secureTextEntry = false,
  rightAccessory = null
}) {
  const inputRefs = useRef([null, null, null, null]);
  const pins = value.split("").slice(0, 4);

  // Pad with empty strings to ensure 4 boxes
  while (pins.length < 4) {
    pins.push("");
  }

  const handlePinChange = (index, newValue) => {
    // Only allow digits
    const cleanValue = newValue.replace(/[^0-9]/g, "");
    if (cleanValue.length > 1) {
      return;
    }

    // Update the pin at this index
    const newPins = pins.slice();
    newPins[index] = cleanValue;
    const newPin = newPins.join("");

    onChangeText(newPin);

    // Auto-focus next input if digit entered
    if (cleanValue && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index, key) => {
    // Handle backspace
    if (key === "Backspace") {
      if (pins[index]) {
        // Clear current box
        const newPins = pins.slice();
        newPins[index] = "";
        const newPin = newPins.join("");
        onChangeText(newPin);
      } else if (index > 0) {
        // Move to previous box and clear it
        inputRefs.current[index - 1]?.focus();
        const newPins = pins.slice();
        newPins[index - 1] = "";
        const newPin = newPins.join("");
        onChangeText(newPin);
      }
    }
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      
      <View style={styles.pinRow}>
        <View style={styles.pinContainer}>
          {[0, 1, 2, 3].map((index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={[
                styles.pinBox,
                pins[index] && styles.pinBoxFilled,
                error && styles.pinBoxError
              ]}
              value={secureTextEntry && pins[index] ? "*" : pins[index]}
              onChangeText={(newValue) => handlePinChange(index, newValue)}
              onKeyPress={(e) => handleKeyPress(index, e.nativeEvent.key)}
              keyboardType="numeric"
              maxLength={1}
              secureTextEntry={false}
              autoComplete="off"
              autoCorrect={false}
              importantForAutofill="no"
              textContentType="none"
              textAlign="center"
              placeholderTextColor={palette.textMuted}
              editable={true}
              selectTextOnFocus={true}
            />
          ))}
        </View>
        {rightAccessory ? <View style={styles.pinAccessory}>{rightAccessory}</View> : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    gap: 8
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.blue900,
    marginBottom: 4
  },
  pinRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  pinContainer: {
    flex: 1,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8
  },
  pinAccessory: {
    width: 38,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center"
  },
  pinBox: {
    flex: 1,
    minWidth: 0,
    maxWidth: 60,
    aspectRatio: 0.86,
    borderWidth: 2,
    borderColor: palette.border,
    borderRadius: 16,
    fontSize: 26,
    fontWeight: "700",
    color: palette.blue900,
    textAlign: "center",
    textAlignVertical: "center",
    backgroundColor: palette.surface
  },
  pinBoxFilled: {
    borderColor: palette.blue700,
    backgroundColor: "#F0F7FF"
  },
  pinBoxError: {
    borderColor: palette.danger,
    backgroundColor: palette.dangerBg
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.danger,
    textAlign: "center",
    marginTop: 4
  }
});

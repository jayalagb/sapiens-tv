import React from 'react';
import {TouchableOpacity, Text, StyleSheet} from 'react-native';
import {colors, spacing, fontSize} from '../theme';

export default function TagChip({label, selected = false, onPress}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}>
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 20,
    backgroundColor: colors.grayLight,
    marginRight: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.accent,
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.grayDark,
  },
  labelSelected: {
    color: colors.white,
    fontWeight: '600',
  },
});

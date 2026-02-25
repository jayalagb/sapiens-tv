import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, StatusBar} from 'react-native';
import {colors, spacing, fontSize} from '../theme';

export default function LandingScreen({navigation}) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.accent} />
      <View style={styles.hero}>
        <Text style={styles.logo}>SesamoTV</Text>
        <Text style={styles.tagline}>Tu plataforma de video privada</Text>
      </View>
      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.8}>
          <Text style={styles.btnPrimaryText}>Iniciar Sesión</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.8}>
          <Text style={styles.btnSecondaryText}>Crear Cuenta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl * 2,
  },
  logo: {
    fontSize: fontSize.hero + 8,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: fontSize.lg,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.sm,
  },
  buttons: {
    width: '100%',
  },
  btnPrimary: {
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  btnPrimaryText: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  btnSecondary: {
    borderWidth: 2,
    borderColor: colors.white,
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
});

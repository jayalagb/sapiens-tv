import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {register} from '../api';
import {colors, spacing, fontSize} from '../theme';

export default function RegisterScreen({navigation}) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password) {
      Alert.alert('Error', 'Todos los campos son obligatorios');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
      Alert.alert(
        'Registro exitoso',
        'Tu cuenta está pendiente de aprobación. Te notificaremos cuando sea aprobada.',
        [{text: 'OK', onPress: () => navigation.goBack()}],
      );
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Crear Cuenta</Text>

        <TextInput
          style={styles.input}
          placeholder="Usuario"
          placeholderTextColor={colors.gray}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.gray}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor={colors.gray}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <View style={styles.rules}>
          <Text style={styles.ruleTitle}>La contraseña debe tener:</Text>
          <Text style={styles.rule}>• Al menos 8 caracteres</Text>
          <Text style={styles.rule}>• Una letra mayúscula</Text>
          <Text style={styles.rule}>• Una letra minúscula</Text>
          <Text style={styles.rule}>• Un número</Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.btnText}>Registrarse</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.link}>
          <Text style={styles.linkText}>
            ¿Ya tienes cuenta? <Text style={styles.linkBold}>Inicia sesión</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: colors.white},
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.black,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.grayLight,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    fontSize: fontSize.lg,
    color: colors.black,
    marginBottom: spacing.md,
    backgroundColor: colors.grayLight,
  },
  rules: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.grayLight,
    borderRadius: 8,
  },
  ruleTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.grayDark,
    marginBottom: spacing.xs,
  },
  rule: {
    fontSize: fontSize.sm,
    color: colors.gray,
    marginLeft: spacing.sm,
  },
  btn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnDisabled: {opacity: 0.7},
  btnText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  link: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  linkText: {
    color: colors.gray,
    fontSize: fontSize.md,
  },
  linkBold: {
    color: colors.accent,
    fontWeight: '600',
  },
});

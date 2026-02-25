import React, {useState, useEffect, useCallback} from 'react';
import {View, Text, ActivityIndicator, StyleSheet, Alert} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {getToken, getMe, clearToken} from './src/api';
import {colors} from './src/theme';

import LandingScreen from './src/screens/LandingScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ResetScreen from './src/screens/ResetScreen';
import HomeScreen from './src/screens/HomeScreen';
import PlayerScreen from './src/screens/PlayerScreen';

const AuthStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();

function AuthNavigator({onLogin}) {
  return (
    <AuthStack.Navigator screenOptions={{headerShown: false}}>
      <AuthStack.Screen name="Landing" component={LandingScreen} />
      <AuthStack.Screen
        name="Login"
        component={LoginScreen}
        initialParams={{onLogin}}
      />
      <AuthStack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          headerShown: true,
          headerTitle: '',
          headerBackTitle: 'Volver',
          headerTintColor: colors.accent,
          headerShadowVisible: false,
        }}
      />
      <AuthStack.Screen
        name="Reset"
        component={ResetScreen}
        options={{
          headerShown: true,
          headerTitle: '',
          headerBackTitle: 'Volver',
          headerTintColor: colors.accent,
          headerShadowVisible: false,
        }}
      />
    </AuthStack.Navigator>
  );
}

function MainNavigator({username, onLogout}) {
  return (
    <MainStack.Navigator>
      <MainStack.Screen
        name="Home"
        component={HomeScreen}
        initialParams={{username, onLogout}}
        options={{headerShown: false}}
      />
      <MainStack.Screen
        name="Player"
        component={PlayerScreen}
        options={{
          headerTitle: '',
          headerStyle: {backgroundColor: colors.black},
          headerTintColor: colors.white,
          headerShadowVisible: false,
        }}
      />
    </MainStack.Navigator>
  );
}

export default function App() {
  const [state, setState] = useState('loading'); // loading | auth | pending | rejected | main
  const [username, setUsername] = useState('');

  const checkAuth = useCallback(async () => {
    setState('loading');
    const token = await getToken();
    if (!token) {
      setState('auth');
      return;
    }
    try {
      const data = await getMe();
      const user = data.user || data;
      setUsername(user.username || '');
      if (user.status === 'approved') {
        setState('main');
      } else if (user.status === 'pending') {
        setState('pending');
      } else {
        setState('rejected');
      }
    } catch {
      await clearToken();
      setState('auth');
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = async () => {
    await clearToken();
    setState('auth');
    setUsername('');
  };

  if (state === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (state === 'pending') {
    return (
      <View style={styles.center}>
        <Text style={styles.statusTitle}>Cuenta Pendiente</Text>
        <Text style={styles.statusText}>
          Tu cuenta está pendiente de aprobación por un administrador.
        </Text>
        <Text style={styles.statusLink} onPress={handleLogout}>
          Cerrar sesión
        </Text>
      </View>
    );
  }

  if (state === 'rejected') {
    return (
      <View style={styles.center}>
        <Text style={styles.statusTitle}>Cuenta Rechazada</Text>
        <Text style={styles.statusText}>
          Tu solicitud de cuenta ha sido rechazada. Contacta al administrador.
        </Text>
        <Text style={styles.statusLink} onPress={handleLogout}>
          Cerrar sesión
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {state === 'auth' ? (
        <AuthNavigator onLogin={checkAuth} />
      ) : (
        <MainNavigator username={username} onLogout={handleLogout} />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 32,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.black,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 16,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  statusLink: {
    fontSize: 16,
    color: colors.accent,
    fontWeight: '600',
  },
});

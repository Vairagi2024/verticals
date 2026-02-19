import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useRouter, useSegments } from 'expo-router';
import { api } from '../utils/api';

export default function Index() {
  const { token, setUser, loadAuth } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (isReady) {
      checkAuth();
    }
  }, [isReady, token]);

  const initAuth = async () => {
    await loadAuth();
    setIsReady(true);
  };

  const checkAuth = async () => {
    if (!token) {
      router.replace('/login/role-selection');
      return;
    }

    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Auth check failed:', error);
      router.replace('/login/role-selection');
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6C3AE0" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
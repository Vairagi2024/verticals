import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';

export default function Index() {
  const { token, isLoading, setUser, setLoading, loadAuth } = useAuthStore();
  const router = useRouter();
  const [checked, setChecked] = React.useState(false);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    // Load auth from storage first
    await loadAuth();
    setChecked(true);
  };

  useEffect(() => {
    if (checked) {
      checkAuth();
    }
  }, [checked, token]);

  const checkAuth = async () => {
    if (!token) {
      router.replace('/(auth)/login');
      return;
    }

    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Auth check failed:', error);
      router.replace('/(auth)/login');
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6200ee" />
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
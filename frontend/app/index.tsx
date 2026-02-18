import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';

export default function Index() {
  const { token, isLoading, setUser, setLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, [token]);

  const checkAuth = async () => {
    if (isLoading) return;

    if (!token) {
      router.replace('/(auth)/login');
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/auth/me');
      setUser(response.data);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Auth check failed:', error);
      router.replace('/(auth)/login');
    } finally {
      setLoading(false);
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
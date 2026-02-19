import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function StudentLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser, setToken } = useAuthStore();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password || !batchCode) {
      setError('Please fill all fields');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await api.post('/auth/login/student', {
        email,
        password,
        batch_code: batchCode,
      });
      setUser(response.data.user);
      await setToken(response.data.session_token);
      router.replace('/(tabs)');
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#4ECDC4" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <MaterialCommunityIcons name="school" size={80} color="#4ECDC4" />
          <Text variant="headlineLarge" style={styles.title}>
            Student Login
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            Enter your student credentials
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Student Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            left={<TextInput.Icon icon="email" />}
            outlineColor="#4ECDC4"
            activeOutlineColor="#4ECDC4"
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
            left={<TextInput.Icon icon="lock" />}
            outlineColor="#4ECDC4"
            activeOutlineColor="#4ECDC4"
          />

          <TextInput
            label="Batch Code"
            value={batchCode}
            onChangeText={setBatchCode}
            mode="outlined"
            autoCapitalize="characters"
            style={styles.input}
            placeholder="e.g., VS2026-001"
            left={<TextInput.Icon icon="ticket" />}
            outlineColor="#4ECDC4"
            activeOutlineColor="#4ECDC4"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.button}
            buttonColor="#4ECDC4"
          >
            Login as Student
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backText: {
    marginLeft: 8,
    color: '#4ECDC4',
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    color: '#666',
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  button: {
    marginTop: 8,
    paddingVertical: 8,
  },
  error: {
    color: '#d32f2f',
    marginBottom: 16,
    textAlign: 'center',
  },
});
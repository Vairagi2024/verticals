import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Text, TextInput, Button, SegmentedButtons, Checkbox } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [grade, setGrade] = useState('11');
  const [instituteCode, setInstituteCode] = useState('');
  const [isTeacher, setIsTeacher] = useState(false);
  const [teacherCode, setTeacherCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser, setToken } = useAuthStore();
  const router = useRouter();

  const handleRegister = async () => {
    if (!name || !email || !password || !instituteCode) {
      setError('Please fill all fields');
      return;
    }

    if (isTeacher && !teacherCode) {
      setError('Please enter teacher code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await api.post('/auth/register', {
        name,
        email,
        password,
        grade: parseInt(grade),
        institute_code: instituteCode,
        is_teacher: isTeacher,
        teacher_code: isTeacher ? teacherCode : undefined,
      });
      setUser(response.data.user);
      await setToken(response.data.session_token);
      router.replace('/(tabs)');
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Registration failed');
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
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            Student Registration
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Join Vertical Studies
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
          />

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
          />

          <Text variant="labelLarge" style={styles.label}>
            Select Grade
          </Text>
          <SegmentedButtons
            value={grade}
            onValueChange={setGrade}
            buttons={[
              { value: '11', label: 'Grade 11' },
              { value: '12', label: 'Grade 12' },
            ]}
            style={styles.segmented}
          />

          <TextInput
            label="Institute Code"
            value={instituteCode}
            onChangeText={setInstituteCode}
            mode="outlined"
            autoCapitalize="characters"
            style={styles.input}
            placeholder="Enter code provided by institute"
          />

          <View style={styles.checkboxContainer}>
            <Checkbox
              status={isTeacher ? 'checked' : 'unchecked'}
              onPress={() => setIsTeacher(!isTeacher)}
            />
            <Text variant="bodyLarge" style={styles.checkboxLabel}>
              I'm a teacher
            </Text>
          </View>

          {isTeacher && (
            <TextInput
              label="Teacher Code"
              value={teacherCode}
              onChangeText={setTeacherCode}
              mode="outlined"
              autoCapitalize="characters"
              style={styles.input}
              placeholder="Enter teacher registration code"
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            mode="contained"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.button}
          >
            Register
          </Button>

          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.link}
          >
            <Text style={styles.linkText}>
              Already have an account? Login
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontWeight: 'bold',
    color: '#6200ee',
    marginBottom: 8,
  },
  subtitle: {
    color: '#666',
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  input: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    marginTop: 8,
  },
  segmented: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
  },
  error: {
    color: '#d32f2f',
    marginBottom: 16,
    textAlign: 'center',
  },
  link: {
    marginTop: 8,
    alignItems: 'center',
  },
  linkText: {
    color: '#6200ee',
    fontSize: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  checkboxLabel: {
    marginLeft: 8,
  },
});
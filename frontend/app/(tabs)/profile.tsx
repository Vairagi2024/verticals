import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, Avatar } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { useRouter } from 'expo-router';
import { api } from '../../utils/api';

export default function Profile() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    await api.post('/auth/logout');
    await logout();
    router.replace('/');
  };

  if (!user) return null;

  const getRoleColor = () => {
    switch (user.role) {
      case 'admin': return '#6C3AE0';
      case 'teacher': return '#4A90E2';
      case 'student': return '#4ECDC4';
      default: return '#6C3AE0';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { backgroundColor: getRoleColor() }]}>
        <Avatar.Text
          size={80}
          label={user.name.substring(0, 2).toUpperCase()}
          style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.3)' }]}
          color="#fff"
        />
        <Text variant="headlineMedium" style={styles.name}>
          {user.name}
        </Text>
        <Text variant="bodyLarge" style={styles.email}>
          {user.email}
        </Text>
      </View>

      <View style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Account Information
            </Text>
            <View style={styles.infoRow}>
              <Text variant="bodyLarge" style={styles.label}>
                Role:
              </Text>
              <Text variant="bodyLarge" style={styles.value}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </Text>
            </View>
            {user.batch_code && (
              <View style={styles.infoRow}>
                <Text variant="bodyLarge" style={styles.label}>
                  Batch Code:
                </Text>
                <Text variant="bodyLarge" style={styles.value}>
                  {user.batch_code}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Institute Information
            </Text>
            <Text variant="bodyMedium" style={styles.instituteText}>
              Vertical Studies
            </Text>
            <Text variant="bodyMedium" style={styles.instituteText}>
              Sector 44 D, SCO:371
            </Text>
            <Text variant="bodyMedium" style={styles.instituteText}>
              Chandigarh
            </Text>
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={handleLogout}
          style={styles.logoutButton}
          buttonColor="#d32f2f"
        >
          Logout
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  avatar: {
    marginBottom: 16,
  },
  name: {
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  email: {
    color: '#fff',
    opacity: 0.9,
  },
  content: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  cardTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    color: '#666',
  },
  value: {
    fontWeight: '600',
  },
  instituteText: {
    color: '#666',
    marginVertical: 4,
  },
  logoutButton: {
    marginTop: 16,
    paddingVertical: 4,
  },
});
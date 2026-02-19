import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Button, FAB } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function Home() {
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      if (user?.role === 'admin') {
        const response = await api.get('/admin/analytics');
        setStats(response.data);
      } else if (user?.role === 'student') {
        const response = await api.get('/student/results');
        setStats({ attempts: response.data.length });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await api.post('/auth/logout');
    await logout();
    router.replace('/login/role-selection');
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
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={[styles.header, { backgroundColor: getRoleColor() }]}>
          <View style={styles.headerContent}>
            <View>
              <Text variant="headlineSmall" style={styles.welcomeText}>
                Welcome, {user.name}!
              </Text>
              <Text variant="bodyLarge" style={styles.roleText}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)} Dashboard
              </Text>
            </View>
            <Button
              mode="contained"
              onPress={handleLogout}
              buttonColor="rgba(255,255,255,0.3)"
              textColor="#fff"
            >
              Logout
            </Button>
          </View>
        </View>

        <View style={styles.content}>
          <Text variant="headlineSmall" style={styles.sectionTitle}>
            Vertical Studies
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Sector 44 D, Chandigarh • SCO:371
          </Text>

          {user.role === 'admin' && (
            <View style={styles.statsGrid}>
              <Card style={styles.statCard}>
                <Card.Content style={styles.statContent}>
                  <MaterialCommunityIcons name="account-group" size={32} color="#6C3AE0" />
                  <Text variant="headlineMedium" style={styles.statNumber}>
                    {stats.total_students || 0}
                  </Text>
                  <Text variant="bodyMedium">Students</Text>
                </Card.Content>
              </Card>

              <Card style={styles.statCard}>
                <Card.Content style={styles.statContent}>
                  <MaterialCommunityIcons name="account-tie" size={32} color="#4A90E2" />
                  <Text variant="headlineMedium" style={styles.statNumber}>
                    {stats.total_teachers || 0}
                  </Text>
                  <Text variant="bodyMedium">Teachers</Text>
                </Card.Content>
              </Card>

              <Card style={styles.statCard}>
                <Card.Content style={styles.statContent}>
                  <MaterialCommunityIcons name="video" size={32} color="#4ECDC4" />
                  <Text variant="headlineMedium" style={styles.statNumber}>
                    {stats.total_videos || 0}
                  </Text>
                  <Text variant="bodyMedium">Videos</Text>
                </Card.Content>
              </Card>

              <Card style={styles.statCard}>
                <Card.Content style={styles.statContent}>
                  <MaterialCommunityIcons name="file-document-edit" size={32} color="#FF6B6B" />
                  <Text variant="headlineMedium" style={styles.statNumber}>
                    {stats.total_tests || 0}
                  </Text>
                  <Text variant="bodyMedium">Tests</Text>
                </Card.Content>
              </Card>
            </View>
          )}

          <Card style={styles.quickCard}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.cardTitle}>
                Quick Actions
              </Text>
              {user.role === 'student' && (
                <Button
                  mode="contained"
                  icon="book-open"
                  style={styles.actionButton}
                  onPress={() => router.push('/(tabs)/subjects')}
                >
                  Browse Subjects
                </Button>
              )}
              {(user.role === 'teacher' || user.role === 'admin') && (
                <>
                  <Button
                    mode="contained"
                    icon="upload"
                    style={styles.actionButton}
                    onPress={() => router.push('/(tabs)/subjects')}
                  >
                    Upload Content
                  </Button>
                  <Button
                    mode="outlined"
                    icon="file-document-edit"
                    style={styles.actionButton}
                    onPress={() => router.push('/(tabs)/subjects')}
                  >
                    Create Test
                  </Button>
                </>
              )}
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  header: {
    padding: 24,
    paddingTop: 48,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  roleText: {
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#666',
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statNumber: {
    fontWeight: 'bold',
    marginVertical: 8,
  },
  quickCard: {
    marginTop: 8,
  },
  cardTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  actionButton: {
    marginBottom: 12,
  },
});
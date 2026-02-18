import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Button, Avatar } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function Home() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({ quizzes: 0, avgScore: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    if (!user) return;
    try {
      const response = await api.get(`/quiz/results/${user.user_id}`);
      const attempts = response.data;
      if (attempts.length > 0) {
        const avgScore = attempts.reduce((sum: number, a: any) => 
          sum + (a.score / a.total * 100), 0) / attempts.length;
        setStats({ quizzes: attempts.length, avgScore: Math.round(avgScore) });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  if (!user) return null;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Avatar.Text
          size={80}
          label={user.name.substring(0, 2).toUpperCase()}
          style={styles.avatar}
        />
        <Text variant="headlineSmall" style={styles.welcomeText}>
          Welcome, {user.name}!
        </Text>
        <Text variant="bodyMedium" style={styles.gradeText}>
          Grade {user.grade} | {user.role}
        </Text>
      </View>

      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <MaterialCommunityIcons
              name="file-document-edit"
              size={32}
              color="#6200ee"
            />
            <Text variant="headlineMedium" style={styles.statNumber}>
              {stats.quizzes}
            </Text>
            <Text variant="bodyMedium">Quizzes Taken</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <MaterialCommunityIcons name="chart-line" size={32} color="#6200ee" />
            <Text variant="headlineMedium" style={styles.statNumber}>
              {stats.avgScore}%
            </Text>
            <Text variant="bodyMedium">Average Score</Text>
          </Card.Content>
        </Card>
      </View>

      <Card style={styles.infoCard}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.cardTitle}>
            Vertical Studies
          </Text>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="map-marker" size={20} color="#666" />
            <Text variant="bodyMedium" style={styles.infoText}>
              Sector 44 D, SCO:371, Chandigarh
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="book" size={20} color="#666" />
            <Text variant="bodyMedium" style={styles.infoText}>
              Physics, Chemistry, Mathematics
            </Text>
          </View>
        </Card.Content>
      </Card>

      <View style={styles.quickActions}>
        <Button
          mode="contained"
          icon="book-open"
          onPress={() => router.push('/(tabs)/subjects')}
          style={styles.actionButton}
        >
          Browse Subjects
        </Button>
        <Button
          mode="outlined"
          icon="file-document-edit"
          onPress={() => router.push('/(tabs)/quizzes')}
          style={styles.actionButton}
        >
          Take a Quiz
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
  },
  avatar: {
    backgroundColor: '#6200ee',
    marginBottom: 16,
  },
  welcomeText: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  gradeText: {
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  statCard: {
    flex: 1,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statNumber: {
    fontWeight: 'bold',
    color: '#6200ee',
    marginVertical: 8,
  },
  infoCard: {
    margin: 16,
    marginTop: 0,
  },
  cardTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  infoText: {
    marginLeft: 8,
    flex: 1,
  },
  quickActions: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 4,
  },
});
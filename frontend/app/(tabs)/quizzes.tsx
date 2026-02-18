import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';
import { useRouter } from 'expo-router';

export default function Quizzes() {
  const { user } = useAuthStore();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      loadResults();
    }
  }, [user]);

  const loadResults = async () => {
    if (!user) return;
    try {
      const response = await api.get(`/quiz/results/${user.user_id}`);
      setResults(response.data);
    } catch (error) {
      console.error('Failed to load results:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadResults();
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
      <View style={styles.content}>
        <Text variant="headlineSmall" style={styles.header}>
          Your Quiz Results
        </Text>

        {loading ? (
          <Text>Loading...</Text>
        ) : results.length === 0 ? (
          <View style={styles.emptyState}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              No quiz attempts yet. Browse subjects to take a quiz!
            </Text>
            <Button
              mode="contained"
              onPress={() => router.push('/(tabs)/subjects')}
              style={styles.button}
            >
              Browse Subjects
            </Button>
          </View>
        ) : (
          results.map((result, index) => (
            <View key={index} style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text variant="titleMedium" style={styles.quizTitle}>
                  {result.quiz_title}
                </Text>
                <Text
                  variant="titleLarge"
                  style={[
                    styles.score,
                    result.score / result.total >= 0.7
                      ? styles.scoreGood
                      : styles.scorePoor,
                  ]}
                >
                  {result.score}/{result.total}
                </Text>
              </View>
              <Text variant="bodySmall" style={styles.date}>
                {new Date(result.completed_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  header: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 24,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quizTitle: {
    flex: 1,
    fontWeight: 'bold',
  },
  score: {
    fontWeight: 'bold',
    marginLeft: 16,
  },
  scoreGood: {
    color: '#4caf50',
  },
  scorePoor: {
    color: '#f44336',
  },
  date: {
    color: '#666',
  },
});
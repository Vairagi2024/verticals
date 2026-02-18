import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Card, Chip } from 'react-native-paper';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface Subject {
  subject_id: string;
  name: string;
  description: string;
  grade: number;
  icon: string;
}

const iconMap: Record<string, string> = {
  atom: 'atom',
  flask: 'flask',
  calculator: 'calculator',
};

export default function Subjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      const response = await api.get('/subjects');
      setSubjects(response.data);
    } catch (error) {
      console.error('Failed to load subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSubjects();
    setRefreshing(false);
  };

  const handleSubjectPress = (subject: Subject) => {
    router.push(`/subject/${subject.subject_id}`);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.content}>
        <Text variant="headlineSmall" style={styles.header}>
          Your Subjects - Grade {user?.grade}
        </Text>

        {subjects.map((subject) => (
          <TouchableOpacity
            key={subject.subject_id}
            onPress={() => handleSubjectPress(subject)}
          >
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons
                    name={iconMap[subject.icon] as any}
                    size={40}
                    color="#6200ee"
                  />
                </View>
                <View style={styles.textContainer}>
                  <Text variant="titleLarge" style={styles.subjectName}>
                    {subject.name}
                  </Text>
                  <Text variant="bodyMedium" style={styles.description}>
                    {subject.description}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color="#666"
                />
              </Card.Content>
            </Card>
          </TouchableOpacity>
        ))}
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
  card: {
    marginBottom: 12,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ede7f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  subjectName: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  description: {
    color: '#666',
  },
});
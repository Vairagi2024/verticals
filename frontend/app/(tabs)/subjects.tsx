import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Card, Searchbar } from 'react-native-paper';
import { api } from '../../utils/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';

interface Subject {
  subject_id: string;
  name: string;
  teacher_name: string;
  description: string;
  icon: string;
  color: string;
}

const iconMap: Record<string, string> = {
  atom: 'atom',
  flask: 'flask',
  calculator: 'calculator',
};

export default function Subjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<Subject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      setFilteredSubjects(
        subjects.filter((s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredSubjects(subjects);
    }
  }, [searchQuery, subjects]);

  const loadSubjects = async () => {
    try {
      const response = await api.get('/content/subjects');
      setSubjects(response.data);
      setFilteredSubjects(response.data);
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          Subjects
        </Text>
        <Searchbar
          placeholder="Search subjects..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <Text style={styles.emptyText}>Loading subjects...</Text>
        ) : filteredSubjects.length === 0 ? (
          <Text style={styles.emptyText}>No subjects found</Text>
        ) : (
          filteredSubjects.map((subject) => (
            <TouchableOpacity
              key={subject.subject_id}
              onPress={() => router.push(`/subject/${subject.subject_id}`)}
            >
              <Card style={[styles.card, { borderLeftColor: subject.color }]}>
                <Card.Content style={styles.cardContent}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: subject.color + '20' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={iconMap[subject.icon] as any}
                      size={40}
                      color={subject.color}
                    />
                  </View>
                  <View style={styles.textContainer}>
                    <Text variant="titleLarge" style={styles.subjectName}>
                      {subject.name}
                    </Text>
                    <Text variant="bodyMedium" style={styles.teacherName}>
                      by {subject.teacher_name}
                    </Text>
                    <Text variant="bodySmall" style={styles.description}>
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
          ))
        )}
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
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  searchBar: {
    elevation: 0,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 12,
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
  teacherName: {
    color: '#666',
    marginBottom: 4,
  },
  description: {
    color: '#999',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 32,
  },
});
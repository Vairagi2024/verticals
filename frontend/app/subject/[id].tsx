import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { Text, Button, FAB, Chip, Card } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Video } from 'expo-av';

interface Content {
  content_id: string;
  subject_id: string;
  type: string;
  title: string;
  description?: string;
  data?: string;
  url?: string;
  uploaded_by: string;
  created_at: string;
}

interface Quiz {
  quiz_id: string;
  subject_id: string;
  title: string;
  description?: string;
  time_limit_mins: number;
  created_at: string;
}

export default function SubjectDetail() {
  const { id } = useLocalSearchParams();
  const [content, setContent] = useState<Content[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const { user } = useAuthStore();
  const router = useRouter();

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [contentRes, quizRes] = await Promise.all([
        api.get(`/content/${id}`),
        api.get(`/quiz/${id}`),
      ]);
      setContent(contentRes.data);
      setQuizzes(quizRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleUploadPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const title = await promptForTitle('Photo');
      if (title) {
        await uploadContent('photo', title, result.assets[0].base64);
      }
    }
  };

  const handleUploadVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
    });

    if (!result.canceled) {
      const title = await promptForTitle('Video');
      if (title) {
        // For videos, we'll use URL-based approach
        Alert.alert('Info', 'For large videos, please use YouTube link option');
      }
    }
  };

  const handleUploadDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword'],
    });

    if (!result.canceled && result.assets[0]) {
      const title = await promptForTitle('Document');
      if (title) {
        // Convert to base64
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          await uploadContent('document', title, base64);
        };
        reader.readAsDataURL(blob);
      }
    }
  };

  const handleAddVideoLink = () => {
    Alert.prompt('Add Video Link', 'Enter YouTube or video URL', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Add',
        onPress: async (url) => {
          if (url) {
            const title = await promptForTitle('Video');
            if (title) {
              await uploadContent('video_link', title, undefined, url);
            }
          }
        },
      },
    ]);
  };

  const promptForTitle = (type: string): Promise<string | undefined> => {
    return new Promise((resolve) => {
      Alert.prompt(`${type} Title`, 'Enter a title for this content', [
        { text: 'Cancel', onPress: () => resolve(undefined), style: 'cancel' },
        { text: 'OK', onPress: (text) => resolve(text || undefined) },
      ]);
    });
  };

  const uploadContent = async (
    type: string,
    title: string,
    data?: string,
    url?: string
  ) => {
    try {
      const formData = new FormData();
      formData.append('subject_id', id as string);
      formData.append('type', type);
      formData.append('title', title);
      if (data) {
        formData.append('data', data);
      }
      if (url) {
        formData.append('url', url);
      }

      await api.post('/content', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Alert.alert('Success', 'Content uploaded successfully');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Upload failed');
    }
  };

  const handleDeleteContent = (contentId: string) => {
    Alert.alert('Delete Content', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/content/${contentId}`);
            loadData();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete content');
          }
        },
      },
    ]);
  };

  const renderContent = (item: Content) => {
    return (
      <Card key={item.content_id} style={styles.contentCard}>
        <Card.Content>
          <View style={styles.contentHeader}>
            <MaterialCommunityIcons
              name={
                item.type === 'photo'
                  ? 'image'
                  : item.type.includes('video')
                  ? 'video'
                  : 'file-document'
              }
              size={24}
              color="#6200ee"
            />
            <View style={styles.contentInfo}>
              <Text variant="titleMedium">{item.title}</Text>
              {item.description && (
                <Text variant="bodySmall" style={styles.description}>
                  {item.description}
                </Text>
              )}
            </View>
            {isTeacher && (
              <TouchableOpacity onPress={() => handleDeleteContent(item.content_id)}>
                <MaterialCommunityIcons name="delete" size={24} color="#d32f2f" />
              </TouchableOpacity>
            )}
          </View>

          {item.type === 'photo' && item.data && (
            <Image
              source={{ uri: `data:image/jpeg;base64,${item.data}` }}
              style={styles.image}
              resizeMode="contain"
            />
          )}

          {item.type === 'video_link' && item.url && (
            <TouchableOpacity
              onPress={() => Alert.alert('Video URL', item.url)}
              style={styles.videoLink}
            >
              <MaterialCommunityIcons name="play-circle" size={48} color="#6200ee" />
              <Text style={styles.videoLinkText}>Open Video</Text>
            </TouchableOpacity>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Study Materials
          </Text>
          {content.length === 0 ? (
            <Text style={styles.emptyText}>
              {isTeacher ? 'No content yet. Add some!' : 'No content available'}
            </Text>
          ) : (
            content.map(renderContent)
          )}
        </View>

        <View style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Quizzes
          </Text>
          {quizzes.length === 0 ? (
            <Text style={styles.emptyText}>
              {isTeacher ? 'No quizzes yet. Create one!' : 'No quizzes available'}
            </Text>
          ) : (
            quizzes.map((quiz) => (
              <TouchableOpacity
                key={quiz.quiz_id}
                onPress={() => router.push(`/quiz/${quiz.quiz_id}`)}
              >
                <Card style={styles.quizCard}>
                  <Card.Content>
                    <Text variant="titleMedium">{quiz.title}</Text>
                    {quiz.description && (
                      <Text variant="bodySmall" style={styles.description}>
                        {quiz.description}
                      </Text>
                    )}
                    <View style={styles.quizMeta}>
                      <Chip icon="clock" compact>
                        {quiz.time_limit_mins} mins
                      </Chip>
                    </View>
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {isTeacher && (
        <>
          <FAB.Group
            open={showMenu}
            visible
            icon={showMenu ? 'close' : 'plus'}
            actions={[
              {
                icon: 'image',
                label: 'Upload Photo',
                onPress: handleUploadPhoto,
              },
              {
                icon: 'youtube',
                label: 'Add Video Link',
                onPress: handleAddVideoLink,
              },
              {
                icon: 'file-document',
                label: 'Upload Document',
                onPress: handleUploadDocument,
              },
              {
                icon: 'file-document-edit',
                label: 'Create Quiz',
                onPress: () => router.push(`/quiz/create?subjectId=${id}`),
              },
            ]}
            onStateChange={({ open }) => setShowMenu(open)}
            style={styles.fab}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  contentCard: {
    marginBottom: 12,
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  description: {
    color: '#666',
    marginTop: 4,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  videoLink: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ede7f6',
    borderRadius: 8,
    marginTop: 8,
  },
  videoLinkText: {
    marginTop: 8,
    color: '#6200ee',
    fontWeight: '600',
  },
  quizCard: {
    marginBottom: 12,
  },
  quizMeta: {
    flexDirection: 'row',
    marginTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    padding: 16,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
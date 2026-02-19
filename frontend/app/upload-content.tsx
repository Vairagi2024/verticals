import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { Text, Button, Card, RadioButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export default function UploadContent() {
  const { subject } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [contentType, setContentType] = useState('photo');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  const subjectId = subject as string || 'physics';

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedFile(result.assets[0]);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      setSelectedFile(result.assets[0]);
    }
  };

  const handleUpload = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (contentType === 'video_link' && !videoUrl.trim()) {
      Alert.alert('Error', 'Please enter a video URL');
      return;
    }

    if ((contentType === 'photo' || contentType === 'document') && !selectedFile) {
      Alert.alert('Error', 'Please select a file');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('subject_id', subjectId);
      formData.append('content_type', contentType);
      formData.append('title', title);
      if (description) formData.append('description', description);

      if (contentType === 'video_link') {
        formData.append('url', videoUrl);
      } else if (selectedFile) {
        const fileUri = selectedFile.uri;
        const fileName = selectedFile.name || fileUri.split('/').pop() || 'file';
        const fileType = selectedFile.mimeType || (contentType === 'photo' ? 'image/jpeg' : 'application/pdf');
        
        formData.append('file', {
          uri: fileUri,
          name: fileName,
          type: fileType,
        } as any);
      }

      await api.uploadContent(formData);
      Alert.alert('Success', 'Content uploaded successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload content');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Upload Content
        </Text>
        <Text style={styles.subtitle}>Subject: {subjectId}</Text>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Content Type</Text>
            <RadioButton.Group onValueChange={value => setContentType(value)} value={contentType}>
              <View style={styles.radioRow}>
                <RadioButton.Item label="Photo" value="photo" />
                <RadioButton.Item label="Video Link" value="video_link" />
                <RadioButton.Item label="Document" value="document" />
              </View>
            </RadioButton.Group>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Details</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Title *"
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (optional)"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            {contentType === 'video_link' && (
              <TextInput
                style={styles.input}
                placeholder="YouTube or Video URL *"
                value={videoUrl}
                onChangeText={setVideoUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
            )}
          </Card.Content>
        </Card>

        {(contentType === 'photo' || contentType === 'document') && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Select {contentType === 'photo' ? 'Image' : 'Document'}
              </Text>
              
              <Button 
                mode="outlined" 
                onPress={contentType === 'photo' ? pickImage : pickDocument}
                style={styles.selectButton}
              >
                {selectedFile ? 'Change File' : `Select ${contentType === 'photo' ? 'Image' : 'Document'}`}
              </Button>

              {selectedFile && (
                <View style={styles.selectedFile}>
                  {contentType === 'photo' && selectedFile.uri && (
                    <Image source={{ uri: selectedFile.uri }} style={styles.previewImage} />
                  )}
                  <Text style={styles.fileName}>
                    {selectedFile.name || selectedFile.uri?.split('/').pop() || 'File selected'}
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        <Button
          mode="contained"
          onPress={handleUpload}
          loading={uploading}
          disabled={uploading}
          style={styles.uploadButton}
        >
          Upload Content
        </Button>

        <Button
          mode="text"
          onPress={() => router.back()}
          style={styles.cancelButton}
        >
          Cancel
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
  content: {
    padding: 16,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#666',
    marginBottom: 20,
    textTransform: 'capitalize',
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  radioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: 'white',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectButton: {
    marginVertical: 8,
  },
  selectedFile: {
    marginTop: 12,
    alignItems: 'center',
  },
  previewImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
  fileName: {
    color: '#666',
    fontSize: 14,
  },
  uploadButton: {
    marginTop: 8,
    paddingVertical: 6,
  },
  cancelButton: {
    marginTop: 8,
  },
});

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  IconButton,
  RadioButton,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../utils/api';

interface Question {
  question: string;
  options: [string, string, string, string];
  correct: number;
}

export default function CreateQuiz() {
  const { subjectId } = useLocalSearchParams();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState('30');
  const [questions, setQuestions] = useState<Question[]>([
    { question: '', options: ['', '', '', ''], correct: 0 },
  ]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const router = useRouter();

  const addQuestion = () => {
    setQuestions([...questions, { question: '', options: ['', '', '', ''], correct: 0 }]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const updated = [...questions];
    if (field === 'question') {
      updated[index].question = value;
    } else if (field === 'correct') {
      updated[index].correct = value;
    }
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = value;
    setQuestions(updated);
  };

  const handleAIGenerate = async () => {
    if (!aiTopic.trim()) {
      Alert.alert('Error', 'Please enter a topic');
      return;
    }

    try {
      setAiLoading(true);
      const formData = new FormData();
      formData.append('subject_id', subjectId as string);
      formData.append('topic', aiTopic);
      formData.append('num_questions', '5');

      const response = await api.post('/ai/generate-quiz', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setQuestions(response.data.questions);
      Alert.alert('Success', 'Questions generated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || questions.length === 0) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    // Validate questions
    for (let q of questions) {
      if (!q.question.trim() || q.options.some((o) => !o.trim())) {
        Alert.alert('Error', 'All questions and options must be filled');
        return;
      }
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('subject_id', subjectId as string);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('questions_json', JSON.stringify(questions));
      formData.append('time_limit_mins', timeLimit);

      await api.post('/quiz', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('Success', 'Quiz created successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineSmall" style={styles.header}>
          Create Quiz
        </Text>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              AI Quiz Generator
            </Text>
            <TextInput
              label="Topic"
              value={aiTopic}
              onChangeText={setAiTopic}
              mode="outlined"
              placeholder="e.g., Newton's Laws of Motion"
              style={styles.input}
            />
            <Button
              mode="contained"
              onPress={handleAIGenerate}
              loading={aiLoading}
              disabled={aiLoading}
              icon="sparkles"
            >
              Generate Questions with AI
            </Button>
          </Card.Content>
        </Card>

        <TextInput
          label="Quiz Title"
          value={title}
          onChangeText={setTitle}
          mode="outlined"
          style={styles.input}
        />

        <TextInput
          label="Description (Optional)"
          value={description}
          onChangeText={setDescription}
          mode="outlined"
          multiline
          numberOfLines={2}
          style={styles.input}
        />

        <TextInput
          label="Time Limit (minutes)"
          value={timeLimit}
          onChangeText={setTimeLimit}
          mode="outlined"
          keyboardType="number-pad"
          style={styles.input}
        />

        <Text variant="titleMedium" style={styles.questionsHeader}>
          Questions
        </Text>

        {questions.map((q, qIndex) => (
          <Card key={qIndex} style={styles.questionCard}>
            <Card.Content>
              <View style={styles.questionHeader}>
                <Text variant="titleSmall">Question {qIndex + 1}</Text>
                {questions.length > 1 && (
                  <IconButton
                    icon="delete"
                    size={20}
                    onPress={() => removeQuestion(qIndex)}
                  />
                )}
              </View>

              <TextInput
                label="Question"
                value={q.question}
                onChangeText={(val) => updateQuestion(qIndex, 'question', val)}
                mode="outlined"
                multiline
                style={styles.input}
              />

              <RadioButton.Group
                onValueChange={(val) => updateQuestion(qIndex, 'correct', parseInt(val))}
                value={q.correct.toString()}
              >
                {q.options.map((opt, oIndex) => (
                  <View key={oIndex} style={styles.optionRow}>
                    <RadioButton value={oIndex.toString()} />
                    <TextInput
                      label={`Option ${String.fromCharCode(65 + oIndex)}`}
                      value={opt}
                      onChangeText={(val) => updateOption(qIndex, oIndex, val)}
                      mode="outlined"
                      style={styles.optionInput}
                    />
                  </View>
                ))}
              </RadioButton.Group>
            </Card.Content>
          </Card>
        ))}

        <Button mode="outlined" onPress={addQuestion} icon="plus" style={styles.addButton}>
          Add Question
        </Button>

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          style={styles.submitButton}
        >
          Create Quiz
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginBottom: 16,
  },
  cardTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  input: {
    marginBottom: 16,
  },
  questionsHeader: {
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 16,
  },
  questionCard: {
    marginBottom: 16,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionInput: {
    flex: 1,
    marginLeft: 8,
  },
  addButton: {
    marginBottom: 16,
  },
  submitButton: {
    paddingVertical: 8,
    marginBottom: 32,
  },
});
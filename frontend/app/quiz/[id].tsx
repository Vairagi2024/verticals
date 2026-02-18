import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  RadioButton,
  Portal,
  Dialog,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../utils/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Question {
  question: string;
  options: string[];
  correct: number;
}

interface Quiz {
  quiz_id: string;
  subject_id: string;
  title: string;
  description?: string;
  questions: Question[];
  time_limit_mins: number;
}

export default function QuizAttempt() {
  const { id } = useLocalSearchParams();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    loadQuiz();
  }, [id]);

  useEffect(() => {
    if (started && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (started && timeLeft === 0) {
      handleSubmit();
    }
  }, [started, timeLeft]);

  const loadQuiz = async () => {
    try {
      const response = await api.get(`/quiz/detail/${id}`);
      setQuiz(response.data);
      setAnswers(new Array(response.data.questions.length).fill(-1));
      setTimeLeft(response.data.time_limit_mins * 60);
    } catch (error) {
      Alert.alert('Error', 'Failed to load quiz');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    setStarted(true);
  };

  const handleAnswerChange = (questionIndex: number, answerIndex: number) => {
    const updated = [...answers];
    updated[questionIndex] = answerIndex;
    setAnswers(updated);
  };

  const handleSubmit = async () => {
    if (answers.some((a) => a === -1)) {
      Alert.alert(
        'Incomplete',
        'Some questions are unanswered. Submit anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit', onPress: submitQuiz },
        ]
      );
    } else {
      submitQuiz();
    }
  };

  const submitQuiz = async () => {
    if (!quiz) return;

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('quiz_id', quiz.quiz_id);
      formData.append('answers_json', JSON.stringify(answers));

      const response = await api.post('/quiz/attempt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setResult(response.data);
      setShowResult(true);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading quiz...</Text>
      </View>
    );
  }

  if (!quiz) return null;

  if (!started) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.startContainer}>
          <MaterialCommunityIcons
            name="file-document-edit"
            size={80}
            color="#6200ee"
          />
          <Text variant="headlineMedium" style={styles.startTitle}>
            {quiz.title}
          </Text>
          {quiz.description && (
            <Text variant="bodyLarge" style={styles.startDescription}>
              {quiz.description}
            </Text>
          )}

          <Card style={styles.infoCard}>
            <Card.Content>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="help-circle" size={24} color="#666" />
                <Text variant="bodyLarge" style={styles.infoText}>
                  {quiz.questions.length} Questions
                </Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="clock" size={24} color="#666" />
                <Text variant="bodyLarge" style={styles.infoText}>
                  {quiz.time_limit_mins} Minutes
                </Text>
              </View>
            </Card.Content>
          </Card>

          <Button
            mode="contained"
            onPress={handleStart}
            style={styles.startButton}
            icon="play"
          >
            Start Quiz
          </Button>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.timerBar}>
        <MaterialCommunityIcons name="clock" size={24} color="#fff" />
        <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
      </View>

      <ScrollView style={styles.quizContainer}>
        {quiz.questions.map((question, qIndex) => (
          <Card key={qIndex} style={styles.questionCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.questionNumber}>
                Question {qIndex + 1}
              </Text>
              <Text variant="bodyLarge" style={styles.questionText}>
                {question.question}
              </Text>

              <RadioButton.Group
                onValueChange={(value) => handleAnswerChange(qIndex, parseInt(value))}
                value={answers[qIndex]?.toString() || ''}
              >
                {question.options.map((option, oIndex) => (
                  <View key={oIndex} style={styles.optionRow}>
                    <RadioButton value={oIndex.toString()} />
                    <Text
                      variant="bodyMedium"
                      style={styles.optionText}
                      onPress={() => handleAnswerChange(qIndex, oIndex)}
                    >
                      {String.fromCharCode(65 + oIndex)}. {option}
                    </Text>
                  </View>
                ))}
              </RadioButton.Group>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>

      <View style={styles.submitContainer}>
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
          style={styles.submitButton}
        >
          Submit Quiz
        </Button>
      </View>

      <Portal>
        <Dialog visible={showResult} onDismiss={() => router.back()}>
          <Dialog.Title>Quiz Complete!</Dialog.Title>
          <Dialog.Content>
            {result && (
              <View style={styles.resultContent}>
                <Text variant="headlineMedium" style={styles.resultScore}>
                  {result.score} / {result.total}
                </Text>
                <Text variant="bodyLarge" style={styles.resultPercentage}>
                  {Math.round((result.score / result.total) * 100)}%
                </Text>
                <Text variant="bodyMedium" style={styles.resultMessage}>
                  {result.score / result.total >= 0.7
                    ? 'Great job! Well done!'
                    : 'Keep practicing!'}
                </Text>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => router.back()}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  startContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startTitle: {
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  startDescription: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  infoCard: {
    width: '100%',
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  infoText: {
    marginLeft: 12,
  },
  startButton: {
    paddingHorizontal: 32,
    paddingVertical: 8,
  },
  timerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6200ee',
    paddingVertical: 12,
    gap: 8,
  },
  timerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  quizContainer: {
    flex: 1,
    padding: 16,
  },
  questionCard: {
    marginBottom: 16,
  },
  questionNumber: {
    color: '#6200ee',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  questionText: {
    marginBottom: 16,
    fontWeight: '500',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  optionText: {
    flex: 1,
    marginLeft: 8,
  },
  submitContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  submitButton: {
    paddingVertical: 8,
  },
  resultContent: {
    alignItems: 'center',
  },
  resultScore: {
    fontWeight: 'bold',
    color: '#6200ee',
    marginBottom: 8,
  },
  resultPercentage: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  resultMessage: {
    color: '#666',
  },
});

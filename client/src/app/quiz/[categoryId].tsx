import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Alert, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  BackHandler
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { Bookmark, Clock, Check, X, AlertCircle } from 'lucide-react-native';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { Colors, Spacing, Shadows } from '../../constants/theme';

interface Question {
  id: string;
  type: 'MCQ' | 'ShortAnswer';
  questionText: string;
  options?: string[];
  correctAnswer: string;
  marks?: number; // Defaults to 1 for MCQ, 5 for Short Answer
}

interface UserAnswer {
  questionId: string;
  type: 'MCQ' | 'ShortAnswer';
  selectedAnswer?: string;
  userAnswerText?: string;
  isCorrect: boolean;
  marksAwarded: number;
  explanation?: string; // Feedback from Gemini
}

export default function QuizScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  const [categoryName, setCategoryName] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);

  // Quiz progression and scores
  const [answers, setAnswers] = useState<UserAnswer[]>([]);
  const answersRef = useRef<UserAnswer[]>([]);
  
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const timerRef = useRef<any>(null);
  
  // Track bookmarked IDs in real time
  const [bookmarkDocId, setBookmarkDocId] = useState<string | null>(null);

  const handleCancelQuiz = () => {
    Alert.alert(
      "Cancel Quiz",
      "Are you sure you want to cancel the quiz? Your progress will be lost and nothing will be saved.",
      [
        { text: "No, Continue", style: "cancel" },
        { 
          text: "Yes, Cancel", 
          style: "destructive",
          onPress: () => {
            if (timerRef.current) clearInterval(timerRef.current);
            router.replace('/(tabs)');
          }
        }
      ]
    );
  };

  // 1. Fetch Category and Questions
  useEffect(() => {
    const fetchQuizData = async () => {
      try {
        if (!categoryId) return;

        // Fetch category limit
        const catSnap = await getDoc(doc(db, 'categories', categoryId));
        let timeLimit = 120; // Default 2 minutes
        if (catSnap.exists()) {
          setCategoryName(catSnap.data().name);
          timeLimit = catSnap.data().timeLimitSeconds || 120;
        } else if (categoryId === 'general_knowledge') {
          setCategoryName('General Knowledge');
        }

        setSecondsLeft(timeLimit);
        setTotalTime(timeLimit);

        // Fetch questions for this category
        const qSnap = await getDocs(
          query(collection(db, 'questions'), where('categoryId', '==', categoryId))
        );

        const loadedQuestions: Question[] = [];
        qSnap.forEach((doc) => {
          const data = doc.data();
          loadedQuestions.push({
            id: doc.id,
            type: data.type || 'MCQ',
            questionText: data.questionText || '',
            options: data.options || [],
            correctAnswer: data.correctAnswer || '',
            marks: data.marks || (data.type === 'ShortAnswer' ? 5 : 1)
          });
        });

        if (loadedQuestions.length === 0) {
          Alert.alert('No Questions', 'There are no questions in this category yet.', [
            { text: 'Go Back', onPress: () => router.back() }
          ]);
          return;
        }

        // Shuffle questions
        const shuffled = loadedQuestions.sort(() => Math.random() - 0.5);
        setQuestions(shuffled);
        setLoading(false);
      } catch (err) {
        console.error("Error loading quiz:", err);
        Alert.alert('Error', 'Failed to start quiz.');
        router.back();
      }
    };

    fetchQuizData();
  }, [categoryId]);

  // 2. Start Countdown Timer
  useEffect(() => {
    if (loading || questions.length === 0) return;

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleQuizTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, questions]);

  // Back button handler for Android hardware back button
  useEffect(() => {
    const backAction = () => {
      handleCancelQuiz();
      return true; // Block default back action
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [questions, currentIdx, answers]);

  // 3. Track Bookmarked state for current question
  useEffect(() => {
    if (loading || questions.length === 0 || !profile?.uid) return;
    
    const checkBookmark = async () => {
      const qId = questions[currentIdx].id;
      const bSnap = await getDocs(
        query(
          collection(db, 'bookmarks'), 
          where('userId', '==', profile.uid),
          where('questionId', '==', qId)
        )
      );
      if (!bSnap.empty) {
        setBookmarked(true);
        setBookmarkDocId(bSnap.docs[0].id);
      } else {
        setBookmarked(false);
        setBookmarkDocId(null);
      }
    };

    checkBookmark();
  }, [currentIdx, loading, questions]);

  const handleQuizTimeout = () => {
    Alert.alert("Time's Up!", "Your time limit was exceeded. Submitting completed answers.", [
      { text: 'View Results', onPress: () => submitQuiz(answersRef.current) }
    ]);
  };

  const toggleBookmark = async () => {
    if (!profile?.uid || questions.length === 0) return;
    const currentQuestion = questions[currentIdx];

    try {
      if (bookmarked && bookmarkDocId) {
        await deleteDoc(doc(db, 'bookmarks', bookmarkDocId));
        setBookmarked(false);
        setBookmarkDocId(null);
      } else {
        const newBookmarkRef = doc(collection(db, 'bookmarks'));
        await setDoc(newBookmarkRef, {
          userId: profile.uid,
          questionId: currentQuestion.id,
          questionText: currentQuestion.questionText,
          categoryName: categoryName || 'General',
          addedAt: new Date()
        });
        setBookmarked(true);
        setBookmarkDocId(newBookmarkRef.id);
      }
    } catch (err) {
      console.error("Error toggling bookmark:", err);
    }
  };

  const handleMCQSelect = (option: string) => {
    if (selectedOpt !== null) return; // Locked

    setSelectedOpt(option);
    const currentQuestion = questions[currentIdx];
    const isCorrect = option === currentQuestion.correctAnswer;
    const marks = currentQuestion.marks || 1;

    const answerRecord: UserAnswer = {
      questionId: currentQuestion.id,
      type: 'MCQ',
      selectedAnswer: option,
      isCorrect,
      marksAwarded: isCorrect ? marks : 0
    };

    const newAnswers = [...answers, answerRecord];
    setAnswers(newAnswers);

    // Auto-advance after 1.5 seconds
    setTimeout(() => {
      advanceQuiz(newAnswers);
    }, 1500);
  };

  const handleShortAnswerSubmit = async () => {
    if (!typedAnswer.trim()) return;

    setGrading(true);
    const currentQuestion = questions[currentIdx];
    const marks = currentQuestion.marks || 5;

    try {
      // Call backend Gemini AI grading
      const evaluation = await apiService.gradeShortAnswer(
        currentQuestion.questionText,
        currentQuestion.correctAnswer,
        typedAnswer.trim()
      );

      const answerRecord: UserAnswer = {
        questionId: currentQuestion.id,
        type: 'ShortAnswer',
        userAnswerText: typedAnswer.trim(),
        isCorrect: evaluation.isCorrect,
        marksAwarded: evaluation.isCorrect ? marks : 0,
        explanation: evaluation.explanation
      };

      const newAnswers = [...answers, answerRecord];
      setAnswers(newAnswers);

      setGrading(false);
      setTypedAnswer('');
      advanceQuiz(newAnswers);
    } catch (err) {
      console.error("Gemini grading failed:", err);
      setGrading(false);
      
      // Fallback: Save as pending manual grading, default to 0 marks
      const answerRecord: UserAnswer = {
        questionId: currentQuestion.id,
        type: 'ShortAnswer',
        userAnswerText: typedAnswer.trim(),
        isCorrect: false, // Default false until admin checks
        marksAwarded: 0,
        explanation: 'Auto-grading failed. Queued for admin review.'
      };
      
      const newAnswers = [...answers, answerRecord];
      setAnswers(newAnswers);
      advanceQuiz(newAnswers);
    }
  };

  const advanceQuiz = (currentAnswersList: UserAnswer[]) => {
    setSelectedOpt(null);
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      // Quiz finished
      submitQuiz(currentAnswersList);
    }
  };

  const submitQuiz = async (finalAnswers: UserAnswer[]) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setLoading(true);

    try {
      // Calculate final raw score (sum of marks awarded)
      const rawScore = finalAnswers.reduce((sum, ans) => sum + ans.marksAwarded, 0);
      const totalPossibleMarks = questions.reduce((sum, q) => sum + (q.marks || (q.type === 'ShortAnswer' ? 5 : 1)), 0);

      const statsPayload = {
        userId: profile?.uid || '',
        categoryId: categoryId || 'general_knowledge',
        categoryName: categoryName || 'General Knowledge',
        score: rawScore,
        totalQuestions: questions.length,
        totalPossibleMarks,
        answers: finalAnswers
      };

      // Submit results to server stats controller
      await apiService.submitQuizStats(statsPayload);

      // Create a local package of result statistics to display on the Result Screen
      router.replace({
        pathname: '/quiz/result',
        params: {
          categoryName,
          score: rawScore,
          totalPossibleMarks,
          totalQuestions: questions.length,
          percentage: Math.round((rawScore / totalPossibleMarks) * 100),
          // We pass along the answer logs so the result page can render the review
          answersJson: JSON.stringify(finalAnswers),
          questionsJson: JSON.stringify(questions)
        }
      });
    } catch (err) {
      console.error("Failed to submit quiz statistics:", err);
      Alert.alert('Submission Error', 'Failed to save quiz results online, returning to home.');
      router.replace('/(tabs)');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.dark.primary} size="large" />
        <Text style={styles.loadingText}>Loading quiz questions...</Text>
      </View>
    );
  }

  const currentQuestion = questions[currentIdx];
  const progressPercent = ((currentIdx + 1) / questions.length) * 100;
  const isTimeCritical = secondsLeft < 20;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <Stack.Screen 
        options={{
          headerShown: true,
          title: categoryName || 'Quiz',
          headerStyle: { backgroundColor: '#0B0F19' },
          headerTintColor: '#FFFFFF',
          headerLeft: () => (
            <TouchableOpacity onPress={handleCancelQuiz} style={styles.headerIconBtn}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={toggleBookmark} style={styles.headerIconBtn}>
              <Bookmark size={22} color={bookmarked ? Colors.dark.warning : '#FFFFFF'} fill={bookmarked ? Colors.dark.warning : 'none'} />
            </TouchableOpacity>
          )
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Progress Bar & Timer */}
        <View style={styles.progressHeader}>
          <View style={styles.progressTextRow}>
            <Text style={styles.progressCountText}>Question {currentIdx + 1} of {questions.length}</Text>
            <View style={[styles.timerBadge, isTimeCritical ? styles.timerBadgeAlert : {}]}>
              <Clock size={14} color={isTimeCritical ? '#FFFFFF' : Colors.dark.textSecondary} />
              <Text style={[styles.timerText, isTimeCritical ? styles.timerTextAlert : {}]}>
                {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        {/* Question Card */}
        <View style={styles.questionCard}>
          <View style={styles.marksBadge}>
            <Text style={styles.marksText}>{currentQuestion.marks || (currentQuestion.type === 'ShortAnswer' ? 5 : 1)} Marks</Text>
          </View>
          <Text style={styles.questionText}>{currentQuestion.questionText}</Text>
        </View>

        {/* Answers Interface */}
        {currentQuestion.type === 'MCQ' ? (
          <View style={styles.optionsList}>
            {currentQuestion.options?.map((option) => {
              const isSelected = selectedOpt === option;
              const isCorrectAnswer = option === currentQuestion.correctAnswer;
              
              // Apply conditional styling for selected answers (immediate feedback)
              let optionStyle: any = styles.optionBtn;
              let optionTextStyle: any = styles.optionText;
              let iconElement = null;

              if (selectedOpt !== null) {
                if (isCorrectAnswer) {
                  optionStyle = [styles.optionBtn, styles.optionBtnCorrect];
                  optionTextStyle = [styles.optionText, styles.optionTextCorrect];
                  iconElement = <Check size={18} color="#FFFFFF" />;
                } else if (isSelected) {
                  optionStyle = [styles.optionBtn, styles.optionBtnIncorrect];
                  optionTextStyle = [styles.optionText, styles.optionTextIncorrect];
                  iconElement = <X size={18} color="#FFFFFF" />;
                } else {
                  optionStyle = [styles.optionBtn, styles.optionBtnDisabled];
                }
              }

              return (
                <TouchableOpacity
                  key={option}
                  style={optionStyle}
                  onPress={() => handleMCQSelect(option)}
                  disabled={selectedOpt !== null}
                  activeOpacity={0.7}
                >
                  <Text style={optionTextStyle}>{option}</Text>
                  {iconElement}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.shortAnswerContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Type your answer here..."
              placeholderTextColor={Colors.dark.textSecondary}
              value={typedAnswer}
              onChangeText={setTypedAnswer}
              multiline
              numberOfLines={4}
              editable={!grading}
            />
            
            <TouchableOpacity
              style={[styles.submitBtn, !typedAnswer.trim() ? styles.submitBtnDisabled : {}]}
              onPress={handleShortAnswerSubmit}
              disabled={!typedAnswer.trim() || grading}
            >
              {grading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Answer</Text>
              )}
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <AlertCircle size={16} color={Colors.dark.textSecondary} />
              <Text style={styles.infoText}>
                This answer is graded instantly by the Gemini AI, which awards full marks if conceptually correct, or 0. Admin can override this grade later.
              </Text>
            </View>
          </View>
        )}

        {/* Cancel Quiz Button */}
        <TouchableOpacity 
          style={styles.cancelQuizBtn} 
          onPress={handleCancelQuiz}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelQuizBtnText}>Cancel Quiz</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B0F19',
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  scrollContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  headerIconBtn: {
    padding: Spacing.xs,
  },
  progressHeader: {
    marginBottom: Spacing.lg,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  progressCountText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 4,
  },
  timerBadgeAlert: {
    backgroundColor: Colors.dark.incorrect,
    borderColor: Colors.dark.incorrect,
  },
  timerText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  timerTextAlert: {
    color: '#FFFFFF',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.dark.primary,
  },
  questionCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: Spacing.xl,
    position: 'relative',
    ...Shadows.md,
  },
  marksBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 8,
  },
  marksText: {
    color: Colors.dark.primary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  questionText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 28,
    marginTop: Spacing.md,
  },
  optionsList: {
    gap: Spacing.md,
  },
  optionBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: Spacing.sm,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    ...Shadows.sm,
  },
  optionBtnCorrect: {
    backgroundColor: Colors.dark.correct,
    borderColor: Colors.dark.correct,
  },
  optionBtnIncorrect: {
    backgroundColor: Colors.dark.incorrect,
    borderColor: Colors.dark.incorrect,
  },
  optionBtnDisabled: {
    opacity: 0.6,
  },
  optionText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    paddingRight: Spacing.sm,
  },
  optionTextCorrect: {
    color: '#FFFFFF',
  },
  optionTextIncorrect: {
    color: '#FFFFFF',
  },
  shortAnswerContainer: {
    gap: Spacing.md,
  },
  textInput: {
    backgroundColor: Colors.dark.card,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    borderRadius: Spacing.sm,
    padding: Spacing.md,
    color: Colors.dark.text,
    fontSize: 15,
    textAlignVertical: 'top',
    height: 120,
  },
  submitBtn: {
    backgroundColor: Colors.dark.primary,
    height: 52,
    borderRadius: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: Spacing.sm,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  infoText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  cancelQuizBtn: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  cancelQuizBtnText: {
    color: Colors.dark.incorrect,
    fontSize: 15,
    fontWeight: 'bold',
  },
});

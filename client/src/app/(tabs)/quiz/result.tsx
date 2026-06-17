import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  FlatList
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { apiService, QuestionStatsResponse } from '../../../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, RefreshCw, Home, ChevronDown, Check, X, AlertCircle, Percent } from 'lucide-react-native';
import { Colors, Spacing, Shadows } from '../../../constants/theme';

interface UserAnswer {
  questionId: string;
  type: 'MCQ' | 'ShortAnswer';
  selectedAnswer?: string;
  userAnswerText?: string;
  isCorrect: boolean;
  marksAwarded: number;
  explanation?: string;
}

interface QuestionData {
  id: string;
  type: 'MCQ' | 'ShortAnswer';
  questionText: string;
  options?: string[];
  correctAnswer: string;
  marks?: number;
}

export default function ResultScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  // Route parameters
  const { historyId, categoryName, score, totalPossibleMarks, totalQuestions, percentage, answersJson, questionsJson } = params;

  const [loading, setLoading] = useState(true);
  const [quizDetails, setQuizDetails] = useState<{
    categoryName: string;
    score: number;
    totalPossibleMarks: number;
    totalQuestions: number;
    percentage: number;
    answers: UserAnswer[];
    questions: QuestionData[];
  } | null>(null);

  // Store question-level stats fetched from backend
  const [questionStats, setQuestionStats] = useState<{ [key: string]: QuestionStatsResponse }>({});
  const [loadingStats, setLoadingStats] = useState(false);

  // 1. Load Quiz details (either from passed params or fetch from firestore historyId)
  useEffect(() => {
    const loadData = async () => {
      try {
        if (historyId) {
          // Fetch from history document
          const docRef = doc(db, 'quiz_history', historyId as string);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            const answers = data.answers || [];
            
            // Fetch questions to render details
            const qIds = answers.map((a: any) => a.questionId);
            const questions: QuestionData[] = [];
            
            // Firestore doesn't allow in-query with empty array
            if (qIds.length > 0) {
              // Batch query questions in chunks of 10 to respect Firestore 'in' limit
              const chunks: string[][] = [];
              for (let i = 0; i < qIds.length; i += 10) {
                chunks.push(qIds.slice(i, i + 10));
              }
              
              await Promise.all(
                chunks.map(async (chunk) => {
                  const questionsSnap = await getDocs(
                    query(collection(db, 'questions'), where('__name__', 'in', chunk))
                  );
                  questionsSnap.forEach(qDoc => {
                    questions.push({ id: qDoc.id, ...qDoc.data() } as QuestionData);
                  });
                })
              );
            }

            const totalPossible = questions.reduce((sum, q) => sum + (q.marks || (q.type === 'ShortAnswer' ? 5 : 1)), 0);

            setQuizDetails({
              categoryName: data.categoryName || 'General Knowledge',
              score: data.score,
              totalPossibleMarks: totalPossible || data.totalQuestions,
              totalQuestions: data.totalQuestions,
              percentage: data.percentage,
              answers,
              questions
            });
          }
        } else if (answersJson && questionsJson) {
          // Load from direct parameters (quiz completed just now)
          setQuizDetails({
            categoryName: (categoryName as string) || 'Quiz Results',
            score: Number(score),
            totalPossibleMarks: Number(totalPossibleMarks),
            totalQuestions: Number(totalQuestions),
            percentage: Number(percentage),
            answers: JSON.parse(answersJson as string),
            questions: JSON.parse(questionsJson as string)
          });
        }
        setLoading(false);
      } catch (err) {
        console.error("Error loading result details:", err);
        setLoading(false);
      }
    };

    loadData();
  }, [historyId, answersJson]);

  // 2. Fetch question distribution statistics from backend
  useEffect(() => {
    if (!quizDetails || quizDetails.answers.length === 0) return;

    const fetchStats = async () => {
      setLoadingStats(true);
      const statsMap: { [key: string]: QuestionStatsResponse } = {};
      
      try {
        await Promise.all(
          quizDetails.answers.map(async (ans) => {
            const stats = await apiService.getQuestionStats(ans.questionId);
            statsMap[ans.questionId] = stats;
          })
        );
        setQuestionStats(statsMap);
      } catch (err) {
        console.error("Error fetching question stats:", err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [quizDetails]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.dark.primary} size="large" />
        <Text style={styles.loadingText}>Compiling results...</Text>
      </View>
    );
  }

  if (!quizDetails) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Error loading quiz session.</Text>
        <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.homeBtnText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { categoryName: catName, score: finalScore, totalPossibleMarks: totalPossible, totalQuestions: totalQ, percentage: pct, answers: userAnswers, questions: qData } = quizDetails;

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Quiz Summary',
          headerStyle: { backgroundColor: '#0B0F19' },
          headerTintColor: '#FFFFFF',
          headerLeft: historyId ? undefined : () => null // Hide back button only when immediately finished to prevent returning to active quiz
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Score Radial Gradient Circle */}
        <View style={styles.scoreHeader}>
          <LinearGradient
            colors={['#1E1E38', '#151D30']}
            style={styles.scoreCard}
          >
            <Award size={48} color="#F59E0B" />
            <Text style={styles.categoryNameText}>{catName}</Text>
            
            <View style={styles.scoreRow}>
              <Text style={styles.scoreBigText}>{finalScore}</Text>
              <Text style={styles.scoreSlashText}>/{totalPossible} Marks</Text>
            </View>

            <Text style={styles.percentageText}>{Math.round((finalScore / totalPossible) * 100)}% Score</Text>
          </LinearGradient>
        </View>

        {/* Action Buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.replace('/(tabs)')}>
            <Home size={18} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.primaryBtn]} onPress={() => router.replace('/(tabs)/categories')}>
            <RefreshCw size={18} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Play Again</Text>
          </TouchableOpacity>
        </View>

        {/* Answer Key Review Header */}
        <Text style={styles.reviewHeaderTitle}>Question Review & Stats</Text>

        {/* Detailed Question Review List */}
        {userAnswers.map((ans, index) => {
          const matchingQuestion = qData.find(q => q.id === ans.questionId);
          if (!matchingQuestion) return null;

          const stats = questionStats[ans.questionId];

          return (
            <View key={ans.questionId} style={[
              styles.reviewCard,
              ans.isCorrect ? styles.reviewCardCorrect : styles.reviewCardIncorrect
            ]}>
              <View style={styles.cardHeader}>
                <Text style={styles.questionNumText}>Question {index + 1}</Text>
                <View style={[
                  styles.statusBadge,
                  ans.isCorrect ? styles.badgeCorrect : styles.badgeIncorrect
                ]}>
                  {ans.isCorrect ? (
                    <Text style={styles.statusBadgeText}>Correct</Text>
                  ) : (
                    <Text style={styles.statusBadgeText}>Incorrect</Text>
                  )}
                </View>
              </View>

              <Text style={styles.questionText}>{matchingQuestion.questionText}</Text>

              {/* MCQ Selected Answer Review */}
              {matchingQuestion.type === 'MCQ' ? (
                <View style={styles.answerLogBox}>
                  <Text style={styles.answerLabel}>Your Answer:</Text>
                  <Text style={[
                    styles.answerValueText,
                    ans.isCorrect ? styles.correctValueText : styles.incorrectValueText
                  ]}>
                    {ans.selectedAnswer}
                  </Text>

                  {!ans.isCorrect && (
                    <View style={styles.correctAnswerRow}>
                      <Text style={styles.answerLabel}>Correct Answer:</Text>
                      <Text style={[styles.answerValueText, styles.correctValueText]}>
                        {matchingQuestion.correctAnswer}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                // Short Answer Review
                <View style={styles.answerLogBox}>
                  <Text style={styles.answerLabel}>Your Typed Answer:</Text>
                  <Text style={styles.answerValueText}>{ans.userAnswerText}</Text>

                  <Text style={styles.answerLabel}>Reference Key concepts:</Text>
                  <Text style={[styles.answerValueText, styles.correctValueText]}>
                    {matchingQuestion.correctAnswer}
                  </Text>

                  {ans.explanation && (
                    <View style={styles.feedbackBox}>
                      <Text style={styles.feedbackTitle}>Gemini AI Feedback:</Text>
                      <Text style={styles.feedbackText}>{ans.explanation}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Question Analytics Stats ("Koto percent manush kemon korse") */}
              {stats && (
                <View style={styles.statsPanel}>
                  <View style={styles.statsPanelHeader}>
                    <Percent size={14} color={Colors.dark.primary} />
                    <Text style={styles.statsPanelTitle}>Global Community Statistics</Text>
                  </View>
                  <Text style={styles.statsSummaryText}>
                    {stats.correctPercentage}% of users answered this question correctly.
                  </Text>
                  
                  {/* If MCQ, show option counts breakdown */}
                  {matchingQuestion.type === 'MCQ' && stats.optionPercentages && (
                    <View style={styles.optionStatsGrid}>
                      {matchingQuestion.options?.map(opt => {
                        const isCorrectOpt = opt === matchingQuestion.correctAnswer;
                        const pctVal = stats.optionPercentages?.[opt] || 0;
                        return (
                          <View key={opt} style={styles.optionStatRow}>
                            <View style={styles.optionStatTextLabel}>
                              <Text style={[styles.optionStatText, isCorrectOpt ? styles.goldText : {}]} numberOfLines={1}>
                                {opt} {isCorrectOpt ? '(Correct)' : ''}
                              </Text>
                            </View>
                            <View style={styles.statProgressTrack}>
                              <View style={[
                                styles.statProgressProgress,
                                { width: `${pctVal}%`, backgroundColor: isCorrectOpt ? Colors.dark.correct : Colors.dark.inactiveTab }
                              ]} />
                            </View>
                            <Text style={styles.optionStatPercentText}>{pctVal}%</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
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
    paddingBottom: Spacing.xxl,
  },
  scoreHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  scoreCard: {
    width: '100%',
    borderRadius: Spacing.md,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  categoryNameText: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreBigText: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  scoreSlashText: {
    fontSize: 18,
    color: Colors.dark.textSecondary,
  },
  percentageText: {
    fontSize: 20,
    color: Colors.dark.primary,
    fontWeight: 'bold',
  },
  btnRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  actionButton: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    flex: 1,
    height: 48,
    borderRadius: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: Spacing.xs,
    ...Shadows.sm,
  },
  primaryBtn: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  reviewHeaderTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
  },
  reviewCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  reviewCardCorrect: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.dark.correct,
  },
  reviewCardIncorrect: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.dark.incorrect,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  questionNumText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeCorrect: {
    backgroundColor: Colors.dark.correctLight,
  },
  badgeIncorrect: {
    backgroundColor: Colors.dark.incorrectLight,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  questionText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 24,
    marginBottom: Spacing.md,
  },
  answerLogBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: Spacing.sm,
    padding: Spacing.md,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  answerLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  answerValueText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  correctValueText: {
    color: Colors.dark.correct,
    fontWeight: 'bold',
  },
  incorrectValueText: {
    color: Colors.dark.incorrect,
    fontWeight: 'bold',
  },
  correctAnswerRow: {
    marginTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingTop: Spacing.xs,
  },
  feedbackBox: {
    marginTop: Spacing.sm,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 6,
    padding: Spacing.sm,
  },
  feedbackTitle: {
    color: Colors.dark.primary,
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  feedbackText: {
    color: Colors.dark.text,
    fontSize: 13,
    lineHeight: 18,
  },
  statsPanel: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  statsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statsPanelTitle: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  statsSummaryText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  optionStatsGrid: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  optionStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  optionStatTextLabel: {
    width: 100,
  },
  optionStatText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  goldText: {
    color: Colors.dark.correct,
    fontWeight: '600',
  },
  statProgressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  statProgressProgress: {
    height: '100%',
    borderRadius: 3,
  },
  optionStatPercentText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    width: 30,
    textAlign: 'right',
  },
  homeBtn: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.sm,
    marginTop: Spacing.md,
  },
  homeBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

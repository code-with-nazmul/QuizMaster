import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  ActivityIndicator, 
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  getDoc, 
  setDoc,
  query, 
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../context/AuthContext';
import { Colors, Spacing, Shadows } from '../../../constants/theme';
import { ArrowLeft, BookOpen, Plus, FileText, CheckCircle, Edit, Save, Users, Trash2 } from 'lucide-react-native';
import { apiService } from '../../../services/api';

interface Category {
  id: string;
  name: string;
  description: string;
  timeLimitSeconds: number;
}

interface PendingReview {
  historyId: string;
  userId: string;
  userDisplayName: string;
  categoryName: string;
  questionId: string;
  questionText: string;
  userAnswerText: string;
  correctAnswer: string;
  currentMarks: number;
  maxMarks: number;
  isCorrect: boolean;
  answerIndexInHistory: number;
}

export default function AdminDashboardScreen() {
  const { isAdmin, profile } = useAuth();
  const router = useRouter();

  // Navigation
  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'Only administrators can access the dashboard.');
      router.replace('/(tabs)');
    }
  }, [isAdmin]);

  const [activeTab, setActiveTab] = useState<'content' | 'grading' | 'users'>('content');
  const [categories, setCategories] = useState<Category[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states - Add Category
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catTime, setCatTime] = useState('120'); // in seconds

  // Form states - Add Question
  const [selectedCatId, setSelectedCatId] = useState('');
  const [qType, setQType] = useState<'MCQ' | 'ShortAnswer'>('MCQ');
  const [qText, setQText] = useState('');
  const [qCorrect, setQCorrect] = useState('');
  const [qMarks, setQMarks] = useState('5');
  // MCQ options
  const [opt1, setOpt1] = useState('');
  const [opt2, setOpt2] = useState('');
  const [opt3, setOpt3] = useState('');
  const [opt4, setOpt4] = useState('');

  // Grading states
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [gradingHistoryId, setGradingHistoryId] = useState<string | null>(null);
  const [overrideScore, setOverrideScore] = useState('');
  const [submittingGrade, setSubmittingGrade] = useState(false);

  // Fetch categories and pending short answers
  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch categories
      const catSnap = await getDocs(collection(db, 'categories'));
      const catItems: Category[] = [];
      catSnap.forEach(doc => {
        catItems.push({ id: doc.id, ...doc.data() } as Category);
      });
      setCategories(catItems);
      if (catItems.length > 0 && !selectedCatId) {
        setSelectedCatId(catItems[0].id);
      }

      // 2. Fetch submissions for grading review
      if (activeTab === 'grading') {
        const historySnap = await getDocs(collection(db, 'quiz_history'));
        const reviewList: PendingReview[] = [];

        for (const historyDoc of historySnap.docs) {
          const hData = historyDoc.data();
          const answers = hData.answers || [];
          const userId = hData.userId || '';

          // Fetch user display name
          let userDisplayName = 'Anonymous Student';
          if (userId) {
            const userSnap = await getDoc(doc(db, 'users', userId));
            if (userSnap.exists()) {
              userDisplayName = userSnap.data()?.displayName || 'Anonymous Student';
            }
          }

          // Loop through history answers to find short answers
          for (let i = 0; i < answers.length; i++) {
            const ans = answers[i];
            if (ans.type === 'ShortAnswer') {
              // Fetch question text and key details
              const questionSnap = await getDoc(doc(db, 'questions', ans.questionId));
              if (questionSnap.exists()) {
                const qData = questionSnap.data();
                
                reviewList.push({
                  historyId: historyDoc.id,
                  userId,
                  userDisplayName,
                  categoryName: hData.categoryName || 'General',
                  questionId: ans.questionId,
                  questionText: qData.questionText || '',
                  userAnswerText: ans.userAnswerText || '',
                  correctAnswer: qData.correctAnswer || '',
                  currentMarks: ans.marksAwarded || 0,
                  maxMarks: qData.marks || 5,
                  isCorrect: ans.isCorrect || false,
                  answerIndexInHistory: i
                });
              }
            }
          }
        }
        setReviews(reviewList);
      }

      // 3. Fetch users list
      if (activeTab === 'users') {
        const usersSnap = await getDocs(collection(db, 'users'));
        const uItems: any[] = [];
        usersSnap.forEach(doc => {
          uItems.push({ uid: doc.id, ...doc.data() });
        });
        // Sort users: admins first, then by averageScore descending
        uItems.sort((a, b) => {
          if (a.isAdmin && !b.isAdmin) return -1;
          if (!a.isAdmin && b.isAdmin) return 1;
          return (b.averageScore || 0) - (a.averageScore || 0);
        });
        setUsersList(uItems);
      }
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!catName || !catDesc || !catTime) {
      Alert.alert('Error', 'Please fill all category details.');
      return;
    }

    try {
      const id = catName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
      await setDoc(doc(db, 'categories', id), {
        name: catName.trim(),
        description: catDesc.trim(),
        timeLimitSeconds: Number(catTime)
      });

      Alert.alert('Success', 'Category added successfully.');
      setCatName('');
      setCatDesc('');
      setCatTime('120');
      fetchData();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to add category.');
    }
  };

  const handleAddQuestion = async () => {
    if (!qText || !qCorrect || !selectedCatId) {
      Alert.alert('Error', 'Please complete the question form.');
      return;
    }

    if (qType === 'MCQ' && (!opt1 || !opt2 || !opt3 || !opt4)) {
      Alert.alert('Error', 'Please enter all 4 options for MCQ.');
      return;
    }

    try {
      const qRef = collection(db, 'questions');
      const questionPayload: any = {
        categoryId: selectedCatId,
        type: qType,
        questionText: qText.trim(),
        correctAnswer: qCorrect.trim(),
        marks: qType === 'MCQ' ? 1 : Number(qMarks),
        stats: { totalAttempts: 0, correctAttempts: 0, optionCounts: {} }
      };

      if (qType === 'MCQ') {
        questionPayload.options = [opt1.trim(), opt2.trim(), opt3.trim(), opt4.trim()];
        // Make sure correct answer is one of the options
        if (!questionPayload.options.includes(qCorrect.trim())) {
          Alert.alert('Warning', 'The correct answer does not match any of the four options.');
          return;
        }
      }

      await addDoc(qRef, questionPayload);

      Alert.alert('Success', 'Question added successfully.');
      setQText('');
      setQCorrect('');
      setOpt1('');
      setOpt2('');
      setOpt3('');
      setOpt4('');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to add question.');
    }
  };

  const handleSaveGradeOverride = async (review: PendingReview) => {
    const marksInput = Number(overrideScore);
    if (isNaN(marksInput) || marksInput < 0 || marksInput > review.maxMarks) {
      Alert.alert('Invalid Marks', `Please enter a score between 0 and ${review.maxMarks}`);
      return;
    }

    setSubmittingGrade(true);
    try {
      // 1. Fetch history document
      const historyRef = doc(db, 'quiz_history', review.historyId);
      const historySnap = await getDoc(historyRef);

      if (historySnap.exists()) {
        const historyData = historySnap.data();
        const answers = historyData.answers || [];
        const oldScore = historyData.score || 0;

        // Calculate score change
        const oldAnswerMarks = review.currentMarks;
        const scoreDiff = marksInput - oldAnswerMarks;
        const newScore = oldScore + scoreDiff;

        // Update specific answer details
        answers[review.answerIndexInHistory].marksAwarded = marksInput;
        answers[review.answerIndexInHistory].isCorrect = marksInput > 0;
        answers[review.answerIndexInHistory].status = 'reviewed';

        const possibleMarksDivisor = historyData.totalPossibleMarks || historyData.totalQuestions;
        const newPercentage = Math.round((newScore / possibleMarksDivisor) * 10000) / 100;

        // Write to history
        await updateDoc(historyRef, {
          score: newScore,
          percentage: newPercentage,
          answers
        });

        // 2. Adjust user statistics by recalculating from full history to avoid drift/corruption
        const userRef = doc(db, 'users', review.userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          // Query all history documents for the user
          const q = query(collection(db, 'quiz_history'), where('userId', '==', review.userId));
          const querySnapshot = await getDocs(q);
          
          let totalQuizzes = 0;
          let sumPercentage = 0;
          const newCategoryPerformance: { [key: string]: { correct: number; total: number } } = {};
          
          querySnapshot.forEach(hDoc => {
            const hData = hDoc.data();
            // Derive totalPossibleMarks from the answers array for old records that lack the field
            let divisor = hData.totalPossibleMarks;
            if (!divisor && hData.answers && hData.answers.length > 0) {
              divisor = hData.answers.reduce((sum: number, a: any) => sum + (a.type === 'ShortAnswer' ? 5 : 1), 0);
            }
            if (!divisor) divisor = hData.totalQuestions || 1;
            
            // If it is the quiz we just updated, use the newScore to compute percentage
            const isTargetQuiz = hDoc.id === review.historyId;
            const attemptScore = isTargetQuiz ? newScore : (hData.score || 0);
            
            const pct = Math.round((attemptScore / divisor) * 100);
            sumPercentage += pct;
            totalQuizzes += 1;

            // Rebuild categoryPerformance from source of truth (marks-based)
            const catName = hData.categoryName || 'General';
            if (!newCategoryPerformance[catName]) {
              newCategoryPerformance[catName] = { correct: 0, total: 0 };
            }
            // For the quiz we just edited, use the locally-updated answers array
            const quizAnswers = isTargetQuiz ? answers : (hData.answers || []);
            for (const a of quizAnswers) {
              // Sum marks obtained and total possible marks per question
              const questionMaxMarks = a.type === 'ShortAnswer' ? (a.maxMarks || 5) : 1;
              newCategoryPerformance[catName].total += questionMaxMarks;
              newCategoryPerformance[catName].correct += (a.marksAwarded || 0);
            }
          });

          const newAvg = totalQuizzes > 0 ? Math.round((sumPercentage / totalQuizzes) * 10) / 10 : 0;

          await updateDoc(userRef, {
            averageScore: newAvg,
            totalQuizzes,
            categoryPerformance: newCategoryPerformance
          });
        }
      }

      Alert.alert('Success', 'Marks updated successfully!');
      setGradingHistoryId(null);
      setOverrideScore('');
      fetchData();
    } catch (err) {
      console.error("Grading override failed:", err);
      Alert.alert('Error', 'Failed to save grading changes.');
    } finally {
      setSubmittingGrade(false);
    }
  };

  const handleDeleteUser = (userId: string, userDisplayName: string) => {
    if (userId === profile?.uid) {
      Alert.alert('Action Denied', 'You cannot delete your own administrator account.');
      return;
    }

    Alert.alert(
      'Delete User',
      `Are you sure you want to permanently delete user "${userDisplayName}"? All of their quiz history and performance data will be lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await apiService.deleteUser(userId);
              Alert.alert('Success', 'User deleted successfully.');
              fetchData();
            } catch (err: any) {
              console.error("Failed to delete user:", err);
              Alert.alert('Error', err.message || 'Failed to delete user.');
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderUserRow = ({ item }: { item: any }) => {
    const isSelf = item.uid === profile?.uid;
    return (
      <View style={styles.userCard}>
        <View style={styles.userCardInfo}>
          <Text style={styles.userDisplayName}>{item.displayName || 'Anonymous User'}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <View style={styles.userMetaRow}>
            {item.isAdmin && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            )}
            <Text style={styles.userStatsText}>
              {item.totalQuizzes || 0} Quizzes | Avg: {Math.round(item.averageScore || 0)}%
            </Text>
          </View>
        </View>

        {!isSelf && (
          <TouchableOpacity 
            style={styles.deleteUserBtn} 
            onPress={() => handleDeleteUser(item.uid, item.displayName || 'Anonymous User')}
          >
            <Trash2 size={18} color={Colors.dark.incorrect} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderReviewItem = ({ item }: { item: PendingReview }) => {
    const isEditingThis = gradingHistoryId === `${item.historyId}_${item.questionId}`;

    return (
      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <Text style={styles.studentName}>{item.userDisplayName}</Text>
          <Text style={styles.categoryBadge}>{item.categoryName}</Text>
        </View>

        <Text style={styles.label}>Question:</Text>
        <Text style={styles.reviewValueText}>{item.questionText}</Text>

        <Text style={styles.label}>Student's Typed Answer:</Text>
        <Text style={styles.studentAnswerText}>"{item.userAnswerText}"</Text>

        <Text style={styles.label}>Reference Core Key concepts:</Text>
        <Text style={styles.correctAnswerText}>{item.correctAnswer}</Text>

        <View style={styles.gradingFooter}>
          <View>
            <Text style={styles.label}>Marks Awarded (Auto):</Text>
            <Text style={styles.marksSummary}>
              {item.currentMarks} / {item.maxMarks} ({item.isCorrect ? 'Correct' : 'Incorrect'})
            </Text>
          </View>

          {isEditingThis ? (
            <View style={styles.editScoreContainer}>
              <TextInput
                style={styles.scoreInput}
                keyboardType="numeric"
                value={overrideScore}
                onChangeText={setOverrideScore}
                placeholder={String(item.currentMarks)}
                placeholderTextColor={Colors.dark.textSecondary}
              />
              <TouchableOpacity 
                style={styles.saveScoreBtn} 
                onPress={() => handleSaveGradeOverride(item)}
                disabled={submittingGrade}
              >
                <Save size={16} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.cancelScoreBtn} 
                onPress={() => setGradingHistoryId(null)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.overrideBtn} 
              onPress={() => {
                setGradingHistoryId(`${item.historyId}_${item.questionId}`);
                setOverrideScore(String(item.currentMarks));
              }}
            >
              <Edit size={16} color="#FFFFFF" />
              <Text style={styles.overrideText}>Edit Marks</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Admin Dashboard',
          headerStyle: { backgroundColor: '#0B0F19' },
          headerTintColor: '#FFFFFF',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: Spacing.md }}>
              <ArrowLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )
        }}
      />

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'content' ? styles.activeTab : {}]}
          onPress={() => setActiveTab('content')}
        >
          <BookOpen size={18} color={activeTab === 'content' ? '#FFFFFF' : Colors.dark.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'content' ? styles.activeTabText : {}]}>Manage Content</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'grading' ? styles.activeTab : {}]}
          onPress={() => setActiveTab('grading')}
        >
          <CheckCircle size={18} color={activeTab === 'grading' ? '#FFFFFF' : Colors.dark.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'grading' ? styles.activeTabText : {}]}>Grade Reviews</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'users' ? styles.activeTab : {}]}
          onPress={() => setActiveTab('users')}
        >
          <Users size={18} color={activeTab === 'users' ? '#FFFFFF' : Colors.dark.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'users' ? styles.activeTabText : {}]}>Users</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={Colors.dark.primary} size="large" />
        </View>
      ) : activeTab === 'content' ? (
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          {/* Section: Add Category */}
          <View style={styles.card}>
            <View style={styles.cardHeaderArea}>
              <Plus size={20} color={Colors.dark.primary} />
              <Text style={styles.cardTitle}>Add Category</Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Category Name (e.g., Space Travel)"
              placeholderTextColor={Colors.dark.textSecondary}
              value={catName}
              onChangeText={setCatName}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Short Description"
              placeholderTextColor={Colors.dark.textSecondary}
              value={catDesc}
              onChangeText={setCatDesc}
              multiline
              numberOfLines={3}
            />

            <TextInput
              style={styles.input}
              placeholder="Timer (Seconds, e.g. 120)"
              placeholderTextColor={Colors.dark.textSecondary}
              value={catTime}
              onChangeText={setCatTime}
              keyboardType="numeric"
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleAddCategory}>
              <Text style={styles.submitBtnText}>Create Category</Text>
            </TouchableOpacity>
          </View>

          {/* Section: Add Question */}
          <View style={styles.card}>
            <View style={styles.cardHeaderArea}>
              <FileText size={20} color={Colors.dark.secondary} />
              <Text style={styles.cardTitle}>Add Question</Text>
            </View>

            {/* Category Dropdown Simulator */}
            <Text style={styles.dropdownLabel}>Target Category:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dropdownScroll}>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.dropdownPill, selectedCatId === c.id ? styles.activePill : {}]}
                  onPress={() => setSelectedCatId(c.id)}
                >
                  <Text style={[styles.pillText, selectedCatId === c.id ? styles.activePillText : {}]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Type selector */}
            <View style={styles.typeSelectorRow}>
              <TouchableOpacity 
                style={[styles.typeBtn, qType === 'MCQ' ? styles.typeBtnActive : {}]}
                onPress={() => setQType('MCQ')}
              >
                <Text style={[styles.typeBtnText, qType === 'MCQ' ? styles.typeBtnTextActive : {}]}>MCQ (Multiple Choice)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.typeBtn, qType === 'ShortAnswer' ? styles.typeBtnActive : {}]}
                onPress={() => setQType('ShortAnswer')}
              >
                <Text style={[styles.typeBtnText, qType === 'ShortAnswer' ? styles.typeBtnTextActive : {}]}>Short Answer</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Question Text"
              placeholderTextColor={Colors.dark.textSecondary}
              value={qText}
              onChangeText={setQText}
              multiline
              numberOfLines={3}
            />

            {qType === 'MCQ' ? (
              <View style={styles.mcqOptionsBlock}>
                <Text style={styles.dropdownLabel}>Enter Options & Exact Correct Answer:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Option 1"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={opt1}
                  onChangeText={setOpt1}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Option 2"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={opt2}
                  onChangeText={setOpt2}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Option 3"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={opt3}
                  onChangeText={setOpt3}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Option 4"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={opt4}
                  onChangeText={setOpt4}
                />
                
                <TextInput
                  style={styles.input}
                  placeholder="Exact Correct Option (matching text)"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={qCorrect}
                  onChangeText={setQCorrect}
                />
              </View>
            ) : (
              <View style={styles.shortAnswerBlock}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Reference Answer Key Concepts (for Gemini Comparison)"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={qCorrect}
                  onChangeText={setQCorrect}
                  multiline
                  numberOfLines={3}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Maximum Question Marks (e.g. 5)"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={qMarks}
                  onChangeText={setQMarks}
                  keyboardType="numeric"
                />
              </View>
            )}

            <TouchableOpacity style={[styles.submitButton, { backgroundColor: Colors.dark.secondary }]} onPress={handleAddQuestion}>
              <Text style={styles.submitBtnText}>Create Question</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : activeTab === 'grading' ? (
        <FlatList
          data={reviews}
          keyExtractor={(item) => `${item.historyId}_${item.questionId}`}
          renderItem={renderReviewItem}
          contentContainerStyle={styles.gradingScroll}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <CheckCircle size={48} color={Colors.dark.correct} />
              <Text style={styles.emptyText}>All caught up!</Text>
              <Text style={styles.emptySubText}>There are no short answers pending grade reviews.</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={usersList}
          keyExtractor={(item) => item.uid}
          renderItem={renderUserRow}
          contentContainerStyle={styles.usersScroll}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Users size={48} color={Colors.dark.textSecondary} />
              <Text style={styles.emptyText}>No users found.</Text>
            </View>
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.dark.primary,
  },
  tabText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  scrollContainer: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    ...Shadows.md,
  },
  cardHeaderArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: Colors.dark.border,
    borderWidth: 1,
    borderRadius: Spacing.sm,
    height: 48,
    paddingHorizontal: Spacing.md,
    color: Colors.dark.text,
    fontSize: 15,
    marginBottom: Spacing.md,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingVertical: Spacing.sm,
  },
  submitButton: {
    backgroundColor: Colors.dark.primary,
    height: 48,
    borderRadius: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xs,
    ...Shadows.sm,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  dropdownLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  dropdownScroll: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  dropdownPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginRight: Spacing.xs,
  },
  activePill: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  pillText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  activePillText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  typeBtn: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderRadius: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBtnActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  typeBtnText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  typeBtnTextActive: {
    color: Colors.dark.primary,
    fontWeight: 'bold',
  },
  mcqOptionsBlock: {
    gap: 2,
  },
  shortAnswerBlock: {
    gap: 2,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradingScroll: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  reviewCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  studentName: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  categoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    color: Colors.dark.textSecondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  label: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  reviewValueText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  studentAnswerText: {
    color: Colors.dark.text,
    fontStyle: 'italic',
    fontSize: 14,
    marginVertical: Spacing.xs,
  },
  correctAnswerText: {
    color: Colors.dark.correct,
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  gradingFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingTop: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marksSummary: {
    color: Colors.dark.text,
    fontWeight: 'bold',
    fontSize: 15,
  },
  overrideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Spacing.xs,
  },
  overrideText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  editScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  scoreInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: Colors.dark.primary,
    borderWidth: 1,
    borderRadius: Spacing.xs,
    width: 45,
    height: 36,
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 14,
  },
  saveScoreBtn: {
    backgroundColor: Colors.dark.correct,
    height: 36,
    width: 36,
    borderRadius: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelScoreBtn: {
    paddingHorizontal: Spacing.xs,
  },
  cancelText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 1.5,
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptySubText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  usersScroll: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  userCardInfo: {
    flex: 1,
    gap: 4,
  },
  userDisplayName: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  userEmail: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  userMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  adminBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  adminBadgeText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  userStatsText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  deleteUserBtn: {
    padding: Spacing.sm,
    borderRadius: Spacing.xs,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
});

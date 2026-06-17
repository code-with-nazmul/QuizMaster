import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Image 
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Compass, History, ShieldAlert, Award, Clock, ChevronRight } from 'lucide-react-native';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, Shadows } from '../../constants/theme';

interface RecentQuiz {
  id: string;
  categoryName: string;
  score: number;
  totalQuestions: number;
  totalPossibleMarks?: number;
  percentage: number;
  timestamp: any;
  answers?: any[];
}

// Helper to derive totalPossibleMarks from a quiz record
const getPossibleMarks = (q: { totalPossibleMarks?: number; answers?: any[]; totalQuestions: number }) => {
  if (q.totalPossibleMarks) return q.totalPossibleMarks;
  if (q.answers && q.answers.length > 0) {
    return q.answers.reduce((sum: number, ans: any) => sum + (ans.type === 'ShortAnswer' ? 5 : 1), 0);
  }
  return q.totalQuestions;
};

export default function HomeScreen() {
  const { profile, isAdmin } = useAuth();
  const [recentQuizzes, setRecentQuizzes] = useState<RecentQuiz[]>([]);
  const [allQuizzes, setAllQuizzes] = useState<RecentQuiz[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchRecentQuizzes = async () => {
      if (!profile?.uid) return;
      
      try {
        const historyRef = collection(db, 'quiz_history');
        const q = query(
          historyRef,
          where('userId', '==', profile.uid)
        );
        const querySnapshot = await getDocs(q);
        const items: RecentQuiz[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          items.push({
            id: doc.id,
            categoryName: data.categoryName || 'General',
            score: data.score,
            totalQuestions: data.totalQuestions,
            totalPossibleMarks: data.totalPossibleMarks,
            percentage: data.percentage,
            timestamp: data.timestamp,
            answers: data.answers
          });
        });
        
        // Sort in-memory desc by timestamp
        items.sort((a, b) => {
          const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
          const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
          return timeB - timeA;
        });
        
        setAllQuizzes(items);
        setRecentQuizzes(items.slice(0, 3));
      } catch (error) {
        console.error("Error fetching recent quizzes:", error);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchRecentQuizzes();
  }, [profile?.uid, profile?.totalQuizzes]); // Reload when profile quizzes count updates

  const startQuickQuiz = () => {
    // Navigates directly to General Knowledge quiz (default category)
    router.push('/quiz/general_knowledge');
  };

  const browseCategories = () => {
    router.push('/(tabs)/categories');
  };

  const formatDate = (firestoreTimestamp: any) => {
    if (!firestoreTimestamp) return 'Just now';
    const date = firestoreTimestamp.toDate();
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Welcome Banner */}
      <View style={styles.welcomeRow}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>{profile?.displayName || 'User'}</Text>
        </View>
        <Image 
          source={{ uri: profile?.photoURL || 'https://api.dicebear.com/7.x/bottts/png' }} 
          style={styles.avatar}
        />
      </View>

      {/* Admin Panel Warning */}
      {isAdmin && (
        <TouchableOpacity 
          style={styles.adminBanner} 
          onPress={() => router.push('/admin/dashboard')}
        >
          <ShieldAlert size={20} color={Colors.dark.warning} />
          <View style={styles.adminBannerContent}>
            <Text style={styles.adminBannerTitle}>Administrator Mode Active</Text>
            <Text style={styles.adminBannerSubtitle}>Manage categories, questions, and grade answers</Text>
          </View>
          <ChevronRight size={18} color={Colors.dark.warning} />
        </TouchableOpacity>
      )}

      {/* Summary Scoreboard */}
      <LinearGradient
        colors={['#1E1E38', '#151D30']}
        style={styles.statsCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.statItem}>
          <Award size={24} color="#F59E0B" />
          <Text style={styles.statValue}>
            {allQuizzes.length > 0
              ? Math.round(
                  allQuizzes.reduce((sum, q) => {
                    const pm = getPossibleMarks(q);
                    return sum + Math.round((q.score / pm) * 100);
                  }, 0) / allQuizzes.length
                )
              : 0}%
          </Text>
          <Text style={styles.statLabel}>Avg Score</Text>
        </View>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statItem} onPress={() => router.push('/profile/history')} activeOpacity={0.7}>
          <Play size={24} color="#6366F1" />
          <Text style={styles.statValue}>{allQuizzes.length}</Text>
          <Text style={styles.statLabel}>Quizzes Played</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Action Cards */}
      <Text style={styles.sectionTitle}>Get Started</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity style={styles.actionCard} onPress={startQuickQuiz}>
          <LinearGradient
            colors={['#6366F1', '#4F46E5']}
            style={styles.actionGradient}
          >
            <Play size={32} color="#FFFFFF" />
            <Text style={styles.actionTitle}>Quick Play</Text>
            <Text style={styles.actionSubtitle}>Start a general quiz now</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={browseCategories}>
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            style={styles.actionGradient}
          >
            <Compass size={32} color="#FFFFFF" />
            <Text style={styles.actionTitle}>Categories</Text>
            <Text style={styles.actionSubtitle}>Choose your subject</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Recent Activity */}
      <Text style={styles.sectionTitle}>Recent Quizzes</Text>
      <View style={styles.historyContainer}>
        {loadingHistory ? (
          <ActivityIndicator color={Colors.dark.primary} style={{ margin: Spacing.lg }} />
        ) : recentQuizzes.length === 0 ? (
          <View style={styles.emptyHistory}>
            <History size={36} color={Colors.dark.textSecondary} />
            <Text style={styles.emptyHistoryText}>No quizzes played yet. Take your first quiz!</Text>
          </View>
        ) : (
          recentQuizzes.map((quiz) => (
            <TouchableOpacity 
              key={quiz.id} 
              style={styles.historyItem}
              onPress={() => router.push({
                pathname: '/quiz/result',
                params: { historyId: quiz.id }
              })}
              activeOpacity={0.7}
            >
              <View style={styles.historyInfo}>
                <Text style={styles.historyCategory}>{quiz.categoryName}</Text>
                <View style={styles.historyMeta}>
                  <Clock size={12} color={Colors.dark.textSecondary} />
                  <Text style={styles.historyDate}>{formatDate(quiz.timestamp)}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <View style={styles.historyScoreBox}>
                  {(() => {
                    const getPossibleMarks = (q: RecentQuiz) => {
                      if (q.totalPossibleMarks) return q.totalPossibleMarks;
                      if (q.answers && q.answers.length > 0) {
                        return q.answers.reduce((sum, ans) => sum + (ans.type === 'ShortAnswer' ? 5 : 1), 0);
                      }
                      return q.totalQuestions;
                    };
                    const possibleMarks = getPossibleMarks(quiz);
                    return (
                      <>
                        <Text style={styles.historyScoreText}>
                          {quiz.score}/{possibleMarks}
                        </Text>
                        <Text style={styles.historyPercentText}>
                          {Math.round((quiz.score / possibleMarks) * 100)}%
                        </Text>
                      </>
                    );
                  })()}
                </View>
                <ChevronRight size={16} color={Colors.dark.textSecondary} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  contentContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  welcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  welcomeText: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
  },
  userName: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: Colors.dark.primary,
  },
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: Spacing.sm,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  adminBannerContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  adminBannerTitle: {
    color: Colors.dark.warning,
    fontWeight: 'bold',
    fontSize: 14,
  },
  adminBannerSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: Spacing.md,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: Spacing.xl,
    ...Shadows.md,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: Spacing.xs,
  },
  statLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.dark.border,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  actionCard: {
    flex: 1,
    borderRadius: Spacing.md,
    overflow: 'hidden',
    ...Shadows.md,
  },
  actionGradient: {
    padding: Spacing.lg,
    height: 140,
    justifyContent: 'space-between',
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  historyContainer: {
    backgroundColor: Colors.dark.card,
    borderRadius: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.md,
  },
  emptyHistory: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyHistoryText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  historyInfo: {
    flex: 1,
  },
  historyCategory: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 4,
  },
  historyDate: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  historyScoreBox: {
    alignItems: 'flex-end',
  },
  historyScoreText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyPercentText: {
    color: Colors.dark.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});

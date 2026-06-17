import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator 
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { History, ArrowLeft, Clock, Award, ChevronRight } from 'lucide-react-native';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../context/AuthContext';
import { Colors, Spacing, Shadows } from '../../../constants/theme';

interface HistoryItem {
  id: string;
  categoryName: string;
  score: number;
  totalQuestions: number;
  totalPossibleMarks?: number;
  percentage: number;
  timestamp: any;
  answers?: any[];
}

export default function HistoryScreen() {
  const { profile } = useAuth();
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchHistory = async () => {
      if (!profile?.uid) return;

      try {
        const historyRef = collection(db, 'quiz_history');
        const q = query(
          historyRef, 
          where('userId', '==', profile.uid)
        );
        const querySnapshot = await getDocs(q);
        const items: HistoryItem[] = [];
        querySnapshot.forEach(doc => {
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

        setHistoryList(items);
      } catch (err) {
        console.error("Error fetching quiz history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [profile?.uid]);

  const formatDate = (firestoreTimestamp: any) => {
    if (!firestoreTimestamp) return 'Just now';
    const date = firestoreTimestamp.toDate();
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleReviewSession = (historyId: string) => {
    router.push({
      pathname: '/quiz/result',
      params: { historyId }
    });
  };

  const renderHistoryItem = ({ item }: { item: HistoryItem }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => handleReviewSession(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.cardLeft}>
        <Text style={styles.categoryName}>{item.categoryName}</Text>
        <View style={styles.metaRow}>
          <Clock size={14} color={Colors.dark.textSecondary} />
          <Text style={styles.metaText}>{formatDate(item.timestamp)}</Text>
        </View>
      </View>
      
      <View style={styles.cardRight}>
        <View style={styles.scoreBadge}>
          {(() => {
            const getPossibleMarks = (h: HistoryItem) => {
              if (h.totalPossibleMarks) return h.totalPossibleMarks;
              if (h.answers && h.answers.length > 0) {
                return h.answers.reduce((sum, ans) => sum + (ans.type === 'ShortAnswer' ? 5 : 1), 0);
              }
              return h.totalQuestions;
            };
            const possibleMarks = getPossibleMarks(item);
            return (
              <>
                <Text style={styles.scoreText}>{item.score}/{possibleMarks}</Text>
                <Text style={styles.percentText}>
                  {Math.round((item.score / possibleMarks) * 100)}%
                </Text>
              </>
            );
          })()}
        </View>
        <ChevronRight size={18} color={Colors.dark.textSecondary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Quiz History',
          headerStyle: { backgroundColor: '#0B0F19' },
          headerTintColor: '#FFFFFF',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.replace('/(tabs)/profile')} style={{ marginRight: Spacing.md }}>
              <ArrowLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )
        }}
      />

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={Colors.dark.primary} size="large" />
          <Text style={styles.loaderText}>Retrieving history...</Text>
        </View>
      ) : historyList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <History size={56} color={Colors.dark.textSecondary} />
          <Text style={styles.emptyText}>No history found.</Text>
          <Text style={styles.emptySubText}>
            You haven't completed any quizzes yet. Go to Categories and start playing!
          </Text>
        </View>
      ) : (
        <FlatList
          data={historyList}
          keyExtractor={(item) => item.id}
          renderItem={renderHistoryItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loaderText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    ...Shadows.sm,
  },
  cardLeft: {
    flex: 1,
    gap: Spacing.xs,
  },
  categoryName: {
    color: Colors.dark.text,
    fontSize: 17,
    fontWeight: 'bold',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  scoreBadge: {
    alignItems: 'flex-end',
  },
  scoreText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  percentText: {
    color: Colors.dark.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptySubText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
});

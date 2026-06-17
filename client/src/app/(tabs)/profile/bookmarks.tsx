import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Bookmark, Trash2, ArrowLeft, BookOpen } from 'lucide-react-native';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../context/AuthContext';
import { Colors, Spacing, Shadows } from '../../../constants/theme';

interface BookmarkedQuestion {
  id: string;
  questionId: string;
  questionText: string;
  categoryName: string;
  addedAt: any;
}

export default function BookmarksScreen() {
  const { profile } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!profile?.uid) return;

    const bookmarksRef = collection(db, 'bookmarks');
    const q = query(bookmarksRef, where('userId', '==', profile.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: BookmarkedQuestion[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        items.push({
          id: doc.id,
          questionId: data.questionId,
          questionText: data.questionText,
          categoryName: data.categoryName || 'General',
          addedAt: data.addedAt
        });
      });
      setBookmarks(items);
      setLoading(false);
    }, (error) => {
      console.error("Error reading bookmarks:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  const handleDeleteBookmark = (bookmarkId: string) => {
    Alert.alert(
      'Remove Bookmark',
      'Are you sure you want to remove this question from your bookmarks?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'bookmarks', bookmarkId));
            } catch (err) {
              console.error("Failed to delete bookmark:", err);
            }
          }
        }
      ]
    );
  };

  const renderBookmarkItem = ({ item }: { item: BookmarkedQuestion }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{item.categoryName}</Text>
        </View>
        <TouchableOpacity 
          style={styles.deleteBtn} 
          onPress={() => handleDeleteBookmark(item.id)}
        >
          <Trash2 size={16} color={Colors.dark.incorrect} />
        </TouchableOpacity>
      </View>
      <Text style={styles.questionText}>{item.questionText}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Bookmarks',
          headerStyle: { backgroundColor: '#0B0F19' },
          headerTintColor: '#FFFFFF',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: Spacing.md }}>
              <ArrowLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )
        }}
      />

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={Colors.dark.primary} size="large" />
          <Text style={styles.loaderText}>Loading bookmarks...</Text>
        </View>
      ) : bookmarks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Bookmark size={56} color={Colors.dark.textSecondary} />
          <Text style={styles.emptyText}>No bookmarked questions yet.</Text>
          <Text style={styles.emptySubText}>
            You can bookmark difficult or interesting questions during a quiz or when reviewing results!
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookmarks}
          keyExtractor={(item) => item.id}
          renderItem={renderBookmarkItem}
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
    backgroundColor: Colors.dark.card,
    borderRadius: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  categoryBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  categoryBadgeText: {
    color: Colors.dark.primary,
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  deleteBtn: {
    padding: Spacing.xs,
  },
  questionText: {
    color: Colors.dark.text,
    fontSize: 16,
    lineHeight: 24,
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

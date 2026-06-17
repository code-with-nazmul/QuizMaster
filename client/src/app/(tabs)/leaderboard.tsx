import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  Image, 
  ScrollView 
} from 'react-native';
import { Trophy, Award, Search, User } from 'lucide-react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { apiService, LeaderboardUser } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, Shadows } from '../../constants/theme';

interface FilterCategory {
  id: string; // 'global' or categoryId
  name: string;
}

export default function LeaderboardScreen() {
  const { profile } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [categories, setCategories] = useState<FilterCategory[]>([{ id: 'global', name: 'Global' }]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('global');
  const [loading, setLoading] = useState(true);

  // Fetch categories list for filter pills
  useEffect(() => {
    const fetchFilterCategories = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'categories'));
        const items: FilterCategory[] = [{ id: 'global', name: 'Global' }];
        querySnapshot.forEach(doc => {
          items.push({ id: doc.id, name: doc.data().name });
        });
        setCategories(items);
      } catch (err) {
        console.error("Error loading categories for leaderboard:", err);
      }
    };
    fetchFilterCategories();
  }, []);

  // Fetch leaderboard based on selected filter
  useEffect(() => {
    const fetchLeaderboardData = async () => {
      setLoading(true);
      try {
        // Send category NAME (not ID) because server's categoryPerformance is keyed by name
        let catName: string | undefined;
        if (selectedCategoryId !== 'global') {
          const found = categories.find(c => c.id === selectedCategoryId);
          catName = found ? found.name : undefined;
        }
        const res = await apiService.getLeaderboard(catName);
        setLeaderboard(res.leaderboard);
      } catch (err) {
        console.error("Error fetching leaderboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboardData();
  }, [selectedCategoryId, categories]);

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <View style={[styles.badge, styles.goldBadge]}><Trophy size={16} color="#000" /></View>;
      case 2:
        return <View style={[styles.badge, styles.silverBadge]}><Text style={styles.badgeText}>2</Text></View>;
      case 3:
        return <View style={[styles.badge, styles.bronzeBadge]}><Text style={styles.badgeText}>3</Text></View>;
      default:
        return <View style={styles.plainBadge}><Text style={styles.plainBadgeText}>{rank}</Text></View>;
    }
  };

  const renderUserRow = ({ item, index }: { item: LeaderboardUser; index: number }) => {
    const rank = index + 1;
    const isSelf = item.uid === profile?.uid;
    return (
      <View style={[
        styles.userRow, 
        rank === 1 ? styles.firstPlaceRow : {},
        isSelf ? styles.currentUserRow : {}
      ]}>
        {/* Rank indicator */}
        <View style={styles.rankContainer}>
          {getRankBadge(rank)}
        </View>
 
        {/* User Profile Info */}
        <Image 
          source={{ uri: item.photoURL || 'https://api.dicebear.com/7.x/bottts/png' }} 
          style={styles.userAvatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userNameText}>
            {item.displayName}
            {isSelf && <Text style={styles.currentUserSuffix}> (You)</Text>}
          </Text>
          <Text style={styles.userMetaText}>{item.displayMetric}</Text>
        </View>
 
        {/* Score Display */}
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>
            {selectedCategoryId === 'global' 
              ? `${Math.round(item.averageScore)}%`
              : `${Math.round(item.rankValue)}%`
            }
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Category Filter Pills (Horizontal Scroll) */}
      <View style={styles.filterWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.filterPill,
                selectedCategoryId === cat.id ? styles.activeFilterPill : {}
              ]}
              onPress={() => setSelectedCategoryId(cat.id)}
            >
              <Text style={[
                styles.filterPillLabel,
                selectedCategoryId === cat.id ? styles.activeFilterPillLabel : {}
              ]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main Leaderboard List */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={Colors.dark.primary} size="large" />
          <Text style={styles.loaderText}>Fetching standings...</Text>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.uid}
          renderItem={renderUserRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Trophy size={48} color={Colors.dark.textSecondary} />
              <Text style={styles.emptyText}>No rankings available for this category yet.</Text>
              <Text style={styles.emptySubText}>Be the first to complete a quiz and claim rank #1!</Text>
            </View>
          }
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
  filterWrapper: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  filterScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 2,
    borderRadius: 20,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  activeFilterPill: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  filterPillLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  activeFilterPillLabel: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    ...Shadows.sm,
  },
  firstPlaceRow: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: 'rgba(245, 158, 11, 0.03)',
  },
  rankContainer: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goldBadge: {
    backgroundColor: '#F59E0B',
  },
  silverBadge: {
    backgroundColor: '#9CA3AF',
  },
  bronzeBadge: {
    backgroundColor: '#D97706',
  },
  badgeText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 13,
  },
  plainBadge: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plainBadgeText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  userInfo: {
    flex: 1,
  },
  userNameText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  userMetaText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  scoreContainer: {
    paddingLeft: Spacing.sm,
  },
  scoreText: {
    color: Colors.dark.primary,
    fontSize: 18,
    fontWeight: 'bold',
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 1.5,
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptySubText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  currentUserRow: {
    borderColor: 'rgba(99, 102, 241, 0.6)',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  currentUserSuffix: {
    color: Colors.dark.primary,
    fontSize: 14,
    fontWeight: 'normal',
  },
});

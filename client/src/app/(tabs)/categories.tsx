import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  TextInput 
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, doc, writeBatch, getDocs } from 'firebase/firestore';
import { Compass, Clock, BookOpen, ChevronRight, Search } from 'lucide-react-native';
import { db } from '../../services/firebase';
import { Colors, Spacing, Shadows } from '../../constants/theme';

interface Category {
  id: string;
  name: string;
  description: string;
  timeLimitSeconds: number;
}

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const categoriesRef = collection(db, 'categories');
    
    // Listen to categories in real-time
    const unsubscribe = onSnapshot(categoriesRef, async (snapshot) => {
      if (snapshot.empty) {
        // Seed the database with default categories if empty
        await seedDefaultDatabase();
      } else {
        const items: Category[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as Category);
        });
        setCategories(items);
        setLoading(false);
      }
    }, (error) => {
      console.error("Error listening to categories:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const seedDefaultDatabase = async () => {
    console.log("Seeding default categories & questions database...");
    try {
      const batch = writeBatch(db);
      
      const defaultCategories = [
        { id: 'general_knowledge', name: 'General Knowledge', description: 'Test your knowledge on world geography, capitals, and trivia.', timeLimitSeconds: 120 },
        { id: 'science', name: 'Science', description: 'Fascinating questions about biology, physics, space, and technology.', timeLimitSeconds: 120 },
        { id: 'history', name: 'History', description: 'Travel back in time to explore world-changing events and empires.', timeLimitSeconds: 150 },
        { id: 'mathematics', name: 'Mathematics', description: 'Solve arithmetic, equations, logic puzzles, and math challenges.', timeLimitSeconds: 150 },
        { id: 'sports', name: 'Sports', description: 'Questions about world athletes, championships, and game rules.', timeLimitSeconds: 90 },
      ];

      // Create categories
      defaultCategories.forEach(cat => {
        const docRef = doc(db, 'categories', cat.id);
        batch.set(docRef, {
          name: cat.name,
          description: cat.description,
          timeLimitSeconds: cat.timeLimitSeconds
        });
      });

      // Sample questions: 2 MCQ and 1 Short Answer per category
      const sampleQuestions = [
        // General Knowledge
        {
          categoryId: 'general_knowledge',
          type: 'MCQ',
          questionText: 'Which country is known as the Land of the Rising Sun?',
          options: ['China', 'Japan', 'South Korea', 'Thailand'],
          correctAnswer: 'Japan',
          stats: { totalAttempts: 0, correctAttempts: 0, optionCounts: {} }
        },
        {
          categoryId: 'general_knowledge',
          type: 'MCQ',
          questionText: 'What is the capital of France?',
          options: ['Berlin', 'Madrid', 'Rome', 'Paris'],
          correctAnswer: 'Paris',
          stats: { totalAttempts: 0, correctAttempts: 0, optionCounts: {} }
        },
        {
          categoryId: 'general_knowledge',
          type: 'ShortAnswer',
          questionText: 'Name the largest ocean on Earth.',
          correctAnswer: 'Pacific Ocean',
          stats: { totalAttempts: 0, correctAttempts: 0, optionCounts: {} }
        },
        // Science
        {
          categoryId: 'science',
          type: 'MCQ',
          questionText: 'What chemical element has the symbol O?',
          options: ['Gold', 'Oxygen', 'Carbon', 'Iron'],
          correctAnswer: 'Oxygen',
          stats: { totalAttempts: 0, correctAttempts: 0, optionCounts: {} }
        },
        {
          categoryId: 'science',
          type: 'MCQ',
          questionText: 'Which planet is known as the Red Planet?',
          options: ['Venus', 'Jupiter', 'Mars', 'Saturn'],
          correctAnswer: 'Mars',
          stats: { totalAttempts: 0, correctAttempts: 0, optionCounts: {} }
        },
        {
          categoryId: 'science',
          type: 'ShortAnswer',
          questionText: 'What process do plants use to convert sunlight into food?',
          correctAnswer: 'Photosynthesis',
          stats: { totalAttempts: 0, correctAttempts: 0, optionCounts: {} }
        },
        // History
        {
          categoryId: 'history',
          type: 'MCQ',
          questionText: 'In which year did World War II end?',
          options: ['1918', '1945', '1939', '1950'],
          correctAnswer: '1945',
          stats: { totalAttempts: 0, correctAttempts: 0, optionCounts: {} }
        },
        {
          categoryId: 'history',
          type: 'ShortAnswer',
          questionText: 'Who was the first President of the United States?',
          correctAnswer: 'George Washington',
          stats: { totalAttempts: 0, correctAttempts: 0, optionCounts: {} }
        },
        // Mathematics
        {
          categoryId: 'mathematics',
          type: 'MCQ',
          questionText: 'What is the square root of 144?',
          options: ['10', '12', '14', '16'],
          correctAnswer: '12',
          stats: { totalAttempts: 0, correctAttempts: 0, optionCounts: {} }
        },
        {
          categoryId: 'mathematics',
          type: 'ShortAnswer',
          questionText: 'Solve for x: 2x + 7 = 15.',
          correctAnswer: '4',
          stats: { totalAttempts: 0, correctAttempts: 0, optionCounts: {} }
        },
        // Sports
        {
          categoryId: 'sports',
          type: 'MCQ',
          questionText: 'How many players are on the field for one team in a standard soccer match?',
          options: ['9', '10', '11', '12'],
          correctAnswer: '11',
          stats: { totalAttempts: 0, correctAttempts: 0, optionCounts: {} }
        },
        {
          categoryId: 'sports',
          type: 'ShortAnswer',
          questionText: 'Which country won the FIFA World Cup in 2022?',
          correctAnswer: 'Argentina',
          stats: { totalAttempts: 0, correctAttempts: 0, optionCounts: {} }
        }
      ];

      sampleQuestions.forEach(q => {
        const qRef = doc(collection(db, 'questions'));
        batch.set(qRef, q);
      });

      await batch.commit();
      console.log("Seeding complete!");
    } catch (err) {
      console.error("Error seeding database:", err);
    }
  };

  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    cat.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderCategoryCard = ({ item }: { item: Category }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => router.push(`/quiz/${item.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <ChevronRight size={20} color={Colors.dark.primary} />
      </View>
      <Text style={styles.cardDesc}>{item.description}</Text>
      
      <View style={styles.cardFooter}>
        <View style={styles.metaRow}>
          <Clock size={16} color={Colors.dark.textSecondary} />
          <Text style={styles.metaText}>{Math.floor(item.timeLimitSeconds / 60)} mins</Text>
        </View>
        <View style={styles.metaRow}>
          <BookOpen size={16} color={Colors.dark.textSecondary} />
          <Text style={styles.metaText}>Play now</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={20} color={Colors.dark.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search categories..."
          placeholderTextColor={Colors.dark.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={Colors.dark.primary} size="large" />
          <Text style={styles.loaderText}>Loading categories...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCategories}
          keyExtractor={(item) => item.id}
          renderItem={renderCategoryCard}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Compass size={48} color={Colors.dark.textSecondary} />
              <Text style={styles.emptyText}>No categories found matching your search.</Text>
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
    padding: Spacing.lg,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: Spacing.md,
    height: 50,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 16,
  },
  listContainer: {
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    ...Shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  cardTitle: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  cardDesc: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
    paddingTop: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
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
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
});

import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  ActivityIndicator, 
  Image, 
  Modal,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { User, LogOut, Bookmark, History, Edit2, Check, X, Award, BarChart2 } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, Shadows } from '../../constants/theme';

export default function ProfileScreen() {
  const { profile, signOut, updateProfileData, isAdmin } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  const handleUpdateProfile = async () => {
    if (!displayName.trim()) {
      setError('Name cannot be empty.');
      return;
    }

    setUpdating(true);
    setError('');
    try {
      await updateProfileData(displayName.trim(), photoURL.trim());
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setUpdating(false);
    }
  };

  const openEditModal = () => {
    setDisplayName(profile?.displayName || '');
    setPhotoURL(profile?.photoURL || '');
    setIsEditing(true);
  };

  // Extract category performance
  const catPerformance = profile?.categoryPerformance || {};
  const categoriesPlayed = Object.keys(catPerformance);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Profile Header */}
      <View style={styles.profileHeaderCard}>
        <Image 
          source={{ uri: profile?.photoURL || 'https://api.dicebear.com/7.x/bottts/png' }} 
          style={styles.profileAvatar}
        />
        <View style={styles.profileHeaderInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{profile?.displayName || 'User'}</Text>
            <TouchableOpacity style={styles.editBtn} onPress={openEditModal}>
              <Edit2 size={16} color={Colors.dark.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.profileEmail}>{profile?.email}</Text>
        </View>
      </View>

      {/* Profile Navigation Actions */}
      <View style={styles.navSection}>
        {isAdmin && (
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/admin/dashboard')}>
            <View style={styles.navRowLeft}>
              <Award size={20} color="#F59E0B" />
              <Text style={styles.navRowLabel}>Admin Dashboard</Text>
            </View>
            <Text style={styles.navRowRightText}>Manage quiz content</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.navRow} onPress={() => router.push('/profile/bookmarks')}>
          <View style={styles.navRowLeft}>
            <Bookmark size={20} color={Colors.dark.primary} />
            <Text style={styles.navRowLabel}>Bookmarked Questions</Text>
          </View>
          <Text style={styles.navRowRightText}>Review saved</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navRow} onPress={() => router.push('/profile/history')}>
          <View style={styles.navRowLeft}>
            <History size={20} color={Colors.dark.secondary} />
            <Text style={styles.navRowLabel}>Full Quiz History</Text>
          </View>
          <Text style={styles.navRowRightText}>See all scores</Text>
        </TouchableOpacity>
      </View>

      {/* Category Performance Breakdown */}
      <View style={styles.perfCard}>
        <View style={styles.perfHeader}>
          <BarChart2 size={20} color={Colors.dark.primary} />
          <Text style={styles.perfTitle}>Performance by Category</Text>
        </View>

        {categoriesPlayed.length === 0 ? (
          <Text style={styles.emptyPerfText}>No quiz data yet. Take a quiz to see your performance by category!</Text>
        ) : (
          categoriesPlayed.map((catKey) => {
            const perf = catPerformance[catKey];
            const total = perf.total || 0;
            const correct = perf.correct || 0;
            const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

            return (
              <View key={catKey} style={styles.categoryPerfRow}>
                <View style={styles.catPerfLabels}>
                  <Text style={styles.catName}>{catKey}</Text>
                  <Text style={styles.catStats}>{correct}/{total} marks ({percent}%)</Text>
                </View>
                {/* Visual Progress Bar */}
                <View style={styles.progressBarBg}>
                  <View style={[
                    styles.progressBarFill, 
                    { width: `${percent}%` }
                  ]} />
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <LogOut size={20} color="#FFFFFF" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditing}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditing(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <ScrollView 
            contentContainerStyle={styles.modalScrollContent} 
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <TouchableOpacity onPress={() => setIsEditing(false)}>
                  <X size={24} color={Colors.dark.text} />
                </TouchableOpacity>
              </View>

              {error ? <Text style={styles.modalError}>{error}</Text> : null}

              <Text style={styles.inputLabel}>Display Name</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.modalInput}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Enter display name"
                  placeholderTextColor={Colors.dark.textSecondary}
                />
              </View>

              <Text style={styles.inputLabel}>Avatar Image URL</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.modalInput}
                  value={photoURL}
                  onChangeText={setPhotoURL}
                  placeholder="Enter image URL"
                  placeholderTextColor={Colors.dark.textSecondary}
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity 
                style={styles.saveBtn} 
                onPress={handleUpdateProfile}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Check size={18} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
    gap: Spacing.lg,
  },
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    ...Shadows.md,
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: Colors.dark.primary,
    marginRight: Spacing.lg,
  },
  profileHeaderInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  profileName: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  editBtn: {
    padding: Spacing.xs,
  },
  profileEmail: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  navSection: {
    backgroundColor: Colors.dark.card,
    borderRadius: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  navRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  navRowLabel: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
  },
  navRowRightText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  perfCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    ...Shadows.md,
  },
  perfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  perfTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyPerfText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: Spacing.md,
    lineHeight: 20,
  },
  categoryPerfRow: {
    marginBottom: Spacing.md,
  },
  catPerfLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  catName: {
    color: Colors.dark.text,
    fontWeight: '600',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  catStats: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.dark.primary,
  },
  signOutButton: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.incorrect,
    borderRadius: Spacing.sm,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    ...Shadows.md,
  },
  signOutText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    backgroundColor: Colors.dark.card,
    borderRadius: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalError: {
    color: Colors.dark.incorrect,
    backgroundColor: Colors.dark.incorrectLight,
    padding: Spacing.sm,
    borderRadius: Spacing.xs,
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  inputLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: Spacing.sm,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  modalInput: {
    color: Colors.dark.text,
    fontSize: 15,
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.primary,
    height: 50,
    borderRadius: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
    ...Shadows.md,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});

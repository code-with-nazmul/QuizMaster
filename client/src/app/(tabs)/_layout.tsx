import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Home, Compass, Trophy, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';

export default function TabsLayout() {
  const scheme = useColorScheme();
  const theme = Colors.dark; // Force dark mode look as requested by premium theme
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.background,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: theme.text,
          fontSize: 18,
          fontWeight: 'bold',
        },
        headerTintColor: theme.text,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.activeTab,
        tabBarInactiveTintColor: theme.inactiveTab,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'QuizMaster',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          tabBarLabel: 'Browse',
          tabBarIcon: ({ color, size }) => <Compass size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarLabel: 'Rankings',
          tabBarIcon: ({ color, size }) => <Trophy size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'My Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile/bookmarks"
        options={{
          href: null,
          title: 'Bookmarks',
        }}
      />
      <Tabs.Screen
        name="profile/history"
        options={{
          href: null,
          title: 'Quiz History',
        }}
      />
      <Tabs.Screen
        name="quiz/result"
        options={{
          href: null,
          title: 'Quiz Results',
        }}
      />
      <Tabs.Screen
        name="admin/dashboard"
        options={{
          href: null,
          title: 'Admin Dashboard',
        }}
      />
    </Tabs>
  );
}

import { Platform } from 'react-native';

export const Colors = {
  // Main premium dark theme
  dark: {
    background: '#0B0F19',
    card: '#151D30',
    border: 'rgba(255, 255, 255, 0.08)',
    text: '#F3F4F6',
    textSecondary: '#9CA3AF',
    primary: '#6366F1', // Indigo
    primaryGradient: ['#6366F1', '#8B5CF6'],
    secondary: '#8B5CF6', // Violet
    correct: '#10B981', // Emerald
    correctLight: 'rgba(16, 185, 129, 0.15)',
    incorrect: '#EF4444', // Rose
    incorrectLight: 'rgba(239, 68, 68, 0.15)',
    warning: '#F59E0B', // Amber
    glass: 'rgba(255, 255, 255, 0.03)',
    glassBorder: 'rgba(255, 255, 255, 0.06)',
    activeTab: '#6366F1',
    inactiveTab: '#6B7280',
    backgroundElement: '#151D30',
    backgroundSelected: '#1E293B',
  },
  // Clean fallback light theme
  light: {
    background: '#F9FAFB',
    card: '#FFFFFF',
    border: '#E5E7EB',
    text: '#111827',
    textSecondary: '#4B5563',
    primary: '#4F46E5',
    primaryGradient: ['#4F46E5', '#7C3AED'],
    secondary: '#7C3AED',
    correct: '#059669',
    correctLight: 'rgba(5, 150, 105, 0.1)',
    incorrect: '#DC2626',
    incorrectLight: 'rgba(220, 38, 38, 0.1)',
    warning: '#D97706',
    glass: 'rgba(0, 0, 0, 0.02)',
    glassBorder: 'rgba(0, 0, 0, 0.05)',
    activeTab: '#4F46E5',
    inactiveTab: '#9CA3AF',
    backgroundElement: '#E5E7EB',
    backgroundSelected: '#D1D5DB',
  }
} as const;

export type ThemeType = typeof Colors.dark;
export type ThemeColor = {
  [K in keyof typeof Colors.dark]: typeof Colors.dark[K] extends string ? K : never;
}[keyof typeof Colors.dark];

export const BottomTabInset = 0;
export const MaxContentWidth = 600;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Fonts = Platform.select({
  ios: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
    mono: 'CourierNewPSMT',
  },
  android: {
    regular: 'sans-serif',
    medium: 'sans-serif-medium',
    bold: 'sans-serif-bold',
    mono: 'monospace',
  },
  default: {
    regular: 'sans-serif',
    medium: 'sans-serif-medium',
    bold: 'sans-serif-bold',
    mono: 'monospace',
  },
});

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
  },
};

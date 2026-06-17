import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getBaseUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:5001';
  }

  // Dynamically resolve dev machine's IP address for physical devices running Expo Go
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':').shift();
    if (ip) {
      return `http://${ip}:5001`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5001';
  }
  return 'http://localhost:5001';
};

const BASE_URL = getBaseUrl();

export interface GradeResponse {
  isCorrect: boolean;
  explanation: string;
}

export interface QuestionStatsResponse {
  questionId: string;
  totalAttempts: number;
  correctAttempts: number;
  correctPercentage: number;
  optionPercentages?: { [key: string]: number };
  type: 'MCQ' | 'ShortAnswer';
}

export interface LeaderboardUser {
  uid: string;
  displayName: string;
  photoURL: string;
  rankValue: number;
  displayMetric: string;
  totalQuizzes: number;
  averageScore: number;
}

export interface LeaderboardResponse {
  category: string;
  leaderboard: LeaderboardUser[];
}

export const apiService = {
  /**
   * Submit short answer to Gemini for auto-grading
   */
  gradeShortAnswer: async (
    questionText: string,
    correctAnswer: string,
    userAnswer: string
  ): Promise<GradeResponse> => {
    try {
      const response = await fetch(`${BASE_URL}/api/grade-short-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionText, correctAnswer, userAnswer }),
      });

      if (!response.ok) {
        let errorMsg = `Grading server returned status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.error) {
            errorMsg = `GEMINI_ERROR: ${errData.error}`;
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error grading short answer:', error);
      
      const isGoogleIssue = error.message && error.message.includes('GEMINI_ERROR');

      return {
        isCorrect: false,
        explanation: isGoogleIssue 
          ? 'Gemini is currently unable to handle this. Try later.'
          : 'Auto-grading service is temporarily unavailable. Answer queued for admin review.'
      };
    }
  },

  /**
   * Submit quiz statistics and update aggregated tables
   */
  submitQuizStats: async (payload: {
    userId: string;
    categoryId: string;
    categoryName: string;
    score: number;
    totalQuestions: number;
    totalPossibleMarks?: number;
    answers: Array<{
      questionId: string;
      type: 'MCQ' | 'ShortAnswer';
      selectedAnswer?: string;
      userAnswerText?: string;
      isCorrect: boolean;
      marksAwarded: number;
    }>;
  }) => {
    try {
      const response = await fetch(`${BASE_URL}/api/submit-quiz-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Stats server returned status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error submitting quiz stats:', error);
      throw error;
    }
  },

  /**
   * Fetch option statistics for an MCQ or success rate for a Short Answer
   */
  getQuestionStats: async (questionId: string): Promise<QuestionStatsResponse> => {
    try {
      const response = await fetch(`${BASE_URL}/api/questions/${questionId}/stats`);

      if (!response.ok) {
        throw new Error(`Stats server returned status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching question stats:', error);
      return {
        questionId,
        totalAttempts: 0,
        correctAttempts: 0,
        correctPercentage: 0,
        type: 'MCQ'
      };
    }
  },

  /**
   * Retrieve Leaderboard entries (global or category-filtered)
   */
  getLeaderboard: async (category?: string): Promise<LeaderboardResponse> => {
    try {
      const url = category
        ? `${BASE_URL}/api/leaderboard?category=${encodeURIComponent(category)}`
        : `${BASE_URL}/api/leaderboard`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Leaderboard server returned status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return {
        category: category || 'Global',
        leaderboard: []
      };
    }
  },

  /**
   * Delete a user and all associated data (admin only)
   */
  deleteUser: async (userId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch(`${BASE_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned status ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
};

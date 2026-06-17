import { Request, Response } from 'express';
import { db, auth } from '../config/firebase';
import * as admin from 'firebase-admin';

// Helper to sanitize option names so they don't contain characters forbidden in Firestore field paths (. / * ~ [ ])
const sanitizeOptionKey = (option: string): string => {
  return option.replace(/[\.\/\*~\[\]]/g, '_');
};

// Interface for quiz submission payload
interface QuizAnswer {
  questionId: string;
  type: 'MCQ' | 'ShortAnswer';
  selectedAnswer?: string; // For MCQ
  userAnswerText?: string; // For Short Answer
  isCorrect: boolean;
  marksAwarded: number;
}

export const submitQuizStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, categoryId, categoryName, answers, score, totalQuestions, totalPossibleMarks } = req.body;

    if (!userId || !categoryId || !categoryName || !answers || score === undefined || !totalQuestions) {
      res.status(400).json({ error: 'Missing required quiz stats submission fields.' });
      return;
    }

    const batch = db.batch();
    const possibleMarksDivisor = totalPossibleMarks || totalQuestions;
    const currentPercentage = Math.round((score / possibleMarksDivisor) * 100);

    // 1. Fetch user metrics to update categoryPerformance
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    
    let categoryPerformance: any = {};
    if (userSnap.exists) {
      const userData = userSnap.data() || {};
      categoryPerformance = userData.categoryPerformance || {};
    }

    // Update specific category statistics (marks-based, not question-count)
    const catPerf = categoryPerformance[categoryName] || { correct: 0, total: 0 };
    let marksObtainedInThisQuiz = answers.reduce((sum: number, a: QuizAnswer) => sum + (a.marksAwarded || 0), 0);
    
    categoryPerformance[categoryName] = {
      correct: (catPerf.correct || 0) + marksObtainedInThisQuiz,
      total: (catPerf.total || 0) + possibleMarksDivisor
    };

    // Calculate correct average score from actual history records (direct query)
    const historySnap = await db.collection('quiz_history').where('userId', '==', userId).get();
    let totalQuizzes = 1;
    let sumPercentage = currentPercentage;

    historySnap.forEach(doc => {
      const data = doc.data();
      // Derive totalPossibleMarks from the answers array for old records that lack the field
      let divisor = data.totalPossibleMarks;
      if (!divisor && data.answers && data.answers.length > 0) {
        divisor = data.answers.reduce((sum: number, a: any) => sum + (a.type === 'ShortAnswer' ? 5 : 1), 0);
      }
      if (!divisor) divisor = data.totalQuestions || 1;
      const attemptScore = data.score || 0;
      const pct = Math.round((attemptScore / divisor) * 100);
      sumPercentage += pct;
      totalQuizzes += 1;
    });

    const avgScore = Math.round((sumPercentage / totalQuizzes) * 10) / 10;

    batch.set(userRef, {
      totalQuizzes,
      averageScore: avgScore,
      categoryPerformance,
      lastActive: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 2. Update stats for each question
    for (const answer of answers) {
      const questionRef = db.collection('questions').doc(answer.questionId);
      
      const updateData: any = {
        'stats.totalAttempts': admin.firestore.FieldValue.increment(1)
      };

      if (answer.isCorrect) {
        updateData['stats.correctAttempts'] = admin.firestore.FieldValue.increment(1);
      }

      if (answer.type === 'MCQ' && answer.selectedAnswer) {
        // Increment the count for the specific selected option
        // Clean option names to avoid dot notation and invalid character issues in Firestore keys
        const optionKey = `stats.optionCounts.${sanitizeOptionKey(answer.selectedAnswer)}`;
        updateData[optionKey] = admin.firestore.FieldValue.increment(1);
      }

      batch.update(questionRef, updateData);
    }

    const percentage = Math.round((score / possibleMarksDivisor) * 10000) / 100;

    // 3. Save the quiz history document
    const historyRef = db.collection('quiz_history').doc();
    batch.set(historyRef, {
      userId,
      categoryId,
      categoryName,
      score,
      totalQuestions,
      totalPossibleMarks: possibleMarksDivisor,
      percentage,
      answers,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    res.status(200).json({ 
      success: true, 
      message: 'Quiz results and statistics recorded successfully.',
      averageScore: avgScore,
      totalQuizzes
    });
  } catch (error: any) {
    console.error('Error submitting quiz stats:', error);
    res.status(500).json({ error: 'Failed to record quiz results.', details: error.message });
  }
};

export const getQuestionStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { questionId } = req.params;

    if (!questionId) {
      res.status(400).json({ error: 'Question ID is required.' });
      return;
    }

    const questionSnap = await db.collection('questions').doc(questionId).get();

    if (!questionSnap.exists) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    const questionData = questionSnap.data();
    const stats = questionData?.stats || { totalAttempts: 0, correctAttempts: 0, optionCounts: {} };

    const total = stats.totalAttempts || 0;
    const correct = stats.correctAttempts || 0;
    const correctPercentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Calculate percentage for options if MCQ
    const optionPercentages: { [key: string]: number } = {};
    if (questionData?.type === 'MCQ' && questionData.options) {
      const counts = stats.optionCounts || {};
      for (const option of questionData.options) {
        const cleanedKey = sanitizeOptionKey(option);
        const count = counts[cleanedKey] || 0;
        optionPercentages[option] = total > 0 ? Math.round((count / total) * 100) : 0;
      }
    }

    res.status(200).json({
      questionId,
      totalAttempts: total,
      correctAttempts: correct,
      correctPercentage,
      optionPercentages,
      type: questionData?.type
    });
  } catch (error: any) {
    console.error('Error retrieving question stats:', error);
    res.status(500).json({ error: 'Failed to fetch question statistics.', details: error.message });
  }
};

export const getLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = req.query.category as string; // Optional query param

    // Fetch top 100 users ordered by averageScore desc (runs instantly, no special index needed)
    const querySnapshot = await db.collection('users')
      .orderBy('averageScore', 'desc')
      .limit(100)
      .get();

    const leaderboard: any[] = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      
      let rankValue = 0;
      let displayMetric = '';

      if (category) {
        const perf = data.categoryPerformance?.[category] || { correct: 0, total: 0 };
        if (perf.total > 0) {
          rankValue = Math.round((perf.correct / perf.total) * 100);
        }
        displayMetric = `${perf.correct}/${perf.total} marks (${rankValue}%)`;
      } else {
        rankValue = data.averageScore || 0;
        displayMetric = `${rankValue}% Avg (${data.totalQuizzes || 0} quizzes)`;
      }

      leaderboard.push({
        uid: doc.id,
        displayName: data.displayName || 'Anonymous User',
        photoURL: data.photoURL || '',
        rankValue,
        displayMetric,
        totalQuizzes: data.totalQuizzes || 0,
        averageScore: data.averageScore || 0
      });
    });

    // Sort and filter in memory
    let finalLeaderboard = leaderboard;
    if (category) {
      finalLeaderboard = leaderboard
        .filter(item => item.rankValue > 0)
        .sort((a, b) => {
          if (b.rankValue !== a.rankValue) {
            return b.rankValue - a.rankValue;
          }
          // Tie-break by total quizzes
          return b.totalQuizzes - a.totalQuizzes;
        });
    } else {
      // Filter out users who never took a quiz, then sort by averageScore desc, totalQuizzes desc
      finalLeaderboard = leaderboard
        .filter(item => item.totalQuizzes > 0)
        .sort((a, b) => {
          if (b.averageScore !== a.averageScore) {
            return b.averageScore - a.averageScore;
          }
          return b.totalQuizzes - a.totalQuizzes;
        });
    }

    // Limit to top 20
    finalLeaderboard = finalLeaderboard.slice(0, 20);

    res.status(200).json({
      category: category || 'Global',
      leaderboard: finalLeaderboard
    });
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard.', details: error.message });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({ error: 'User ID is required.' });
      return;
    }

    // 1. Delete user from Firebase Auth
    try {
      await auth.deleteUser(userId);
    } catch (authError: any) {
      // If user doesn't exist in Auth, continue with Firestore cleanup
      if (authError.code !== 'auth/user-not-found') {
        throw authError;
      }
    }

    // 2. Delete user document from Firestore
    await db.collection('users').doc(userId).delete();

    // 3. Delete all quiz_history documents for this user
    const historySnap = await db.collection('quiz_history').where('userId', '==', userId).get();
    const batch = db.batch();
    historySnap.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    res.status(200).json({ success: true, message: 'User and all associated data deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user.', details: error.message });
  }
};

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.getLeaderboard = exports.getQuestionStats = exports.submitQuizStats = void 0;
const firebase_1 = require("../config/firebase");
const admin = __importStar(require("firebase-admin"));
// Helper to sanitize option names so they don't contain characters forbidden in Firestore field paths (. / * ~ [ ])
const sanitizeOptionKey = (option) => {
    return option.replace(/[\.\/\*~\[\]]/g, '_');
};
const submitQuizStats = async (req, res) => {
    try {
        const { userId, categoryId, categoryName, answers, score, totalQuestions, totalPossibleMarks } = req.body;
        if (!userId || !categoryId || !categoryName || !answers || score === undefined || !totalQuestions) {
            res.status(400).json({ error: 'Missing required quiz stats submission fields.' });
            return;
        }
        const batch = firebase_1.db.batch();
        const possibleMarksDivisor = totalPossibleMarks || totalQuestions;
        const currentPercentage = Math.round((score / possibleMarksDivisor) * 100);
        // 1. Fetch user metrics to update categoryPerformance
        const userRef = firebase_1.db.collection('users').doc(userId);
        const userSnap = await userRef.get();
        let categoryPerformance = {};
        if (userSnap.exists) {
            const userData = userSnap.data() || {};
            categoryPerformance = userData.categoryPerformance || {};
        }
        // Update specific category statistics (marks-based, not question-count)
        const catPerf = categoryPerformance[categoryName] || { correct: 0, total: 0 };
        let marksObtainedInThisQuiz = answers.reduce((sum, a) => sum + (a.marksAwarded || 0), 0);
        categoryPerformance[categoryName] = {
            correct: (catPerf.correct || 0) + marksObtainedInThisQuiz,
            total: (catPerf.total || 0) + possibleMarksDivisor
        };
        // Calculate correct average score from actual history records (direct query)
        const historySnap = await firebase_1.db.collection('quiz_history').where('userId', '==', userId).get();
        let totalQuizzes = 1;
        let sumPercentage = currentPercentage;
        historySnap.forEach(doc => {
            const data = doc.data();
            // Derive totalPossibleMarks from the answers array for old records that lack the field
            let divisor = data.totalPossibleMarks;
            if (!divisor && data.answers && data.answers.length > 0) {
                divisor = data.answers.reduce((sum, a) => sum + (a.type === 'ShortAnswer' ? 5 : 1), 0);
            }
            if (!divisor)
                divisor = data.totalQuestions || 1;
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
            const questionRef = firebase_1.db.collection('questions').doc(answer.questionId);
            const updateData = {
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
        const historyRef = firebase_1.db.collection('quiz_history').doc();
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
    }
    catch (error) {
        console.error('Error submitting quiz stats:', error);
        res.status(500).json({ error: 'Failed to record quiz results.', details: error.message });
    }
};
exports.submitQuizStats = submitQuizStats;
const getQuestionStats = async (req, res) => {
    try {
        const { questionId } = req.params;
        if (!questionId) {
            res.status(400).json({ error: 'Question ID is required.' });
            return;
        }
        const questionSnap = await firebase_1.db.collection('questions').doc(questionId).get();
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
        const optionPercentages = {};
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
    }
    catch (error) {
        console.error('Error retrieving question stats:', error);
        res.status(500).json({ error: 'Failed to fetch question statistics.', details: error.message });
    }
};
exports.getQuestionStats = getQuestionStats;
const getLeaderboard = async (req, res) => {
    try {
        const category = req.query.category; // Optional query param
        // Fetch top 100 users ordered by averageScore desc (runs instantly, no special index needed)
        const querySnapshot = await firebase_1.db.collection('users')
            .orderBy('averageScore', 'desc')
            .limit(100)
            .get();
        const leaderboard = [];
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
            }
            else {
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
        }
        else {
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
    }
    catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard.', details: error.message });
    }
};
exports.getLeaderboard = getLeaderboard;
const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            res.status(400).json({ error: 'User ID is required.' });
            return;
        }
        // 1. Delete user from Firebase Auth
        try {
            await firebase_1.auth.deleteUser(userId);
        }
        catch (authError) {
            // If user doesn't exist in Auth, continue with Firestore cleanup
            if (authError.code !== 'auth/user-not-found') {
                throw authError;
            }
        }
        // 2. Delete user document from Firestore
        await firebase_1.db.collection('users').doc(userId).delete();
        // 3. Delete all quiz_history documents for this user
        const historySnap = await firebase_1.db.collection('quiz_history').where('userId', '==', userId).get();
        const batch = firebase_1.db.batch();
        historySnap.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        res.status(200).json({ success: true, message: 'User and all associated data deleted successfully.' });
    }
    catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user.', details: error.message });
    }
};
exports.deleteUser = deleteUser;

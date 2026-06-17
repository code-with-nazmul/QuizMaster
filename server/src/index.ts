import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { gradeShortAnswer } from './controllers/geminiController';
import { submitQuizStats, getQuestionStats, getLeaderboard, deleteUser } from './controllers/statsController';

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS and JSON body parser
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Core QuizMaster Routes
app.post('/api/grade-short-answer', gradeShortAnswer);
app.post('/api/submit-quiz-stats', submitQuizStats);
app.get('/api/questions/:questionId/stats', getQuestionStats);
app.get('/api/leaderboard', getLeaderboard);
app.delete('/api/admin/users/:userId', deleteUser);

// Start Server
app.listen(port, () => {
  console.log(`QuizMaster backend running on port ${port}`);
});

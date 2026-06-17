"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
const geminiController_1 = require("./controllers/geminiController");
const statsController_1 = require("./controllers/statsController");
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
// Enable CORS and JSON body parser
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date() });
});
// Core QuizMaster Routes
app.post('/api/grade-short-answer', geminiController_1.gradeShortAnswer);
app.post('/api/submit-quiz-stats', statsController_1.submitQuizStats);
app.get('/api/questions/:questionId/stats', statsController_1.getQuestionStats);
app.get('/api/leaderboard', statsController_1.getLeaderboard);
app.delete('/api/admin/users/:userId', statsController_1.deleteUser);
// Start Server
app.listen(port, () => {
    console.log(`QuizMaster backend running on port ${port}`);
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gradeShortAnswer = void 0;
const generative_ai_1 = require("@google/generative-ai");
// Initialize the Gemini API client
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
const gradeShortAnswer = async (req, res) => {
    try {
        const { questionText, correctAnswer, userAnswer } = req.body;
        if (!questionText || !correctAnswer || userAnswer === undefined) {
            res.status(400).json({ error: 'Missing required fields: questionText, correctAnswer, userAnswer.' });
            return;
        }
        if (!apiKey) {
            res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
            return;
        }
        // Call Gemini 1.5 Flash model
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: {
                responseMimeType: 'application/json',
            },
        });
        const prompt = `
      You are an expert academic grading assistant. Grade the student's answer to the following question.
      
      Question: "${questionText}"
      Reference Correct Answer/Key Concepts: "${correctAnswer}"
      Student's Answer: "${userAnswer}"

      Evaluate if the student's answer is conceptually correct.
      Rules:
      - Ignore minor spelling typos or grammatical mistakes.
      - The student's answer must contain the core ideas of the reference answer, even if written in different words or simplified.
      - If the student's answer is empty or completely off-topic, mark it as incorrect.
      
      You must respond with a JSON object of this structure:
      {
        "isCorrect": true or false,
        "explanation": "A very brief feedback sentence explaining why they are correct or what was missing (maximum 20 words)."
      }
    `;
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        // Parse response
        const evaluation = JSON.parse(text);
        res.status(200).json({
            isCorrect: !!evaluation.isCorrect,
            explanation: evaluation.explanation || (evaluation.isCorrect ? 'Correct!' : 'Incorrect answer.')
        });
    }
    catch (error) {
        console.error('Error in Gemini auto-grading:', error);
        res.status(500).json({
            error: 'Failed to auto-grade answer due to generative API error.',
            details: error.message
        });
    }
};
exports.gradeShortAnswer = gradeShortAnswer;

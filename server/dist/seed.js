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
const firebase_1 = require("./config/firebase");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function seed() {
    console.log('Starting Firestore database seeder...\n');
    // 1. Read questions.json
    const jsonPath = path.join(__dirname, '../questions.json');
    if (!fs.existsSync(jsonPath)) {
        console.error(`Error: File not found at ${jsonPath}`);
        process.exit(1);
    }
    let questions = [];
    try {
        const rawData = fs.readFileSync(jsonPath, 'utf8');
        questions = JSON.parse(rawData);
    }
    catch (error) {
        console.error(`Error parsing questions.json: ${error.message}`);
        process.exit(1);
    }
    if (!Array.isArray(questions)) {
        console.error('Error: questions.json must contain a JSON array of question objects.');
        process.exit(1);
    }
    console.log(`Loaded ${questions.length} questions from questions.json.`);
    // 2. Fetch categories map from database
    console.log('Fetching existing categories from Firestore...');
    const categoriesMap = {}; // name (lowercase) -> document ID
    try {
        const catSnap = await firebase_1.db.collection('categories').get();
        catSnap.forEach(doc => {
            const data = doc.data();
            if (data.name) {
                categoriesMap[data.name.trim().toLowerCase()] = doc.id;
            }
        });
        console.log(`Resolved ${Object.keys(categoriesMap).length} categories in database.`);
    }
    catch (error) {
        console.error(`Failed to fetch categories: ${error.message}`);
        process.exit(1);
    }
    // 3. Fetch existing questions to build a duplicate checking set
    console.log('Fetching existing questions from Firestore for duplicate detection...');
    const existingQuestionsSet = new Set(); // key format: categoryId_questiontext
    try {
        const qSnap = await firebase_1.db.collection('questions').get();
        qSnap.forEach(doc => {
            const data = doc.data();
            if (data.categoryId && data.questionText) {
                const key = `${data.categoryId}_${data.questionText.trim().toLowerCase()}`;
                existingQuestionsSet.add(key);
            }
        });
        console.log(`Found ${existingQuestionsSet.size} existing questions in database.`);
    }
    catch (error) {
        console.error(`Failed to fetch questions: ${error.message}`);
        process.exit(1);
    }
    // 4. Iterate and upload non-duplicates
    let addedCount = 0;
    let duplicateCount = 0;
    let categoryNotFoundCount = 0;
    let invalidFormatCount = 0;
    console.log('\nProcessing questions...');
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const indexStr = `[Question ${i + 1}]`;
        // Validation
        if (!q.category || !q.type || !q.questionText || q.correctAnswer === undefined) {
            console.warn(`${indexStr} SKIP: Missing required fields (category, type, questionText, correctAnswer).`);
            invalidFormatCount++;
            continue;
        }
        if (q.type !== 'MCQ' && q.type !== 'ShortAnswer') {
            console.warn(`${indexStr} SKIP: Invalid type "${q.type}". Must be "MCQ" or "ShortAnswer".`);
            invalidFormatCount++;
            continue;
        }
        if (q.type === 'MCQ') {
            if (!Array.isArray(q.options) || q.options.length < 2) {
                console.warn(`${indexStr} SKIP: MCQ type must contain an options array with at least 2 choices.`);
                invalidFormatCount++;
                continue;
            }
            const trimmedOptions = q.options.map(opt => opt.trim());
            if (!trimmedOptions.includes(q.correctAnswer.trim())) {
                console.warn(`${indexStr} SKIP: correctAnswer "${q.correctAnswer}" must exactly match one of the choices in options.`);
                invalidFormatCount++;
                continue;
            }
        }
        // Resolve Category ID
        const catNameLower = q.category.trim().toLowerCase();
        const categoryId = categoriesMap[catNameLower];
        if (!categoryId) {
            console.warn(`${indexStr} SKIP: Category "${q.category}" does not exist in the database. Please create it first.`);
            categoryNotFoundCount++;
            continue;
        }
        // Check for duplicate
        const duplicateKey = `${categoryId}_${q.questionText.trim().toLowerCase()}`;
        if (existingQuestionsSet.has(duplicateKey)) {
            console.warn(`${indexStr} SKIP: Duplicate question detected in category "${q.category}": "${q.questionText.trim()}"`);
            duplicateCount++;
            continue;
        }
        // Upload to Firestore
        try {
            const docPayload = {
                categoryId,
                type: q.type,
                questionText: q.questionText.trim(),
                correctAnswer: q.correctAnswer.trim(),
                marks: q.marks !== undefined ? Number(q.marks) : (q.type === 'MCQ' ? 1 : 5),
                stats: { totalAttempts: 0, correctAttempts: 0, optionCounts: {} }
            };
            if (q.type === 'MCQ' && q.options) {
                docPayload.options = q.options.map(o => o.trim());
            }
            await firebase_1.db.collection('questions').add(docPayload);
            // Register in local set to prevent duplicate uploads if the JSON file itself has duplicate questions
            existingQuestionsSet.add(duplicateKey);
            console.log(`${indexStr} SUCCESS: Added question to "${q.category}": "${q.questionText.trim()}"`);
            addedCount++;
        }
        catch (err) {
            console.error(`${indexStr} ERROR adding question: ${err.message}`);
            invalidFormatCount++;
        }
    }
    // 5. Final Report
    console.log('\n======================================');
    console.log('            Seeding Summary           ');
    console.log('======================================');
    console.log(`Total Parsed Questions:     ${questions.length}`);
    console.log(`Successfully Seeded:        ${addedCount}`);
    console.log(`Skipped (Duplicates):       ${duplicateCount}`);
    console.log(`Skipped (Category Not Found): ${categoryNotFoundCount}`);
    console.log(`Skipped (Invalid/Errors):   ${invalidFormatCount}`);
    console.log('======================================\n');
    process.exit(0);
}
seed();

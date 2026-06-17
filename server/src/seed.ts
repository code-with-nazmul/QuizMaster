import { db } from './config/firebase';
import * as fs from 'fs';
import * as path from 'path';

interface InputQuestion {
  category: string;
  type: 'MCQ' | 'ShortAnswer';
  questionText: string;
  options?: string[];
  correctAnswer: string;
  marks: number;
}

async function seed() {
  console.log('Starting Firestore database seeder...\n');

  // 1. Read questions.json
  const jsonPath = path.join(__dirname, '../questions.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: File not found at ${jsonPath}`);
    process.exit(1);
  }

  let questions: InputQuestion[] = [];
  try {
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    questions = JSON.parse(rawData);
  } catch (error: any) {
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
  const categoriesMap: { [key: string]: string } = {}; // name (lowercase) -> document ID
  try {
    const catSnap = await db.collection('categories').get();
    catSnap.forEach(doc => {
      const data = doc.data();
      if (data.name) {
        categoriesMap[data.name.trim().toLowerCase()] = doc.id;
      }
    });
    console.log(`Resolved ${Object.keys(categoriesMap).length} categories in database.`);
  } catch (error: any) {
    console.error(`Failed to fetch categories: ${error.message}`);
    process.exit(1);
  }

  // 3. Fetch existing questions to build a duplicate checking set
  console.log('Fetching existing questions from Firestore for duplicate detection...');
  const existingQuestionsSet = new Set<string>(); // key format: categoryId_questiontext
  try {
    const qSnap = await db.collection('questions').get();
    qSnap.forEach(doc => {
      const data = doc.data();
      if (data.categoryId && data.questionText) {
        const key = `${data.categoryId}_${data.questionText.trim().toLowerCase()}`;
        existingQuestionsSet.add(key);
      }
    });
    console.log(`Found ${existingQuestionsSet.size} existing questions in database.`);
  } catch (error: any) {
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
      const docPayload: any = {
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

      await db.collection('questions').add(docPayload);
      
      // Register in local set to prevent duplicate uploads if the JSON file itself has duplicate questions
      existingQuestionsSet.add(duplicateKey);
      
      console.log(`${indexStr} SUCCESS: Added question to "${q.category}": "${q.questionText.trim()}"`);
      addedCount++;
    } catch (err: any) {
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

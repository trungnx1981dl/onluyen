import { Quiz, Question } from '../types';

/**
 * Fisher-Yates shuffle an array immutably
 */
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Clean option text by removing leading letter prefixes like "A. ", "B) ", "1. "
 */
function cleanOptionText(text: string): string {
  if (!text) return '';
  return text.replace(/^[A-Da-d0-9][\.\:\)\-\s]+\s*/, '').trim();
}

/**
 * Shuffles questions in each section and shuffles options & answers within each question.
 * Ensures that every time a quiz is opened, the order is randomized while retaining correctness.
 */
export function shuffleQuiz(quiz: Quiz): Quiz {
  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return quiz;
  }

  // 1. Group questions by section/type: MC, TF, SA, ESSAY
  const mcQuestions: Question[] = [];
  const tfQuestions: Question[] = [];
  const saQuestions: Question[] = [];
  const essayQuestions: Question[] = [];
  const otherQuestions: Question[] = [];

  for (const q of quiz.questions) {
    if (q.type === 'MC') mcQuestions.push(q);
    else if (q.type === 'TF') tfQuestions.push(q);
    else if (q.type === 'SA') saQuestions.push(q);
    else if (q.type === 'ESSAY') essayQuestions.push(q);
    else otherQuestions.push(q);
  }

  // Helper to shuffle an MC question's options and update its answer
  const processMCQuestion = (q: Question): Question => {
    if (!q.options || q.options.length < 2) return { ...q };

    const rawOptions = q.options;
    const cleanOptions = rawOptions.map(cleanOptionText);

    // Identify the original correct option text
    let originalCorrectText = '';
    const cleanAnswer = (q.answer || '').trim();
    const upperAns = cleanAnswer.toUpperCase();

    // Check if answer is a letter 'A', 'B', 'C', 'D'
    const letterMatch = upperAns.match(/^[A-D]/);
    if (letterMatch) {
      const originalIdx = ['A', 'B', 'C', 'D'].indexOf(letterMatch[0]);
      if (originalIdx >= 0 && originalIdx < cleanOptions.length) {
        originalCorrectText = cleanOptions[originalIdx];
      }
    }

    // If not found by letter index, find by text match
    if (!originalCorrectText) {
      const matchIdx = cleanOptions.findIndex(
        opt => opt.toLowerCase() === cleanAnswer.toLowerCase() ||
               cleanOptionText(q.answer).toLowerCase() === opt.toLowerCase()
      );
      if (matchIdx >= 0) {
        originalCorrectText = cleanOptions[matchIdx];
      } else {
        // Fallback: take first option
        originalCorrectText = cleanOptions[0];
      }
    }

    // Shuffle the cleaned options
    const shuffledOptions = shuffleArray(cleanOptions);

    // Find the new index of the correct text
    let newIdx = shuffledOptions.indexOf(originalCorrectText);
    if (newIdx === -1) newIdx = 0;

    const newAnswerLetter = ['A', 'B', 'C', 'D'][newIdx] || 'A';

    return {
      ...q,
      options: shuffledOptions,
      answer: newAnswerLetter,
    };
  };

  // Helper to shuffle a TF question's statements and update its answer array
  const processTFQuestion = (q: Question): Question => {
    if (!q.options || q.options.length === 0) return { ...q };

    let ansList: string[] = [];
    try {
      if (typeof q.answer === 'string' && q.answer.startsWith('[')) {
        ansList = JSON.parse(q.answer);
      } else if (Array.isArray(q.answer)) {
        ansList = q.answer;
      }
    } catch {
      ansList = [];
    }

    // Pair each option with its answer (defaults to 'Đúng')
    const pairs = q.options.map((opt, i) => ({
      statement: cleanOptionText(opt),
      ans: ansList[i] || 'Đúng'
    }));

    // Shuffle statements
    const shuffledPairs = shuffleArray(pairs);

    return {
      ...q,
      options: shuffledPairs.map(p => p.statement),
      answer: JSON.stringify(shuffledPairs.map(p => p.ans)),
    };
  };

  // 2. Shuffle questions inside each section
  const shuffledMC = shuffleArray(mcQuestions).map(processMCQuestion);
  const shuffledTF = shuffleArray(tfQuestions).map(processTFQuestion);
  const shuffledSA = shuffleArray(saQuestions);
  const shuffledEssay = shuffleArray(essayQuestions);
  const shuffledOther = shuffleArray(otherQuestions);

  // 3. Combine sections in standard order
  const finalQuestions = [
    ...shuffledMC,
    ...shuffledTF,
    ...shuffledSA,
    ...shuffledEssay,
    ...shuffledOther,
  ];

  return {
    ...quiz,
    questions: finalQuestions,
  };
}

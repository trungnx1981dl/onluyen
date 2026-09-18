import { Question } from '../types';

export interface ScoreBreakdown {
  mcCount: number;
  tfCount: number;
  saCount: number;
  essayCount: number;
  totalQuestions: number;
  tfScorePerQ: number; // 1.0 point
  tfScorePerItem: number; // 0.25 point per correct statement
  saScorePerQ: number; // 0.5 point
  mcScorePerQ: number; // Remaining points divided equally among MC questions
  essayScorePerQ: number;
  totalPoints: number; // 10.0
}

/**
 * Calculates score allocation based on:
 * - Each True/False (TF) question is 1.0 point (0.25 per correct statement)
 * - Each Short Answer (SA) question is 0.5 point
 * - Remaining points out of 10.0 are divided equally among 4-option Multiple Choice (MC) questions
 */
export function calculateScoreBreakdown(questions: Question[]): ScoreBreakdown {
  if (!questions || questions.length === 0) {
    return {
      mcCount: 0,
      tfCount: 0,
      saCount: 0,
      essayCount: 0,
      totalQuestions: 0,
      tfScorePerQ: 1.0,
      tfScorePerItem: 0.25,
      saScorePerQ: 0.5,
      mcScorePerQ: 0,
      essayScorePerQ: 0,
      totalPoints: 10.0,
    };
  }

  let mcCount = 0;
  let tfCount = 0;
  let saCount = 0;
  let essayCount = 0;

  for (const q of questions) {
    if (q.type === 'MC') mcCount++;
    else if (q.type === 'TF') tfCount++;
    else if (q.type === 'SA') saCount++;
    else if (q.type === 'ESSAY') essayCount++;
    else mcCount++;
  }

  const tfScorePerQ = 1.0;
  const tfScorePerItem = 0.25;
  const saScorePerQ = 0.5;
  const essayScorePerQ = essayCount > 0 ? 0.5 : 0;

  const reservedPoints = (tfCount * tfScorePerQ) + (saCount * saScorePerQ) + (essayCount * essayScorePerQ);
  const remainingPoints = 10.0 - reservedPoints;

  let mcScorePerQ = 0;
  if (mcCount > 0) {
    if (remainingPoints > 0) {
      mcScorePerQ = remainingPoints / mcCount;
    } else {
      // Fallback if reserved points already exceed 10 (edge case with too many TF/SA)
      mcScorePerQ = 10.0 / questions.length;
    }
  }

  return {
    mcCount,
    tfCount,
    saCount,
    essayCount,
    totalQuestions: questions.length,
    tfScorePerQ,
    tfScorePerItem,
    saScorePerQ,
    mcScorePerQ,
    essayScorePerQ,
    totalPoints: 10.0,
  };
}

/**
 * Parses True/False answer array from JSON or string list
 */
export function parseTFAnswerList(rawAnswer: any): string[] {
  if (Array.isArray(rawAnswer)) return rawAnswer.map(String);
  if (typeof rawAnswer === 'string') {
    const trimmed = rawAnswer.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {
        // ignore
      }
    }
    // Fallback comma/semicolon/space separated
    if (trimmed.includes(',')) {
      return trimmed.split(',').map(s => s.trim());
    }
  }
  return [];
}

/**
 * Normalizes 'Đúng', 'Dung', 'True', 'T', 'D', 'Đ' -> 'Đ'
 * Normalizes 'Sai', 'False', 'F', 'S' -> 'S'
 */
export function normalizeTFChar(val: string): 'Đ' | 'S' {
  if (!val) return 'S';
  const clean = val.trim().toLowerCase();
  if (clean === 'đúng' || clean === 'dung' || clean === 'true' || clean === 't' || clean === 'đ' || clean === 'd') {
    return 'Đ';
  }
  return 'S';
}

/**
 * Formats a TF answer string into:
 * `Câu x: a) Đ, b) S, c) S, d) Đ` or `a) Đ, b) S, c) S, d) Đ`
 */
export function formatTFAnswer(rawAnswer: any, questionNum?: number): string {
  const list = parseTFAnswerList(rawAnswer);
  const letters = ['a', 'b', 'c', 'd'];
  const formattedItems = letters.map((letter, idx) => {
    const val = list[idx] ? normalizeTFChar(list[idx]) : 'Đ';
    return `${letter}) ${val}`;
  });

  const formattedStr = formattedItems.join(', ');
  if (typeof questionNum === 'number') {
    return `Câu ${questionNum}: ${formattedStr}`;
  }
  return formattedStr;
}

/**
 * Grade a student's answer for a single question
 */
export function gradeQuestion(
  question: Question,
  studentAnswer: any,
  breakdown: ScoreBreakdown
): {
  earned: number;
  max: number;
  isFullyCorrect: boolean;
  tfDetails?: { statementIdx: number; isCorrect: boolean; studentVal: string; correctVal: string }[];
} {
  if (!question) {
    return { earned: 0, max: 0, isFullyCorrect: false };
  }

  if (question.type === 'MC') {
    const max = breakdown.mcScorePerQ;
    if (!studentAnswer) return { earned: 0, max, isFullyCorrect: false };

    const studentStr = String(studentAnswer).trim();
    const optIdx = ['A', 'B', 'C', 'D'].indexOf(studentStr);
    const chosenText = (optIdx >= 0 && question.options && question.options[optIdx]) ? question.options[optIdx].trim() : '';

    const isCorrect = (studentStr.toUpperCase() === (question.answer || '').trim().toUpperCase()) ||
      (chosenText.toLowerCase() === (question.answer || '').trim().toLowerCase());

    return {
      earned: isCorrect ? max : 0,
      max,
      isFullyCorrect: isCorrect,
    };
  }

  if (question.type === 'TF') {
    const max = breakdown.tfScorePerQ; // 1.0 point
    const correctList = parseTFAnswerList(question.answer);
    const studentList = parseTFAnswerList(studentAnswer);

    let correctCount = 0;
    const tfDetails: { statementIdx: number; isCorrect: boolean; studentVal: string; correctVal: string }[] = [];

    for (let i = 0; i < 4; i++) {
      const correctNorm = normalizeTFChar(correctList[i] || 'Đúng');
      const studentNorm = normalizeTFChar(studentList[i] || '');
      const isItemCorrect = Boolean(studentList[i]) && (correctNorm === studentNorm);

      if (isItemCorrect) {
        correctCount++;
      }
      tfDetails.push({
        statementIdx: i,
        isCorrect: isItemCorrect,
        studentVal: studentNorm,
        correctVal: correctNorm,
      });
    }

    // 0.25 points per correct statement
    const earned = correctCount * breakdown.tfScorePerItem;

    return {
      earned,
      max,
      isFullyCorrect: correctCount === 4,
      tfDetails,
    };
  }

  if (question.type === 'SA') {
    const max = breakdown.saScorePerQ; // 0.5 point
    if (!studentAnswer) return { earned: 0, max, isFullyCorrect: false };

    const studentClean = String(studentAnswer).trim().toLowerCase();
    const correctClean = (question.answer || '').trim().toLowerCase();
    const isCorrect = studentClean === correctClean;

    return {
      earned: isCorrect ? max : 0,
      max,
      isFullyCorrect: isCorrect,
    };
  }

  // ESSAY
  const max = breakdown.essayScorePerQ || 0.5;
  const isGiven = Boolean(studentAnswer && String(studentAnswer).trim().length > 0);
  return {
    earned: isGiven ? max : 0,
    max,
    isFullyCorrect: isGiven,
  };
}

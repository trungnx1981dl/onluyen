export type User = {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  name?: string;
};

export type QuestionType = 'MC' | 'TF' | 'SA' | 'ESSAY';

export type Question = {
  id: string;
  type: QuestionType;
  content: string; // supports KaTeX
  options?: string[]; // for MC and TF (TF has 4 options)
  answer: string;
  timeLimit: number;
};

export type Quiz = {
  id: string;
  title: string;
  subject?: string;
  createdBy: string;
  createdAt: number;
  questions: Question[];
};

export type SessionStatus = 'WAITING' | 'ACTIVE' | 'FINISHED';

export type GameSession = {
  id: string;
  quizId: string;
  hostId: string;
  status: SessionStatus;
  currentQuestionIndex: number;
  questionStartTime?: number;
  createdAt: number;
  questions?: Question[];
};

export type Player = {
  id: string;
  sessionId: string;
  name: string;
  score: number;
  answers: Record<string, string>; // questionId -> answer
};

export type PracticeResult = {
  id: string;
  quizId: string;
  playerName: string;
  playerClass: string;
  score: number;
  timeSpent: number;
  createdAt: number;
};

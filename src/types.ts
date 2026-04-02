export type QuestionType = 'true-false' | 'single-choice' | 'multiple-choice' | 'info';

export interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface MediaAsset {
  type: 'image' | 'video' | 'youtube';
  url: string;
  fileName?: string;
}

export interface MediaItem {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: 'admin' | 'user';
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options: Option[];
  media?: MediaAsset;
  explanation?: string;
  content?: string;
  isScenario?: boolean; // For 'info' type
  showScenario?: boolean; // For other types to show the last scenario
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  passingScore: number; // Percentage
  showImmediateFeedback?: boolean;
  encryptData?: boolean;
  enableScormDebug?: boolean;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

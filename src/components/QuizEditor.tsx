import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Plus, Trash2, Image as ImageIcon, Video, CheckCircle2, Circle, XCircle, Save, Download, Square, CheckSquare, Link as LinkIcon, RotateCcw, Library, GripVertical, Info, FileSpreadsheet, Undo, Redo, Search, FileText, Clipboard, ChevronDown, PlayCircle, BookOpen } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { Quiz, Question, QuestionType, Option, MediaItem } from '../types';
import { generateScorm2004 } from '../services/scormExport';
import { exportToMoodleXml, importFromMoodleXml } from '../services/moodleXml';
import { generateStandaloneHtml } from '../services/htmlExport';
import { generateUserManualDocx } from '../services/manualExport';
import { quizService } from '../services/quizService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QuizPlayer from './QuizPlayer';
import { UserAuth } from './UserAuth';
import { MediaLibrary } from './MediaLibrary';
import { useFirebase } from './FirebaseProvider';

const DEFAULT_VALUES = [
  'New Quiz',
  'Untitled Quiz',
  'Enter quiz description here...',
  'New Question',
  'New Information Block',
  'Instructions',
  'Option 1',
  'Option 2',
  'True',
  'False',
  'New Option',
  '80'
];

export default function QuizEditor() {
  const [quiz, setQuiz] = useState<Quiz>({
    id: uuidv4(),
    title: 'New Quiz',
    description: 'Enter quiz description here...',
    questions: [
      {
        id: uuidv4(),
        type: 'info',
        text: 'Instructions',
        content: `Welcome to the quiz!
To pass this quiz, you need a score of at least 80%. 
If you do not pass, you may retake the quiz as many times as you like.
You can use the arrow keys on your keyboard to navigate between questions:
- Right Arrow: Next question
- Left Arrow: Previous question`,
        options: [],
      }
    ],
    passingScore: 80,
    encryptData: true,
  });

  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [mediaInputType, setMediaInputType] = useState<'image' | 'video' | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isPreviewDropdownOpen, setIsPreviewDropdownOpen] = useState(false);
  const [previewStartIndex, setPreviewStartIndex] = useState(0);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [isQuizListOpen, setIsQuizListOpen] = useState(false);
  const [passingScoreInput, setPassingScoreInput] = useState(quiz.passingScore.toString());
  const [quizSearchQuery, setQuizSearchQuery] = useState('');
  const [userQuizzes, setUserQuizzes] = useState<Quiz[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedQuiz, setLastSavedQuiz] = useState<string>('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [newlyAddedOptionId, setNewlyAddedOptionId] = useState<string | null>(null);
  const [isBulkPasteOpen, setIsBulkPasteOpen] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');
  const bulkPasteRef = useRef<HTMLTextAreaElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    isDestructive?: boolean;
  } | null>(null);

  // Undo/Redo state
  const [history, setHistory] = useState<{ quiz: Quiz; activeQuestionId: string | null }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);

  const { user } = useFirebase();

  useEffect(() => {
    if (isBulkPasteOpen) {
      setTimeout(() => {
        bulkPasteRef.current?.focus();
      }, 100);
    }
  }, [isBulkPasteOpen]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openConfirm = (title: string, message: string, onConfirm: () => void, confirmText = 'Confirm', isDestructive = false) => {
    setConfirmModal({ title, message, onConfirm, confirmText, isDestructive });
  };

  // Resizing logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(240, Math.min(600, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Initialize lastSavedQuiz with the initial state to prevent autosaving the default quiz
  useEffect(() => {
    if (!lastSavedQuiz && quiz) {
      setLastSavedQuiz(JSON.stringify(quiz));
    }
  }, []);

  // Undo/Redo Logic
  useEffect(() => {
    if (history.length === 0) {
      setHistory([{ quiz: JSON.parse(JSON.stringify(quiz)), activeQuestionId }]);
      setHistoryIndex(0);
    }
  }, []);

  useEffect(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }

    const timer = setTimeout(() => {
      setHistory(prev => {
        const lastState = prev[historyIndex];
        if (lastState && JSON.stringify(lastState.quiz) === JSON.stringify(quiz)) {
          return prev;
        }

        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push({ quiz: JSON.parse(JSON.stringify(quiz)), activeQuestionId });
        if (newHistory.length > 50) newHistory.shift();
        const newIndex = newHistory.length - 1;
        setHistoryIndex(newIndex);
        return newHistory;
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [quiz, historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      isUndoRedoAction.current = true;
      const prevState = history[historyIndex - 1];
      setQuiz(JSON.parse(JSON.stringify(prevState.quiz)));
      setActiveQuestionId(prevState.activeQuestionId);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      isUndoRedoAction.current = true;
      const nextState = history[historyIndex + 1];
      setQuiz(JSON.parse(JSON.stringify(nextState.quiz)));
      setActiveQuestionId(nextState.activeQuestionId);
      setHistoryIndex(historyIndex + 1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  // Auto-save logic
  useEffect(() => {
    if (!user || quiz.questions.length === 0) return;

    const quizString = JSON.stringify(quiz);
    if (quizString === lastSavedQuiz) return;

    const timer = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        await quizService.saveQuiz(quiz);
        setLastSavedQuiz(quizString);
        setAutoSaveStatus('saved');
        // Reset status to idle after 3 seconds
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      } catch (error) {
        console.error('Auto-save failed:', error);
        setAutoSaveStatus('error');
      }
    }, 30000); // 30 seconds delay

    return () => clearTimeout(timer);
  }, [quiz, user, lastSavedQuiz]);

  useEffect(() => {
    if (user) {
      const unsubscribe = quizService.subscribeToUserQuizzes((quizzes) => {
        setUserQuizzes(quizzes);
      });
      return () => unsubscribe();
    } else {
      setUserQuizzes([]);
    }
  }, [user]);

  // Update Instructions block when passingScore changes
  useEffect(() => {
    const instructionsIndex = quiz.questions.findIndex(q => q.type === 'info' && q.text === 'Instructions');
    if (instructionsIndex !== -1) {
      const instructions = quiz.questions[instructionsIndex];
      const currentContent = instructions.content || '';
      const newContent = currentContent.replace(/at least \d+%/g, `at least ${quiz.passingScore}%`);
      
      if (newContent !== currentContent) {
        const newQuestions = [...quiz.questions];
        newQuestions[instructionsIndex] = { ...instructions, content: newContent };
        setQuiz(prev => ({ ...prev, questions: newQuestions }));
      }
    }
  }, [quiz.passingScore]);

  // Sync local passing score input state when quiz state changes externally
  useEffect(() => {
    if (quiz.passingScore.toString() !== passingScoreInput && !(quiz.passingScore === 0 && passingScoreInput === '')) {
      setPassingScoreInput(quiz.passingScore.toString());
    }
  }, [quiz.passingScore]);

  const startNewQuiz = () => {
    openConfirm(
      'Start New Quiz',
      'Are you sure you want to start a new quiz? Any unsaved changes will be lost.',
      () => {
        const newQuiz: Quiz = {
          id: uuidv4(),
          title: 'New Quiz',
          description: 'Enter quiz description here...',
          questions: [
            {
              id: uuidv4(),
              type: 'info',
              text: 'Instructions',
              content: `Welcome to the quiz! 
To pass this quiz, you need a score of at least 80%. 
If you do not pass, you may retake the quiz as many times as you like.
You can use the arrow keys on your keyboard to navigate between questions:
- Right Arrow: Next question
- Left Arrow: Previous question`,
              options: [],
            }
          ],
          passingScore: 80,
          encryptData: true,
        };
        setQuiz(newQuiz);
        setActiveQuestionId(null);
        setLastSavedQuiz(JSON.stringify(newQuiz));
        // Reset history
        setHistory([{ quiz: JSON.parse(JSON.stringify(newQuiz)), activeQuestionId: null }]);
        setHistoryIndex(0);
      },
      'Start New',
      true
    );
  };

  const normalizeQuiz = (q: any): Quiz => {
    const normalized: Quiz = {
      id: q.id || uuidv4(),
      title: q.title || 'New Quiz',
      description: q.description || '',
      questions: Array.isArray(q.questions) ? q.questions.map((question: any) => {
        const normalizedQuestion: Question = {
          id: question.id || uuidv4(),
          type: (['true-false', 'single-choice', 'multiple-choice', 'info'].includes(question.type) 
            ? question.type 
            : 'single-choice') as QuestionType,
          text: question.text || '',
          options: Array.isArray(question.options) ? question.options.map((option: any) => ({
            id: option.id || uuidv4(),
            text: option.text || '',
            isCorrect: !!option.isCorrect
          })) : [],
          media: question.media,
          explanation: question.explanation,
          content: question.content,
          isScenario: !!question.isScenario,
          showScenario: !!question.showScenario
        };

        // Ensure at least one correct option for non-info questions
        if (normalizedQuestion.type !== 'info' && normalizedQuestion.options.length > 0) {
          const hasCorrect = normalizedQuestion.options.some(o => o.isCorrect);
          if (!hasCorrect) {
            normalizedQuestion.options[0].isCorrect = true;
          }
          // For single-choice, ensure only one is correct
          if (normalizedQuestion.type === 'single-choice' || normalizedQuestion.type === 'true-false') {
            const firstCorrectIdx = normalizedQuestion.options.findIndex(o => o.isCorrect);
            normalizedQuestion.options = normalizedQuestion.options.map((o, idx) => ({
              ...o,
              isCorrect: idx === firstCorrectIdx
            }));
          }
        }

        return normalizedQuestion;
      }) : [],
      passingScore: typeof q.passingScore === 'number' ? q.passingScore : 80,
      showImmediateFeedback: !!q.showImmediateFeedback,
      encryptData: q.encryptData !== undefined ? !!q.encryptData : true,
      enableScormDebug: !!q.enableScormDebug,
      userId: q.userId,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt
    };
    return normalized;
  };

  const validateQuiz = () => {
    const errors: string[] = [];
    
    if (quiz.questions.length === 0) {
      errors.push('Quiz must have at least one question.');
    }

    quiz.questions.forEach((q, idx) => {
      const isInfo = q.type === 'info';
      const qNum = quiz.questions.slice(0, idx).filter(prevQ => prevQ.type !== 'info').length + 1;
      
      if (isInfo) return;

      if ((q.type === 'single-choice' || q.type === 'multiple-choice') && q.options.length < 2) {
        errors.push(`Question ${qNum} must have at least two options.`);
      }

      q.options.forEach((opt, optIdx) => {
        if (!opt.text.trim()) {
          errors.push(`Question ${qNum}, Option ${optIdx + 1} must have text.`);
        }
      });

      const hasCorrect = q.options.some(opt => opt.isCorrect);
      if (!hasCorrect) {
        errors.push(`Question ${qNum} must have at least one correct option.`);
      }
    });

    return errors;
  };

  const checkValidation = () => {
    const errors = validateQuiz();
    if (errors.length > 0) {
      // Show first 3 errors to avoid overwhelming
      errors.slice(0, 3).forEach(err => showToast(err, 'error'));
      if (errors.length > 3) {
        showToast(`...and ${errors.length - 3} more errors.`, 'error');
      }
      return false;
    }
    return true;
  };

  const handlePreview = (startIndex: number = 0) => {
    if (checkValidation()) {
      setPreviewStartIndex(startIndex);
      setIsPreviewMode(true);
      setIsPreviewDropdownOpen(false);
    }
  };

  const handleSaveToCloud = async () => {
    if (!user) {
      showToast('Please sign in to save your quiz to the cloud.', 'info');
      return;
    }
    
    if (!checkValidation()) return;

    setIsSaving(true);
    try {
      await quizService.saveQuiz(quiz);
      setLastSavedQuiz(JSON.stringify(quiz));
      showToast('Quiz saved successfully!');
    } catch (error) {
      console.error('Failed to save quiz:', error);
      showToast('Failed to save quiz. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (activeQuestionId) {
      const element = document.getElementById(`question-item-${activeQuestionId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeQuestionId]);

  const handleReorder = (newQuestions: Question[]) => {
    setQuiz({ ...quiz, questions: newQuestions });
  };

  const addQuestion = (type: QuestionType) => {
    const newQuestion: Question = {
      id: uuidv4(),
      type,
      text: type === 'info' ? 'New Information Block' : 'New Question',
      options: type === 'true-false' 
        ? [
            { id: uuidv4(), text: 'True', isCorrect: false },
            { id: uuidv4(), text: 'False', isCorrect: false }
          ]
        : type === 'info'
        ? []
        : [
            { id: uuidv4(), text: 'Option 1', isCorrect: false },
            { id: uuidv4(), text: 'Option 2', isCorrect: false }
          ],
    };

    setQuiz(prev => {
      const activeIdx = prev.questions.findIndex(q => q.id === activeQuestionId);
      if (activeIdx !== -1) {
        const newQuestions = [...prev.questions];
        newQuestions.splice(activeIdx + 1, 0, newQuestion);
        return { ...prev, questions: newQuestions };
      }
      return { ...prev, questions: [...prev.questions, newQuestion] };
    });
    setActiveQuestionId(newQuestion.id);
  };

  const addInstructions = () => {
    const newQuestion: Question = {
      id: uuidv4(),
      type: 'info',
      text: 'Instructions',
      content: `Welcome to the quiz! 
To pass this quiz, you need a score of at least ${quiz.passingScore}%. 
If you do not pass, you may retake the quiz as many times as you like.
You can use the arrow keys on your keyboard to navigate between questions:
- Right Arrow: Next question
- Left Arrow: Previous question`,
      options: [],
    };

    setQuiz(prev => {
      const activeIdx = prev.questions.findIndex(q => q.id === activeQuestionId);
      if (activeIdx !== -1) {
        const newQuestions = [...prev.questions];
        newQuestions.splice(activeIdx + 1, 0, newQuestion);
        return { ...prev, questions: newQuestions };
      }
      return { ...prev, questions: [newQuestion, ...prev.questions] };
    });
    setActiveQuestionId(newQuestion.id);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuiz(prev => ({
      ...prev,
      questions: prev.questions.map(q => q.id === id ? { ...q, ...updates } : q)
    }));
  };

  const handleBulkPaste = () => {
    const activeQuestion = quiz.questions.find(q => q.id === activeQuestionId);
    if (!activeQuestion || !bulkPasteText) return;

    const rawLines = bulkPasteText.split('\n');
    const isFirstLineEmpty = rawLines.length > 0 && rawLines[0].trim() === '';
    const lines = rawLines.map(l => l.trim()).filter(l => l.length > 0);
    
    if (lines.length === 0) return;

    let questionText = '';
    const options: Option[] = [];

    // Regex for option prefixes: A., B., 1., a), etc.
    const optionPrefixRegex = /^\s*(?:[A-Z]|[0-9]+)[\.\)\:]\s*/i;
    const questionPrefixRegex = /^\s*(?:Question\s+|Q)?\d+[\.\)\:]\s*/i;

    const processOptionLine = (line: string): { text: string; isCorrect: boolean } => {
      let isCorrect = false;
      let processedLine = line;
      
      // Check for asterisk at the very beginning
      if (processedLine.startsWith('*')) {
        isCorrect = true;
        processedLine = processedLine.substring(1).trim();
      }
      
      // Strip prefix
      let optText = processedLine.replace(optionPrefixRegex, '');
      
      // Check for asterisk after prefix if not already found
      if (!isCorrect && optText.startsWith('*')) {
        isCorrect = true;
        optText = optText.substring(1).trim();
      }
      
      return { text: optText, isCorrect };
    };

    if (isFirstLineEmpty) {
      // User explicitly left first line blank, so no question text
      for (const line of lines) {
        const { text, isCorrect } = processOptionLine(line);
        options.push({ id: uuidv4(), text, isCorrect });
      }
    } else {
      // First line is populated, so it (or the first few lines) is the question
      let firstOptionIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (optionPrefixRegex.test(lines[i])) {
          firstOptionIndex = i;
          break;
        }
      }

      if (firstOptionIndex === -1) {
        // No prefixes found, assume first line is question, rest are options
        questionText = lines[0].replace(questionPrefixRegex, '');
        for (let i = 1; i < lines.length; i++) {
          const { text, isCorrect } = processOptionLine(lines[i]);
          options.push({ id: uuidv4(), text, isCorrect });
        }
      } else if (firstOptionIndex === 0) {
        // First line has a prefix but user said first line is question if populated
        questionText = lines[0].replace(questionPrefixRegex, '');
        for (let i = 1; i < lines.length; i++) {
          const { text, isCorrect } = processOptionLine(lines[i]);
          options.push({ id: uuidv4(), text, isCorrect });
        }
      } else {
        // Everything before firstOptionIndex is question text
        questionText = lines.slice(0, firstOptionIndex).join(' ').replace(questionPrefixRegex, '');
        
        // Everything from firstOptionIndex onwards are options
        for (let i = firstOptionIndex; i < lines.length; i++) {
          const { text, isCorrect } = processOptionLine(lines[i]);
          options.push({ id: uuidv4(), text, isCorrect });
        }
      }
    }

    // Handle single-choice constraint
    const correctCount = options.filter(o => o.isCorrect).length;
    if (activeQuestion.type === 'single-choice' && correctCount > 1) {
      let firstFound = false;
      options.forEach(o => {
        if (o.isCorrect) {
          if (!firstFound) {
            firstFound = true;
          } else {
            o.isCorrect = false;
          }
        }
      });
      showToast('Multiple correct answers detected for a single-answer question. Only the first one was marked.', 'info');
    }

    const updates: Partial<Question> = {};
    if (questionText) updates.text = questionText;
    if (options.length > 0) updates.options = options;

    updateQuestion(activeQuestion.id, updates);
    setIsBulkPasteOpen(false);
    setBulkPasteText('');
    showToast('Question parsed successfully!');
  };

  const deleteQuestion = (id: string) => {
    setQuiz(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== id)
    }));
    if (activeQuestionId === id) setActiveQuestionId(null);
  };

  const getQuestionNumber = (idx: number) => {
    const q = quiz.questions[idx];
    if (q.type === 'info') return null;
    return quiz.questions.slice(0, idx).filter(prevQ => prevQ.type !== 'info').length + 1;
  };

  const handleExportScorm = async () => {
    if (!checkValidation()) return;
    const blob = await generateScorm2004(quiz);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quiz.title.replace(/\s+/g, '_')}_SCORM2004.zip`;
    a.click();
  };

  const handleShareQuiz = async () => {
    if (!user) {
      showToast('Please sign in to share your quiz.', 'info');
      return;
    }

    if (!checkValidation()) return;

    try {
      setIsSaving(true);
      await quizService.saveQuiz(quiz);
      const shareUrl = `${window.location.origin}/?quizId=${quiz.id}`;
      await navigator.clipboard.writeText(shareUrl);
      showToast('Quiz link copied to clipboard!');
    } catch (error) {
      console.error('Failed to share quiz:', error);
      showToast('Failed to share quiz. Please make sure your quiz is saved.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportMoodle = () => {
    if (!checkValidation()) return;
    try {
      const xml = exportToMoodleXml(quiz);
      const blob = new Blob([xml], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quiz.title.replace(/\s+/g, '_')}_quiz.xml`;
      a.click();
      showToast('Quiz exported to XML successfully.', 'success');
    } catch (error) {
      console.error('XML Export Error:', error);
      showToast('Failed to export quiz to XML. Check console for details.', 'error');
    }
  };

  const handleImportMoodle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const importedQuiz = normalizeQuiz(importFromMoodleXml(content));
        setQuiz(importedQuiz);
        if (importedQuiz.questions.length > 0) {
          setActiveQuestionId(importedQuiz.questions[0].id);
        }
        showToast(`Successfully imported ${importedQuiz.questions.length} questions.`);
      } catch (error) {
        console.error('Failed to import Moodle XML:', error);
        showToast('Failed to import Moodle XML. Please check the file format.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleExportCsv = () => {
    if (!checkValidation()) return;
    const sanitize = (str: string | undefined) => {
      if (!str) return '';
      // Remove non-printable control characters except common whitespace
      return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    };

    const maxOptions = Math.max(...quiz.questions.map(q => q.options.length), 4);

    const csvData = quiz.questions.map((q, idx) => {
      const row: any = {
        'Order Number': idx + 1,
        'Question Type': q.type === 'multiple-choice' ? 'Multiple Answer Multiple Choice' : 
                         q.type === 'true-false' ? 'True / False' : 
                         q.type === 'info' ? 'Information Block' :
                         'Single Answer Multiple Choice',
        'Question Text': sanitize(q.text),
        'Information Content': sanitize(q.content || ''),
        'Answer Explanation': sanitize(q.explanation || ''),
      };

      // Add all available answers
      for (let i = 0; i < maxOptions; i++) {
        row[`Answer ${i + 1}`] = sanitize(q.options[i]?.text || '');
      }

      // Correct Answer indices (1-based)
      const correctIndices = q.options
        .map((opt, i) => opt.isCorrect ? i + 1 : -1)
        .filter(i => i !== -1);
      
      row['Correct Answer'] = correctIndices.join(',');

      return row;
    });

    const csv = Papa.unparse(csvData);
    // Add UTF-8 BOM (\uFEFF) to ensure Excel and other tools recognize UTF-8 encoding
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quiz.title.replace(/\s+/g, '_')}_questions.csv`;
    a.click();
  };

  const handleExportStoryline = () => {
    if (!checkValidation()) return;
    const sanitize = (str: string | undefined) => {
      if (!str) return '';
      // Preserve \n (10) and \r (13), remove other control characters
      return str.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
    };

    // Filter out info blocks
    const questions = quiz.questions.filter(q => q.type !== 'info');

    const data = questions.map((q) => {
      let typeCode = 'MC'; // Default to Single Choice
      if (q.type === 'true-false') typeCode = 'TF';
      else if (q.type === 'multiple-choice') typeCode = 'MR';

      const row: any = {
        '//Question Type': typeCode,
        '//Points': 1,
        '//Question Text': sanitize(q.text),
      };

      // Add up to 10 answer choices
      for (let i = 0; i < 10; i++) {
        const option = q.options[i];
        let choiceText = '';
        if (option) {
          choiceText = sanitize(option.text);
          if (option.isCorrect) {
            choiceText = '*' + choiceText;
          }
        }
        row[`//Answer Choice ${i + 1}`] = choiceText;
      }

      return row;
    });

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Attempt to set wrap text for all cells (may not work in community version of xlsx, but harmless)
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = { c: C, r: R };
        const cell_ref = XLSX.utils.encode_cell(cell_address);
        if (!ws[cell_ref]) continue;
        if (!ws[cell_ref].s) ws[cell_ref].s = {};
        ws[cell_ref].s.alignment = { wrapText: true, vertical: 'top' };
      }
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");

    // Save file
    XLSX.writeFile(wb, `${quiz.title.replace(/\s+/g, '_')}_storyline.xlsx`);
  };

  const handleExportStorylineCsv = () => {
    if (!checkValidation()) return;
    const sanitize = (str: string | undefined) => {
      if (!str) return '';
      // Preserve \n (10) and \r (13), remove other control characters
      return str.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
    };

    // Filter out info blocks
    const questions = quiz.questions.filter(q => q.type !== 'info');

    const data = questions.map((q) => {
      let typeCode = 'MC'; // Default to Single Choice
      if (q.type === 'true-false') typeCode = 'TF';
      else if (q.type === 'multiple-choice') typeCode = 'MR';

      const row: any = {
        '//Question Type': typeCode,
        '//Points': 1,
        '//Question Text': sanitize(q.text),
      };

      // Add up to 10 answer choices
      for (let i = 0; i < 10; i++) {
        const option = q.options[i];
        let choiceText = '';
        if (option) {
          choiceText = sanitize(option.text);
          if (option.isCorrect) {
            choiceText = '*' + choiceText;
          }
        }
        row[`//Answer Choice ${i + 1}`] = choiceText;
      }

      return row;
    });

    const csv = Papa.unparse(data);
    // Add UTF-8 BOM (\uFEFF) to ensure Excel and other tools recognize UTF-8 encoding
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${quiz.title.replace(/\s+/g, '_')}_storyline.csv`);
  };

  const handleExportHtmlAnswerKey = () => {
    if (!checkValidation()) return;

    const escapeHtml = (text: string) => {
      if (!text) return '';
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>');
    };

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(quiz.title)} - Answer Key</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #334155;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background-color: #f8fafc;
        }
        .container {
            background-color: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        h1 {
            color: #1e293b;
            text-align: center;
            margin-bottom: 8px;
            font-size: 2.5rem;
        }
        .description {
            text-align: center;
            color: #64748b;
            margin-bottom: 32px;
            font-size: 1.1rem;
        }
        .instructions {
            text-align: center;
            font-weight: bold;
            color: #059669;
            background-color: #ecfdf5;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 48px;
        }
        .question-item {
            margin-bottom: 40px;
            padding-bottom: 40px;
            border-bottom: 1px solid #e2e8f0;
        }
        .question-item:last-child {
            border-bottom: none;
        }
        .question-header {
            display: flex;
            gap: 12px;
            margin-bottom: 16px;
        }
        .question-number {
            font-weight: bold;
            color: #2563eb;
            font-size: 1.2rem;
            min-width: 24px;
        }
        .question-text {
            font-weight: bold;
            color: #1e293b;
            font-size: 1.2rem;
        }
        .info-block {
            background-color: #eff6ff;
            border-left: 4px solid #2563eb;
            padding: 20px;
            border-radius: 0 8px 8px 0;
            margin-bottom: 24px;
        }
        .info-title {
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 8px;
            font-size: 1.1rem;
        }
        .media-container {
            margin: 20px 0;
            text-align: center;
        }
        .media-container img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgb(0 0 0 / 0.1);
        }
        .options-list {
            list-style: none;
            padding: 0;
            margin-left: 36px;
        }
        .option-item {
            padding: 8px 12px;
            margin-bottom: 4px;
            border-radius: 6px;
        }
        .option-correct {
            background-color: #ecfdf5;
            color: #065f46;
            font-weight: bold;
            border: 1px solid #10b981;
        }
        .explanation {
            margin-top: 16px;
            margin-left: 36px;
            padding: 12px;
            background-color: #fefce8;
            border-radius: 8px;
            font-style: italic;
            color: #854d0e;
        }
        .explanation-label {
            font-weight: bold;
            margin-right: 4px;
        }
        @media print {
            body {
                background-color: white;
                padding: 0;
            }
            .container {
                box-shadow: none;
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${escapeHtml(quiz.title)}</h1>
        <div class="description">${escapeHtml(quiz.description)}</div>
        <div class="instructions">Highlighted options (marked with an asterisk *) are the correct answers.</div>

        <div class="questions-container">`;

    let questionCounter = 0;
    quiz.questions.forEach((q) => {
      if (q.type === 'info') {
        html += `
            <div class="question-item">
                <div class="info-block">
                    <div class="info-title">Information Block: ${escapeHtml(q.text)}</div>
                    <div class="info-content">${escapeHtml(q.content || '')}</div>
                </div>`;
        if (q.media && q.media.type === 'image') {
          html += `
                <div class="media-container">
                    <img src="${q.media.url}" alt="Information Image">
                </div>`;
        }
        html += `</div>`;
        return;
      }

      questionCounter++;
      html += `
            <div class="question-item">
                <div class="question-header">
                    <span class="question-number">${questionCounter}.</span>
                    <span class="question-text">${escapeHtml(q.text)}</span>
                </div>`;

      if (q.media && q.media.type === 'image') {
        html += `
                <div class="media-container">
                    <img src="${q.media.url}" alt="Question Image">
                </div>`;
      }

      html += `<ul class="options-list">`;
      q.options.forEach((opt) => {
        const isCorrect = opt.isCorrect;
        html += `
                    <li class="option-item ${isCorrect ? 'option-correct' : ''}">
                        ${isCorrect ? '* ' : ''}${escapeHtml(opt.text)}
                    </li>`;
      });
      html += `</ul>`;

      if (q.explanation) {
        html += `
                <div class="explanation">
                    <span class="explanation-label">Explanation:</span>
                    ${escapeHtml(q.explanation)}
                </div>`;
      }

      html += `</div>`;
    });

    html += `
        </div>
    </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    saveAs(blob, `${quiz.title.replace(/\s+/g, '_')}_Answer_Key.html`);
  };

  const handleDownloadImportGuidePdf = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('QuizBuilder Pro: CSV Import Guide', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text('This guide explains how to format your CSV files for importing questions.', 14, 30);
    
    // Section 1: Required Headers
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('1. Required Column Headers', 14, 45);
    
    autoTable(doc, {
      startY: 50,
      head: [['Header Name', 'Required?', 'Description']],
      body: [
        ['Order Number', 'Optional', 'The sequence of the question (e.g., 1, 2, 3).'],
        ['Question Type', 'Optional', 'The type of question (see inference below).'],
        ['Question Text', 'Yes', 'The main question or heading text. (Also accepts "Title")'],
        ['Information Content', 'Optional', 'Extra text used only for "Information Blocks".'],
        ['Answer Explanation', 'Optional', 'Text shown to the user after they answer.'],
        ['Answer 1', 'Optional', 'Text for the first option. (Also accepts "Choice 1")'],
        ['Answer 2', 'Optional', 'Text for the second option. (Also accepts "Choice 2")'],
        ['Answer X', 'Optional', 'Add as many columns as needed (Answer 3, 4, etc.).'],
        ['Correct Answer', 'Yes*', '1-based index of the correct choice(s).'],
      ],
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }, // indigo-600
    });
    
    const finalY = (doc as any).lastAutoTable.finalY;
    
    // Section 2: Inference
    doc.setFontSize(14);
    doc.text('2. Automatic Type Inference', 14, finalY + 15);
    doc.setFontSize(11);
    const inferenceText = [
      'If you leave the Question Type column blank, the system will guess the type:',
      '• True / False: Detected if Answer 1 (or Choice 1) is "True" and Answer 2 (or Choice 2) is "False".',
      '• Multiple Answer: Detected if Correct Answer contains multiple values (e.g., 1,3).',
      '• Information Block: Detected if no answers but Information Content exists.',
      '• Single Answer: The default fallback for standard questions.'
    ];
    doc.text(inferenceText, 14, finalY + 22);
    
    // Section 3: Correct Answer
    doc.setFontSize(14);
    doc.text('3. Correct Answer Formatting', 14, finalY + 55);
    doc.setFontSize(11);
    const formatText = [
      'The Correct Answer column uses 1-based indices:',
      '• Single Choice: Enter a single number (e.g., 2).',
      '• Multiple Choice: Enter numbers separated by commas (e.g., 1,3).',
      '• True / False: Use 1 for True and 2 for False.'
    ];
    doc.text(formatText, 14, finalY + 62);
    
    // Section 4: Advanced Features
    doc.setFontSize(14);
    doc.text('4. Advanced Features', 14, finalY + 90);
    doc.setFontSize(11);
    const advancedText = [
      '• Flexible Headers: Use "Choice 1" instead of "Answer 1" or "Title" instead of "Question Text".',
      '• Dynamic Answers: Add columns up to Answer 10, 20, etc. as needed.',
      '• Auto Naming: The CSV filename is used as the Quiz Title if it is still "New Quiz".'
    ];
    doc.text(advancedText, 14, finalY + 97);
    
    doc.save('QuizBuilder_Pro_CSV_Import_Guide.pdf');
  };

  const handleExportHtml = () => {
    if (!checkValidation()) return;
    const html = generateStandaloneHtml(quiz);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quiz.title.replace(/\s+/g, '_')}.html`;
    a.click();
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.replace(/\.[^/.]+$/, "");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const importedQuestions: Question[] = results.data.map((row: any) => {
            // Dynamically find all "Answer X" or "Choice X" columns
            const answerKeys = Object.keys(row)
              .filter(key => (key.startsWith('Answer ') || key.startsWith('Choice ')) && !isNaN(parseInt(key.replace(/Answer |Choice /, ''))))
              .sort((a, b) => {
                const numA = parseInt(a.replace(/Answer |Choice /, ''));
                const numB = parseInt(b.replace(/Answer |Choice /, ''));
                return numA - numB;
              });
            
            const answers = answerKeys.map(key => row[key]).filter(val => val !== undefined && val !== null && String(val).trim() !== '');
            
            const correctAnswersStr = String(row['Correct Answer'] || '');
            const correctIndices = correctAnswersStr.split(/[;,]/).map(s => parseInt(s.trim()) - 1).filter(n => !isNaN(n));

            const typeStr = (row['Question Type'] || '').toLowerCase();
            let type: QuestionType = 'single-choice';
            
            if (typeStr.includes('multiple answer')) {
              type = 'multiple-choice';
            } else if (typeStr.includes('true / false')) {
              type = 'true-false';
            } else if (typeStr.includes('information')) {
              type = 'info';
            } else if (!typeStr) {
              // Inference logic
              const ans1 = String(row['Answer 1'] || row['Choice 1'] || '').toLowerCase().trim();
              const ans2 = String(row['Answer 2'] || row['Choice 2'] || '').toLowerCase().trim();
              
              if ((ans1 === 'true' && ans2 === 'false') || (ans1 === 'false' && ans2 === 'true')) {
                type = 'true-false';
              } else if (correctIndices.length > 1) {
                type = 'multiple-choice';
              } else if (answers.length === 0 && row['Information Content']) {
                type = 'info';
              } else {
                type = 'single-choice';
              }
            }

            const options: Option[] = [];
            answers.forEach((text, idx) => {
              let optionText = String(text).trim();
              if (type === 'true-false') {
                if (optionText.toLowerCase() === 'true') optionText = 'True';
                if (optionText.toLowerCase() === 'false') optionText = 'False';
              }
              options.push({
                id: uuidv4(),
                text: optionText,
                isCorrect: correctIndices.includes(idx)
              });
            });

            // Fallback for True/False if answers are missing but it's marked as T/F
            if (type === 'true-false' && options.length === 0) {
              options.push({ id: uuidv4(), text: 'True', isCorrect: correctIndices.includes(0) });
              options.push({ id: uuidv4(), text: 'False', isCorrect: correctIndices.includes(1) });
            }

            return {
              id: uuidv4(),
              type,
              text: row['Question Text'] || row['Title'] || 'New Question',
              content: row['Information Content'] || undefined,
              explanation: row['Answer Explanation'] || undefined,
              options,
              orderNumber: parseInt(row['Order Number']) || 0
            };
          });

          // Sort by order number
          importedQuestions.sort((a, b) => (a as any).orderNumber - (b as any).orderNumber);

          setQuiz(prev => normalizeQuiz({
            ...prev,
            title: prev.title === 'New Quiz' ? fileName : prev.title,
            questions: [...prev.questions, ...importedQuestions]
          }));

          if (importedQuestions.length > 0 && !activeQuestionId) {
            setActiveQuestionId(importedQuestions[0].id);
          }
          
          showToast(`Successfully imported ${importedQuestions.length} questions.`);
        } catch (error) {
          console.error('Failed to parse CSV:', error);
          showToast('Failed to parse CSV. Please check the file format and column headers.', 'error');
        }
      },
      error: (error) => {
        console.error('CSV Parsing Error:', error);
        showToast('Error reading CSV file.', 'error');
      }
    });
  };

  const activeQuestion = quiz.questions.find(q => q.id === activeQuestionId);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target;
    if (DEFAULT_VALUES.includes(target.value.trim())) {
      setTimeout(() => target.select(), 0);
    }
  };

  const handleMarkdownShortcut = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    value: string,
    updateFn: (newValue: string) => void
  ) => {
    const isModKey = e.metaKey || e.ctrlKey;
    
    // Bold and Italics
    if (isModKey && (e.key === 'b' || e.key === 'i')) {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const selectedText = value.substring(start, end);
      const symbol = e.key === 'b' ? '**' : '*';
      
      const isWrapped = selectedText.startsWith(symbol) && selectedText.endsWith(symbol);
      
      let newText: string;
      let newStart: number;
      let newEnd: number;

      if (selectedText.length === 0) {
        newText = value.substring(0, start) + symbol + symbol + value.substring(end);
        newStart = newEnd = start + symbol.length;
      } else if (isWrapped) {
        const unwrapped = selectedText.substring(symbol.length, selectedText.length - symbol.length);
        newText = value.substring(0, start) + unwrapped + value.substring(end);
        newStart = start;
        newEnd = start + unwrapped.length;
      } else {
        newText = value.substring(0, start) + symbol + selectedText + symbol + value.substring(end);
        newStart = start;
        newEnd = end + (symbol.length * 2);
      }

      updateFn(newText);
      
      setTimeout(() => {
        target.selectionStart = newStart;
        target.selectionEnd = newEnd;
      }, 0);
    }

    // Hyperlink
    if (isModKey && e.key === 'k') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const selectedText = value.substring(start, end);
      
      let newText: string;
      let newStart: number;
      let newEnd: number;

      if (selectedText.length === 0) {
        newText = value.substring(0, start) + "[](https://)" + value.substring(end);
        newStart = start + 1; // Inside []
        newEnd = start + 1;
      } else {
        newText = value.substring(0, start) + "[" + selectedText + "](https://)" + value.substring(end);
        newStart = start + selectedText.length + 3; // Start of https://
        newEnd = start + selectedText.length + 11; // End of https://
      }

      updateFn(newText);
      
      setTimeout(() => {
        target.selectionStart = newStart;
        target.selectionEnd = newEnd;
      }, 0);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar: Question List */}
      <aside 
        style={{ width: sidebarWidth }}
        className="border-r border-slate-200 bg-white flex flex-col relative" 
        aria-label="Question list"
      >
        {/* Resizer Handle */}
        <div
          onMouseDown={() => setIsResizing(true)}
          className={`absolute top-0 -right-1 w-2 h-full cursor-col-resize z-10 transition-colors hover:bg-indigo-400/30 ${isResizing ? 'bg-indigo-400/50' : ''}`}
          aria-hidden="true"
        />
        <div className="p-4 border-b border-slate-100 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <UserAuth />
            <div className="flex gap-1">
              <button
                onClick={undo}
                disabled={historyIndex <= 0}
                aria-label="Undo"
                className="flex items-center justify-center p-2 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-30"
                title="Undo (Ctrl+Z)"
              >
                <Undo size={16} aria-hidden="true" />
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                aria-label="Redo"
                className="flex items-center justify-center p-2 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-30"
                title="Redo (Ctrl+Y)"
              >
                <Redo size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={startNewQuiz}
              aria-label="Start a new quiz"
              className="flex items-center justify-center gap-2 p-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            >
              <Plus size={14} aria-hidden="true" /> New
            </button>
            <button
              onClick={() => setIsQuizListOpen(true)}
              disabled={!user}
              aria-label="Open an existing quiz"
              className="flex items-center justify-center gap-2 p-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all disabled:opacity-50"
            >
              <Library size={14} aria-hidden="true" /> Open
            </button>
          </div>
        </div>
        <div className="p-3 px-4 border-b border-slate-100">
          <input
            className="text-lg font-bold w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 py-0.5"
            value={quiz.title}
            onChange={e => setQuiz({ ...quiz, title: e.target.value })}
            onFocus={handleFocus}
            aria-label="Quiz Title"
          />
          <textarea
            className="mt-0.5 text-xs text-slate-500 w-full resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 py-0.5"
            value={quiz.description}
            onChange={e => setQuiz({ ...quiz, description: e.target.value })}
            onFocus={handleFocus}
            aria-label="Quiz Description"
            rows={1}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <Reorder.Group axis="y" values={quiz.questions} onReorder={handleReorder} className="space-y-2" as="ul">
            <AnimatePresence initial={false}>
              {quiz.questions.map((q, idx) => (
                <Reorder.Item
                  key={q.id}
                  id={`question-item-${q.id}`}
                  value={q}
                  as="li"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onClick={() => setActiveQuestionId(q.id)}
                  aria-label={`${q.type === 'info' ? 'Information Block' : `Question ${getQuestionNumber(idx)}`}: ${q.text}`}
                  className={`p-3 pr-4 rounded-lg cursor-pointer flex items-start justify-between group border transition-all ${
                    q.showScenario ? 'ml-6 border-l-2 border-l-amber-300' : ''
                  } ${
                    activeQuestionId === q.id 
                      ? (q.type === 'info' && q.isScenario ? 'bg-amber-50 border-amber-300 shadow-sm' : 'bg-indigo-50 border-indigo-200 shadow-sm') 
                      : (q.type === 'info' && q.isScenario ? 'bg-amber-50/40 border-amber-100 hover:bg-amber-50' : 'bg-white border-transparent hover:bg-slate-50')
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  whileDrag={{ 
                    scale: 1.02,
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                    backgroundColor: "white",
                    zIndex: 50
                  }}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0 mr-2">
                    <div className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-slate-100 rounded transition-colors mt-0.5" aria-hidden="true">
                      <GripVertical className="text-slate-400" size={16} />
                    </div>
                    <span className="text-xs font-mono text-slate-500 select-none mt-1.5" aria-hidden="true">
                      {q.type === 'info' ? (
                        q.isScenario ? <BookOpen size={12} className="mt-0.5 text-amber-600" /> : <Info size={12} className="mt-0.5" />
                      ) : getQuestionNumber(idx)}
                    </span>
                    <span className="text-sm font-medium flex-1 select-none break-words whitespace-pre-wrap py-0.5">
                      {q.text.length > 60 ? q.text.substring(0, 60) + '...' : q.text}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteQuestion(q.id); }}
                    aria-label={`Delete question ${idx + 1}`}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity focus:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        </div>

        <div className="p-4 border-t border-slate-100 space-y-2">
          <div className="grid grid-cols-1 gap-2">
            <button onClick={() => addQuestion('true-false')} className="flex items-center gap-2 w-full p-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors">
              <Plus size={16} /> True / False
            </button>
            <button onClick={() => addQuestion('single-choice')} className="flex items-center gap-2 w-full p-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors">
              <Plus size={16} /> Single Answer Multiple Choice
            </button>
            <button onClick={() => addQuestion('multiple-choice')} className="flex items-center gap-2 w-full p-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors">
              <Plus size={16} /> Multiple Answer Multiple Choice
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => addQuestion('info')} className="flex items-center gap-2 w-full p-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors">
                <Plus size={14} /> Info Block
              </button>
              <button onClick={addInstructions} className="flex items-center gap-2 w-full p-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors">
                <Info size={14} /> Add Instructions
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content: Question Editor */}
      <main className="flex-1 overflow-y-auto bg-slate-50 p-12" aria-label="Question editor">
        {activeQuestion ? (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="glass-panel rounded-2xl p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-400 mb-0.5">Question Type</span>
                    <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                      {activeQuestion.type === 'single-choice' ? 'Single Answer' : 
                       activeQuestion.type === 'multiple-choice' ? 'Multiple Answer' : 
                       activeQuestion.type === 'info' ? 'Information Block' :
                       'True / False'}
                    </span>
                  </div>
                  {(activeQuestion.type === 'single-choice' || activeQuestion.type === 'multiple-choice') && (
                    <button
                      onClick={() => {
                        if (activeQuestion.type === 'single-choice') {
                          updateQuestion(activeQuestion.id, { type: 'multiple-choice' });
                          showToast('Converted to Multiple Answer question.', 'info');
                        } else {
                          const firstCorrectIdx = activeQuestion.options.findIndex(o => o.isCorrect);
                          const newOptions = activeQuestion.options.map((o, idx) => ({
                            ...o,
                            isCorrect: idx === firstCorrectIdx
                          }));
                          updateQuestion(activeQuestion.id, { type: 'single-choice', options: newOptions });
                          showToast('Converted to Single Answer question.', 'info');
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 rounded-lg text-xs font-bold transition-all shadow-sm"
                      title={`Convert to ${activeQuestion.type === 'single-choice' ? 'Multiple' : 'Single'} Answer`}
                    >
                      <RotateCcw size={14} />
                      Switch Type
                    </button>
                  )}
                  {activeQuestion.type === 'info' ? (
                    <button
                      onClick={() => updateQuestion(activeQuestion.id, { isScenario: !activeQuestion.isScenario })}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm border ${
                        activeQuestion.isScenario 
                          ? 'bg-amber-50 text-amber-700 border-amber-200' 
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200'
                      }`}
                      title="Mark as a scenario that can be referenced in later questions"
                    >
                      <BookOpen size={14} />
                      {activeQuestion.isScenario ? 'Scenario Block' : 'Mark as Scenario'}
                    </button>
                  ) : (
                    <button
                      onClick={() => updateQuestion(activeQuestion.id, { showScenario: !activeQuestion.showScenario })}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm border ${
                        activeQuestion.showScenario 
                          ? 'bg-amber-50 text-amber-700 border-amber-200' 
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200'
                      }`}
                      title="Show the most recent scenario block at the top of this question"
                    >
                      <BookOpen size={14} />
                      {activeQuestion.showScenario ? 'Showing Scenario' : 'Reference Scenario'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {activeQuestion.type !== 'info' && (
                    <button 
                      onClick={() => setIsBulkPasteOpen(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 rounded-lg text-xs font-bold transition-all shadow-sm"
                      aria-label="Smart Paste"
                    >
                      <Clipboard size={14} />
                      Smart Paste
                    </button>
                  )}
                  <div className="w-px h-6 bg-slate-200 mx-1" />
                  <div className="relative">
                    <button 
                      onClick={() => setMediaInputType(mediaInputType === 'image' ? null : 'image')}
                      className={`p-2 hover:bg-slate-100 rounded-full transition-colors ${mediaInputType === 'image' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-600'}`} 
                      aria-label="Add Image"
                      aria-expanded={mediaInputType === 'image'}
                    >
                      <ImageIcon size={20} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="relative">
                    <button 
                      onClick={() => setMediaInputType(mediaInputType === 'video' ? null : 'video')}
                      className={`p-2 hover:bg-slate-100 rounded-full transition-colors ${mediaInputType === 'video' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-600'}`} 
                      aria-label="Add Video"
                      aria-expanded={mediaInputType === 'video'}
                    >
                      <Video size={20} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>

              {mediaInputType && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-600">Add {mediaInputType === 'image' ? 'Image' : 'Video'}</p>
                    <button onClick={() => setMediaInputType(null)} className="text-slate-400 hover:text-slate-600"><XCircle size={16} /></button>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={() => setIsMediaLibraryOpen(true)}
                      disabled={!user}
                      className="flex items-center justify-center gap-2 w-full p-3 bg-white border border-indigo-200 text-indigo-600 rounded-xl hover:bg-indigo-50 transition-all font-bold text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Library size={18} />
                      Select from Library
                    </button>
                    
                    <div className="relative flex items-center">
                      <div className="flex-grow border-t border-slate-200"></div>
                      <span className="flex-shrink mx-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">or paste URL</span>
                      <div className="flex-grow border-t border-slate-200"></div>
                    </div>

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                          placeholder={`Paste ${mediaInputType} URL here...`}
                          value={mediaUrl}
                          onChange={(e) => setMediaUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && mediaUrl) {
                              updateQuestion(activeQuestion.id, { media: { type: mediaInputType, url: mediaUrl } });
                              setMediaUrl('');
                              setMediaInputType(null);
                            }
                          }}
                        />
                      </div>
                      <button 
                        onClick={() => {
                          if (mediaUrl) {
                            updateQuestion(activeQuestion.id, { media: { type: mediaInputType, url: mediaUrl } });
                            setMediaUrl('');
                            setMediaInputType(null);
                          }
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  {!user && (
                    <p className="text-[10px] text-amber-600 font-medium text-center">Sign in to use the media library and upload files.</p>
                  )}
                  <p className="text-[10px] text-slate-400 italic text-center">Tip: Use direct links from sites like Unsplash or YouTube (embed URLs).</p>
                </motion.div>
              )}

              <textarea
                className="text-2xl font-bold w-full focus:outline-none bg-transparent placeholder-slate-400 resize-none"
                placeholder={activeQuestion.type === 'info' ? 'Heading / Title' : 'Enter your question here...'}
                value={activeQuestion.text}
                onChange={e => updateQuestion(activeQuestion.id, { text: e.target.value })}
                onKeyDown={e => handleMarkdownShortcut(e, activeQuestion.text, (val) => updateQuestion(activeQuestion.id, { text: val }))}
                onPaste={e => {
                  if (activeQuestion.type === 'info') return;
                  const pastedText = e.clipboardData.getData('text');
                  // 1. Strip question number prefix: "1. ", "1) ", "1: ", "Question 1: ", "Q1: ", etc.
                  let processedText = pastedText.replace(/^\s*(?:Question\s+|Q)?\d+[\.\)\:]\s*/i, '');
                  
                  // 2. Remove line breaks mid-sentence and collapse multiple spaces
                  processedText = processedText.replace(/\r?\n/g, ' ').replace(/\s\s+/g, ' ').trim();
                  
                  if (processedText !== pastedText) {
                    e.preventDefault();
                    const target = e.currentTarget;
                    const start = target.selectionStart;
                    const end = target.selectionEnd;
                    const value = target.value;
                    const newValue = value.substring(0, start) + processedText + value.substring(end);
                    updateQuestion(activeQuestion.id, { text: newValue });
                    
                    // Set cursor position after the inserted text
                    setTimeout(() => {
                      target.selectionStart = target.selectionEnd = start + processedText.length;
                    }, 0);
                  }
                }}
                onFocus={handleFocus}
                aria-label="Question Text"
                rows={activeQuestion.type === 'info' ? 2 : 4}
              />

              {activeQuestion.type === 'info' && (
                <textarea
                  className="text-lg w-full focus:outline-none bg-transparent placeholder-slate-400 resize-none border-t border-slate-100 pt-4 mt-2"
                  placeholder="Enter detailed information, instructions, or content here..."
                  value={activeQuestion.content || ''}
                  onChange={e => updateQuestion(activeQuestion.id, { content: e.target.value })}
                  onKeyDown={e => handleMarkdownShortcut(e, activeQuestion.content || '', (val) => updateQuestion(activeQuestion.id, { content: val }))}
                  onFocus={handleFocus}
                  aria-label="Information Content"
                  rows={16}
                />
              )}

              {activeQuestion.media && (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  {activeQuestion.media.type === 'image' ? (
                    <img src={activeQuestion.media.url} alt="Question media" className="w-full h-auto max-h-96 object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <video src={activeQuestion.media.url} controls className="w-full h-auto max-h-96" />
                  )}
                  <button 
                    onClick={() => updateQuestion(activeQuestion.id, { media: undefined })}
                    className="absolute top-2 right-2 p-1 bg-white/80 hover:bg-white rounded-full text-red-500 shadow-sm"
                  >
                    <XCircle size={20} />
                  </button>
                </div>
              )}

              {activeQuestion.type !== 'info' && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Options</p>
                  <Reorder.Group
                    axis="y"
                    values={activeQuestion.options}
                    onReorder={(newOptions) => updateQuestion(activeQuestion.id, { options: newOptions })}
                    className="grid grid-cols-1 gap-4"
                    role={activeQuestion.type === 'multiple-choice' ? 'group' : 'radiogroup'}
                    aria-label="Options"
                  >
                    {activeQuestion.options.map((opt, idx) => (
                      <Reorder.Item
                        key={opt.id}
                        value={opt}
                        className="flex items-start gap-4 group bg-white p-1 rounded-xl"
                      >
                        <div className="mt-3 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors">
                          <GripVertical size={20} />
                        </div>
                        <button
                          onClick={() => {
                            const newOptions = activeQuestion.options.map(o => {
                              if (activeQuestion.type === 'multiple-choice') {
                                return o.id === opt.id ? { ...o, isCorrect: !o.isCorrect } : o;
                              } else {
                                return { ...o, isCorrect: o.id === opt.id };
                              }
                            });
                            updateQuestion(activeQuestion.id, { options: newOptions });
                          }}
                          aria-label={`Mark option ${idx + 1} as ${opt.isCorrect ? 'incorrect' : 'correct'}`}
                          aria-pressed={opt.isCorrect}
                          className={`mt-3 transition-colors ${opt.isCorrect ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          {activeQuestion.type === 'multiple-choice' ? (
                            opt.isCorrect ? <CheckSquare size={24} aria-hidden="true" /> : <Square size={24} aria-hidden="true" />
                          ) : (
                            opt.isCorrect ? <CheckCircle2 size={24} aria-hidden="true" /> : <Circle size={24} aria-hidden="true" />
                          )}
                        </button>
                        <textarea
                          className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 resize-none min-h-[48px]"
                          value={opt.text}
                          onChange={e => {
                            const newOptions = activeQuestion.options.map(o => o.id === opt.id ? { ...o, text: e.target.value } : o);
                            updateQuestion(activeQuestion.id, { options: newOptions });
                          }}
                          onKeyDown={e => handleMarkdownShortcut(e, opt.text, (val) => {
                            const newOptions = activeQuestion.options.map(o => o.id === opt.id ? { ...o, text: val } : o);
                            updateQuestion(activeQuestion.id, { options: newOptions });
                          })}
                          onPaste={e => {
                            const pastedText = e.clipboardData.getData('text');
                            // 1. Strip option prefix: "A. ", "A) ", "A: ", "a. ", etc.
                            let processedText = pastedText.replace(/^\s*[A-Z][\.\)\:]\s*/i, '');
                            
                            // 2. Remove line breaks mid-sentence and collapse multiple spaces
                            processedText = processedText.replace(/\r?\n/g, ' ').replace(/\s\s+/g, ' ').trim();
                            
                            if (processedText !== pastedText) {
                              e.preventDefault();
                              const target = e.currentTarget;
                              const start = target.selectionStart;
                              const end = target.selectionEnd;
                              const value = target.value;
                              const newValue = value.substring(0, start) + processedText + value.substring(end);
                              
                              const newOptions = activeQuestion.options.map(o => 
                                o.id === opt.id ? { ...o, text: newValue } : o
                              );
                              updateQuestion(activeQuestion.id, { options: newOptions });
                              
                              // Set cursor position after the inserted text
                              setTimeout(() => {
                                target.selectionStart = target.selectionEnd = start + processedText.length;
                              }, 0);
                            }
                          }}
                          onFocus={handleFocus}
                          aria-label={`Option ${idx + 1} text`}
                          rows={1}
                          ref={el => {
                            if (el) {
                              el.style.height = 'auto';
                              el.style.height = el.scrollHeight + 'px';
                              
                              if (newlyAddedOptionId === opt.id) {
                                el.focus();
                                // Select text to make it easy to replace "New Option"
                                if (opt.text === 'New Option') {
                                  (el as HTMLTextAreaElement).select();
                                }
                                setNewlyAddedOptionId(null);
                              }
                            }
                          }}
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = target.scrollHeight + 'px';
                          }}
                        />
                        {activeQuestion.type !== 'true-false' && activeQuestion.options.length > 2 && (
                          <button
                            onClick={() => {
                              const newOptions = activeQuestion.options.filter(o => o.id !== opt.id);
                              updateQuestion(activeQuestion.id, { options: newOptions });
                            }}
                            aria-label={`Delete option ${idx + 1}`}
                            className="opacity-0 group-hover:opacity-100 p-2 mt-2 text-slate-500 hover:text-red-500 transition-all focus:opacity-100"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                  
                  {activeQuestion.type !== 'true-false' && (
                    <button
                      onClick={() => {
                        const newId = uuidv4();
                        const newOption: Option = { id: newId, text: 'New Option', isCorrect: false };
                        setNewlyAddedOptionId(newId);
                        updateQuestion(activeQuestion.id, { options: [...activeQuestion.options, newOption] });
                      }}
                      className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 p-2"
                    >
                      <Plus size={16} /> Add Option
                    </button>
                  )}

                  <div className="pt-6 border-t border-slate-100 space-y-2">
                    <label htmlFor="explanation" className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Answer Explanation (Optional)</label>
                    <textarea
                      id="explanation"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm text-slate-800"
                      placeholder="Explain why the correct answer is correct. This will be shown to learners when reviewing the quiz answer."
                      value={activeQuestion.explanation || ''}
                      onChange={e => updateQuestion(activeQuestion.id, { explanation: e.target.value })}
                      onKeyDown={e => handleMarkdownShortcut(e, activeQuestion.explanation || '', (val) => updateQuestion(activeQuestion.id, { explanation: val }))}
                      onFocus={handleFocus}
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
            <div className="p-6 bg-white rounded-full shadow-sm border border-slate-100">
              <Plus size={48} className="text-slate-200" />
            </div>
            <p className="text-lg font-medium">Select or add a question to get started</p>
          </div>
        )}
      </main>

      {/* Export Panel */}
      <aside className="w-80 border-l border-slate-200 bg-white p-6 space-y-6 overflow-y-auto" aria-label="Quiz settings">
        <h2 className="text-lg font-bold">Quiz Settings</h2>
        
        <div className="space-y-2">
          <label htmlFor="passing-score" className="text-sm font-medium text-slate-700">Passing Score (%)</label>
          <input
            id="passing-score"
            type="number"
            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
            value={passingScoreInput}
            onChange={e => {
              const val = e.target.value;
              setPassingScoreInput(val);
              const num = parseInt(val);
              if (!isNaN(num)) {
                setQuiz({ ...quiz, passingScore: num });
              } else if (val === '') {
                setQuiz({ ...quiz, passingScore: 0 });
              }
            }}
            onFocus={handleFocus}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="encrypt-data" className="text-sm font-medium text-slate-700">Encrypt Quiz Data</label>
            <button
              id="encrypt-data"
              onClick={() => setQuiz({ ...quiz, encryptData: !quiz.encryptData })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                quiz.encryptData ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  quiz.encryptData ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            Obfuscates quiz data in the exported file to prevent users from viewing answers in the source code.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="show-feedback" className="text-sm font-medium text-slate-700">Show Immediate Feedback</label>
            <button
              id="show-feedback"
              onClick={() => setQuiz({ ...quiz, showImmediateFeedback: !quiz.showImmediateFeedback })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                quiz.showImmediateFeedback ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  quiz.showImmediateFeedback ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            Shows students if they got the question correct or incorrect before moving to the next question.
          </p>
        </div>

        <div className="pt-6 border-t border-slate-100 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Preview</h3>
          <div className="relative">
            <div className="flex">
              <button
                onClick={() => handlePreview(0)}
                disabled={quiz.questions.length === 0}
                className="flex-1 flex items-center justify-between p-4 bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 rounded-l-xl font-bold transition-all shadow-sm disabled:opacity-50"
              >
                <span>Preview Quiz</span>
                <RotateCcw size={20} />
              </button>
              <button
                onClick={() => setIsPreviewDropdownOpen(!isPreviewDropdownOpen)}
                disabled={quiz.questions.length === 0}
                className="px-3 bg-white hover:bg-slate-50 text-indigo-600 border-y border-r border-indigo-200 rounded-r-xl transition-all shadow-sm disabled:opacity-50"
              >
                <ChevronDown size={20} className={`transform transition-transform ${isPreviewDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <AnimatePresence>
              {isPreviewDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-[10]" 
                    onClick={() => setIsPreviewDropdownOpen(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-xl shadow-xl z-[11] overflow-hidden"
                  >
                    <button
                      onClick={() => handlePreview(0)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 text-left text-sm font-medium text-slate-700 transition-colors border-b border-slate-100"
                    >
                      <RotateCcw size={16} className="text-indigo-500" />
                      <div>
                        <div className="font-bold">From Beginning</div>
                        <div className="text-[10px] text-slate-400">Start the quiz from the first question</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        const idx = quiz.questions.findIndex(q => q.id === activeQuestionId);
                        handlePreview(idx !== -1 ? idx : 0);
                      }}
                      className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 text-left text-sm font-medium text-slate-700 transition-colors"
                    >
                      <PlayCircle size={16} className="text-indigo-500" />
                      <div>
                        <div className="font-bold">From Current Question</div>
                        <div className="text-[10px] text-slate-400">
                          {activeQuestionId ? (
                            (() => {
                              const idx = quiz.questions.findIndex(q => q.id === activeQuestionId);
                              const num = getQuestionNumber(idx);
                              return num ? `Start from question ${num}` : 'Start from information block';
                            })()
                          ) : 'Start from the selected question'}
                        </div>
                      </div>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Cloud Storage</h3>
            {autoSaveStatus !== 'idle' && (
              <span className={`text-[10px] font-medium ${
                autoSaveStatus === 'saving' ? 'text-indigo-500' : 
                autoSaveStatus === 'saved' ? 'text-emerald-500' : 
                'text-red-500'
              }`}>
                {autoSaveStatus === 'saving' ? 'Auto-saving...' : 
                 autoSaveStatus === 'saved' ? 'Draft saved' : 
                 'Save error'}
              </span>
            )}
          </div>
          <button
            onClick={handleSaveToCloud}
            disabled={!user || isSaving}
            className="w-full flex items-center justify-between p-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:shadow-none"
          >
            <span>{isSaving ? 'Saving...' : 'Save to Cloud'}</span>
            <Save size={20} />
          </button>

          {user && userQuizzes.some(q => q.id === quiz.id) && (
            <button
              onClick={() => {
                openConfirm(
                  'Delete from Cloud',
                  'Are you sure you want to delete THIS quiz from the cloud? This cannot be undone.',
                  async () => {
                    try {
                      setIsSaving(true);
                      await quizService.deleteQuiz(quiz.id);
                      showToast('Quiz deleted from cloud.');
                      setQuiz({
                        id: uuidv4(),
                        title: 'New Quiz',
                        description: 'Enter quiz description here...',
                        questions: [],
                        passingScore: 80,
                      });
                      setActiveQuestionId(null);
                    } catch (error) {
                      console.error('Delete failed in component:', error);
                      showToast('Failed to delete quiz.', 'error');
                    } finally {
                      setIsSaving(false);
                    }
                  },
                  'Delete',
                  true
                );
              }}
              className="w-full flex items-center justify-between p-3 text-red-600 hover:bg-red-50 rounded-xl font-bold transition-all text-sm border border-red-100"
            >
              <span>Delete from Cloud</span>
              <Trash2 size={18} />
            </button>
          )}
        </div>

        <div className="pt-6 border-t border-slate-100 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Share</h3>
          <button
            onClick={handleShareQuiz}
            disabled={quiz.questions.length === 0 || isSaving}
            className="w-full flex items-center justify-between p-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50"
          >
            <span>{isSaving ? 'Saving...' : 'Copy Share Link'}</span>
            <LinkIcon size={20} />
          </button>
          <p className="text-[10px] text-slate-400 text-center">
            Anyone with the link can take this quiz directly in their browser.
          </p>
        </div>

        <div className="pt-6 border-t border-slate-100 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Standalone HTML</h3>
          <button
            onClick={handleExportHtml}
            disabled={quiz.questions.length === 0}
            className="w-full flex items-center justify-between p-4 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50"
          >
            <span>Export HTML</span>
            <Download size={20} />
          </button>
          <p className="text-[10px] text-slate-400 text-center">
            Download a single file that works offline in any browser.
          </p>
        </div>

        <div className="pt-6 border-t border-slate-100 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">CSV Data</h3>
          <label className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold transition-all shadow-sm cursor-pointer">
            <span>Import CSV</span>
            <FileSpreadsheet size={20} />
            <input type="file" accept=".csv" onChange={handleImportCsv} className="hidden" />
          </label>

          <button
            onClick={handleExportCsv}
            disabled={quiz.questions.length === 0}
            className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50"
          >
            <span>Export CSV</span>
            <Download size={20} />
          </button>

          <button
            onClick={handleDownloadImportGuidePdf}
            className="w-full flex items-center justify-between p-3 text-indigo-600 hover:bg-indigo-50 rounded-xl font-bold transition-all text-sm border border-indigo-100"
          >
            <span>Download Guide (PDF)</span>
            <Download size={18} />
          </button>
        </div>

        <div className="pt-6 border-t border-slate-100 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">XML Data (Moodle)</h3>
          <label className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold transition-all shadow-sm cursor-pointer">
            <span>Import XML</span>
            <Plus size={20} />
            <input type="file" accept=".xml" onChange={handleImportMoodle} className="hidden" />
          </label>

          <button
            onClick={handleExportMoodle}
            disabled={quiz.questions.length === 0}
            className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50"
          >
            <span>Export XML</span>
            <Download size={20} />
          </button>
        </div>

        <div className="pt-6 border-t border-slate-100 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Word Export</h3>
          <button
            onClick={handleExportHtmlAnswerKey}
            className="w-full flex items-center justify-between p-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold transition-all shadow-sm"
          >
            <span>Export Answer Key (HTML)</span>
            <FileText size={20} />
          </button>
        </div>

        <div className="pt-6 border-t border-slate-100 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Storyline Export</h3>
          <div className="space-y-2">
            <button
              onClick={handleExportStoryline}
              disabled={quiz.questions.filter(q => q.type !== 'info').length === 0}
              className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50"
            >
              <span>Export Storyline XLSX</span>
              <FileSpreadsheet size={20} />
            </button>
            <button
              onClick={handleExportStorylineCsv}
              disabled={quiz.questions.filter(q => q.type !== 'info').length === 0}
              className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50"
            >
              <span>Export Storyline CSV</span>
              <FileText size={20} />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center">
            Excel or CSV format compatible with Articulate Storyline import.
          </p>
        </div>

        <div className="pt-6 border-t border-slate-100 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">SCORM Export</h3>
          
          <div className="space-y-4 pb-2">
            <div className="flex items-center justify-between">
              <label htmlFor="scorm-debug" className="text-sm font-medium text-slate-700">Enable SCORM Debug</label>
              <button
                id="scorm-debug"
                onClick={() => setQuiz({ ...quiz, enableScormDebug: !quiz.enableScormDebug })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  quiz.enableScormDebug ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    quiz.enableScormDebug ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Includes debug logging in the SCORM package to help diagnose LMS communication issues.
            </p>
          </div>

          <button
            onClick={handleExportScorm}
            disabled={quiz.questions.length === 0}
            className="w-full flex items-center justify-between p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none"
          >
            <span>SCORM 2004</span>
            <Download size={20} />
          </button>
        </div>

        <div className="mt-auto pt-12 text-center pb-8 px-4">
          <button
            onClick={generateUserManualDocx}
            className="flex items-center justify-center gap-2 w-full p-2 mb-4 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all border border-indigo-100"
          >
            <FileText size={14} /> Download User Manual (Word)
          </button>
          <p className="text-xs text-slate-400">QuizBuilder Pro v1.0</p>
          <p className="text-xs text-slate-400">A Google AI Studio app by <a href="https://willfindlayportfolio.wordpress.com/" target="_blank">Will Findlay</a></p>
        </div>
      </aside>

      {isPreviewMode && (
        <QuizPlayer 
          quiz={quiz} 
          initialQuestionIdx={previewStartIndex}
          onClose={() => {
            setIsPreviewMode(false);
            setPreviewStartIndex(0);
          }} 
        />
      )}

      {/* Quiz List Modal */}
      <AnimatePresence>
        {isQuizListOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                    <Library size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">My Quizzes</h2>
                    <p className="text-xs text-slate-500">Select a quiz to open</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search quizzes..."
                      value={quizSearchQuery}
                      onChange={(e) => setQuizSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-64"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setIsQuizListOpen(false);
                      setQuizSearchQuery('');
                    }}
                    className="p-2 hover:bg-black/5 rounded-full text-slate-400"
                  >
                    <XCircle size={24} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {userQuizzes.filter(q => 
                  q.title.toLowerCase().includes(quizSearchQuery.toLowerCase()) ||
                  q.description.toLowerCase().includes(quizSearchQuery.toLowerCase())
                ).length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Library size={48} className="mx-auto mb-4 opacity-20" />
                    <p>{quizSearchQuery ? 'No quizzes match your search.' : 'No quizzes saved in the cloud yet.'}</p>
                  </div>
                ) : (
                  userQuizzes
                    .filter(q => 
                      q.title.toLowerCase().includes(quizSearchQuery.toLowerCase()) ||
                      q.description.toLowerCase().includes(quizSearchQuery.toLowerCase())
                    )
                    .map((q) => (
                      <div
                        key={q.id}
                        onClick={() => {
                          const normalized = normalizeQuiz(q);
                          setQuiz(normalized);
                          setIsQuizListOpen(false);
                          setQuizSearchQuery('');
                          const firstQuestionId = normalized.questions.length > 0 ? normalized.questions[0].id : null;
                          setActiveQuestionId(firstQuestionId);
                          // Reset history
                          setHistory([{ quiz: JSON.parse(JSON.stringify(normalized)), activeQuestionId: firstQuestionId }]);
                          setHistoryIndex(0);
                        }}
                      className="group flex items-center justify-between p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-2xl cursor-pointer transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 truncate">{q.title}</h3>
                        <p className="text-xs text-slate-500 truncate">{q.description}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                            {q.questions.length} Questions
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Updated: {new Date(q.updatedAt!).toLocaleDateString()} {new Date(q.updatedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openConfirm(
                              'Delete Quiz',
                              'Are you sure you want to delete this quiz from the cloud?',
                              async () => {
                                try {
                                  await quizService.deleteQuiz(q.id);
                                  showToast('Quiz deleted successfully.');
                                } catch (err) {
                                  console.error('Delete failed in modal:', err);
                                  showToast('Failed to delete quiz. Please try again.', 'error');
                                }
                              },
                              'Delete',
                              true
                            );
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={18} />
                        </button>
                        <RotateCcw size={18} className="text-indigo-400" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart Paste Modal */}
      <AnimatePresence>
        {isBulkPasteOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4"
            onClick={() => setIsBulkPasteOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                      <Clipboard size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">Smart Paste</h2>
                      <p className="text-sm text-slate-500">Paste your question and options below to auto-fill the form.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsBulkPasteOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                  >
                    <XCircle size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                    <p className="text-xs text-amber-800 leading-relaxed">
                      <strong>How it works:</strong> Paste your question and options. 
                      If the <strong>first line is blank</strong>, we assume you're only pasting options. 
                      If the <strong>first line is populated</strong>, we treat it as the question. 
                      Use an <strong>asterisk (*)</strong> at the start of an option to mark it as correct.
                    </p>
                  </div>

                  <textarea
                    ref={bulkPasteRef}
                    autoFocus
                    className="w-full h-96 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 font-mono text-sm resize-none"
                    placeholder="Example:&#10;1. What is the capital of France?&#10;A. London&#10;* B. Paris&#10;C. Berlin&#10;D. Madrid"
                    value={bulkPasteText}
                    onChange={(e) => setBulkPasteText(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setIsBulkPasteOpen(false)}
                    className="px-6 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkPaste}
                    disabled={!bulkPasteText.trim()}
                    className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Parse & Fill
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media Library Modal */}
      <AnimatePresence>
        {isMediaLibraryOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-12 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-5xl h-full max-h-[800px]"
            >
              <MediaLibrary
                onClose={() => setIsMediaLibraryOpen(false)}
                onSelect={(item) => {
                  if (activeQuestion) {
                    updateQuestion(activeQuestion.id, { 
                      media: { 
                        type: item.type.startsWith('image') ? 'image' : 'video', 
                        url: item.url,
                        fileName: item.name
                      } 
                    });
                    setIsMediaLibraryOpen(false);
                    setMediaInputType(null);
                  }
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Confirm Modal */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-6"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-2">{confirmModal.title}</h3>
              <p className="text-slate-600 mb-6">{confirmModal.message}</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  className={`px-6 py-2 rounded-xl font-bold transition-all text-white ${
                    confirmModal.isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {confirmModal.confirmText || 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200]"
          >
            <div className={`px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border ${
              toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-indigo-50 border-indigo-200 text-indigo-800'
            }`}>
              {toast.type === 'success' ? <CheckCircle2 size={20} /> : 
               toast.type === 'error' ? <XCircle size={20} /> : 
               <Info size={20} />}
              <span className="font-bold text-sm">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

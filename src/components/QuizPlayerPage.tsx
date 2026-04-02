import React, { useEffect, useState } from 'react';
import { Quiz } from '../types';
import { quizService } from '../services/quizService';
import QuizPlayer from './QuizPlayer';
import { Loader2, AlertCircle } from 'lucide-react';

export default function QuizPlayerPage() {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const quizId = params.get('quizId');

    if (!quizId) {
      setError('No quiz ID provided in the URL.');
      setLoading(false);
      return;
    }

    const fetchQuiz = async () => {
      try {
        const data = await quizService.getQuiz(quizId);
        if (data) {
          setQuiz(data);
        } else {
          setError('Quiz not found.');
        }
      } catch (err) {
        console.error('Failed to fetch quiz:', err);
        setError('Failed to load quiz. Please check the ID and try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Loading Quiz...</h2>
        <p className="text-slate-500">Please wait while we fetch the quiz data.</p>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Oops!</h2>
        <p className="text-slate-600 mb-8 max-w-md">{error}</p>
        <button 
          onClick={() => window.location.href = '/'}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          Go to QuizBuilder Pro
        </button>
      </div>
    );
  }

  return (
    <QuizPlayer 
      quiz={quiz} 
      onClose={() => window.location.href = '/'} 
    />
  );
}

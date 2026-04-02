import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Circle, Square, CheckSquare, ArrowRight, RotateCcw, X, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Quiz, Question } from '../types';

interface QuizPlayerProps {
  quiz: Quiz;
  onClose: () => void;
  initialQuestionIdx?: number;
}

export default function QuizPlayer({ quiz, onClose, initialQuestionIdx = 0 }: QuizPlayerProps) {
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(initialQuestionIdx);
  const [userAnswers, setUserAnswers] = useState<number[][]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null);
  const [previousDisabledMessage, setPreviousDisabledMessage] = useState<string | null>(null);

  const currentQuestion = quiz.questions[currentQuestionIdx];
  const totalQuestions = quiz.questions.filter(q => q.type !== 'info').length;
  const currentQuestionNumber = quiz.questions.slice(0, currentQuestionIdx).filter(q => q.type !== 'info').length + 1;
  const questionHeaderRef = useRef<HTMLHeadingElement>(null);

  const getLastScenario = (idx: number) => {
    const q = quiz.questions[idx];
    if (!q || !q.showScenario) return null;
    
    // Search backwards from the current question
    for (let i = idx - 1; i >= 0; i--) {
      if (quiz.questions[i].type === 'info' && quiz.questions[i].isScenario) {
        return quiz.questions[i];
      }
    }
    return null;
  };

  const lastScenario = getLastScenario(currentQuestionIdx);

  // Reset feedback and move focus when question changes
  React.useEffect(() => {
    setShowFeedback(false);
    // Move focus to the question header for screen readers
    if (questionHeaderRef.current) {
      questionHeaderRef.current.focus();
    }
  }, [currentQuestionIdx]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showResults && !isReviewing) return;
      
      if (e.key === 'ArrowLeft') {
        if (quiz.showImmediateFeedback && !isReviewing) {
          setPreviousDisabledMessage("Going backwards in this quiz is not allowed since feedback is shown after each question.");
          setTimeout(() => setPreviousDisabledMessage(null), 3000);
          return;
        }
        if (currentQuestionIdx > 0) {
          setCurrentQuestionIdx(prev => prev - 1);
        }
      } else if (e.key === 'ArrowRight') {
        const canGoNext = currentQuestion.type === 'info' || (userAnswers[currentQuestionIdx] || []).length > 0;
        if (canGoNext) {
          if (quiz.showImmediateFeedback && !showFeedback && currentQuestion.type !== 'info') {
            setShowFeedback(true);
            return;
          }
          
          if (currentQuestionIdx < quiz.questions.length - 1) {
            setCurrentQuestionIdx(prev => prev + 1);
          } else if (!showResults) {
            setShowResults(true);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestionIdx, quiz.questions.length, showResults, isReviewing, currentQuestion.type, userAnswers, showFeedback, quiz.showImmediateFeedback]);

  const handleOptionToggle = (optionIdx: number) => {
    if (showResults && !isReviewing) return;
    if (showFeedback) return;
    
    const currentAnswers = userAnswers[currentQuestionIdx] || [];
    let newAnswers: number[];

    if (currentQuestion.type === 'multiple-choice') {
      if (currentAnswers.includes(optionIdx)) {
        newAnswers = currentAnswers.filter(a => a !== optionIdx);
      } else {
        newAnswers = [...currentAnswers, optionIdx];
      }
    } else {
      newAnswers = [optionIdx];
    }

    const newUserAnswers = [...userAnswers];
    newUserAnswers[currentQuestionIdx] = newAnswers;
    setUserAnswers(newUserAnswers);
  };

  const getResults = () => {
    let correctCount = 0;
    const actualQuestions = quiz.questions.filter(q => q.type !== 'info');
    
    if (actualQuestions.length === 0) return { score: 100, correctCount: 0, totalCount: 0 };

    quiz.questions.forEach((q, idx) => {
      if (q.type === 'info') return;

      const userAns = userAnswers[idx] || [];
      const correctIndices = q.options.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1);
      
      if (q.type === 'multiple-choice') {
        const isCorrect = userAns.length === correctIndices.length && 
                        userAns.every(val => correctIndices.includes(val));
        if (isCorrect) correctCount++;
      } else {
        if (userAns.length === 1 && correctIndices.includes(userAns[0])) {
          correctCount++;
        }
      }
    });
    const score = Math.round((correctCount / actualQuestions.length) * 100);
    return { score, correctCount, totalCount: actualQuestions.length };
  };

  const { score, correctCount, totalCount } = getResults();
  const passed = score >= quiz.passingScore;

  if (showResults && !isReviewing) {
    return (
      <div 
        className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-title"
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-3xl p-12 max-w-lg w-full text-center space-y-8 shadow-2xl"
        >
          <div 
            className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${passed ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}
            aria-hidden="true"
          >
            {passed ? <CheckCircle2 size={48} /> : <X size={48} />}
          </div>
          
          <div className="space-y-2">
            <h2 id="result-title" className="text-3xl font-bold">{passed ? 'Congratulations!' : 'Keep Practicing!'}</h2>
            <p className="text-slate-600">{passed ? 'You completed ' : 'You reached the end of '} {quiz.title}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Your Score</p>
              <p className={`text-3xl font-black ${passed ? 'text-emerald-600' : 'text-red-600'}`}>
                {score}%
              </p>
              <p className="text-xs text-slate-500 mt-1">{correctCount} of {totalCount} correct</p>
            </div>
            
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Passing Score</p>
              <p className="text-3xl font-black text-slate-700">
                {quiz.passingScore}%
              </p>
              <p className="text-xs text-slate-500 mt-1">Required to pass</p>
            </div>
          </div>

          <div className={`p-4 rounded-xl font-bold text-sm ${passed ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
            {passed ? 'You have successfully passed this quiz!' : 'You did not pass this time.'}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setIsReviewing(true)}
              className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
            >
              Review Quiz
            </button>
            <button 
              onClick={onClose}
              className="px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-indigo-200"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 text-white p-2 rounded-lg" aria-hidden="true">
            <RotateCcw size={20} />
          </div>
          <div>
            <h1 className="font-bold text-slate-900">{quiz.title}</h1>
            <p className="text-xs text-slate-600">
              {isReviewing ? 'Quiz Review' : currentQuestion.type === 'info' ? 'Information Block' : `Question ${currentQuestionNumber} of ${totalQuestions}`}
            </p>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-700"
          aria-label="Close quiz"
        >
          <X size={24} />
        </button>
      </div>

      {/* Progress Bar */}
      {!isReviewing && (
          <div 
            className="h-1 bg-slate-200 w-full"
            role="progressbar"
            aria-valuenow={currentQuestion.type === 'info' ? 0 : currentQuestionNumber}
            aria-valuemin={0}
            aria-valuemax={totalQuestions}
            aria-label="Quiz progress"
          >
            <motion.div 
              className="h-full bg-indigo-600"
              initial={{ width: 0 }}
              animate={{ width: currentQuestion.type === 'info' ? '0%' : `${(currentQuestionNumber / totalQuestions) * 100}%` }}
            />
          </div>
      )}

      {/* Question Area */}
      <div className="flex-1 overflow-y-auto p-8 md:p-12">
        <div className="max-w-3xl mx-auto space-y-8">
          {isReviewing ? (
            <div className="space-y-12 pb-12">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-slate-900">Quiz Review</h2>
                  <p className="text-slate-500">Review your answers and see the correct ones below.</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Your Score</p>
                  <p className={`text-4xl font-black ${passed ? 'text-emerald-600' : 'text-red-600'}`}>
                    {score}%
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{correctCount} of {totalCount} correct</p>
                </div>
              </div>
              
              {quiz.questions.map((q, qIdx) => {
                const qNum = quiz.questions.slice(0, qIdx).filter(prevQ => prevQ.type !== 'info').length + 1;
                const scenario = getLastScenario(qIdx);
                return (
                  <div key={q.id} className="space-y-6 pt-12 border-t border-slate-200 first:pt-0 first:border-0">
                    {scenario && (
                      <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2 mb-3 text-amber-700">
                          <BookOpen size={18} />
                          <span className="text-xs font-bold uppercase tracking-widest">Reference Scenario</span>
                        </div>
                        <h3 className="text-lg font-bold text-amber-900 mb-2">{scenario.text}</h3>
                        {scenario.content && (
                          <div className="text-sm text-amber-800 leading-relaxed prose prose-amber max-w-none">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm, remarkBreaks]}
                              components={{
                                a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-amber-700 underline" />
                              }}
                            >
                              {scenario.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-widest text-indigo-500">
                          {q.type === 'info' ? 'Information' : `Question ${qNum}`}
                        </span>
                        {q.type !== 'info' && (
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          (() => {
                            const userAns = userAnswers[qIdx] || [];
                            const correctIndices = q.options.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1);
                            return q.type === 'multiple-choice' 
                              ? (userAns.length === correctIndices.length && userAns.every(val => correctIndices.includes(val)))
                              : (userAns.length === 1 && correctIndices.includes(userAns[0]));
                          })() ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {(() => {
                            const userAns = userAnswers[qIdx] || [];
                            const correctIndices = q.options.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1);
                            return q.type === 'multiple-choice' 
                              ? (userAns.length === correctIndices.length && userAns.every(val => correctIndices.includes(val)))
                              : (userAns.length === 1 && correctIndices.includes(userAns[0]));
                          })() ? 'CORRECT' : 'INCORRECT'}
                        </span>
                      )}
                    </div>
                    <div className="text-2xl font-bold text-slate-900 leading-tight">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={{
                          a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline" />
                        }}
                      >
                        {q.text}
                      </ReactMarkdown>
                    </div>
                    {q.type === 'info' && q.content && (
                      <div className="text-lg text-slate-700 leading-relaxed mt-4 prose prose-slate max-w-none">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkBreaks]}
                          components={{
                            a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline" />
                          }}
                        >
                          {q.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {q.media && (
                    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white max-w-md">
                      {q.media.type === 'image' ? (
                        <img 
                          src={q.media.url} 
                          alt="Question" 
                          className="max-w-full h-auto max-h-[300px] object-contain mx-auto block cursor-zoom-in hover:opacity-90 transition-opacity" 
                          referrerPolicy="no-referrer" 
                          onClick={() => setEnlargedImageUrl(q.media?.url || null)}
                        />
                      ) : (
                        <video src={q.media.url} controls className="max-w-full h-auto max-h-[300px] mx-auto block" />
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3">
                    {q.type !== 'info' && q.options.map((opt, idx) => {
                      const isSelected = (userAnswers[qIdx] || []).includes(idx);
                      const isCorrect = opt.isCorrect;
                      
                      let borderClass = 'border-slate-200';
                      let bgClass = 'bg-white';
                      let iconColor = 'text-slate-300';

                      if (isSelected && isCorrect) {
                        borderClass = 'border-emerald-500 ring-1 ring-emerald-500';
                        bgClass = 'bg-emerald-50';
                        iconColor = 'text-emerald-500';
                      } else if (isSelected && !isCorrect) {
                        borderClass = 'border-red-500 ring-1 ring-red-500';
                        bgClass = 'bg-red-50';
                        iconColor = 'text-red-500';
                      } else if (!isSelected && isCorrect) {
                        borderClass = 'border-amber-500 ring-1 ring-amber-500 border-dashed';
                        bgClass = 'bg-amber-50';
                        iconColor = 'text-amber-500';
                      }

                      return (
                        <div
                          key={opt.id}
                          className={`p-4 rounded-xl border-2 text-left flex items-start gap-4 ${borderClass} ${bgClass}`}
                        >
                          <div className={`${iconColor} mt-0.5`}>
                            {q.type === 'multiple-choice' ? (
                              isSelected ? <CheckSquare size={20} /> : <Square size={20} />
                            ) : (
                              isSelected ? <CheckCircle2 size={20} /> : <Circle size={20} />
                            )}
                          </div>
                          <div className="text-base font-medium flex-1 prose prose-slate max-w-none">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm, remarkBreaks]}
                              components={{
                                a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline" />
                              }}
                            >
                              {opt.text}
                            </ReactMarkdown>
                          </div>
                          {isCorrect && <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Correct Answer</span>}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 bg-slate-100 border-l-4 border-indigo-500 rounded-r-xl space-y-2"
                    >
                      <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-600">Explanation</h4>
                      <div className="text-sm text-slate-700 leading-relaxed prose prose-slate max-w-none">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkBreaks]}
                          components={{
                            a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline" />
                          }}
                        >
                          {q.explanation}
                        </ReactMarkdown>
                      </div>
                    </motion.div>
                  )}
                </div>
              )})}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestionIdx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                {lastScenario && (
                  <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2 mb-3 text-amber-700">
                      <BookOpen size={18} />
                      <span className="text-xs font-bold uppercase tracking-widest">Reference Scenario</span>
                    </div>
                    <h3 className="text-lg font-bold text-amber-900 mb-2">{lastScenario.text}</h3>
                    {lastScenario.content && (
                      <div className="text-sm text-amber-800 leading-relaxed prose prose-amber max-w-none">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkBreaks]}
                          components={{
                            a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-amber-700 underline" />
                          }}
                        >
                          {lastScenario.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    {lastScenario.media && (
                      <div className="mt-4 rounded-xl overflow-hidden border border-amber-200 shadow-sm bg-white flex justify-center">
                        {lastScenario.media.type === 'image' ? (
                          <img 
                            src={lastScenario.media.url} 
                            alt="Scenario" 
                            className="max-w-full h-auto max-h-[300px] object-contain cursor-zoom-in hover:opacity-90 transition-opacity" 
                            referrerPolicy="no-referrer" 
                            onClick={() => setEnlargedImageUrl(lastScenario.media?.url || null)}
                          />
                        ) : (
                          <video src={lastScenario.media.url} controls className="max-w-full h-auto max-h-[300px]" />
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-indigo-500">
                      {currentQuestion.type === 'info' ? 'Information Block' : `Question ${currentQuestionNumber} of ${totalQuestions}`}
                    </span>
                  </div>
                  <div 
                    ref={questionHeaderRef}
                    tabIndex={-1}
                    className="text-3xl font-bold text-slate-900 leading-tight focus:outline-none prose prose-slate max-w-none"
                  >
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      components={{
                        a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline" />
                      }}
                    >
                      {currentQuestion.text}
                    </ReactMarkdown>
                  </div>
                  {currentQuestion.type === 'info' && currentQuestion.content && (
                    <div className="text-xl text-slate-700 leading-relaxed mt-6 prose prose-slate max-w-none">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={{
                          a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline" />
                        }}
                      >
                        {currentQuestion.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>

                {currentQuestion.media && (
                  <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white flex justify-center">
                    {currentQuestion.media.type === 'image' ? (
                      <img 
                        src={currentQuestion.media.url} 
                        alt="Question" 
                        className="max-w-full h-auto max-h-[400px] object-contain cursor-zoom-in hover:opacity-90 transition-opacity" 
                        referrerPolicy="no-referrer" 
                        onClick={() => setEnlargedImageUrl(currentQuestion.media?.url || null)}
                      />
                    ) : (
                      <video src={currentQuestion.media.url} controls className="max-w-full h-auto max-h-[400px]" />
                    )}
                  </div>
                )}

                {currentQuestion.type === 'info' && (
                  <div className="pt-4">
                    <button
                      onClick={() => {
                        if (currentQuestionIdx < quiz.questions.length - 1) {
                          setCurrentQuestionIdx(prev => prev + 1);
                        } else {
                          setShowResults(true);
                        }
                      }}
                      className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                    >
                      Continue <ArrowRight size={20} />
                    </button>
                  </div>
                )}

                <div 
                  className="grid grid-cols-1 gap-4" 
                  role={currentQuestion.type === 'multiple-choice' ? 'group' : 'radiogroup'} 
                  aria-label="Options"
                >
                  {currentQuestion.type !== 'info' && currentQuestion.options.map((opt, idx) => {
                    const isSelected = (userAnswers[currentQuestionIdx] || []).includes(idx);
                    const isCorrect = opt.isCorrect;
                    
                    let borderClass = 'border-slate-200';
                    let bgClass = 'bg-white';
                    let iconColor = 'text-slate-400';

                    if (showFeedback) {
                      if (isSelected && isCorrect) {
                        borderClass = 'border-emerald-500 ring-1 ring-emerald-500';
                        bgClass = 'bg-emerald-50';
                        iconColor = 'text-emerald-500';
                      } else if (isSelected && !isCorrect) {
                        borderClass = 'border-red-500 ring-1 ring-red-500';
                        bgClass = 'bg-red-50';
                        iconColor = 'text-red-500';
                      } else if (!isSelected && isCorrect) {
                        borderClass = 'border-amber-500 ring-1 ring-amber-500 border-dashed';
                        bgClass = 'bg-amber-50';
                        iconColor = 'text-amber-600';
                      }
                    } else if (isSelected) {
                      borderClass = 'border-indigo-600 ring-1 ring-indigo-600';
                      bgClass = 'bg-indigo-50';
                      iconColor = 'text-indigo-600';
                    }

                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleOptionToggle(idx)}
                        role={currentQuestion.type === 'multiple-choice' ? 'checkbox' : 'radio'}
                        aria-checked={isSelected}
                        disabled={showFeedback}
                        className={`p-6 rounded-2xl border-2 text-left flex items-start gap-4 ${borderClass} ${bgClass} ${!showFeedback ? 'hover:border-indigo-300 hover:bg-slate-50' : ''} focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all`}
                      >
                        <div className={`${iconColor} mt-1`} aria-hidden="true">
                          {currentQuestion.type === 'multiple-choice' ? (
                            isSelected ? <CheckSquare size={24} /> : <Square size={24} />
                          ) : (
                            isSelected ? <CheckCircle2 size={24} /> : <Circle size={24} />
                          )}
                        </div>
                        <div className="text-lg font-medium flex-1 prose prose-slate max-w-none">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={{
                              a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline" />
                            }}
                          >
                            {opt.text}
                          </ReactMarkdown>
                        </div>
                        {showFeedback && isCorrect && <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Correct Answer</span>}
                      </button>
                    );
                  })}
                </div>

                <div aria-live="polite" className="sr-only">
                  {showFeedback && (
                    (() => {
                      const userAns = userAnswers[currentQuestionIdx] || [];
                      const correctIndices = currentQuestion.options.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1);
                      const isCorrect = currentQuestion.type === 'multiple-choice' 
                        ? (userAns.length === correctIndices.length && userAns.every(val => correctIndices.includes(val)))
                        : (userAns.length === 1 && correctIndices.includes(userAns[0]));
                      return isCorrect ? "Correct answer!" : "Incorrect answer.";
                    })()
                  )}
                </div>

                {showFeedback && currentQuestion.explanation && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-slate-100 border-l-4 border-indigo-500 rounded-r-xl space-y-2"
                  >
                    <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-600">Explanation</h4>
                    <div className="text-sm text-slate-700 leading-relaxed prose prose-slate max-w-none">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={{
                          a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline" />
                        }}
                      >
                        {currentQuestion.explanation}
                      </ReactMarkdown>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="bg-white border-t border-slate-200 p-6 relative">
        <AnimatePresence>
          {previousDisabledMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 px-4 py-2 bg-slate-800 text-white text-xs font-medium rounded-lg shadow-xl z-50 whitespace-nowrap"
            >
              {previousDisabledMessage}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {!isReviewing ? (
            <>
              <button
                disabled={currentQuestionIdx === 0}
                onClick={() => {
                  if (quiz.showImmediateFeedback) {
                    setPreviousDisabledMessage("Going backwards in this quiz is not allowed since feedback is shown after each question.");
                    setTimeout(() => setPreviousDisabledMessage(null), 3000);
                    return;
                  }
                  setCurrentQuestionIdx(prev => prev - 1);
                }}
                className={`px-6 py-3 font-bold transition-opacity ${currentQuestionIdx === 0 ? 'text-slate-400 opacity-30 cursor-not-allowed' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Previous
              </button>

              <button
                disabled={currentQuestion.type !== 'info' && (userAnswers[currentQuestionIdx] || []).length === 0}
                onClick={() => {
                  if (quiz.showImmediateFeedback && !showFeedback && currentQuestion.type !== 'info') {
                    setShowFeedback(true);
                    return;
                  }

                  if (currentQuestionIdx < quiz.questions.length - 1) {
                    setCurrentQuestionIdx(prev => prev + 1);
                  } else {
                    setShowResults(true);
                  }
                }}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-100"
              >
                {quiz.showImmediateFeedback && !showFeedback && currentQuestion.type !== 'info' 
                  ? 'Check Answer' 
                  : (currentQuestionIdx < quiz.questions.length - 1 ? 'Next' : 'Finish Quiz')} 
                <ArrowRight size={20} />
              </button>
            </>
          ) : (
            <div className="w-full flex justify-center">
              <button
                onClick={onClose}
                className="px-12 py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all shadow-lg"
              >
                Exit Preview
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Enlarged Image Overlay */}
      <AnimatePresence>
        {enlargedImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEnlargedImageUrl(null)}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={enlargedImageUrl}
              alt="Enlarged view"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
            <button 
              className="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
              onClick={(e) => { e.stopPropagation(); setEnlargedImageUrl(null); }}
            >
              <X size={32} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

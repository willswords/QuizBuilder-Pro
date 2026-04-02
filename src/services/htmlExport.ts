import { Quiz } from '../types';

export function generateStandaloneHtml(quiz: Quiz): string {
  let quizJson = JSON.stringify(quiz).replace(/</g, '\\u003c');
  let isEncrypted = !!quiz.encryptData;

  if (isEncrypted) {
    // Simple obfuscation to prevent casual inspection
    const obfuscate = (str: string) => {
      return btoa(encodeURIComponent(str).split('').map((c, i) => 
        String.fromCharCode(c.charCodeAt(0) ^ (i % 255))
      ).join(''));
    };
    quizJson = `"${obfuscate(quizJson)}"`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${quiz.title} - Standalone Quiz</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap">
    <style>
        body { font-family: 'Inter', sans-serif; }
        .glass { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(8px); }
        .fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        .image-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.9);
            z-index: 1000;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            cursor: zoom-out;
        }
        .image-overlay img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
        }
        .image-overlay.active { display: flex; }
    </style>
</head>
    <body class="bg-slate-50 min-h-screen text-slate-900">
    <div id="app" class="max-w-3xl mx-auto p-4 md:p-8">
        <!-- App will be rendered here -->
    </div>

    <div id="image-overlay" class="image-overlay" onclick="hideEnlargedImage()">
        <img id="enlarged-img" src="" alt="Enlarged view">
    </div>

    <script>
        const isEncrypted = ${isEncrypted};
        const rawData = ${quizJson};
        
        const deobfuscate = (str) => {
            try {
                return decodeURIComponent(atob(str).split('').map((c, i) => 
                    String.fromCharCode(c.charCodeAt(0) ^ (i % 255))
                ).join(''));
            } catch (e) {
                console.error('Decryption failed', e);
                return null;
            }
        };

        const escapeHtml = (str) => {
            if (!str) return "";
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        const quiz = isEncrypted ? JSON.parse(deobfuscate(rawData)) : rawData;
        let currentIdx = 0;
        let userAnswers = [];
        let showResults = false;
        let isReviewMode = false;
        let showFeedback = false;

        function getLastScenario(idx) {
            const q = quiz.questions[idx];
            if (!q || !q.showScenario) return null;
            
            for (let i = idx - 1; i >= 0; i--) {
                if (quiz.questions[i].type === 'info' && quiz.questions[i].isScenario) {
                    return quiz.questions[i];
                }
            }
            return null;
        }

        function render(animate = false) {
            const app = document.getElementById('app');
            if (showResults) {
                renderResults(app, animate);
            } else {
                renderQuestion(app, animate);
            }
        }

        function renderQuestion(container, animate) {
            const q = quiz.questions[currentIdx];
            const isInfo = q.type === 'info';
            
            const totalQuestions = quiz.questions.filter(q => q.type !== 'info').length;
            const currentQuestionNumber = quiz.questions.slice(0, currentIdx).filter(q => q.type !== 'info').length + 1;

            const progress = isInfo ? 0 : (currentQuestionNumber / totalQuestions) * 100;
            const animClass = animate ? 'fade-in' : '';

            const scenario = getLastScenario(currentIdx);
            let scenarioHtml = '';
            if (scenario) {
                let scenarioMediaHtml = '';
                if (scenario.media) {
                    if (scenario.media.type === 'image') {
                        scenarioMediaHtml = '<div class="mt-4 rounded-xl overflow-hidden border border-amber-200 bg-white shadow-sm flex justify-center">' +
                            '<img src="' + scenario.media.url + '" class="max-w-full h-auto max-h-[300px] object-contain cursor-zoom-in hover:opacity-90 transition-opacity" onclick="showEnlargedImage(\\'' + scenario.media.url + '\\')" />' +
                        '</div>';
                    } else {
                        scenarioMediaHtml = '<div class="mt-4 rounded-xl overflow-hidden border border-amber-200 bg-white shadow-sm flex justify-center">' +
                            '<video src="' + scenario.media.url + '" controls class="max-w-full h-auto max-h-[300px]"></video>' +
                        '</div>';
                    }
                }

                scenarioHtml = '<div class="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm">' +
                    '<div class="flex items-center gap-2 mb-3 text-amber-700">' +
                        '<span class="text-lg">📖</span>' +
                        '<span class="text-xs font-bold uppercase tracking-widest">Reference Scenario</span>' +
                    '</div>' +
                    '<h3 class="text-lg font-bold text-amber-900 mb-2">' + escapeHtml(scenario.text) + '</h3>' +
                    (scenario.content ? '<p class="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">' + escapeHtml(scenario.content) + '</p>' : '') +
                    scenarioMediaHtml +
                '</div>';
            }

            let mediaHtml = '';
            if (q.media) {
                if (q.media.type === 'image') {
                    mediaHtml = '<div class="rounded-2xl overflow-hidden border border-slate-200 mb-6 bg-white shadow-sm flex justify-center">' +
                        '<img src="' + q.media.url + '" class="max-w-full h-auto max-h-[400px] object-contain cursor-zoom-in hover:opacity-90 transition-opacity" onclick="showEnlargedImage(\\'' + q.media.url + '\\')" />' +
                    '</div>';
                } else {
                    mediaHtml = '<div class="rounded-2xl overflow-hidden border border-slate-200 mb-6 bg-white shadow-sm flex justify-center">' +
                        '<video src="' + q.media.url + '" controls class="max-w-full h-auto max-h-[400px]"></video>' +
                    '</div>';
                }
            }

            let optionsHtml = '';
            if (!isInfo) {
                optionsHtml = '<div class="grid grid-cols-1 gap-4 mb-8">';
                q.options.forEach((opt, idx) => {
                    const isSelected = (userAnswers[currentIdx] || []).includes(idx);
                    const isCorrect = opt.isCorrect;
                    
                    let borderClass = 'border-slate-200 bg-white';
                    let iconColor = 'text-slate-300';
                    
                    if (isReviewMode || showFeedback) {
                        if (isCorrect) {
                            borderClass = 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500';
                            iconColor = 'text-emerald-600';
                        } else if (isSelected && !isCorrect) {
                            borderClass = 'border-red-500 bg-red-50 ring-1 ring-red-500';
                            iconColor = 'text-red-600';
                        }
                    } else if (isSelected) {
                        borderClass = 'border-indigo-600 ring-1 ring-indigo-600 bg-indigo-50';
                        iconColor = 'text-indigo-600';
                    }

                    const icon = q.type === 'multiple-choice' 
                        ? (isSelected ? '☑' : '☐') 
                        : (isSelected ? '●' : '○');
                    
                    const clickAttr = (isReviewMode || showFeedback) ? '' : 'onclick="toggleOption(' + idx + ')"';
                    const cursorClass = (isReviewMode || showFeedback) ? 'cursor-default' : 'hover:border-indigo-300 cursor-pointer';

                    optionsHtml += '<div class="p-6 rounded-2xl border-2 text-left flex items-start gap-4 ' + borderClass + ' ' + cursorClass + '" ' + clickAttr + '>' +
                        '<span class="text-2xl ' + iconColor + ' mt-0.5">' + icon + '</span>' +
                        '<span class="text-lg font-medium whitespace-pre-wrap flex-1">' + escapeHtml(opt.text) + '</span>' +
                        (showFeedback && isCorrect ? '<span class="ml-auto text-xs font-bold text-emerald-600 uppercase tracking-wider">Correct Answer</span>' : '') +
                    '</div>';
                });
                optionsHtml += '</div>';

                if ((isReviewMode || showFeedback) && q.explanation) {
                    optionsHtml += '<div class="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 mb-8">' +
                        '<p class="text-sm font-bold text-indigo-800 uppercase tracking-wider mb-2">Explanation</p>' +
                        '<p class="text-slate-700 leading-relaxed whitespace-pre-wrap">' + escapeHtml(q.explanation) + '</p>' +
                    '</div>';
                }
            }

            const results = getResults();
            const score = results.score;
            const passed = score >= quiz.passingScore;

            let finalScenarioHtml = '';
            if (isReviewMode) {
                const scenario = getLastScenario(currentIdx);
                if (scenario) {
                    let scenarioMediaHtml = '';
                    if (scenario.media) {
                        if (scenario.media.type === 'image') {
                            scenarioMediaHtml = '<div class="mt-4 rounded-xl overflow-hidden border border-amber-200 bg-white shadow-sm flex justify-center">' +
                                '<img src="' + scenario.media.url + '" class="max-w-full h-auto max-h-[300px] object-contain cursor-zoom-in hover:opacity-90 transition-opacity" onclick="showEnlargedImage(\\'' + scenario.media.url + '\\')" />' +
                            '</div>';
                        } else {
                            scenarioMediaHtml = '<div class="mt-4 rounded-xl overflow-hidden border border-amber-200 bg-white shadow-sm flex justify-center">' +
                                '<video src="' + scenario.media.url + '" controls class="max-w-full h-auto max-h-[300px]"></video>' +
                            '</div>';
                        }
                    }

                    finalScenarioHtml = '<div class="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm">' +
                        '<div class="flex items-center gap-2 mb-3 text-amber-700">' +
                            '<span class="text-lg">📖</span>' +
                            '<span class="text-xs font-bold uppercase tracking-widest">Reference Scenario</span>' +
                        '</div>' +
                        '<h3 class="text-lg font-bold text-amber-900 mb-2">' + escapeHtml(scenario.text) + '</h3>' +
                        (scenario.content ? '<p class="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">' + escapeHtml(scenario.content) + '</p>' : '') +
                        scenarioMediaHtml +
                    '</div>';
                }
            }

            container.innerHTML = '<div class="' + animClass + ' space-y-8">' +
                    '<div class="flex items-center justify-between mb-4">' +
                        '<h1 class="text-xl font-bold text-slate-800">' + escapeHtml(quiz.title) + '</h1>' +
                        (isReviewMode ? 
                            '<div class="text-right">' +
                                '<span class="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Your Score</span>' +
                                '<span class="text-xl font-black ' + (passed ? 'text-emerald-600' : 'text-red-600') + '">' + score + '%</span>' +
                            '</div>' :
                            '<span class="text-sm font-bold text-slate-500">' + (isInfo ? 'Information Block' : 'Question ' + currentQuestionNumber + ' of ' + totalQuestions) + '</span>'
                        ) +
                    '</div>' +
                    
                    '<div class="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-8">' +
                        '<div class="h-full bg-indigo-600 transition-all duration-300" style="width: ' + progress + '%"></div>' +
                    '</div>' +

                    (isReviewMode ? finalScenarioHtml : scenarioHtml) +

                    '<div class="space-y-4">' +
                        '<span class="text-xs font-bold uppercase tracking-widest text-indigo-500">' +
                            (isInfo ? 'Information Block' : 'Question ' + currentQuestionNumber) +
                            (isReviewMode && !isInfo ? (isCorrect(q, currentIdx) ? ' • <span class="text-emerald-600">Correct</span>' : ' • <span class="text-red-600">Incorrect</span>') : '') +
                        '</span>' +
                        '<h2 class="text-3xl font-bold text-slate-900 leading-tight whitespace-pre-wrap">' + escapeHtml(q.text) + '</h2>' +
                        (isInfo && q.content ? 
                            '<div class="space-y-8 mt-6">' +
                                '<p class="text-xl text-slate-700 leading-relaxed whitespace-pre-wrap">' + escapeHtml(q.content) + '</p>' +
                            '</div>' 
                        : '') +
                    '</div>' +

                    mediaHtml +
                    (isInfo && !isReviewMode ? 
                        '<div class="mt-8">' +
                            '<button onclick="next()" class="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">' +
                                'Continue <span class="text-xl">→</span>' +
                            '</button>' +
                        '</div>'
                    : '') +
                    optionsHtml +

                    '<div class="flex justify-between items-center pt-8 border-t border-slate-200">' +
                        '<button onclick="prev()" ' + (currentIdx === 0 || (quiz.showImmediateFeedback && !isReviewMode) ? 'disabled' : '') + ' class="px-6 py-3 text-slate-600 font-bold disabled:opacity-30">Previous</button>' +
                        (isReviewMode && currentIdx === quiz.questions.length - 1 
                            ? '<button onclick="finishReview()" class="px-8 py-3 bg-slate-800 text-white rounded-xl font-bold shadow-lg">Back to Results</button>'
                            : '<button onclick="next()" class="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg ' + (!isReviewMode && !isInfo && (userAnswers[currentIdx] || []).length === 0 ? 'disabled:opacity-50' : '') + '" ' + (!isReviewMode && !isInfo && (userAnswers[currentIdx] || []).length === 0 ? 'disabled' : '') + '>' +
                                (quiz.showImmediateFeedback && !showFeedback && !isReviewMode && !isInfo ? 'Check Answer' : (currentIdx === quiz.questions.length - 1 ? 'Finish Quiz' : 'Next')) +
                              '</button>'
                        ) +
                    '</div>' +
                '</div>';
        }

        function renderResults(container, animate) {
            const results = getResults();
            const score = results.score;
            const correctCount = results.correctCount;
            const totalCount = results.totalCount;
            const passed = score >= quiz.passingScore;
            const animClass = animate ? 'fade-in' : '';

            container.innerHTML = '<div class="' + animClass + ' text-center space-y-8 py-12">' +
                    '<div class="w-24 h-24 mx-auto rounded-full flex items-center justify-center ' + (passed ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600') + '">' +
                        '<span class="text-4xl">' + (passed ? '✓' : '✕') + '</span>' +
                    '</div>' +
                    
                    '<div class="space-y-2">' +
                        '<h2 class="text-3xl font-bold">' + (passed ? 'Congratulations!' : 'Keep Practicing!') + '</h2>' +
                        '<p class="text-slate-600">' + (passed ? 'You completed ' : 'You reached the end of ') + escapeHtml(quiz.title) + '</p>' +
                    '</div>' +

                    '<div class="grid grid-cols-2 gap-4 max-w-md mx-auto">' +
                        '<div class="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">' +
                            '<p class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Your Score</p>' +
                            '<p class="text-3xl font-black ' + (passed ? 'text-emerald-600' : 'text-red-600') + '">' +
                                score + '%' +
                            '</p>' +
                            '<p class="text-xs text-slate-500 mt-1">' + correctCount + ' of ' + totalCount + ' correct</p>' +
                        '</div>' +
                        
                        '<div class="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">' +
                            '<p class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Passing Score</p>' +
                            '<p class="text-3xl font-black text-slate-700">' +
                                quiz.passingScore + '%' +
                            '</p>' +
                            '<p class="text-xs text-slate-500 mt-1">Required to pass</p>' +
                        '</div>' +
                    '</div>' +

                    '<div class="max-w-md mx-auto p-4 rounded-xl font-bold text-sm ' + (passed ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100') + '">' +
                        (passed ? 'You have successfully passed this quiz!' : 'You did not pass this time.') +
                    '</div>' +

                    '<div class="flex flex-col gap-3 max-w-sm mx-auto">' +
                        '<button onclick="restart()" class="w-full px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-xl hover:bg-indigo-700 transition-all">' +
                            'Retake Quiz' +
                        '</button>' +
                        '<button onclick="startReview()" class="w-full px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all">' +
                            'Review Quiz' +
                        '</button>' +
                    '</div>' +
                '</div>';
        }

        function toggleOption(idx) {
            if (showFeedback || isReviewMode) return;
            const q = quiz.questions[currentIdx];
            let currentAnswers = userAnswers[currentIdx] || [];

            if (q.type === 'multiple-choice') {
                if (currentAnswers.includes(idx)) {
                    currentAnswers = currentAnswers.filter(a => a !== idx);
                } else {
                    currentAnswers = [...currentAnswers, idx];
                }
            } else {
                currentAnswers = [idx];
            }

            userAnswers[currentIdx] = currentAnswers;
            render(false);
        }

        function next() {
            const q = quiz.questions[currentIdx];
            if (quiz.showImmediateFeedback && !showFeedback && !isReviewMode && q.type !== 'info') {
                showFeedback = true;
                render(false);
                return;
            }

            if (currentIdx < quiz.questions.length - 1) {
                currentIdx++;
                showFeedback = false;
                render(true);
            } else {
                showResults = true;
                render(true);
            }
        }

        function prev() {
            if (currentIdx > 0) {
                currentIdx--;
                render(true);
            }
        }

        function restart() {
            currentIdx = 0;
            userAnswers = [];
            showResults = false;
            isReviewMode = false;
            showFeedback = false;
            render(true);
        }

        function startReview() {
            currentIdx = 0;
            showResults = false;
            isReviewMode = true;
            render(true);
        }

        function finishReview() {
            showResults = true;
            render(true);
        }

        function isCorrect(q, idx) {
            const userAns = userAnswers[idx] || [];
            const correctIndices = q.options.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1);
            
            if (q.type === 'multiple-choice') {
                return userAns.length === correctIndices.length && 
                       userAns.every(val => correctIndices.includes(val));
            } else {
                return userAns.length === 1 && correctIndices.includes(userAns[0]);
            }
        }

        function getResults() {
            let correctCount = 0;
            const actualQuestions = quiz.questions.filter(q => q.type !== 'info');
            if (actualQuestions.length === 0) return { score: 100, correctCount: 0, totalCount: 0 };

            quiz.questions.forEach((q, idx) => {
                if (q.type === 'info') return;
                if (isCorrect(q, idx)) correctCount++;
            });
            const score = Math.round((correctCount / actualQuestions.length) * 100);
            return { score, correctCount, totalCount: actualQuestions.length };
        }

        window.addEventListener('keydown', (e) => {
            if (showResults) return;
            
            if (e.key === 'ArrowLeft') {
                if (quiz.showImmediateFeedback && !isReviewMode) return;
                prev();
            } else if (e.key === 'ArrowRight') {
                const q = quiz.questions[currentIdx];
                const canGoNext = q.type === 'info' || (userAnswers[currentIdx] || []).length > 0;
                if (canGoNext) {
                    next();
                }
            }
        });

        function showEnlargedImage(url) {
            const overlay = document.getElementById('image-overlay');
            const img = document.getElementById('enlarged-img');
            img.src = url;
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function hideEnlargedImage() {
            const overlay = document.getElementById('image-overlay');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }

        render(true);
    </script>
</body>
</html>`;
}

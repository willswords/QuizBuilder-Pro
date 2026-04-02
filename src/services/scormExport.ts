import JSZip from 'jszip';
import { Quiz } from '../types';

export const generateScorm2004 = async (quiz: Quiz) => {
  const zip = new JSZip();
  let quizJson = JSON.stringify(quiz).replace(/</g, '\\u003c');
  let isEncrypted = !!quiz.encryptData;

  if (isEncrypted) {
    const obfuscate = (str: string) => {
      return btoa(encodeURIComponent(str).split('').map((c, i) => 
        String.fromCharCode(c.charCodeAt(0) ^ (i % 255))
      ).join(''));
    };
    quizJson = `"${obfuscate(quizJson)}"`;
  }

  // 1. imsmanifest.xml
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="QuizBuilder_${quiz.id}" version="1"
          xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
          xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
          xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
          xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
                              http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd
                              http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd
                              http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd
                              http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 3rd Edition</schemaversion>
  </metadata>
  <organizations default="QuizBuilder_Org">
    <organization identifier="QuizBuilder_Org">
      <title>${quiz.title}</title>
      <item identifier="item_1" identifierref="resource_1">
        <title>${quiz.title}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="resource_1" type="webcontent" adlcp:scormType="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>`;

  // 2. index.html (The Quiz Player)
  const playerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${quiz.title}</title>
    <style>
        :root {
            --primary: #005EB8;
            --primary-hover: #004a91;
            --bg: #f8fafc;
            --card: #ffffff;
            --text: #0f172a;
            --text-muted: #64748b;
            --border: #e2e8f0;
            --success: #10b981;
            --error: #ef4444;
            --warning: #f59e0b;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            line-height: 1.5;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }
        .header {
            background: white;
            padding: 1rem 2rem;
            border-bottom: 1px solid var(--border);
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        .header-left { display: flex; align-items: center; gap: 1rem; overflow: hidden; }
        .header h1 { font-size: 1.25rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        #header-meta { text-align: right; }
        .btn-exit {
            padding: 0.75rem 1.5rem;
            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #fecaca;
            border-radius: 0.75rem;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-exit:hover { background: #fecaca; }
        .progress-container {
            height: 4px;
            background: var(--border);
            width: 100%;
        }
        .progress-bar {
            height: 100%;
            background: var(--primary);
            width: 0%;
            transition: width 0.3s ease;
        }
        .main {
            flex: 1;
            padding: 2rem;
            max-width: 800px;
            margin: 0 auto;
            width: 100%;
        }
        .card {
            background: var(--card);
            border-radius: 1rem;
            padding: 2rem;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            border: 1px solid var(--border);
            margin-bottom: 2rem;
        }
        .question-meta {
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--primary);
            margin-bottom: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .question-text {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 1.5rem;
            white-space: pre-wrap;
        }
        .media { margin-bottom: 1.5rem; border-radius: 0.75rem; overflow: hidden; border: 1px solid var(--border); background: white; display: flex; justify-content: center; }
        .media img, .media video { max-width: 100%; height: auto; display: block; max-height: 400px; object-fit: contain; }
        .options { display: grid; gap: 1rem; }
        .option {
            display: flex;
            align-items: flex-start;
            padding: 1rem 1.5rem;
            border: 2px solid var(--border);
            border-radius: 0.75rem;
            cursor: pointer;
            transition: all 0.2s;
            font-weight: 500;
        }
        .option:hover { border-color: var(--primary); background: #f5f3ff; }
        .option.selected { border-color: var(--primary); background: #f5f3ff; box-shadow: 0 0 0 1px var(--primary); }
        .option input { display: none; }
        .option-icon {
            width: 1.5rem;
            height: 1.5rem;
            border: 2px solid var(--border);
            margin-right: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: all 0.2s;
            margin-top: 0.125rem;
        }
        .option .option-text {
            white-space: pre-wrap;
            flex: 1;
        }
        .option-icon.radio { border-radius: 50%; }
        .option-icon.checkbox { border-radius: 4px; }
        .option.selected .option-icon { border-color: var(--primary); background: var(--primary); }
        .option.selected .option-icon.radio::after {
            content: "";
            width: 0.5rem;
            height: 0.5rem;
            background: white;
            border-radius: 50%;
        }
        .option.selected .option-icon.checkbox::after {
            content: "✓";
            color: white;
            font-size: 1rem;
            font-weight: bold;
        }
        .footer {
            background: white;
            padding: 1.5rem 2rem;
            border-top: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            bottom: 0;
        }
        .btn {
            padding: 0.75rem 1.5rem;
            border-radius: 0.75rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
            font-size: 1rem;
        }
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: var(--primary-hover); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: var(--text-muted); }
        .btn-ghost:hover { background: #f1f5f9; }
        
        #results { text-align: center; padding: 4rem 2rem; }
        .score-circle {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            font-weight: 800;
            margin: 0 auto 2rem;
        }
        .passed { background: #ecfdf5; color: var(--success); }
        .failed { background: #fef2f2; color: var(--error); }
        
        .review-item { border-top: 1px solid var(--border); padding-top: 3rem; margin-top: 3rem; }
        .review-item:first-child { border: 0; padding: 0; margin: 0; }
        .status-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 700;
        }
        .badge-success { background: #ecfdf5; color: var(--success); }
        .badge-error { background: #fef2f2; color: var(--error); }
        
        .option.correct { border-color: var(--success); background: #ecfdf5; }
        .option.incorrect { border-color: var(--error); background: #fef2f2; }
        .option.missed { border-color: var(--warning); border-style: dashed; background: #fffbeb; }
        .correct-label { 
            margin-left: auto; 
            font-size: 0.75rem; 
            color: var(--success); 
            font-weight: 700;
            flex-shrink: 0;
            white-space: nowrap;
            margin-top: 0.125rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .explanation-box {
            margin-top: 1.5rem;
            padding: 1.5rem;
            background: #f1f5f9;
            border-left: 4px solid var(--primary);
            border-radius: 0 0.75rem 0.75rem 0;
            font-size: 0.875rem;
            white-space: pre-wrap;
        }
        .explanation-title {
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--primary);
            margin-bottom: 0.5rem;
        }
        
        .image-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.9);
            z-index: 2000;
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
        
        .cursor-zoom-in { cursor: zoom-in; }
        .hover-opacity:hover { opacity: 0.9; }
        
        .scenario-box {
            margin-bottom: 2rem;
            padding: 1.5rem;
            background: #fffbeb;
            border: 1px solid #fef3c7;
            border-radius: 1rem;
            box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
        }
        .scenario-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.75rem;
            color: #b45309;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .scenario-title {
            font-size: 1.125rem;
            font-weight: 700;
            color: #78350f;
            margin-bottom: 0.5rem;
        }
        .scenario-content {
            font-size: 0.875rem;
            color: #92400e;
            line-height: 1.5;
            white-space: pre-wrap;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-left">
            <h1>${quiz.title}</h1>
        </div>
        <button class="btn-exit" onclick="exitQuiz()">Exit</button>
        <div id="header-meta" style="font-size: 0.875rem; color: var(--text-muted);"></div>
    </div>
    <div class="progress-container" id="progress-container">
        <div class="progress-bar" id="progress-bar"></div>
    </div>

    <div class="main" id="main-content">
        <div id="quiz-view">
            <div class="card" id="question-card">
                <!-- Question content injected here -->
            </div>
        </div>

        <div id="results-view" style="display: none;">
            <div class="card" id="results">
                <div id="score-circle" class="score-circle"></div>
                <h2 id="result-title" style="font-size: 2rem; margin-bottom: 0.5rem;"></h2>
                <p id="result-desc" style="color: var(--text-muted); margin-bottom: 2rem;"></p>
                <div id="results-stats-container"></div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <button class="btn btn-ghost" onclick="showReview()">Review Quiz</button>
                    <button id="restart-btn" class="btn btn-primary" onclick="restartQuiz()">Restart</button>
                </div>
            </div>
        </div>

        <div id="review-view" style="display: none;">
            <div class="card">
                <div id="review-list"></div>
                <button class="btn btn-primary" style="width: 100%; margin-top: 3rem;" onclick="restartQuiz()">Restart Quiz</button>
            </div>
        </div>
    </div>

    <div id="image-overlay" class="image-overlay" onclick="hideEnlargedImage()">
        <img id="enlarged-img" src="" alt="Enlarged view">
    </div>

    <div class="footer" id="quiz-footer">
        <button class="btn btn-ghost" id="prev-btn" onclick="prevQuestion()">Previous</button>
        <button class="btn btn-primary" id="next-btn" onclick="handleNext()">Next</button>
    </div>

    <script>
        // SCORM API Wrapper (SCORM 2004 Only)
        var scorm = {
            api: null,
            isFinished: false,
            startTime: new Date().getTime(),
            debug: function(msg) {
                if (${quiz.enableScormDebug}) {
                    console.log("[SCORM DEBUG] " + msg);
                }
            },
            init: function() {
                this.debug("Initializing SCORM 2004...");
                var api = null;
                var win = window;
                
                function scan(w) {
                    var iterations = 0;
                    while (w) {
                        try {
                            if (w.API_1484_11) { api = w.API_1484_11; return true; }
                        } catch (e) {}
                        if (w.parent && w.parent !== w) w = w.parent;
                        else break;
                        iterations++;
                        if (iterations > 100) break;
                    }
                    return false;
                }

                if (!scan(window)) {
                    if (window.opener) scan(window.opener);
                }

                this.api = api;

                if (this.api) {
                    this.debug("SCORM 2004 API found.");
                    this.api.Initialize("");
                    var status = this.api.GetValue("cmi.completion_status");
                    this.debug("Initial status: " + status);
                    if (status === "unknown" || status === "not attempted") {
                        this.api.SetValue("cmi.completion_status", "incomplete");
                        this.api.SetValue("cmi.success_status", "unknown");
                        this.api.Commit("");
                    }
                } else {
                    this.debug("No SCORM 2004 API found.");
                }
            },
            saveState: function(location, suspendData) {
                this.debug("Saving state - Location: " + location);
                if (this.api) {
                    this.api.SetValue("cmi.location", String(location));
                    this.api.SetValue("cmi.suspend_data", JSON.stringify(suspendData));
                    this.api.SetValue("cmi.exit", "suspend");
                    this.api.Commit("");
                }
            },
            getState: function() {
                this.debug("Getting state...");
                if (this.api) {
                    var state = {
                        location: this.api.GetValue("cmi.location"),
                        suspendData: this.api.GetValue("cmi.suspend_data")
                    };
                    this.debug("State retrieved: " + JSON.stringify(state));
                    return state;
                }
                return null;
            },
            setScore: function(score) {
                this.debug("Setting score: " + score);
                if (this.api) {
                    var passed = score >= ${quiz.passingScore};
                    this.api.SetValue("cmi.score.scaled", score / 100);
                    this.api.SetValue("cmi.score.raw", score);
                    this.api.SetValue("cmi.score.min", 0);
                    this.api.SetValue("cmi.score.max", 100);
                    
                    // Only update status if not already passed/completed
                    var currentSuccess = this.api.GetValue("cmi.success_status");
                    var currentCompletion = this.api.GetValue("cmi.completion_status");
                    
                    if (passed) {
                        this.api.SetValue("cmi.success_status", "passed");
                        this.api.SetValue("cmi.completion_status", "completed");
                    } else {
                        // If not passed, keep success as unknown (never failed) and completion as incomplete
                        if (currentSuccess !== "passed") this.api.SetValue("cmi.success_status", "unknown");
                        if (currentCompletion !== "completed") this.api.SetValue("cmi.completion_status", "incomplete");
                    }
                    this.api.Commit("");
                }
            },
            recordInteraction: function(id, type, response, result, description, correctPattern, latency, timestamp) {
                this.debug("Recording interaction: " + id + " (" + result + ")");
                if (this.api) {
                    try {
                        var n = this.api.GetValue("cmi.interactions._count");
                        this.api.SetValue("cmi.interactions." + n + ".id", id);
                        this.api.SetValue("cmi.interactions." + n + ".type", type);
                        this.api.SetValue("cmi.interactions." + n + ".learner_response", response);
                        this.api.SetValue("cmi.interactions." + n + ".result", result);
                        this.api.SetValue("cmi.interactions." + n + ".description", description);
                        this.api.SetValue("cmi.interactions." + n + ".timestamp", timestamp);
                        this.api.SetValue("cmi.interactions." + n + ".latency", latency);
                        this.api.SetValue("cmi.interactions." + n + ".weighting", "1");
                        
                        if (correctPattern) {
                            this.api.SetValue("cmi.interactions." + n + ".correct_responses.0.pattern", correctPattern);
                        }
                        this.api.Commit("");
                    } catch (e) {}
                }
            },
            finish: function() {
                this.debug("Terminating SCORM session...");
                if (this.api && !this.isFinished) {
                    var endTime = new Date().getTime();
                    var totalTime = endTime - this.startTime;
                    
                    this.api.SetValue("cmi.session_time", formatISODuration(totalTime));
                    var exit = this.api.GetValue("cmi.exit");
                    if (!exit) this.api.SetValue("cmi.exit", "suspend");
                    this.api.Terminate("");
                    this.isFinished = true;
                }
            }
        };

        window.addEventListener('unload', function() {
            scorm.finish();
        });

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

        const quizData = isEncrypted ? JSON.parse(deobfuscate(rawData)) : rawData;
        let currentIdx = 0;
        let userAnswers = [];
        let showFeedback = false;
        let questionStartTimes = [];
        let questionLatencies = [];

        function getLastScenario(idx) {
            const q = quizData.questions[idx];
            if (!q || !q.showScenario) return null;
            
            for (let i = idx - 1; i >= 0; i--) {
                if (quizData.questions[i].type === 'info' && quizData.questions[i].isScenario) {
                    return quizData.questions[i];
                }
            }
            return null;
        }

        function init() {
            scorm.init();
            
            // Check if user passed before
            var isPassed = false;
            if (scorm.api) {
                var successStatus = scorm.api.GetValue("cmi.success_status");
                var completionStatus = scorm.api.GetValue("cmi.completion_status");
                isPassed = successStatus === "passed" || completionStatus === "completed";
            }

            // Resume from bookmark if available
            const state = scorm.getState();
            if (state) {
                if (state.location) {
                    currentIdx = parseInt(state.location);
                }
                if (state.suspendData) {
                    try {
                        userAnswers = JSON.parse(state.suspendData);
                    } catch (e) {
                        console.error("Failed to parse suspend_data", e);
                    }
                }
            }
            
            const actualQuestions = quizData.questions.filter(q => q.type !== 'info');
            const answeredCount = userAnswers.filter((ans, idx) => 
                quizData.questions[idx] && 
                quizData.questions[idx].type !== 'info' && 
                ans && 
                ans.length > 0
            ).length;
            const allAnswered = actualQuestions.length > 0 && answeredCount === actualQuestions.length;

            if (isPassed || currentIdx >= quizData.questions.length || allAnswered) {
                if (allAnswered) {
                    showReview();
                } else {
                    displayResults();
                }
            } else {
                renderQuestion();
            }
        }

        function exitQuiz() {
            if (scorm.api && !scorm.isFinished) {
                // Save state one last time
                scorm.saveState(currentIdx, userAnswers);
                // Set exit to suspend so it resumes
                scorm.api.SetValue("cmi.exit", "suspend");
                scorm.api.Terminate("");
                scorm.isFinished = true;
            }
            // Try to close window if possible, or just show a message
            try {
                window.close();
            } catch (e) {}
            document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:1rem;background:#f8fafc;font-family:sans-serif;"><h1>Quiz Exited</h1><p>Your progress has been saved. You can now close this window.</p></div>';
        }

        function renderQuestion() {
            const q = quizData.questions[currentIdx];
            const card = document.getElementById('question-card');
            const progressBar = document.getElementById('progress-bar');
            const headerMeta = document.getElementById('header-meta');
            
            const totalQuestions = quizData.questions.filter(q => q.type !== 'info').length;
            const currentQuestionNumber = quizData.questions.slice(0, currentIdx).filter(q => q.type !== 'info').length + 1;

            // Track start time for latency calculation
            if (!questionStartTimes[currentIdx]) {
                questionStartTimes[currentIdx] = new Date().getTime();
            }

            progressBar.style.width = q.type === 'info' ? '0%' : (currentQuestionNumber / totalQuestions * 100) + '%';
            headerMeta.innerText = q.type === 'info' ? 'Information' : 'Question ' + currentQuestionNumber + ' of ' + totalQuestions;

            const scenario = getLastScenario(currentIdx);
            let scenarioHtml = '';
            if (scenario) {
                let scenarioMediaHtml = '';
                if (scenario.media) {
                    if (scenario.media.type === 'image') {
                        scenarioMediaHtml = '<div class="media" style="margin-top: 1rem; max-height: 300px;"><img src="' + scenario.media.url + '" referrerPolicy="no-referrer" class="cursor-zoom-in hover-opacity" onclick="showEnlargedImage(\\\'' + scenario.media.url + '\\\')"></div>';
                    } else {
                        scenarioMediaHtml = '<div class="media" style="margin-top: 1rem; max-height: 300px;"><video controls src="' + scenario.media.url + '"></video></div>';
                    }
                }
                scenarioHtml = \`
                    <div class="scenario-box">
                        <div class="scenario-header">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                            <span>Reference Scenario</span>
                        </div>
                        <div class="scenario-title">\${escapeHtml(scenario.text)}</div>
                        \${scenario.content ? \`<div class="scenario-content">\${escapeHtml(scenario.content)}</div>\` : ''}
                        \${scenarioMediaHtml}
                    </div>
                \`;
            }

            let html = \`
                \${scenarioHtml}
                <div class="question-meta">
                    <span>\${q.type === 'info' ? 'Information' : 'Question ' + currentQuestionNumber}</span>
                </div>
                <h2 class="question-text">\${escapeHtml(q.text)}</h2>
                \${q.type === 'info' && q.content ? \`
                    <div style="margin-top: 2rem;">
                        <p style="font-size: 1.125rem; color: var(--text-light); line-height: 1.6; margin-bottom: 2rem; white-space: pre-wrap;">\${escapeHtml(q.content)}</p>
                    </div>
                \` : ''}
            \`;

            if (q.media) {
                html += '<div class="media">';
                if (q.media.type === 'image') html += '<img src="' + q.media.url + '" referrerPolicy="no-referrer" class="cursor-zoom-in hover-opacity" onclick="showEnlargedImage(\\\'' + q.media.url + '\\\')">';
                else html += '<video controls src="' + q.media.url + '"></video>';
                html += '</div>';
            }

            if (q.type === 'info') {
                html += \`
                    <div style="margin-top: 2rem;">
                        <button class="btn btn-primary" onclick="handleNext()" style="display: flex; align-items: center; gap: 0.5rem;">
                            Continue
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        </button>
                    </div>
                \`;
            }

            html += '<div class="options">';
            if (q.type !== 'info') {
                q.options.forEach((opt, idx) => {
                    const isSelected = (userAnswers[currentIdx] || []).includes(idx);
                    const isCorrect = opt.isCorrect;
                    const iconClass = q.type === 'multiple-choice' ? 'checkbox' : 'radio';
                    
                    let extraClass = '';
                    let statusLabel = '';
                    if (showFeedback) {
                        if (isSelected && isCorrect) extraClass = 'correct';
                        else if (isSelected && !isCorrect) extraClass = 'incorrect';
                        else if (!isSelected && isCorrect) extraClass = 'missed';
                        
                        if (isCorrect) statusLabel = '<span class="correct-label">Correct Answer</span>';
                    } else if (isSelected) {
                        extraClass = 'selected';
                    }

                    html += \`
                        <div class="option \${extraClass}" onclick="if(!showFeedback) toggleOption(\${idx})">
                            <div class="option-icon \${iconClass}"></div>
                            <span class="option-text">\${escapeHtml(opt.text)}</span>
                            \${statusLabel}
                        </div>
                    \`;
                });
            }
            html += '</div>';

            if (showFeedback && q.explanation) {
                html += \`
                    <div class="explanation-box">
                        <div class="explanation-title">Explanation</div>
                        \${escapeHtml(q.explanation)}
                    </div>
                \`;
            }
            
            card.innerHTML = html;
            
            document.getElementById('prev-btn').disabled = currentIdx === 0 || (quizData.showImmediateFeedback);
            const nextBtn = document.getElementById('next-btn');
            if (quizData.showImmediateFeedback && !showFeedback && q.type !== 'info') {
                nextBtn.innerText = 'Check Answer';
            } else {
                nextBtn.innerText = currentIdx === quizData.questions.length - 1 ? 'Finish Quiz' : 'Next';
            }
            nextBtn.disabled = q.type !== 'info' && (userAnswers[currentIdx] || []).length === 0;
        }

        function toggleOption(idx) {
            if (showFeedback) return;
            const q = quizData.questions[currentIdx];
            let current = userAnswers[currentIdx] || [];
            
            if (q.type === 'multiple-choice') {
                if (current.includes(idx)) current = current.filter(i => i !== idx);
                else current.push(idx);
            } else {
                current = [idx];
            }
            
            userAnswers[currentIdx] = current;
            scorm.saveState(currentIdx, userAnswers);
            renderQuestion();
        }

        function prevQuestion() {
            if (currentIdx > 0) {
                // Record latency so far
                const now = new Date().getTime();
                questionLatencies[currentIdx] = (questionLatencies[currentIdx] || 0) + (now - questionStartTimes[currentIdx]);
                questionStartTimes[currentIdx] = null; // Reset for next entry

                currentIdx--;
                scorm.saveState(currentIdx, userAnswers);
                renderQuestion();
            }
        }

        function handleNext() {
            const q = quizData.questions[currentIdx];
            if (quizData.showImmediateFeedback && !showFeedback && q.type !== 'info') {
                showFeedback = true;
                renderQuestion();
                return;
            }

            // Record latency
            const now = new Date().getTime();
            questionLatencies[currentIdx] = (questionLatencies[currentIdx] || 0) + (now - questionStartTimes[currentIdx]);
            questionStartTimes[currentIdx] = null; // Reset

            if (currentIdx < quizData.questions.length - 1) {
                currentIdx++;
                showFeedback = false;
                scorm.saveState(currentIdx, userAnswers);
                renderQuestion();
            } else {
                finishQuiz();
            }
        }

        function formatISODuration(ms) {
            if (ms < 0) ms = 0;
            var seconds = Math.floor(ms / 1000);
            var minutes = Math.floor(seconds / 60);
            seconds = seconds % 60;
            var hours = Math.floor(minutes / 60);
            minutes = minutes % 60;
            var res = "PT";
            if (hours > 0) res += hours + "H";
            if (minutes > 0 || hours > 0) res += minutes + "M";
            res += seconds + "S";
            return res;
        }

        function format12Duration(ms) {
            if (ms < 0) ms = 0;
            var seconds = Math.floor(ms / 1000);
            var minutes = Math.floor(seconds / 60);
            seconds = seconds % 60;
            var hours = Math.floor(minutes / 60);
            minutes = minutes % 60;
            var h = ("0000" + hours).slice(-4);
            var m = ("00" + minutes).slice(-2);
            var s = ("00" + seconds).slice(-2);
            return h + ":" + m + ":" + s;
        }

        function restartQuiz() {
            currentIdx = 0;
            userAnswers = [];
            showFeedback = false;
            questionStartTimes = [];
            questionLatencies = [];
            
            if (scorm.api) {
                scorm.saveState(0, []);
            }

            document.getElementById('results-view').style.display = 'none';
            document.getElementById('review-view').style.display = 'none';
            document.getElementById('quiz-view').style.display = 'block';
            document.getElementById('quiz-footer').style.display = 'flex';
            document.getElementById('progress-container').style.display = 'block';
            
            renderQuestion();
        }

        function displayResults() {
            const results = getResults();
            const score = results.score;
            const correctCount = results.correctCount;
            const totalCount = results.totalCount;
            const passed = score >= quizData.passingScore;

            document.getElementById('quiz-view').style.display = 'none';
            document.getElementById('quiz-footer').style.display = 'none';
            document.getElementById('progress-container').style.display = 'none';
            document.getElementById('results-view').style.display = 'block';

            const circle = document.getElementById('score-circle');
            circle.innerText = score + '%';
            circle.className = 'score-circle ' + (passed ? 'passed' : 'failed');
            
            document.getElementById('result-title').innerText = passed ? 'Congratulations!' : 'Keep Practicing!';
            document.getElementById('result-desc').innerText = (passed ? 'You completed ' : 'You reached the end of ') + quizData.title;
            
            const statsContainer = document.getElementById('results-stats-container');
            statsContainer.innerHTML = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">' +
                    '<div style="background: var(--bg); padding: 1.5rem; border-radius: 1rem; text-align: center;">' +
                        '<p style="text-transform: uppercase; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.5rem;">Your Score</p>' +
                        '<p style="font-size: 1.5rem; font-weight: 800; color: ' + (passed ? 'var(--success)' : 'var(--error)') + ';">' + score + '%</p>' +
                        '<p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">' + correctCount + ' of ' + totalCount + ' correct</p>' +
                    '</div>' +
                    '<div style="background: var(--bg); padding: 1.5rem; border-radius: 1rem; text-align: center;">' +
                        '<p style="text-transform: uppercase; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.5rem;">Passing Score</p>' +
                        '<p style="font-size: 1.5rem; font-weight: 800; color: var(--text);">' + quizData.passingScore + '%</p>' +
                        '<p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">Required to pass</p>' +
                    '</div>' +
                '</div>' +
                '<div style="padding: 1rem; border-radius: 0.75rem; font-weight: 700; font-size: 0.875rem; margin-bottom: 2rem; background: ' + (passed ? '#ecfdf5' : '#fef2f2') + '; color: ' + (passed ? '#047857' : '#b91c1c') + '; border: 1px solid ' + (passed ? '#d1fae5' : '#fee2e2') + ';">' +
                    (passed ? 'You have successfully passed this quiz!' : 'You did not pass this time.') +
                '</div>';
            
            const restartBtn = document.getElementById('restart-btn');
            if (passed) {
                restartBtn.innerText = 'Save and Exit';
                restartBtn.onclick = exitQuiz;
            } else {
                restartBtn.innerText = 'Restart';
                restartBtn.onclick = restartQuiz;
            }
        }

        function finishQuiz() {
            const results = getResults();
            const score = results.score;
            const passed = score >= quizData.passingScore;
            
            scorm.setScore(score);

            // Record interactions for each question
            quizData.questions.forEach((q, qIdx) => {
                if (q.type === 'info') return;

                const userAns = userAnswers[qIdx] || [];
                const correctIndices = q.options.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1);
                const isCorrect = q.type === 'multiple-choice' 
                    ? (userAns.length === correctIndices.length && userAns.every(val => correctIndices.includes(val)))
                    : (userAns.length === 1 && correctIndices.includes(userAns[0]));

                // Use the text of the choices as the response
                const responseText = userAns.map(idx => q.options[idx].text).join('[,]');
                const correctPattern = correctIndices.map(idx => q.options[idx].text).join('[,]');
                const result = isCorrect ? "correct" : "incorrect";
                const latency = formatISODuration(questionLatencies[qIdx] || 0);
                const timestamp = new Date().toISOString();

                scorm.recordInteraction(
                    'question_' + String(qIdx + 1).padStart(2, '0'),
                    'choice',
                    responseText,
                    result,
                    q.text,
                    correctPattern,
                    latency,
                    timestamp
                );
            });

            displayResults();
            
            if (scorm.api) {
                // Always save state at the end index so relaunch resumes here
                scorm.saveState(quizData.questions.length, userAnswers);

                if (passed) {
                    if (scorm.version === "2004") scorm.api.SetValue("cmi.exit", "normal");
                    else scorm.api.LMSSetValue("cmi.core.exit", "");
                    scorm.finish();
                }
            }
        }

        function getResults() {
            let correctCount = 0;
            const actualQuestions = quizData.questions.filter(q => q.type !== 'info');
            if (actualQuestions.length === 0) return { score: 100, correctCount: 0, totalCount: 0 };

            quizData.questions.forEach((q, idx) => {
                if (q.type === 'info') return;
                const userAns = userAnswers[idx] || [];
                const correctIndices = q.options.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1);
                const isCorrect = q.type === 'multiple-choice' 
                    ? (userAns.length === correctIndices.length && userAns.every(val => correctIndices.includes(val)))
                    : (userAns.length === 1 && correctIndices.includes(userAns[0]));
                if (isCorrect) correctCount++;
            });
            const score = Math.round((correctCount / actualQuestions.length) * 100);
            return { score, correctCount, totalCount: actualQuestions.length };
        }

        function showReview() {
            document.getElementById('quiz-view').style.display = 'none';
            document.getElementById('quiz-footer').style.display = 'none';
            document.getElementById('progress-container').style.display = 'none';
            document.getElementById('results-view').style.display = 'none';
            document.getElementById('review-view').style.display = 'block';
            
            const results = getResults();
            const score = results.score;
            const passed = score >= quizData.passingScore;
            
            const list = document.getElementById('review-list');
            let html = '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3rem; padding-bottom: 2rem; border-bottom: 1px solid var(--border);">' +
                    '<div>' +
                        '<h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">Quiz Review</h2>' +
                        '<p style="color: var(--text-muted); font-size: 0.875rem;">Review your answers and see the correct ones below.</p>' +
                    '</div>' +
                    '<div style="text-align: right;">' +
                        '<p style="text-transform: uppercase; font-size: 0.65rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.25rem; letter-spacing: 0.05em;">Your Score</p>' +
                        '<p style="font-size: 2rem; font-weight: 900; color: ' + (passed ? 'var(--success)' : 'var(--error)') + '; line-height: 1;">' + score + '%</p>' +
                        '<p style="font-size: 0.65rem; color: var(--text-muted); margin-top: 0.25rem;">' + results.correctCount + ' of ' + results.totalCount + ' correct</p>' +
                    '</div>' +
                '</div>';
            
            quizData.questions.forEach((q, qIdx) => {
                const userAns = userAnswers[qIdx] || [];
                const correctIndices = q.options.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1);
                const isCorrect = q.type === 'multiple-choice' 
                    ? (userAns.length === correctIndices.length && userAns.every(val => correctIndices.includes(val)))
                    : (userAns.length === 1 && correctIndices.includes(userAns[0]));

                const qNum = quizData.questions.slice(0, qIdx).filter(prevQ => prevQ.type !== 'info').length + 1;

                const scenario = getLastScenario(qIdx);
                let scenarioHtml = '';
                if (scenario) {
                    let scenarioMediaHtml = '';
                    if (scenario.media) {
                        if (scenario.media.type === 'image') {
                            scenarioMediaHtml = '<div class="media" style="margin-top: 1rem; max-height: 300px;"><img src="' + scenario.media.url + '" referrerPolicy="no-referrer" class="cursor-zoom-in hover-opacity" onclick="showEnlargedImage(\\\'' + scenario.media.url + '\\\')"></div>';
                        } else {
                            scenarioMediaHtml = '<div class="media" style="margin-top: 1rem; max-height: 300px;"><video controls src="' + scenario.media.url + '"></video></div>';
                        }
                    }
                    scenarioHtml = \`
                        <div class="scenario-box">
                            <div class="scenario-header">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                                <span>Reference Scenario</span>
                            </div>
                            <div class="scenario-title">\${escapeHtml(scenario.text)}</div>
                            \${scenario.content ? \`<div class="scenario-content">\${escapeHtml(scenario.content)}</div>\` : ''}
                            \${scenarioMediaHtml}
                        </div>
                    \`;
                }

                html += \`
                    <div class="review-item">
                        \${scenarioHtml}
                        <div class="question-meta">
                            <span>\${q.type === 'info' ? 'Information' : 'Question ' + qNum}</span>
                            \${q.type !== 'info' ? \`<span class="status-badge \${isCorrect ? 'badge-success' : 'badge-error'}">\${isCorrect ? 'CORRECT' : 'INCORRECT'}</span>\` : ''}
                        </div>
                        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1.5rem; white-space: pre-wrap;">\${escapeHtml(q.text)}</h3>
                        \${q.type === 'info' && q.content ? \`<p style="font-size: 1rem; color: var(--text-light); line-height: 1.5; margin-bottom: 1.5rem; white-space: pre-wrap;">\${escapeHtml(q.content)}</p>\` : ''}
                \`;

                if (q.media) {
                    html += '<div class="media" style="max-width: 400px;">';
                    if (q.media.type === 'image') html += '<img src="' + q.media.url + '" referrerPolicy="no-referrer" class="cursor-zoom-in hover-opacity" onclick="showEnlargedImage(\\\'' + q.media.url + '\\\')">';
                    else html += '<video controls src="' + q.media.url + '"></video>';
                    html += '</div>';
                }

                html += '<div class="options">';
                if (q.type !== 'info') {
                    q.options.forEach((opt, oIdx) => {
                        const isSelected = userAns.includes(oIdx);
                        const isCorrectOpt = opt.isCorrect;
                        let stateClass = '';
                        if (isSelected && isCorrectOpt) stateClass = 'correct';
                        else if (isSelected && !isCorrectOpt) stateClass = 'incorrect';
                        else if (!isSelected && isCorrectOpt) stateClass = 'missed';

                        const iconClass = q.type === 'multiple-choice' ? 'checkbox' : 'radio';
                        html += \`
                            <div class="option \${stateClass}">
                                <div class="option-icon \${iconClass}"></div>
                                <span class="option-text">\${escapeHtml(opt.text)}</span>
                                \${isCorrectOpt ? '<span class="correct-label">Correct Answer</span>' : ''}
                            </div>
                        \`;
                    });
                }
                html += '</div>';

                if (q.explanation) {
                    html += \`
                        <div class="explanation-box">
                            <div class="explanation-title">Explanation</div>
                            <div style="color: var(--text);">\${escapeHtml(q.explanation)}</div>
                        </div>
                    \`;
                }

                html += '</div>';
            });
            
            list.innerHTML = html;
        }

        window.addEventListener('keydown', (e) => {
            if (document.getElementById('results-view').style.display === 'block' || 
                document.getElementById('review-view').style.display === 'block') return;
            
            if (e.key === 'ArrowLeft') {
                if (quizData.showImmediateFeedback) return;
                prevQuestion();
            } else if (e.key === 'ArrowRight') {
                const q = quizData.questions[currentIdx];
                const canGoNext = q.type === 'info' || (userAnswers[currentIdx] || []).length > 0;
                if (canGoNext) {
                    handleNext();
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

        window.onload = init;
    </script>
</body>
</html>`;

  zip.file("imsmanifest.xml", manifest);
  zip.file("index.html", playerHtml);

  const content = await zip.generateAsync({ type: "blob" });
  return content;
};

import * as ui from './ui.js';

// State
let questions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let flaggedQuestions = new Set();
let timerInterval;
let saveStateTimer;
const EXAM_DURATION = 90 * 60; // Exam duration (seconds)
const TOTAL_QUESTIONS = 60; // Number of questions per sitting
const STORAGE_KEY = 'theorylvl3_exam_start_time';
const END_TIME_KEY = 'theorylvl3_exam_end_time';
const STATE_KEY = 'theorylvl3_exam_state';
const QUESTIONS_KEY = 'theorylvl3_exam_questions';

// Cookie key for the question plan (not the full dataset)
const PLAN_KEY = 'theorylvl3_exam_plan';

function seededRandom(seed) {
    // Mulberry32 PRNG
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

function shuffleArray(array, seed = null) {
    // Fisher-Yates shuffle (optional seed)
    let random = Math.random;
    if (seed !== null) {
        random = () => seededRandom(seed++);
    }
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Shuffle an array in-place with a seed
function shuffleArrayInPlace(array, seed) {
    let random = () => seededRandom(seed++);
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Cookie helpers
function setCookie(name, value, hours) {
    const expires = new Date(Date.now() + hours * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}
function getCookie(name) {
    const cookies = document.cookie.split(';');
    for (let c of cookies) {
        let [k, v] = c.trim().split('=');
        if (k === name) return decodeURIComponent(v || '');
    }
    return null;
}
function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

// Plan save/load helpers
function saveQuestionPlan(plan) {
    setCookie(PLAN_KEY, JSON.stringify({ v: 1, ...plan }), EXAM_COOKIE_HOURS);
}
function loadQuestionPlan() {
    const s = getCookie(PLAN_KEY);
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
}

const EXAM_COOKIE_HOURS = 3;

function saveExamState() {
    const state = {
        currentQuestionIndex,
        userAnswers,
        flaggedQuestions: Array.from(flaggedQuestions)
    };
    setCookie(STATE_KEY, JSON.stringify(state), EXAM_COOKIE_HOURS);
}

function loadExamState() {
    const stateStr = getCookie(STATE_KEY);
    if (!stateStr) return null;
    try {
        const state = JSON.parse(stateStr);
        return {
            currentQuestionIndex: state.currentQuestionIndex || 0,
            userAnswers: state.userAnswers || {},
            flaggedQuestions: new Set(state.flaggedQuestions || [])
        };
    } catch {
        return null;
    }
}

// Start time for timer (cookie-backed)
function saveExamStartTime(ts) {
    setCookie(STORAGE_KEY, ts.toString(), EXAM_COOKIE_HOURS);
}
function loadExamStartTime() {
    const val = getCookie(STORAGE_KEY);
    return val ? parseInt(val, 10) : null;
}

// End-time helpers (stable across browsers)
function saveExamEndTime(ts) {
    setCookie(END_TIME_KEY, ts.toString(), EXAM_COOKIE_HOURS);
}
function loadExamEndTime() {
    const val = getCookie(END_TIME_KEY);
    return val ? parseInt(val, 10) : null;
}

async function loadQuestions() {
    // Rebuild the questions list from a stored plan when possible
    const plan = loadQuestionPlan();

    try {
        const response = await fetch('questions.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const allQuestions = await response.json();

        if (allQuestions.length < TOTAL_QUESTIONS) {
            ui.showError(`Question pool has only ${allQuestions.length} questions. Exam requires exactly ${TOTAL_QUESTIONS}.`);
            questions = [];
            return;
        }

        if (plan) {
            // Prefer stored IDs when available
            if (Array.isArray(plan.selectedIds) && plan.selectedIds.length === TOTAL_QUESTIONS) {
                const byId = new Map(allQuestions.map(q => [q.id, q]));
                const rebuilt = plan.selectedIds.map(id => byId.get(id)).filter(Boolean);
                if (rebuilt.length === TOTAL_QUESTIONS) {
                    questions = rebuilt;
                    // Apply recorded option shuffles if present
                    if (plan.optionsShuffles && Array.isArray(plan.optionsShuffles)) {
                        questions.forEach((q, idx) => {
                            if (plan.optionsShuffles[idx]) {
                                const origOptions = [...q.options];
                                q.options = plan.optionsShuffles[idx].map(i => origOptions[i]);
                            }
                        });
                    }
                    return;
                }
                // If IDs missing, fall through to indices/seed
            }

            // Otherwise, use stored indices (if pool length matches)
            if (
                Array.isArray(plan.selectedIndices) &&
                plan.selectedIndices.length === TOTAL_QUESTIONS &&
                (plan.poolLen == null || plan.poolLen === allQuestions.length) &&
                plan.selectedIndices.every(i => Number.isInteger(i) && i >= 0 && i < allQuestions.length)
            ) {
                questions = plan.selectedIndices.map(i => allQuestions[i]);
                // Apply recorded option shuffles if present
                if (plan.optionsShuffles && Array.isArray(plan.optionsShuffles)) {
                    questions.forEach((q, idx) => {
                        if (plan.optionsShuffles[idx]) {
                            const origOptions = [...q.options];
                            q.options = plan.optionsShuffles[idx].map(i => origOptions[i]);
                        }
                    });
                }
                return;
            }

            // 3) Last resort: re-shuffle using the saved seed (works if the pool hasn’t changed)
            if (Number.isInteger(plan.seed)) {
                const allIdx = Array.from({ length: allQuestions.length }, (_, i) => i);
                shuffleArray(allIdx, plan.seed);
                questions = allIdx.slice(0, TOTAL_QUESTIONS).map(i => allQuestions[i]);
                // Restore option shuffles if present
                if (plan.optionsShuffles && Array.isArray(plan.optionsShuffles)) {
                    questions.forEach((q, idx) => {
                        if (plan.optionsShuffles[idx]) {
                            const origOptions = [...q.options];
                            q.options = plan.optionsShuffles[idx].map(i => origOptions[i]);
                        }
                    });
                }
                // Save canonical indices for stability in this sitting
                saveQuestionPlan({
                    seed: plan.seed,
                    selectedIndices: allIdx.slice(0, TOTAL_QUESTIONS),
                    selectedIds: questions.every(q => q && (typeof q.id === 'string' || typeof q.id === 'number'))
                        ? questions.map(q => q.id)
                        : null,
                    poolLen: allQuestions.length,
                    optionsShuffles: plan.optionsShuffles || null
                });
                return;
            }

            // No workable plan � ask user to restart
            ui.showError("Exam session is invalid or expired. Please restart the exam.");
            questions = [];
            return;
        }

        // No plan yet � load a preview slice for start screen
        // (Randomization only occurs in startExam())
        questions = allQuestions.slice(0, TOTAL_QUESTIONS);

    } catch (error) {
        console.error("Could not load questions:", error);
        ui.showError("Failed to load exam questions. Please try refreshing the page.");
        questions = [];
    }
}

export async function init() {
    await loadQuestions();
    const startTime = loadExamStartTime();
    if (startTime) {
        // Exam in progress, restore state
        const state = loadExamState();
        if (state) {
            currentQuestionIndex = state.currentQuestionIndex;
            // Deep clone userAnswers to avoid prototype issues
            userAnswers = Object.assign({}, state.userAnswers);
            // Ensure flaggedQuestions is a Set
            flaggedQuestions = new Set(state.flaggedQuestions instanceof Set ? Array.from(state.flaggedQuestions) : state.flaggedQuestions);
        }
        ui.showScreen('exam-screen');
        ui.createProgressBar(questions.length);
        showQuestion(currentQuestionIndex);
        startTimer();
    }
}

export function startExam() {
    // Randomize and save a plan for this sitting
    fetch('questions.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(allQuestions => {
            if (allQuestions.length < TOTAL_QUESTIONS) {
                ui.showError(`Question pool has only ${allQuestions.length} questions. Exam requires exactly ${TOTAL_QUESTIONS}.`);
                return;
            }

            // Deterministic seed for this sitting
            const now = Date.now();
            const extra = Math.floor(Math.random() * 1000000);
            const seed = now ^ extra;

            // Shuffle indices deterministically
            const allIdx = Array.from({ length: allQuestions.length }, (_, i) => i);
            shuffleArray(allIdx, seed);

            // Pick exactly TOTAL_QUESTIONS indices
            const selectedIndices = allIdx.slice(0, TOTAL_QUESTIONS);

            // Build questions in that order
            questions = selectedIndices.map(i => allQuestions[i]);

            // Shuffle options per question and record the order
            const optionsShuffles = [];
            questions.forEach((q, idx) => {
                // Save original options
                const origOptions = [...q.options];
                // Indices to shuffle
                const optionIndices = origOptions.map((_, i) => i);
                // Deterministic per-question seed
                shuffleArrayInPlace(optionIndices, seed + idx * 1000);
                // Apply shuffle to options
                q.options = optionIndices.map(i => origOptions[i]);
                // Store shuffle order
                optionsShuffles[idx] = optionIndices;
            });

            // If questions have IDs, store them too
            const selectedIds = questions.every(q => q && (typeof q.id === 'string' || typeof q.id === 'number'))
                ? questions.map(q => q.id)
                : null;

            // Save only the plan (not full questions)
            saveQuestionPlan({
                seed,
                selectedIndices,
                selectedIds,            // may be null if your data has no IDs
                poolLen: allQuestions.length,
                optionsShuffles
            });

            // Reset runtime state
            currentQuestionIndex = 0;
            userAnswers = {};
            flaggedQuestions.clear();

            // Persist start/end time
            const now2 = Date.now();
            saveExamStartTime(now2);
            saveExamEndTime(now2 + EXAM_DURATION * 1000);
            saveExamState();

            ui.showScreen('exam-screen');
            ui.createProgressBar(questions.length);
            showQuestion(currentQuestionIndex);
            startTimer();
        })
        .catch(error => {
            console.error("Could not load questions:", error);
            ui.showError("Failed to load exam questions. Please try refreshing the page.");
        });
}

function showQuestion(index) {
    if (index < 0 || index >= questions.length) return;
    currentQuestionIndex = index;
    const question = questions[index];

    ui.renderQuestion(question, userAnswers[index], index + 1, questions.length);
    ui.updateProgressBar(questions.length, userAnswers, flaggedQuestions, currentQuestionIndex);
    ui.updateFlagButton(flaggedQuestions.has(currentQuestionIndex));

    ui.prevBtn.disabled = index === 0;
    ui.nextBtn.disabled = index === questions.length - 1;
    scheduleSaveExamState();
}

export function selectAnswer(index, answer, isMulti = false) {
    if (!Array.isArray(userAnswers[index])) {
        userAnswers[index] = [];
    }
    if (isMulti) {
        // Toggle membership for multi-select questions
        if (userAnswers[index].includes(answer)) {
            userAnswers[index] = userAnswers[index].filter(a => a !== answer);
        } else {
            userAnswers[index].push(answer);
        }
    } else {
        // Single-select: replace any previous selection with the new one
        userAnswers[index] = [answer];
    }
    ui.updateProgressBar(questions.length, userAnswers, flaggedQuestions, currentQuestionIndex);
    scheduleSaveExamState();
}

export function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
        showQuestion(currentQuestionIndex + 1);
    }
}

export function prevQuestion() {
    if (currentQuestionIndex > 0) {
        showQuestion(currentQuestionIndex - 1);
    }
}

export function goToQuestion(index) {
    // Guard index and update UI
    if (typeof index === 'number' && index >= 0 && index < questions.length) {
        showQuestion(index);
    }
    // Ignore invalid index
}

export function toggleFlag() {
    if (flaggedQuestions.has(currentQuestionIndex)) {
        flaggedQuestions.delete(currentQuestionIndex);
    } else {
        flaggedQuestions.add(currentQuestionIndex);
    }
    ui.updateFlagButton(flaggedQuestions.has(currentQuestionIndex));
    ui.updateProgressBar(questions.length, userAnswers, flaggedQuestions, currentQuestionIndex);
    scheduleSaveExamState();
}

function getTimeLeft() {
    // Prefer fixed end time for stability
    const endTime = loadExamEndTime();
    const now = Date.now();
    if (endTime && Number.isFinite(endTime)) {
        const remaining = Math.ceil((endTime - now) / 1000);
        return Math.max(remaining, 0);
    }
    // Fallback to start time if end not present
    const startTime = loadExamStartTime();
    if (!startTime) return EXAM_DURATION;
    const elapsed = Math.floor((now - startTime) / 1000);
    return Math.max(EXAM_DURATION - elapsed, 0);
}

// Debounce state saves during rapid interactions
function scheduleSaveExamState() {
    if (saveStateTimer) clearTimeout(saveStateTimer);
    saveStateTimer = setTimeout(() => {
        saveExamState();
        saveStateTimer = null;
    }, 200);
}

function startTimer() {
    clearInterval(timerInterval);
    let timeLeft = getTimeLeft();
    ui.updateTimerDisplay(timeLeft, EXAM_DURATION);

    timerInterval = setInterval(() => {
        timeLeft = getTimeLeft();
        ui.updateTimerDisplay(timeLeft, EXAM_DURATION);
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            // Auto-submit on timeout
            submitExam();
        }
    }, 1000);
}

export function handleSubmitAttempt() {
    if (flaggedQuestions.size > 0) {
        const sortedFlagged = [...flaggedQuestions].sort((a, b) => a - b);
        const flaggedDetails = sortedFlagged.map(index => ({
            index,
            text: questions[index].question
        }));
        ui.showFlaggedQuestionsModal(flaggedDetails);
    } else {
        const unansweredCount = questions.length - Object.keys(userAnswers).length;
        if (unansweredCount > 0) {
            // Warn about unanswered, allow submit on confirm
            if (!confirm(`You have ${unansweredCount} unanswered question(s). Are you sure you want to submit?`)) {
                return;
            }
        } else if (!confirm('Are you sure you want to submit the exam?')) {
            return;
        }
        // Submit if confirmed
        submitExam();
    }
}

export function submitExam() {
    clearInterval(timerInterval);
    // Allow submission if questions are loaded; warn if count differs
    if (!questions || questions.length === 0) {
        ui.showError(`Cannot submit: No questions loaded.`);
        return;
    }
    if (questions.length !== TOTAL_QUESTIONS) {
        ui.showError(`Warning: Exam does not have exactly ${TOTAL_QUESTIONS} questions. Results will be shown for ${questions.length} questions.`);
        // Continue to show results for loaded questions
    }
    clearExamCookies();
    ui.showScreen('results-screen');
    calculateResults();
}

// Compare answers (string or array)
function answersMatch(userAnswer, correctAnswer) {
    if (Array.isArray(correctAnswer)) {
        // Multiple correct answers
        if (!Array.isArray(userAnswer)) return false;
        if (userAnswer.length !== correctAnswer.length) return false;
        // Compare arrays order-insensitively
        const a = [...userAnswer].sort();
        const b = [...correctAnswer].sort();
        return a.every((val, idx) => val === b[idx]);
    } else {
        // Single correct answer
        if (Array.isArray(userAnswer)) {
            // If userAnswer is array, check if it contains only the correct answer
            return userAnswer.length === 1 && userAnswer[0] === correctAnswer;
        }
        return userAnswer === correctAnswer;
    }
}

function calculateResults() {
    let correctAnswers = 0;
    const results = questions.map((question, index) => {
        const userAnswer = userAnswers[index];
        const correctAnswer = question.answer;
        const isCorrect = answersMatch(userAnswer, correctAnswer);
        if (isCorrect) {
            correctAnswers++;
        }
        // Format answers for display
        const userAnswerDisplay = Array.isArray(userAnswer)
            ? (userAnswer.length ? userAnswer.join(', ') : 'Not answered')
            : (userAnswer || 'Not answered');
        const correctAnswerDisplay = Array.isArray(correctAnswer)
            ? correctAnswer.join(', ')
            : correctAnswer;
        return {
            question: question.question,
            userAnswer: userAnswerDisplay,
            correctAnswer: correctAnswerDisplay,
            isCorrect,
            reference: question.reference // Pass reference to UI
        };
    });

    const percentage = Math.round((correctAnswers / questions.length) * 100);
    ui.renderResults(percentage, correctAnswers, questions.length, results);
}

export function restartExam() {
    clearInterval(timerInterval);
    clearExamCookies();
    // Clear all state
    currentQuestionIndex = 0;
    userAnswers = {};
    flaggedQuestions.clear();
    questions = [];

    // Reload non-random preview; startExam will randomize
    loadQuestions().then(() => {
        ui.showScreen('start-screen');
    }).catch(error => {
        console.error("Failed to reload questions after restart:", error);
        ui.showError("Failed to reload questions. Please refresh the page.");
    });
}

// Clear all exam cookies
function clearExamCookies() {
    deleteCookie(STORAGE_KEY);
    deleteCookie(END_TIME_KEY);
    deleteCookie(STATE_KEY);
    deleteCookie(QUESTIONS_KEY);
    deleteCookie(PLAN_KEY);
}


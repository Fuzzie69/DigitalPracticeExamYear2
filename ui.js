import { selectAnswer, goToQuestion } from './quiz.js';

// DOM elements
export const startScreen = document.getElementById('start-screen');
const examScreen = document.getElementById('exam-screen');
const resultsScreen = document.getElementById('results-screen');

export const startBtn = document.getElementById('start-btn');
export const prevBtn = document.getElementById('prev-btn');
export const nextBtn = document.getElementById('next-btn');
export const flagBtn = document.getElementById('flag-btn');
export const submitBtn = document.getElementById('submit-btn');
export const restartBtn = document.getElementById('restart-btn');
export const restartExamBtn = document.getElementById('restart-exam-btn');

const questionCounter = document.getElementById('question-counter');
const timerBar = document.getElementById('timer-bar');
const timerLabel = document.getElementById('timer-label');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
export const progressBar = document.getElementById('progress-bar');

const scorePercentage = document.getElementById('score-percentage');
const correctCount = document.getElementById('correct-count');
const totalCount = document.getElementById('total-count');
const resultsDetails = document.getElementById('results-details');

// Modal elements
export const flagModal = document.getElementById('flag-modal');
export const closeModalBtn = document.querySelector('.close-btn');
const flaggedQuestionsList = document.getElementById('flagged-questions-list');
export const submitAnywayBtn = document.getElementById('submit-anyway-btn');

const screens = {
    'start-screen': startScreen,
    'exam-screen': examScreen,
    'results-screen': resultsScreen
};

export function showScreen(screenId) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    if (screens[screenId]) {
        screens[screenId].classList.add('active');
    }
}

export function createProgressBar(numQuestions) {
    progressBar.innerHTML = '';
    for (let i = 0; i < numQuestions; i++) {
        const box = document.createElement('div');
        box.className = 'progress-box';
        box.dataset.index = i; // data-index for navigation
        box.textContent = i + 1;
        progressBar.appendChild(box);
    }
}

export function updateProgressBar(numQuestions, answers, flagged, currentIndex) {
    const boxes = document.querySelectorAll('.progress-box');
    boxes.forEach((box, index) => {
        box.classList.remove('answered', 'flagged', 'current');

        if (flagged.has(index)) {
            box.classList.add('flagged');
        } else if (answers.hasOwnProperty(index)) {
            box.classList.add('answered');
        }

        if (index === currentIndex) {
            box.classList.add('current');
        }
    });
}

export function renderQuestion(question, selectedAnswers, qNumber, qTotal) {
    questionText.textContent = question.question;
    optionsContainer.innerHTML = '';

    // Render media (images) after the question text when provided
    const questionContainer = document.getElementById('question-container');
    // Remove any existing media elements for previous question
    questionContainer.querySelectorAll('.question-media').forEach(el => el.remove());

    const toMediaArray = (q) => {
        if (Array.isArray(q.images) && q.images.length > 0) return q.images;
        if (q.image) return [{ src: q.image, alt: q.imageAlt || '', caption: q.imageCaption || '' }];
        return [];
    };
    const resolveMediaSrc = (src) => {
        if (!src) return '';
        // If already under assets/, keep as-is; else prefix with assets/img/
        if (src.startsWith('assets/')) return src;
        if (src.startsWith('./assets/')) return src.slice(2);
        return `assets/img/${src}`;
    };

    const media = toMediaArray(question);
    // Data attribute for testing/inspection
    questionContainer.setAttribute('data-media-count', String(media.length));

    if (media.length > 0) {
        // Insert each media figure directly after the question text
        media.forEach((m) => {
            const figure = document.createElement('figure');
            figure.className = 'question-media';

            const img = document.createElement('img');
            img.loading = 'lazy';
            img.alt = typeof m.alt === 'string' ? m.alt : '';
            img.src = resolveMediaSrc(m.src);

            const figcapText = typeof m.caption === 'string' && m.caption.trim().length > 0
                ? m.caption
                : '';
            const figcaption = document.createElement('figcaption');
            if (figcapText) figcaption.textContent = figcapText;

            img.onerror = () => {
                figure.classList.add('media-error');
                // Provide a graceful fallback message
                if (!figcaption.textContent) {
                    figcaption.textContent = 'Image unavailable';
                }
            };

            figure.appendChild(img);
            if (figcaption.textContent) figure.appendChild(figcaption);
            // Insert after the question text node
            questionText.insertAdjacentElement('afterend', figure);
        });
    }

    // Enforce single-answer selection across the app
    const isMulti = false;

    question.options.forEach(option => {
        const label = document.createElement('label');
        label.className = 'option';
        const input = document.createElement('input');
        input.type = isMulti ? 'checkbox' : 'radio';
        input.name = 'question' + qNumber; // radio group per question
        input.value = option;

        if (selectedAnswers && selectedAnswers.includes(option)) {
            input.checked = true;
            label.classList.add('selected');
        }

        input.addEventListener('change', () => {
            // Scope selection styling to this question
            optionsContainer.querySelectorAll('.option').forEach(l => l.classList.remove('selected'));
            if (input.checked) label.classList.add('selected');
            selectAnswer(qNumber - 1, option, isMulti);
        });

        label.appendChild(input);
        label.appendChild(document.createTextNode(option));
        optionsContainer.appendChild(label);
    });

    questionCounter.textContent = `Question ${qNumber} of ${qTotal}`;
}


export function updateFlagButton(isFlagged) {
    if (isFlagged) {
        flagBtn.classList.add('flagged');
        flagBtn.textContent = '⚐ Unflag Question';
    } else {
        flagBtn.classList.remove('flagged');
        flagBtn.textContent = '⚐ Flag for Review';
    }
}

export function updateTimerDisplay(seconds, totalSeconds = 180 * 60) {
    // totalSeconds should match EXAM_DURATION in quiz.js
    const percent = Math.max(0, Math.min(1, seconds / totalSeconds));
    if (timerBar) {
        timerBar.style.width = (percent * 100) + '%';
        // Colors by time left: >10m green, >2m amber, else red
        if (seconds > 10 * 60) {
            timerBar.style.background = '#4caf50';
        } else if (seconds > 2 * 60) {
            timerBar.style.background = '#ff9800';
        } else {
            timerBar.style.background = '#f44336';
        }
    }
    if (timerLabel) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        timerLabel.textContent = `Time Left: ${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

export function showFlaggedQuestionsModal(flaggedDetails) {
    flaggedQuestionsList.innerHTML = '';
    
    flaggedDetails.forEach(({ index, text }) => {
        const li = document.createElement('li');
        li.textContent = `Question ${index + 1}: ${text.substring(0, 40)}...`;
        li.dataset.questionIndex = index;
        li.addEventListener('click', () => {
            goToQuestion(index); // Jump to question
            hideFlagModal();
        });
        flaggedQuestionsList.appendChild(li);
    });

    flagModal.style.display = 'flex';
}

export function hideFlagModal() {
    flagModal.style.display = 'none';
}

export function renderResults(percentage, correct, total, resultsData) {
    scorePercentage.textContent = `${percentage}%`;
    correctCount.textContent = correct;
    totalCount.textContent = total;

    resultsDetails.innerHTML = '';
    resultsData.forEach((result, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${result.isCorrect ? 'correct' : 'incorrect'}`;
        
        let resultHTML = `<p><strong>Q${index + 1}: ${result.question}</strong></p>`;
        if (result.isCorrect) {
            resultHTML += `<p class="user-answer">Your answer: ${result.userAnswer}</p>`;
        } else {
            resultHTML += `<p class="user-answer incorrect-text">Your answer: ${result.userAnswer}</p>`;
            resultHTML += `<p class="correct-answer">Correct answer: ${result.correctAnswer}</p>`;
        }
        // Include reference if present
        if (result.reference) {
            resultHTML += `<p class="reference"><em>Reference: ${result.reference}</em></p>`;
        }
        resultItem.innerHTML = resultHTML;
        resultsDetails.appendChild(resultItem);
    });
}

export function showError(message) {
    // Basic error display
    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: red;"><h2>Error</h2><p>${message}</p></div>`;
}

export function setupRestartConfirmation(restartExamFn) {
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to restart the exam? All your progress will be lost.')) {
                restartExamFn();
            }
        });
    }
}

// Attach listener for restart button
if (restartExamBtn) {
    restartExamBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to restart the exam? All your progress will be lost.')) {
            // Dynamic import to avoid circular dependency
            import('./quiz.js').then(module => {
                if (module && typeof module.restartExam === 'function') {
                    module.restartExam();
                } else {
                    console.error("restartExam is not a function");
                }
            }).catch(error => {
                console.error("Failed to import quiz.js:", error);
            });
        }
    });
}

// (submit button wired in main.js)

// App entry point: wires UI events to quiz logic.
import * as quiz from './quiz.js';
import * as ui from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // Boot app
    quiz.init();

    // Core events
    ui.startBtn.addEventListener('click', quiz.startExam);
    ui.nextBtn.addEventListener('click', quiz.nextQuestion);
    ui.prevBtn.addEventListener('click', quiz.prevQuestion);
    ui.flagBtn.addEventListener('click', quiz.toggleFlag);
    ui.submitBtn.addEventListener('click', () => {
        // Quiz handles validation on submit
        quiz.handleSubmitAttempt();
    });

    // Restart with confirmation
    ui.setupRestartConfirmation(() => {
        if (typeof quiz !== 'undefined' && quiz && quiz.restartExam) {
            quiz.restartExam();
        } else {
            console.error("quiz.restartExam is not a function");
        }
    });

    // Modal interactions
    ui.closeModalBtn.addEventListener('click', () => ui.hideFlagModal());
    ui.submitAnywayBtn.addEventListener('click', () => {
        ui.hideFlagModal();
        quiz.submitExam();
    });
    window.addEventListener('click', (event) => {
        if (event.target == ui.flagModal) {
            ui.hideFlagModal();
        }
    });

    ui.progressBar.addEventListener('click', (event) => {
        if (event.target.classList.contains('progress-box')) {
            const index = parseInt(event.target.dataset.index, 10);
            if (!isNaN(index)) {
                quiz.goToQuestion(index);
            }
        }
    });
});

export class TimelineController {
    constructor(onTimeChange, onPlayPause) {
        this.onTimeChange = onTimeChange;
        this.onPlayPause = onPlayPause;
        
        this.startTime = null;
        this.endTime = null;
        this.currentTime = null;
        this.isPlaying = false;
        this.animationSpeed = 1.0;
        this.animationId = null;
        
        this.slider = document.getElementById('timeline-slider');
        this.currentDateEl = document.getElementById('current-date');
        this.startDateEl = document.getElementById('start-date');
        this.endDateEl = document.getElementById('end-date');
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.speedInput = document.getElementById('speed-input');
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.slider.addEventListener('input', (e) => {
            this.setTimeFromSlider(parseFloat(e.target.value));
        });

        this.playPauseBtn.addEventListener('click', () => {
            this.togglePlayPause();
        });

        this.resetBtn.addEventListener('click', () => {
            this.reset();
        });

        this.speedInput.addEventListener('change', (e) => {
            this.animationSpeed = parseFloat(e.target.value);
        });
    }

    setTimeRange(startTime, endTime) {
        this.startTime = new Date(startTime);
        this.endTime = new Date(endTime);
        this.currentTime = new Date(this.startTime);
        
        this.slider.min = 0;
        this.slider.max = 100;
        this.slider.value = 0;
        
        this.updateDisplay();
    }

    setTimeFromSlider(value) {
        if (!this.startTime || !this.endTime) return;
        
        const progress = value / 100;
        const timeDiff = this.endTime.getTime() - this.startTime.getTime();
        this.currentTime = new Date(this.startTime.getTime() + timeDiff * progress);
        
        this.updateDisplay();
        if (this.onTimeChange) {
            this.onTimeChange(this.currentTime);
        }
    }

    setTime(date) {
        if (!this.startTime || !this.endTime) return;
        
        this.currentTime = new Date(date);
        const timeDiff = this.endTime.getTime() - this.startTime.getTime();
        const currentDiff = this.currentTime.getTime() - this.startTime.getTime();
        const progress = Math.max(0, Math.min(100, (currentDiff / timeDiff) * 100));
        
        this.slider.value = progress;
        this.updateDisplay();
    }

    updateDisplay() {
        if (!this.currentTime) return;
        
        this.currentDateEl.textContent = this.formatDate(this.currentTime);
        
        if (this.startTime) {
            this.startDateEl.textContent = this.formatDate(this.startTime);
        }
        
        if (this.endTime) {
            this.endDateEl.textContent = this.formatDate(this.endTime);
        }
    }

    formatDate(date) {
        return date.toLocaleDateString('pt-BR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    togglePlayPause() {
        this.isPlaying = !this.isPlaying;
        
        if (this.isPlaying) {
            this.playPauseBtn.textContent = '⏸ Pause';
            this.startAnimation();
        } else {
            this.playPauseBtn.textContent = '▶ Play';
            this.stopAnimation();
        }
        
        if (this.onPlayPause) {
            this.onPlayPause(this.isPlaying);
        }
    }

    startAnimation() {
        if (this.animationId) return;
        
        const animate = () => {
            if (!this.isPlaying) {
                this.animationId = null;
                return;
            }
            
            if (!this.startTime || !this.endTime) {
                this.animationId = requestAnimationFrame(animate);
                return;
            }
            
            // Avançar tempo
            const timeDiff = this.endTime.getTime() - this.startTime.getTime();
            const step = timeDiff / 1000 * this.animationSpeed; // Avançar baseado na velocidade
            const newTime = this.currentTime.getTime() + step;
            
            if (newTime >= this.endTime.getTime()) {
                // Chegou ao fim, parar
                this.currentTime = new Date(this.endTime);
                this.togglePlayPause();
            } else {
                this.currentTime = new Date(newTime);
                this.setTime(this.currentTime);
            }
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        this.animationId = requestAnimationFrame(animate);
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    reset() {
        this.stopAnimation();
        this.isPlaying = false;
        this.playPauseBtn.textContent = '▶ Play';
        
        if (this.startTime) {
            this.setTime(this.startTime);
        }
    }

    getCurrentTime() {
        return this.currentTime;
    }

    getTimeRange() {
        return {
            start: this.startTime,
            end: this.endTime
        };
    }
}


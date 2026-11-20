// transitions.js — система плавных переходов между экранами

export const TRANSITION_TYPES = {
    FADE: 'fade',
    SLIDE_LEFT: 'slideLeft',
    SLIDE_RIGHT: 'slideRight',
    SLIDE_UP: 'slideUp',
    SLIDE_DOWN: 'slideDown',
    ZOOM_IN: 'zoomIn',
    ZOOM_OUT: 'zoomOut',
    FLIP: 'flip',
    BOUNCE: 'bounce',
};

export const SCREEN_TRANSITIONS = {
    'start-screen': TRANSITION_TYPES.FADE,
    'game-over': TRANSITION_TYPES.ZOOM_IN,
    'pause-screen': TRANSITION_TYPES.FADE,
    'shop-screen': TRANSITION_TYPES.SLIDE_RIGHT,
    'rules-screen': TRANSITION_TYPES.SLIDE_RIGHT,
    'achievements-screen': TRANSITION_TYPES.SLIDE_RIGHT,
    'leaderboard-screen': TRANSITION_TYPES.SLIDE_RIGHT,
    'settings-screen': TRANSITION_TYPES.SLIDE_RIGHT,
    'daily-screen': TRANSITION_TYPES.BOUNCE,
    'powerups-screen': TRANSITION_TYPES.SLIDE_UP,
    'chest-screen': TRANSITION_TYPES.ZOOM_IN,
    'missions-screen': TRANSITION_TYPES.SLIDE_RIGHT,
    'minigames-screen': TRANSITION_TYPES.SLIDE_RIGHT,
    'prestige-confirm-screen': TRANSITION_TYPES.FLIP,
    'prestige-chest-screen': TRANSITION_TYPES.ZOOM_IN,
    'event-screen': TRANSITION_TYPES.SLIDE_RIGHT,
};

export const TRANSITION_DURATIONS = {
    [TRANSITION_TYPES.FADE]: 300,
    [TRANSITION_TYPES.SLIDE_LEFT]: 400,
    [TRANSITION_TYPES.SLIDE_RIGHT]: 400,
    [TRANSITION_TYPES.SLIDE_UP]: 400,
    [TRANSITION_TYPES.SLIDE_DOWN]: 400,
    [TRANSITION_TYPES.ZOOM_IN]: 350,
    [TRANSITION_TYPES.ZOOM_OUT]: 350,
    [TRANSITION_TYPES.FLIP]: 500,
    [TRANSITION_TYPES.BOUNCE]: 500,
};

export function applyTransition(element, type, direction = 'in') {
    if (!element) return Promise.resolve();
    return new Promise((resolve) => {
        const transitionClasses = [
            'transition-fade-in', 'transition-fade-out',
            'transition-slideLeft-in', 'transition-slideLeft-out',
            'transition-slideRight-in', 'transition-slideRight-out',
            'transition-slideUp-in', 'transition-slideUp-out',
            'transition-slideDown-in', 'transition-slideDown-out',
            'transition-zoomIn-in', 'transition-zoomIn-out',
            'transition-zoomOut-in', 'transition-zoomOut-out',
            'transition-flip-in', 'transition-flip-out',
            'transition-bounce-in', 'transition-bounce-out',
        ];
        transitionClasses.forEach(cls => element.classList.remove(cls));
        const className = `transition-${type}-${direction}`;
        element.classList.add(className);
        const duration = TRANSITION_DURATIONS[type] || 300;
        setTimeout(() => {
            element.classList.remove(className);
            resolve();
        }, duration);
    });
}

export function getTransitionForScreen(screenId) {
    return SCREEN_TRANSITIONS[screenId] || TRANSITION_TYPES.FADE;
}

export function staggerElements(elements, delay = 50) {
    if (!elements || elements.length === 0) return;
    elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(15px)';
        setTimeout(() => {
            el.style.transition = 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, index * delay);
    });
}

export function animateNumber(element, from, to, duration = 800) {
    if (!element) return Promise.resolve();
    return new Promise((resolve) => {
        const startTime = performance.now();
        const diff = to - from;
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.round(from + diff * eased);
            element.textContent = currentValue;
            if (progress < 1) requestAnimationFrame(update);
            else { element.textContent = to; resolve(); }
        }
        requestAnimationFrame(update);
    });
}

export function flashTransition(color = 'rgba(255, 255, 255, 0.6)', duration = 200) {
    return new Promise((resolve) => {
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed; inset: 0; background: ${color};
            z-index: 9999; pointer-events: none; opacity: 0;
            transition: opacity ${duration / 2}ms ease;
        `;
        document.body.appendChild(flash);
        requestAnimationFrame(() => {
            flash.style.opacity = '1';
            setTimeout(() => {
                flash.style.opacity = '0';
                setTimeout(() => { flash.remove(); resolve(); }, duration / 2);
            }, duration / 2);
        });
    });
}
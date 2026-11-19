// accessibility.js — доступность и улучшение UI/UX

// ============ ФОКУС-МЕНЕДЖМЕНТ ============
let lastFocusedElement = null;

export function saveLastFocus() {
    lastFocusedElement = document.activeElement;
}

export function restoreLastFocus() {
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        try {
            lastFocusedElement.focus({ preventScroll: true });
        } catch (e) {
            console.warn('Не удалось восстановить фокус:', e);
        }
    }
    lastFocusedElement = null;
}

// ============ ЛОВУШКА ФОКУСА ============
export function trapFocus(modalElement) {
    if (!modalElement) return;
    const focusableSelectors = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = modalElement.querySelectorAll(focusableSelectors);
    if (focusableElements.length === 0) return;
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    function handleTabKey(e) {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable.focus();
            }
        } else {
            if (document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable.focus();
            }
        }
    }
    
    if (modalElement._focusTrapHandler) {
        modalElement.removeEventListener('keydown', modalElement._focusTrapHandler);
    }
    modalElement._focusTrapHandler = handleTabKey;
    modalElement.addEventListener('keydown', handleTabKey);
}

export function releaseFocusTrap(modalElement) {
    if (!modalElement || !modalElement._focusTrapHandler) return;
    modalElement.removeEventListener('keydown', modalElement._focusTrapHandler);
    delete modalElement._focusTrapHandler;
}

// ============ ЗАКРЫТИЕ ПО ESC ============
export function setupEscapeKeyHandler(modalElement, onCloseCallback) {
    if (!modalElement) return;
    function handleEscape(e) {
        if (e.key === 'Escape' && modalElement.classList.contains('open')) {
            e.preventDefault();
            if (typeof onCloseCallback === 'function') onCloseCallback();
        }
    }
    if (modalElement._escapeHandler) {
        document.removeEventListener('keydown', modalElement._escapeHandler);
    }
    modalElement._escapeHandler = handleEscape;
    document.addEventListener('keydown', handleEscape);
}

export function removeEscapeKeyHandler(modalElement) {
    if (!modalElement || !modalElement._escapeHandler) return;
    document.removeEventListener('keydown', modalElement._escapeHandler);
    delete modalElement._escapeHandler;
}

// ============ ARIA-АТРИБУТЫ ============
export function updateAriaAttributes(modalElement, isOpen) {
    if (!modalElement) return;
    if (isOpen) {
        modalElement.setAttribute('aria-hidden', 'false');
        modalElement.setAttribute('role', 'dialog');
        modalElement.setAttribute('aria-modal', 'true');
    } else {
        modalElement.setAttribute('aria-hidden', 'true');
        modalElement.removeAttribute('aria-modal');
    }
}

// ============ ОБЪЯВЛЕНИЯ ДЛЯ СКРИНРИДЕРОВ ============
let ariaLiveRegion = null;

export function announceToScreenReader(message, priority = 'polite') {
    if (!ariaLiveRegion) {
        ariaLiveRegion = document.createElement('div');
        ariaLiveRegion.setAttribute('aria-live', priority);
        ariaLiveRegion.setAttribute('aria-atomic', 'true');
        ariaLiveRegion.style.cssText = `
            position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;
        `;
        document.body.appendChild(ariaLiveRegion);
    }
    ariaLiveRegion.textContent = '';
    setTimeout(() => { ariaLiveRegion.textContent = message; }, 100);
}

// ============ ДЕКОРАТИВНЫЕ ЗВЁЗДЫ ============
export function addDecorativeStars(container, count = 20) {
    if (!container) return;
    const oldStars = container.querySelectorAll('.decorative-star');
    oldStars.forEach(star => star.remove());
    
    for (let i = 0; i < count; i++) {
        const star = document.createElement('div');
        star.className = 'decorative-star';
        star.innerHTML = '✦';
        star.style.cssText = `
            position: absolute;
            color: rgba(255, 215, 0, 0.3);
            font-size: ${Math.random() * 12 + 8}px;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            pointer-events: none;
            animation: twinkle ${Math.random() * 3 + 2}s ease-in-out infinite;
            animation-delay: ${Math.random() * 2}s;
        `;
        container.appendChild(star);
    }
}

// ============ КНОПКА ЗАКРЫТИЯ ============
export function addCloseButtonToModal(modalContent, onCloseCallback) {
    if (!modalContent) return;
    if (modalContent.querySelector('.modal-close-btn')) return;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close-btn';
    closeBtn.innerHTML = '✕';
    closeBtn.setAttribute('aria-label', 'Закрыть');
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof onCloseCallback === 'function') onCloseCallback();
    });
    modalContent.style.position = 'relative';
    modalContent.appendChild(closeBtn);
}

// ============ НОРМАЛИЗАЦИЯ ШРИФТОВ ============
export function normalizeFontSizes() {
    const elements = document.querySelectorAll('.mode-btn .mode-name, .daily-name, .customize-name, .skin-name');
    elements.forEach(el => {
        const computedSize = window.getComputedStyle(el).fontSize;
        const minSize = 14;
        const currentSize = parseFloat(computedSize);
        if (currentSize < minSize) {
            el.style.fontSize = `${minSize}px`;
        }
    });
}

// ============ АНИМАЦИЯ ПОЯВЛЕНИЯ ============
export function animateElementsSequentially(elements, animationType = 'fadeInUp', staggerDelay = 50) {
    if (!elements || elements.length === 0) return;
    elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.animation = `${animationType} 0.4s ease-out ${index * staggerDelay / 1000}s forwards`;
    });
}
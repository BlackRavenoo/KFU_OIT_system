export type HistoryState = {
    history: string[];
    historyIndex: number;
    isApplyingHistory: boolean;
    lastInputTime: number;
    inputTimeout: ReturnType<typeof setTimeout> | null;
    pendingContent: string | null;
};

/**
 * Создает начальное состояние истории
 * @param initialContent - Начальное содержимое редактора
 */
export function createHistory(initialContent: string = ""): HistoryState {
    return {
        history: [initialContent],
        historyIndex: 0,
        isApplyingHistory: false,
        lastInputTime: Date.now(),
        inputTimeout: null,
        pendingContent: null,
    };
}

/**
 * Сохраняет новый блок истории
 */
export function saveHistoryBlock(state: HistoryState, newContent: string) {
    if (state.isApplyingHistory) return;
    if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
    }
    state.history.push(newContent);
    state.historyIndex = state.history.length - 1;
}

/**
 * Планирует сохранение блока истории через 3 секунды после последнего действия
 */
export function scheduleHistorySave(state: HistoryState, newContent: string) {
    state.pendingContent = newContent;
    if (state.inputTimeout) clearTimeout(state.inputTimeout);
    state.inputTimeout = setTimeout(() => {
        if (state.pendingContent !== null && state.history[state.historyIndex] !== state.pendingContent) {
            saveHistoryBlock(state, state.pendingContent);
        }
        state.pendingContent = null;
        state.inputTimeout = null;
    }, 3000);
}

/**
 * Обрабатывает ввод в редактор, группируя изменения по действиям
 */
export function handleEditorInput(state: HistoryState, newContent: string) {
    const now = Date.now();
    if (now - state.lastInputTime > 3000) {
        saveHistoryBlock(state, newContent);
    } else {
        scheduleHistorySave(state, newContent);
    }
    state.lastInputTime = now;
}

/**
 * Откат к предыдущему состоянию
 */
export function undo(state: HistoryState, setContent: (content: string) => void, updateActiveStates: () => void) {
    if (state.historyIndex > 0) {
        state.historyIndex -= 1;
        state.isApplyingHistory = true;
        setContent(state.history[state.historyIndex]);
        updateActiveStates();
        state.isApplyingHistory = false;
    }
}

/**
 * Возврат к следующему состоянию
 */
export function redo(state: HistoryState, setContent: (content: string) => void, updateActiveStates: () => void) {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex += 1;
        state.isApplyingHistory = true;
        setContent(state.history[state.historyIndex]);
        updateActiveStates();
        state.isApplyingHistory = false;
    }
}

/**
 * Очистка таймера при размонтировании редактора
 */
export function clearHistoryTimeout(state: HistoryState) {
    if (state.inputTimeout) clearTimeout(state.inputTimeout);
    state.inputTimeout = null;
}
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    createHistory,
    saveHistoryBlock,
    scheduleHistorySave,
    handleEditorInput,
    undo,
    redo,
    clearHistoryTimeout,
} from '$lib/utils/texteditor/history';

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('Create history in text editor', () => {
    it('Creates initial history state with default content', () => {
        const state = createHistory();
        
        expect(state.history).toEqual(['']);
        expect(state.historyIndex).toBe(0);
        expect(state.isApplyingHistory).toBe(false);
        expect(state.lastInputTime).toBeGreaterThan(0);
        expect(state.inputTimeout).toBeNull();
        expect(state.pendingContent).toBeNull();
    });

    it('Creates initial history state with provided content', () => {
        const initialContent = 'Hello World';
        const state = createHistory(initialContent);
        
        expect(state.history).toEqual([initialContent]);
        expect(state.historyIndex).toBe(0);
    });
});

describe('Save new history block in text editor', () => {
    it('Adds new content to history', () => {
        const state = createHistory('Initial');
        
        saveHistoryBlock(state, 'New content');
        
        expect(state.history).toEqual(['Initial', 'New content']);
        expect(state.historyIndex).toBe(1);
    });

    it('Does not save when isApplyingHistory is true', () => {
        const state = createHistory('Initial');
        state.isApplyingHistory = true;
        
        saveHistoryBlock(state, 'New content');
        
        expect(state.history).toEqual(['Initial']);
        expect(state.historyIndex).toBe(0);
    });

    it('Removes future history when saving at middle position', () => {
        const state = createHistory('First');
        saveHistoryBlock(state, 'Second');
        saveHistoryBlock(state, 'Third');
        
        state.historyIndex = 1;
        saveHistoryBlock(state, 'New Branch');
        
        expect(state.history).toEqual(['First', 'Second', 'New Branch']);
        expect(state.historyIndex).toBe(2);
    });

    it('Appends to history when at the end', () => {
        const state = createHistory('First');
        saveHistoryBlock(state, 'Second');
        
        expect(state.historyIndex).toBe(state.history.length - 1);
        
        saveHistoryBlock(state, 'Third');
        
        expect(state.history).toEqual(['First', 'Second', 'Third']);
        expect(state.historyIndex).toBe(2);
    });
});

describe('Shedule history save in text editor', () => {
    it('Sets pending content and schedules save', () => {
        const state = createHistory('Initial');
        
        scheduleHistorySave(state, 'Pending content');
        
        expect(state.pendingContent).toBe('Pending content');
        expect(state.inputTimeout).not.toBeNull();
    });

    it('Clears previous timeout when called again', () => {
        const state = createHistory('Initial');
        
        scheduleHistorySave(state, 'First');
        const firstTimeout = state.inputTimeout;
        
        scheduleHistorySave(state, 'Second');
        
        expect(state.inputTimeout).not.toBe(firstTimeout);
        expect(state.pendingContent).toBe('Second');
    });

    it('Saves history after 3 seconds', () => {
        const state = createHistory('Initial');
        
        scheduleHistorySave(state, 'New content');
        
        expect(state.history).toEqual(['Initial']);
        
        vi.advanceTimersByTime(3000);
        
        expect(state.history).toEqual(['Initial', 'New content']);
        expect(state.historyIndex).toBe(1);
        expect(state.pendingContent).toBeNull();
        expect(state.inputTimeout).toBeNull();
    });

    it('Does not save if pending content equals current history', () => {
        const state = createHistory('Initial');
        
        scheduleHistorySave(state, 'Initial');
        
        vi.advanceTimersByTime(3000);
        
        expect(state.history).toEqual(['Initial']);
        expect(state.historyIndex).toBe(0);
    });

    it('Does not save if pending content is null', () => {
        const state = createHistory('Initial');
        
        scheduleHistorySave(state, 'New content');
        state.pendingContent = null;
        
        vi.advanceTimersByTime(3000);
        
        expect(state.history).toEqual(['Initial']);
    });
});

describe('Handle editor input', () => {
    it('Saves immediately if more than 3 seconds passed', () => {
        const state = createHistory('Initial');
        state.lastInputTime = Date.now() - 4000;
        
        handleEditorInput(state, 'New content');
        
        expect(state.history).toEqual(['Initial', 'New content']);
        expect(state.historyIndex).toBe(1);
    });

    it('Schedules save if less than 3 seconds passed', () => {
        const state = createHistory('Initial');
        state.lastInputTime = Date.now() - 1000;
        
        handleEditorInput(state, 'New content');
        
        expect(state.history).toEqual(['Initial']);
        expect(state.pendingContent).toBe('New content');
        
        vi.advanceTimersByTime(3000);
        
        expect(state.history).toEqual(['Initial', 'New content']);
    });

    it('Updates lastInputTime', () => {
        const state = createHistory('Initial');
        const timeBefore = state.lastInputTime;
        
        vi.advanceTimersByTime(100);
        handleEditorInput(state, 'New content');
        
        expect(state.lastInputTime).toBeGreaterThan(timeBefore);
    });

    it('Groups rapid changes together', () => {
        const state = createHistory('Initial');
        const startTime = Date.now();
        vi.setSystemTime(startTime);
        
        handleEditorInput(state, 'A');
        
        vi.setSystemTime(startTime + 500);
        handleEditorInput(state, 'AB');
        
        vi.setSystemTime(startTime + 1000);
        handleEditorInput(state, 'ABC');
        
        expect(state.history).toEqual(['Initial']);
        vi.advanceTimersByTime(3000);
        expect(state.history).toEqual(['Initial', 'ABC']);
    });
});

describe('Undo history in text editor', () => {
    it('Moves to previous history state', () => {
        const state = createHistory('First');
        saveHistoryBlock(state, 'Second');
        saveHistoryBlock(state, 'Third');
        
        const setContent = vi.fn();
        const updateActiveStates = vi.fn();
        
        undo(state, setContent, updateActiveStates);
        
        expect(state.historyIndex).toBe(1);
        expect(setContent).toHaveBeenCalledWith('Second');
        expect(updateActiveStates).toHaveBeenCalled();
    });

    it('Sets and unsets isApplyingHistory flag', () => {
        const state = createHistory('First');
        saveHistoryBlock(state, 'Second');
        
        const setContent = vi.fn();
        const updateActiveStates = vi.fn();
        
        expect(state.isApplyingHistory).toBe(false);
        
        undo(state, setContent, updateActiveStates);
        
        expect(state.isApplyingHistory).toBe(false);
    });

    it('Does nothing when at first history position', () => {
        const state = createHistory('First');
        
        const setContent = vi.fn();
        const updateActiveStates = vi.fn();
        
        undo(state, setContent, updateActiveStates);
        
        expect(state.historyIndex).toBe(0);
        expect(setContent).not.toHaveBeenCalled();
        expect(updateActiveStates).not.toHaveBeenCalled();
    });

    it('Can undo multiple times', () => {
        const state = createHistory('First');
        saveHistoryBlock(state, 'Second');
        saveHistoryBlock(state, 'Third');
        saveHistoryBlock(state, 'Fourth');
        
        const setContent = vi.fn();
        const updateActiveStates = vi.fn();
        
        undo(state, setContent, updateActiveStates);
        expect(state.historyIndex).toBe(2);
        
        undo(state, setContent, updateActiveStates);
        expect(state.historyIndex).toBe(1);
        
        undo(state, setContent, updateActiveStates);
        expect(state.historyIndex).toBe(0);
        
        expect(setContent).toHaveBeenCalledTimes(3);
    });
});

describe('Redo history in text editor', () => {
    it('Moves to next history state', () => {
        const state = createHistory('First');
        saveHistoryBlock(state, 'Second');
        saveHistoryBlock(state, 'Third');
        state.historyIndex = 1;
        
        const setContent = vi.fn();
        const updateActiveStates = vi.fn();
        
        redo(state, setContent, updateActiveStates);
        
        expect(state.historyIndex).toBe(2);
        expect(setContent).toHaveBeenCalledWith('Third');
        expect(updateActiveStates).toHaveBeenCalled();
    });

    it('Sets and unsets isApplyingHistory flag', () => {
        const state = createHistory('First');
        saveHistoryBlock(state, 'Second');
        state.historyIndex = 0;
        
        const setContent = vi.fn();
        const updateActiveStates = vi.fn();
        
        expect(state.isApplyingHistory).toBe(false);
        
        redo(state, setContent, updateActiveStates);
        
        expect(state.isApplyingHistory).toBe(false);
    });

    it('Does nothing when at last history position', () => {
        const state = createHistory('First');
        saveHistoryBlock(state, 'Second');
        
        const setContent = vi.fn();
        const updateActiveStates = vi.fn();
        
        redo(state, setContent, updateActiveStates);
        
        expect(state.historyIndex).toBe(1);
        expect(setContent).not.toHaveBeenCalled();
        expect(updateActiveStates).not.toHaveBeenCalled();
    });

    it('Can redo after multiple undos', () => {
        const state = createHistory('First');
        saveHistoryBlock(state, 'Second');
        saveHistoryBlock(state, 'Third');
        
        const setContent = vi.fn();
        const updateActiveStates = vi.fn();
        
        state.historyIndex = 0;
        
        redo(state, setContent, updateActiveStates);
        expect(state.historyIndex).toBe(1);
        expect(setContent).toHaveBeenCalledWith('Second');
        
        redo(state, setContent, updateActiveStates);
        expect(state.historyIndex).toBe(2);
        expect(setContent).toHaveBeenCalledWith('Third');
    });
});

describe('Clear history timeout', () => {
    it('Clears timeout if exists', () => {
        const state = createHistory('Initial');
        scheduleHistorySave(state, 'Pending');
        
        expect(state.inputTimeout).not.toBeNull();
        
        clearHistoryTimeout(state);
        
        expect(state.inputTimeout).toBeNull();
        
        vi.advanceTimersByTime(3000);
        
        expect(state.history).toEqual(['Initial']);
    });

    it('Does nothing if timeout is null', () => {
        const state = createHistory('Initial');
        
        expect(state.inputTimeout).toBeNull();
        
        clearHistoryTimeout(state);
        
        expect(state.inputTimeout).toBeNull();
    });

    it('Prevents scheduled save from executing', () => {
        const state = createHistory('Initial');
        
        scheduleHistorySave(state, 'Should not save');
        clearHistoryTimeout(state);
        
        vi.advanceTimersByTime(5000);
        
        expect(state.history).toEqual(['Initial']);
        expect(state.pendingContent).toBe('Should not save');
    });
});

describe('Integration tests for history in text editor', () => {
    it('Complete undo/redo workflow', () => {
        const state = createHistory('Initial');
        const setContent = vi.fn();
        const updateActiveStates = vi.fn();
        
        handleEditorInput(state, 'Step 1');
        vi.advanceTimersByTime(3000);
        
        handleEditorInput(state, 'Step 2');
        vi.advanceTimersByTime(3000);
        
        expect(state.history).toEqual(['Initial', 'Step 1', 'Step 2']);
        expect(state.historyIndex).toBe(2);
        
        undo(state, setContent, updateActiveStates);
        expect(state.historyIndex).toBe(1);
        expect(setContent).toHaveBeenCalledWith('Step 1');
        
        undo(state, setContent, updateActiveStates);
        expect(state.historyIndex).toBe(0);
        expect(setContent).toHaveBeenCalledWith('Initial');
        
        redo(state, setContent, updateActiveStates);
        expect(state.historyIndex).toBe(1);
        expect(setContent).toHaveBeenCalledWith('Step 1');
    });

    it('Branching history after undo', () => {
        const state = createHistory('Initial');
        
        saveHistoryBlock(state, 'Branch A Step 1');
        saveHistoryBlock(state, 'Branch A Step 2');
        
        state.historyIndex = 1;
        
        saveHistoryBlock(state, 'Branch B Step 1');
        
        expect(state.history).toEqual(['Initial', 'Branch A Step 1', 'Branch B Step 1']);
        expect(state.historyIndex).toBe(2);
    });

    it('Rapid typing followed by pause', () => {
        const state = createHistory('');
        
        handleEditorInput(state, 'H');
        vi.advanceTimersByTime(100);
        
        handleEditorInput(state, 'He');
        vi.advanceTimersByTime(100);
        
        handleEditorInput(state, 'Hel');
        vi.advanceTimersByTime(100);
        
        handleEditorInput(state, 'Hell');
        vi.advanceTimersByTime(100);
        
        handleEditorInput(state, 'Hello');
        
        expect(state.history).toEqual(['']);
        
        vi.advanceTimersByTime(3000);
        
        expect(state.history).toEqual(['', 'Hello']);
        expect(state.historyIndex).toBe(1);
    });
});
import { describe, it, expect } from 'vitest';
import { 
    getNameError, 
    getLoginError, 
    getEmailError, 
    getPasswordError, 
    getConfirmPasswordError 
} from '$lib/utils/validation/error_messages';

describe('Error messages validation', () => {
    describe('getNameError', () => {
        it('returns empty string for empty name', () => {
            expect(getNameError('')).toBe('');
            expect(getNameError('   ')).toBe('');
        });

        it('returns empty string for valid name', () => {
            expect(getNameError('Иван')).toBe('');
            expect(getNameError('Анна Петрова')).toBe('');
        });

        it('returns error for invalid name', () => {
            const errorMessage = 'Имя должно содержать только русские буквы и пробелы, минимум 3 символа';
            expect(getNameError('Тест-тест')).toBe(errorMessage);
            expect(getNameError('ab')).toBe(errorMessage);
            expect(getNameError('John')).toBe(errorMessage);
            expect(getNameError('123')).toBe(errorMessage);
            expect(getNameError('Ив')).toBe(errorMessage);
            expect(getNameError('Ivan123')).toBe(errorMessage);
        });
    });

    describe('getLoginError', () => {
        it('returns empty string for empty login', () => {
            expect(getLoginError('')).toBe('');
            expect(getLoginError('   ')).toBe('');
        });

        it('returns empty string for valid login', () => {
            expect(getLoginError('user123')).toBe('');
            expect(getLoginError('admin_user')).toBe('');
            expect(getLoginError('test_123_user')).toBe('');
            expect(getLoginError('a'.repeat(64))).toBe('');
        });

        it('returns error for invalid login', () => {
            const errorMessage = 'Логин должен содержать от 5 до 64 символов, только латинские буквы, цифры и подчеркивания';
            expect(getLoginError('user')).toBe(errorMessage);
            expect(getLoginError('a'.repeat(65))).toBe(errorMessage);
            expect(getLoginError('user-name')).toBe(errorMessage);
            expect(getLoginError('user name')).toBe(errorMessage);
            expect(getLoginError('пользователь')).toBe(errorMessage);
            expect(getLoginError('user@domain')).toBe(errorMessage);
        });
    });

    describe('getEmailError', () => {
        it('returns empty string for empty email', () => {
            expect(getEmailError('')).toBe('');
            expect(getEmailError('   ')).toBe('');
        });

        it('returns empty string for valid email', () => {
            expect(getEmailError('user@example.com')).toBe('');
            expect(getEmailError('test.email@domain.org')).toBe('');
            expect(getEmailError('admin+tag@company.co.uk')).toBe('');
        });

        it('returns error for invalid email', () => {
            const errorMessage = 'Введите корректный email адрес';
            expect(getEmailError('invalid-email')).toBe(errorMessage);
            expect(getEmailError('user@')).toBe(errorMessage);
            expect(getEmailError('@domain.com')).toBe(errorMessage);
            expect(getEmailError('user.domain.com')).toBe(errorMessage);
            expect(getEmailError('user@domain')).toBe(errorMessage);
        });
    });

    describe('getPasswordError', () => {
        it('returns empty string for empty password', () => {
            expect(getPasswordError('')).toBe('');
        });

        it('returns empty string for valid password', () => {
            expect(getPasswordError('Password123')).toBe('');
            expect(getPasswordError('myPass123')).toBe('');
            expect(getPasswordError('TestPass1')).toBe('');
        });

        it('returns error for invalid password', () => {
            const errorMessage = 'Пароль должен содержать минимум 8 символов, включая буквы и цифры';
            expect(getPasswordError('short')).toBe(errorMessage);
            expect(getPasswordError('password')).toBe(errorMessage);
            expect(getPasswordError('12345678')).toBe(errorMessage);
            expect(getPasswordError('Pass123')).toBe(errorMessage);
        });
    });

    describe('getConfirmPasswordError', () => {
        it('returns empty string for empty confirm password', () => {
            expect(getConfirmPasswordError('password123', '')).toBe('');
        });

        it('returns empty string when passwords match', () => {
            expect(getConfirmPasswordError('password123', 'password123')).toBe('');
            expect(getConfirmPasswordError('TestPass1', 'TestPass1')).toBe('');
        });

        it('returns error when passwords do not match', () => {
            const errorMessage = 'Пароли не совпадают';
            expect(getConfirmPasswordError('password123', 'password124')).toBe(errorMessage);
            expect(getConfirmPasswordError('TestPass1', 'testpass1')).toBe(errorMessage);
            expect(getConfirmPasswordError('password', 'different')).toBe(errorMessage);
        });

        it('returns error when passwords have different cases', () => {
            const errorMessage = 'Пароли не совпадают';
            expect(getConfirmPasswordError('Password123', 'password123')).toBe(errorMessage);
        });
    });

    describe('Edge cases', () => {
        it('handles whitespace-only inputs correctly', () => {
            expect(getNameError('   ')).toBe('');
            expect(getLoginError('   ')).toBe('');
            expect(getEmailError('   ')).toBe('');
        });

        it('handles special characters in names', () => {
            const errorMessage = 'Имя должно содержать только русские буквы и пробелы, минимум 3 символа';
            expect(getNameError('Анна@')).toBe(errorMessage);
            expect(getNameError('Петр123')).toBe(errorMessage);
        });

        it('handles boundary values for login length', () => {
            const errorMessage = 'Логин должен содержать от 5 до 64 символов, только латинские буквы, цифры и подчеркивания';
            expect(getLoginError('test1')).toBe('');
            expect(getLoginError('test')).toBe(errorMessage);
            expect(getLoginError('a'.repeat(64))).toBe('');
            expect(getLoginError('a'.repeat(65))).toBe(errorMessage);
        });

        it('handles complex email formats', () => {
            expect(getEmailError('user+tag@example.com')).toBe('');
            expect(getEmailError('user.name@sub.domain.com')).toBe('');
            expect(getEmailError('123@example.com')).toBe('');
        });

        it('handles password edge cases', () => {
            const errorMessage = 'Пароль должен содержать минимум 8 символов, включая буквы и цифры';
            expect(getPasswordError('1234567a')).toBe('');
            expect(getPasswordError('1234567')).toBe(errorMessage);
            expect(getPasswordError('        ')).toBe(errorMessage);
        });
    });
});
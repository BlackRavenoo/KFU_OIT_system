import { validateName, validateLogin, validateEmail, validatePassword } from './validate';

/**
 * Валидация имени
 */
export function getNameError(name: string): string {
    if (!name.trim()) return '';
    if (!validateName(name)) return 'Имя должно содержать только русские буквы и пробелы, минимум 3 символа';
    return '';
}

/**
 * Валидация логина
 */
export function getLoginError(login: string): string {
    if (!login.trim()) return '';
    if (!validateLogin(login)) return 'Логин должен содержать от 5 до 64 символов, только латинские буквы, цифры и подчеркивания';
    return '';
}

/**
 * Валидация email
 */
export function getEmailError(email: string): string {
    if (!email.trim()) return '';
    if (!validateEmail(email)) return 'Введите корректный email адрес';
    return '';
}

/**
 * Валидация пароля
 */
export function getPasswordError(password: string): string {
    if (!password) return '';
    if (!validatePassword(password)) return 'Пароль должен содержать минимум 8 символов, включая буквы и цифры';
    return '';
}

/**
 * Валидация совпадения паролей
 */
export function getConfirmPasswordError(password: string, confirmPassword: string): string {
    if (!confirmPassword) return '';
    if (password !== confirmPassword) return 'Пароли не совпадают';
    return '';
}
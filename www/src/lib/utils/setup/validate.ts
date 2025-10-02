/**
 * Файл содержит функции для валидации различных типов данных, таких как email, имя, логин, пароль и телефон.
 * Каждая функция возвращает булево значение, указывающее на корректность введённых данных.
 */

export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    return true;
}

export function validateName(name: string): boolean {
    return name.trim().length > 2 && /^[а-яА-Я\s]+$/.test(name);
}

export function validateLogin(name: string): boolean {
    return name.trim().length > 4 && name.trim().length <= 64 && /^[a-zA-Z0-9_]+$/.test(name);
}

export function validatePassword(password: string): boolean {
    return password.length >= 8 && /\d/.test(password) && /[a-zA-Z]/.test(password);
}

export function validatePageSize(size: number): boolean {
    return Number.isInteger(size) && size >= 10 && size <= 50;
}

export function validatePhone(phone: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
}

export function validateFiles(files: FileList | File[] | null): boolean {
    if (!files || files.length === 0) return true;

    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'image/gif', 'image/bmp', 'image/webp', 'image/avif'];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!allowedTypes.includes(file.type)) return false;
    }
    return true;
}
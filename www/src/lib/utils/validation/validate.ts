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

const ALLOWED_MIME = new Set<string>([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
]);

const ALLOWED_EXT = new Set<string>([
    'jpg', 'jpeg', 'png', 'webp',
    'pdf',
    'doc', 'docx',
    'ppt', 'pptx',
    'txt'
]);

export function validateFiles(files: File[], max = 5): boolean {
    if (!files || files.length === 0) return true;
    if (files.length > max) return false;

    const isAllowed = (f: File) => {
        const byMime = f.type && ALLOWED_MIME.has(f.type);
        const ext = (f.name.split('.').pop() || '').toLowerCase();
        const byExt = ALLOWED_EXT.has(ext);
        return byMime || byExt;
    };

    return files.every(isAllowed);
}

export function formatName(name: string): string {
    const parts = name
        .trim()
        .split(' ')
        .filter(part => part.length > 0);
    
    if (parts.length === 0) return '';
    
    const formattedParts = [parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase()];
    
    for (let i = 1; i < parts.length; i++)
        formattedParts.push(parts[i].charAt(0).toUpperCase() + '.');
    
    return formattedParts.join(' ').trim();
}

export function formatTitle(title: string): string {
    const formatted = title
        .trim()
        .split(' ')
        .filter(part => part.length > 0)
        .join(' ');
    
    if (formatted.length <= 25)
        return formatted;
    
    return formatted.substring(0, 22) + '...';
}

export function formatDescription(description: string, short: boolean = true): string {
    const formatted = description
        .trim()
        .split(' ')
        .filter(part => part.length > 0)
        .join(' ');
    
    if (formatted.length <= 100)
        return formatted;

    return short ? formatted.substring(0, 97) + '...' : formatted;
}

export function formatDate(dateStr: string): string {
    if (!dateStr) return 'Без даты';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Без даты';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
/**
 * Файл содержит функции для валидации различных типов данных, таких как email, имя, логин, пароль и телефон.
 * Каждая функция возвращает булево значение, указывающее на корректность введённых данных.
 */

/**
 * Валидирует email
 * @param {string} email - Email для проверки
 * @returns {boolean} true, если email корректный, иначе false
 */
export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    return true;
}

/**
 * Валидирует имя
 * @param {string} name - Имя для проверки
 * @returns {boolean} true, если имя корректное, иначе false
 */
export function validateName(name: string): boolean {
    return name.trim().length > 2 && /^[а-яА-Я\s]+$/.test(name);
}

/**
 * Валидирует логин
 * @param {string} login - Логин для проверки
 * @returns {boolean} true, если логин корректный, иначе false
 */
export function validateLogin(login: string): boolean {
    return login.trim().length > 4 && login.trim().length <= 64 && /^[a-zA-Z0-9_]+$/.test(login);
}

/**
 * Валидирует пароль
 * @param {string} password - Пароль для проверки
 * @returns {boolean} true, если пароль корректный, иначе false
 */
export function validatePassword(password: string): boolean {
    return password.length >= 8 && /\d/.test(password) && /[a-zA-Z]/.test(password);
}

/**
 * Валидирует размер страницы
 * @param {number} size - Размер страницы для проверки
 * @returns {boolean} true, если размер страницы корректный, иначе false
 */
export function validatePageSize(size: number): boolean {
    return Number.isInteger(size) && size >= 10 && size <= 50;
}

/**
 * Валидирует номер телефона
 * @param {string} phone - Номер телефона для проверки
 * @returns {boolean} true, если номер телефона корректный, иначе false
 */
export function validatePhone(phone: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
}

/** Список разрешенных MIME-типов для файлов */
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

/**
 * Валидирует массив файлов, проверяя их MIME-типы и расширения. 
 * Максимальное количество файлов по умолчанию - 5.
 * @param {File[]} files - Массив файлов для проверки
 * @param {number} [max=5] - Максимальное количество файлов
 * @returns {boolean} true, если все файлы корректные, иначе false
 */
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

/**
 * Форматирует имя, оставляя только первую букву каждого слова и сокращая остальные до первой буквы с точкой.
 * @param {string} name - Имя для форматирования
 * @returns {string} Отформатированное имя
 */
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

/**
 * Форматирует заголовок, обрезая его до 25 символов и добавляя многоточие, если необходимо.
 * @param {string} title - Заголовок для форматирования
 * @returns {string} Отформатированный заголовок
 */
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

/**
 * Форматирует описание, обрезая его до 100 символов и добавляя многоточие, если необходимо.
 * @param {string} description - Описание для форматирования
 * @param {boolean} [short=true] - Флаг, указывающий, нужно ли сокращать описание
 * @returns {string} Отформатированное описание
 */
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

/**
 * Форматирует дату, преобразуя её в строку формата "dd.mm.yyyy hh:mm". 
 * Если дата некорректная, возвращает "Без даты".
 * @param {string} dateStr - Строка с датой для форматирования
 * @returns {string} Отформатированная дата или "Без даты"
 */
export function formatDate(dateStr: string): string {
    if (!dateStr) return 'Без даты';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Без даты';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
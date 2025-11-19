import { describe, expect, it } from 'vitest';

import {
    validateEmail,
    validateName,
    validateLogin,
    validatePassword,
    validatePageSize,
    validatePhone,
    validateFiles,
    formatDate,
    formatName,
    formatTitle,
    formatDescription
} from '$lib/utils/validation/validate';

describe('Validate email', () => {
    it('Returns true for valid emails', () => {
        expect(validateEmail('test@example.com')).toBe(true);
        expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('Returns false for invalid emails', () => {
        expect(validateEmail('testexample.com')).toBe(false);
        expect(validateEmail('test@.com')).toBe(false);
        expect(validateEmail('test@com')).toBe(false);
        expect(validateEmail('test@com.')).toBe(false);
        expect(validateEmail('')).toBe(false);
        expect(validateEmail('test@ example.com')).toBe(false);
    });
});

describe('Validate name', () => {
    it('Returns true for valid Russian names', () => {
        expect(validateName('Иван')).toBe(true);
        expect(validateName('Анна Мария')).toBe(true);
    });

    it('Returns false for short names', () => {
        expect(validateName('Ив')).toBe(false);
        expect(validateName('')).toBe(false);
    });

    it('Returns false for names with non-Russian letters', () => {
        expect(validateName('Ivan')).toBe(false);
        expect(validateName('Иван1')).toBe(false);
        expect(validateName('Иван!')).toBe(false);
    });
});

describe('Validate login', () => {
    it('Returns true for login longer than 4 chars', () => {
        expect(validateLogin('login1')).toBe(true);
        expect(validateLogin('a1dfk_aflogin')).toBe(true);
    });

    it('Returns false for login 4 chars or less', () => {
        expect(validateLogin('abcd')).toBe(false);
        expect(validateLogin('   abcd')).toBe(false);
        expect(validateLogin('')).toBe(false);
    });

    it('Returns false for login with invalid characters', () => {
        expect(validateLogin('log!n')).toBe(false);
        expect(validateLogin('log in')).toBe(false);
        expect(validateLogin('log-in')).toBe(false);
        expect(validateLogin('log.in')).toBe(false);
        expect(validateLogin('логин')).toBe(false);
    });

    it('Returns false for login longer than 64 chars', () => {
        const longLogin = 'a'.repeat(65);
        expect(validateLogin(longLogin)).toBe(false);
    });
});

describe('Validate password', () => {
    it('Returns true for valid passwords', () => {
        expect(validatePassword('password1')).toBe(true);
        expect(validatePassword('1Password')).toBe(true);
        expect(validatePassword('abc12345')).toBe(true);
    });
    
    it('Returns false for passwords without digits', () => {
        expect(validatePassword('password')).toBe(false);
        expect(validatePassword('abcdefgh')).toBe(false);
    });
    
    it('Returns false for passwords without letters', () => {
        expect(validatePassword('12345678')).toBe(false);
        expect(validatePassword('1234567890')).toBe(false);
    });

    it('Returns false for passwords shorter than 8 chars', () => {
        expect(validatePassword('a1b2c3')).toBe(false);
        expect(validatePassword('abc123')).toBe(false);
    });
});

describe('Validate page size', () => {
    it('Returns true for valid page sizes', () => {
        expect(validatePageSize(10)).toBe(true);
        expect(validatePageSize(25)).toBe(true);
        expect(validatePageSize(50)).toBe(true);
    });

    it('Returns false for invalid page sizes', () => {
        expect(validatePageSize(9)).toBe(false);
        expect(validatePageSize(51)).toBe(false);
        expect(validatePageSize(100)).toBe(false);
        expect(validatePageSize(0)).toBe(false);
        expect(validatePageSize(-10)).toBe(false);
        expect(validatePageSize(10.5)).toBe(false);
        expect(validatePageSize(NaN)).toBe(false);
    });
});

describe('Validate phone', () => {
    it('Returns true for valid E.164 phones', () => {
        expect(validatePhone('+1234567890')).toBe(true);
        expect(validatePhone('1234567890')).toBe(true);
        expect(validatePhone('+123456789012345')).toBe(true);
    });

    it('Returns false for invalid phones', () => {
        expect(validatePhone('+')).toBe(false);
        expect(validatePhone('')).toBe(false);
        expect(validatePhone('+0123456789')).toBe(false);
        expect(validatePhone('+1234567890123456')).toBe(false);
        expect(validatePhone('abcdefg')).toBe(false);
        expect(validatePhone('+1 234567890')).toBe(false);
    });
});

describe('Validate files', () => {
    function makeFile(type: string, name: string): File {
        return { type, name } as any;
    }

    it('Returns true for empty array', () => {
        expect(validateFiles([])).toBe(true);
    });

    it('Returns true for allowed file types', () => {
        const files = [
            makeFile('image/jpeg', 'a.jpg'),
            makeFile('image/png', 'b.png'),
            makeFile('application/pdf', 'c.pdf'),
            makeFile('image/webp', 'd.webp'),
            makeFile('text/plain', 'e.txt'),
        ];
        expect(validateFiles(files)).toBe(true);
    });

    it('Returns false for disallowed file types (exe)', () => {
        const files = [
            makeFile('application/x-msdownload', 'malware.exe')
        ];
        expect(validateFiles(files)).toBe(false);
    });

    it('Returns false if any file is not allowed', () => {
        const files = [
            makeFile('image/png', 'ok.png'),
            makeFile('application/x-msdownload', 'bad.exe')
        ];
        expect(validateFiles(files)).toBe(false);
    });

    it('Returns false when length exceeds max', () => {
        const files = Array.from({ length: 6 }, (_, i) =>
            makeFile('image/jpeg', `f${i}.jpg`)
        );
        expect(validateFiles(files)).toBe(false);
    });

    it('Handles file name ending with dot (empty extension fallback)', () => {
        const files = [ makeFile('application/x-unknown', 'noext.') ];
        expect(() => validateFiles(files)).not.toThrow();
        expect(validateFiles(files)).toBe(false);
    });
});

describe('formatName', () => {
    it('Formats name with first full name and abbreviated others', () => {
        expect(formatName('иван петрович сидоров')).toBe('Иван П. С.');
        expect(formatName('мария александровна')).toBe('Мария А.');
        expect(formatName('петр')).toBe('Петр');
        expect(formatName('анна сергеевна иванова')).toBe('Анна С. И.');
    });

    it('Handles mixed case input', () => {
        expect(formatName('ИВАН ПЕТРОВИЧ')).toBe('Иван П.');
        expect(formatName('иВаН пЕтРоВиЧ')).toBe('Иван П.');
        expect(formatName('Иван ПЕТРОВИЧ сидоров')).toBe('Иван П. С.');
    });

    it('Handles extra spaces', () => {
        expect(formatName('  иван   петрович  сидоров  ')).toBe('Иван П. С.');
        expect(formatName(' анна  мария ')).toBe('Анна М.');
        expect(formatName('   петр   ')).toBe('Петр');
    });

    it('Returns empty string for empty or whitespace input', () => {
        expect(formatName('')).toBe('');
        expect(formatName('   ')).toBe('');
        expect(formatName('\t\n')).toBe('');
    });

    it('Handles single character names', () => {
        expect(formatName('а')).toBe('А');
        expect(formatName('а б в')).toBe('А Б. В.');
    });
});

describe('formatTitle', () => {
    it('Returns title as-is when 25 chars or less', () => {
        expect(formatTitle('короткий заголовок')).toBe('короткий заголовок');
        expect(formatTitle('точно двадцать пять симв')).toBe('точно двадцать пять симв');
        expect(formatTitle('краткий')).toBe('краткий');
    });

    it('Truncates title to 22 chars plus ellipsis when longer than 25', () => {
        expect(formatTitle('очень длинный заголовок который не помещается')).toBe('очень длинный заголово...');
        expect(formatTitle('это заголовок больше двадцати пяти символов')).toBe('это заголовок больше д...');
    });

    it('Handles extra spaces and filters empty parts', () => {
        expect(formatTitle('  заголовок   с   пробелами  ')).toBe('заголовок с пробелами');
        expect(formatTitle('   короткий   ')).toBe('короткий');
    });

    it('Handles empty or whitespace input', () => {
        expect(formatTitle('')).toBe('');
        expect(formatTitle('   ')).toBe('');
        expect(formatTitle('\t\n')).toBe('');
    });

    it('Handles edge case exactly at truncation boundary', () => {
        expect(formatTitle('это двадцать семь символов?')).toBe('это двадцать семь симв...');
    });
});

describe('formatDescription', () => {
    it('Returns description as-is when 100 chars or less', () => {
        expect(formatDescription('короткое описание')).toBe('короткое описание');
        expect(formatDescription('a'.repeat(100))).toBe('a'.repeat(100));
        expect(formatDescription('это описание меньше ста символов')).toBe('это описание меньше ста символов');
    });

    it('Truncates to 97 chars plus ellipsis when longer and short=true', () => {
        const longText = 'это очень длинное описание которое совершенно точно значительно превышает сто символов и должно быть обрезано с многоточием';
        const result = formatDescription(longText, true);
        expect(result).toBe('это очень длинное описание которое совершенно точно значительно превышает сто символов и должно б...');
        expect(result.length).toBe(100);
    });

    it('Returns full text when longer but short=false', () => {
        const longText = 'это очень длинное описание которое совершенно точно значительно превышает сто символов но не должно быть обрезано';
        expect(formatDescription(longText, false)).toBe(longText);
    });

    it('Uses short=true by default', () => {
        const longText = 'это очень длинное описание которое точно превышает сто символов и обязательно должно быть обрезано по умолчанию';
        const result = formatDescription(longText);
        expect(result).toBe('это очень длинное описание которое точно превышает сто символов и обязательно должно быть обрезан...');
        expect(result.length).toBe(100);
    });

    it('Handles extra spaces and filters empty parts', () => {
        expect(formatDescription('  описание   с   пробелами  ')).toBe('описание с пробелами');
        expect(formatDescription('   короткое   ')).toBe('короткое');
    });

    it('Handles empty or whitespace input', () => {
        expect(formatDescription('')).toBe('');
        expect(formatDescription('   ')).toBe('');
        expect(formatDescription('\t\n')).toBe('');
    });

    it('Handles long word with truncation when short=true', () => {
        const textWithLongWord = 'начало сверхдлинноесловокотороепревышаетдвадцатьсимволовизаконченныйтексттекстбудетпродолжатьсяболее100';
        const result = formatDescription(textWithLongWord, true);
        expect(result.length).toBe(100);
        expect(result.endsWith('...')).toBe(true);
    });

    it('Does not break words 20 chars or less', () => {
        expect(formatDescription('короткоеслово среднееслово')).toBe('короткоеслово среднееслово');
        expect(formatDescription('a'.repeat(20) + ' ' + 'b'.repeat(20))).toBe('a'.repeat(20) + ' ' + 'b'.repeat(20));
    });
});

describe('formatDate', () => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const expectedLocal = (iso: string) => {
        const d = new Date(iso);
        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    it('Formats date in local timezone dynamically', () => {
        const iso = new Date('2023-10-01T12:34:56Z').toISOString();
        expect(formatDate(iso)).toBe(expectedLocal(iso));
    });

    it('Handles midnight time in local timezone dynamically', () => {
        const iso = new Date('2023-10-01T00:00:00Z').toISOString();
        expect(formatDate(iso)).toBe(expectedLocal(iso));
    });

    it('Return "Без даты" for null', () => {
        expect(formatDate(null as any)).toBe('Без даты');
    });

    it('Return "Без даты" for undefined', () => {
        expect(formatDate(undefined as any)).toBe('Без даты');
    });

    it('Handles invalid date format', () => {
        expect(formatDate('invalid-date')).toBe('Без даты');
    });
});
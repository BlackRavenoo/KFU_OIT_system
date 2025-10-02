import { describe, expect, it } from 'vitest';

import {
    validateEmail,
    validateName,
    validateLogin,
    validatePassword,
    validatePageSize,
    validatePhone,
    validateFiles
} from '$lib/utils/setup/validate';

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
    function makeFile(type: string): File {
        // @ts-ignore
        return { type };
    }

    it('Returns true for null or empty', () => {
        expect(validateFiles(null)).toBe(true);
        expect(validateFiles([])).toBe(true);
        // @ts-ignore
        expect(validateFiles({ length: 0 })).toBe(true);
    });

    it('Returns true for allowed file types', () => {
        const files = [
            makeFile('image/jpeg'),
            makeFile('image/png'),
            makeFile('application/pdf'),
            makeFile('image/gif'),
            makeFile('image/bmp'),
            makeFile('image/webp'),
            makeFile('image/avif')
        ];
        expect(validateFiles(files)).toBe(true);
    });

    it('Returns false for disallowed file types', () => {
        const files = [
            makeFile('image/jpeg'),
            makeFile('application/x-msdownload')
        ];
        expect(validateFiles(files)).toBe(false);
    });

    it('Returns false if any file is not allowed', () => {
        const files = [
            makeFile('image/png'),
            makeFile('text/plain')
        ];
        expect(validateFiles(files)).toBe(false);
    });
});
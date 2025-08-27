import { api } from '$lib/utils/api';
import { notification, NotificationType } from '$lib/utils/notifications/notification';
import { currentUser } from '$lib/utils/auth/storage/initial';
import { get } from 'svelte/store';

/**
 * Функция для валидации email
 * @param email Email для валидации
 * @returns Валиден ли email
 */
export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

/**
 * Функция для обновления имени пользователя
 * @param name Новое имя пользователя
 * @returns Обновлено ли имя
 */
export async function updateUserName(name: string): Promise<boolean> {
    if (!name.trim()) return true;
    
    try {
        const response = await api.put('/api/v1/user/name', { name: name.trim() });
        
        if (response.success) {
            const userValue = get(currentUser);
            if (userValue) {
                currentUser.update(_ => ({
                    ...userValue,
                    name: name.trim()
                }));
            }
            return true;
        } else {
            notification('Ошибка при обновлении имени', NotificationType.Error);
            return false;
        }
    } catch (error) {
        notification('Ошибка при обновлении имени', NotificationType.Error);
        return false;
    }
}

/**
 * Функция для обновления email пользователя
 * @param email Новый email пользователя
 * @returns Обновлен ли email
 */
export async function updateUserEmail(email: string): Promise<boolean> {
    if (!email.trim()) return true;
    
    try {
        const response = await api.put('/api/v1/user/email', { email: email.trim() });
        
        if (response.success) {
            const userValue = get(currentUser);
            if (userValue) {
                currentUser.update(user => ({
                    ...userValue,
                    email: email.trim()
                }));
            }
            return true;
        } else {
            notification('Ошибка при обновлении email', NotificationType.Error);
            return false;
        }
    } catch (error) {
        notification('Ошибка при обновлении email', NotificationType.Error);
        return false;
    }
}

/**
 * Функция для обновления пароля пользователя
 * @param currentPassword Текущий пароль
 * @param newPassword Новый пароль
 * @returns Обновлен ли пароль
 */
export async function updateUserPassword(currentPassword: string, newPassword: string): Promise<boolean> {
    try {
        const response = await api.put('/api/v1/user/password', { 
            current_password: currentPassword.trim(), 
            new_password: newPassword.trim() 
        });
        
        if (response.success) {
            return true;
        } else {
            notification('Ошибка при смене пароля', NotificationType.Error);
            return false;
        }
    } catch (error) {
        notification('Ошибка при смене пароля', NotificationType.Error);
        return false;
    }
}

/**
 * Функция для сохранения профиля пользователя
 * @param name Имя пользователя
 * @param email Почта пользователя
 * @param changePassword Флаг изменять ли пароль
 * @param currentPassword Текущий пароль
 * @param newPassword Новый пароль
 * @returns Обновлен ли профиль
 */
export async function saveUserProfile(
    name: string,
    email: string,
    changePassword: boolean,
    currentPassword: string,
    newPassword: string
): Promise<boolean> {
    const userValue = get(currentUser);
    const currentName = userValue?.name || '';
    const currentEmail = userValue?.email || '';
    
    if (email.trim() && !validateEmail(email)) {
        notification('Некорректный формат email', NotificationType.Error);
        return false;
    }
    if (changePassword && !currentPassword.trim()) {
        notification('Введите текущий пароль', NotificationType.Error);
        return false;
    }
    if (changePassword && !newPassword.trim()) {
        notification('Введите новый пароль', NotificationType.Error);
        return false;
    }
    
    let success = true;
    let updated = false;
    
    if (name.trim() && name.trim() !== currentName) {
        const nameUpdated = await updateUserName(name);
        success = success && nameUpdated;
        updated = updated || nameUpdated;
    }
    if (email.trim() && email.trim() !== currentEmail) {
        const emailUpdated = await updateUserEmail(email);
        success = success && emailUpdated;
        updated = updated || emailUpdated;
    }
    if (changePassword && newPassword && currentPassword) {
        const passwordUpdated = await updateUserPassword(currentPassword, newPassword);
        success = success && passwordUpdated;
        updated = updated || passwordUpdated;
    }
    
    updated && success && notification('Профиль успешно обновлен', NotificationType.Success);
    
    return success;
}
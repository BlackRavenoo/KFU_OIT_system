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
 * Функция для обновления профиля пользователя
 * @param name Имя пользователя
 * @param email Email пользователя
 * @returns Успешно ли обновление профиля
 */
export async function updateUserProfile(name?: string, email?: string): Promise<boolean> {
    const profileData: {name?: string, email?: string} = {};
    
    if (name) profileData.name = name.trim();
    if (email) profileData.email = email.trim();
    
    if (Object.keys(profileData).length === 0) return true;
    
    try {
        const response = await api.put('/api/v1/user/profile', profileData);
        
        if (response.success) {
            const userValue = get(currentUser);
            if (userValue) {
                currentUser.update(user => ({
                    ...user,
                    ...profileData
                }));
            }
            return true;
        } else {
            notification('Ошибка при обновлении профиля', NotificationType.Error);
            return false;
        }
    } catch (error) {
        notification('Ошибка при обновлении профиля', NotificationType.Error);
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
    
    const hasProfileChanges = (name.trim() && name.trim() !== currentName) || 
                             (email.trim() && email.trim() !== currentEmail);
    
    if (hasProfileChanges) {
        const profileUpdated = await updateUserProfile(
            name.trim() !== currentName ? name : undefined,
            email.trim() !== currentEmail ? email : undefined
        );
        success = success && profileUpdated;
        updated = updated || profileUpdated;
    }
    
    if (changePassword && newPassword && currentPassword) {
        const passwordUpdated = await updateUserPassword(currentPassword, newPassword);
        success = success && passwordUpdated;
        updated = updated || passwordUpdated;
    }
    
    updated && success && notification('Профиль успешно обновлен', NotificationType.Success);
    
    return success;
}
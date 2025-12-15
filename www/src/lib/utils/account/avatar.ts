import { notification, NotificationType } from '$lib/utils/notifications/notification';
import { api } from '$lib/utils/api';
import { currentUser } from '$lib/utils/auth/storage/initial';
import { tick } from 'svelte';
import { browser } from '$app/environment';
import { type IUserData } from '$lib/utils/auth/types';

export interface AvatarState {
    isDragging: boolean;
    isResizing: boolean;
    resizeStartX: number;
    resizeStartY: number;
    startCropSize: number;
    startX: number;
    startY: number;
    imgX: number;
    imgY: number;
    scale: number;
    cropSize: number;
    maxCropSize: number;
    minCropSize: number;
    containerSize: number;
    imageSize: {width: number, height: number};
}

/**
 * Функция для инициализации состояния аватара
 * @returns Инициализированное состояние аватара
 */
export function initAvatarState(): AvatarState {
    return {
        isDragging: false,
        isResizing: false,
        resizeStartX: 0,
        resizeStartY: 0,
        startCropSize: 0,
        startX: 0,
        startY: 0,
        imgX: 0,
        imgY: 0,
        scale: 1,
        cropSize: 150,
        maxCropSize: 280,
        minCropSize: 80,
        containerSize: 300,
        imageSize: {width: 0, height: 0}
    };
}

/**
 * Функция для центрирования изображения аватара в контейнере
 * @param state Текущее состояние аватара
 * @returns Состояние аватара с центрированным изображением
 */
export function centerImage(state: AvatarState): AvatarState {
    if (!state.imageSize.width || !state.imageSize.height) return state;

    const isPortrait = state.imageSize.height > state.imageSize.width;
    
    let newScale = isPortrait ? 
        state.containerSize / (state.imageSize.width * 1.2) :
        state.containerSize / (state.imageSize.height * 1.2);

    newScale = isPortrait && state.imageSize.width * newScale < state.cropSize * 1.1 ?
        state.cropSize * 1.1 / state.imageSize.width : 
        !isPortrait && state.imageSize.height * newScale < state.cropSize * 1.1 ?
        state.cropSize * 1.1 / state.imageSize.height : newScale;

    const newImgX = (state.containerSize - state.imageSize.width * newScale) / 2;
    const newImgY = (state.containerSize - state.imageSize.height * newScale) / 2;

    return {
        ...state,
        scale: newScale,
        imgX: newImgX,
        imgY: newImgY
    };
}

/**
 * Функция для ограничения перемещения изображения в пределах области обрезки
 * @param state Текущее состояние аватара
 * @returns Состояние аватара с ограниченной позицией изображения
 */
export function constrainCrop(state: AvatarState): AvatarState {
    if (!state.imageSize.width || !state.imageSize.height) return state;
    
    const cropLeft = (state.containerSize - state.cropSize) / 2;
    const cropRight = cropLeft + state.cropSize;
    const cropTop = (state.containerSize - state.cropSize) / 2;
    const cropBottom = cropTop + state.cropSize;
    
    const scaledWidth = state.imageSize.width * state.scale;
    const scaledHeight = state.imageSize.height * state.scale;
    
    let newImgX = state.imgX > cropLeft ? cropLeft : state.imgX;
    newImgX = newImgX + scaledWidth < cropRight ? cropRight - scaledWidth : newImgX;
    
    let newImgY = state.imgY > cropTop ? cropTop : state.imgY;
    newImgY = newImgY + scaledHeight < cropBottom ? cropBottom - scaledHeight : newImgY;
    
    return {
        ...state,
        imgX: newImgX,
        imgY: newImgY
    };
}

/**
 * Функция для обновления позиции и масштаба изображения в DOM
 * @param imageContainer Контейнер с изображением
 * @param imgX Координата X изображения
 * @param imgY Координата Y изображения
 * @param scale Параметр масштабирования изображения
 */
export function updateImagePosition(imageContainer: HTMLDivElement | null, imgX: number, imgY: number, scale: number): void {
    if (imageContainer)
        imageContainer.style.transform = `translate(${imgX}px, ${imgY}px) scale(${scale})`;
    else
        console.warn('Image container not found');
}

/**
 * Функция для обновления рамки обрезки в DOM
 * @param cropFrame Элемент рамки обрезки
 * @param cropSize Размер рамки обрезки
 * @param containerSize Размер контейнера
 */
export function updateCropFrame(cropFrame: HTMLDivElement | null, cropSize: number, containerSize: number): void {
    if (cropFrame) {
        cropFrame.style.width = `${cropSize}px`;
        cropFrame.style.height = `${cropSize}px`;
        cropFrame.style.left = `${(containerSize - cropSize) / 2}px`;
        cropFrame.style.top = `${(containerSize - cropSize) / 2}px`;
    } else {
        console.warn('Crop frame not found');
    }
}

/**
 * Функция для изменения масштаба изображения аватара
 * @param state Текущее состояние аватара
 * @param delta Порядок изменения масштаба
 * @returns 
 */
export function zoomImage(state: AvatarState, delta: number): AvatarState {
    const newScale = Math.max(0.1, Math.min(5, state.scale + delta));
    
    const centerX = state.containerSize / 2;
    const centerY = state.containerSize / 2;
    
    const newImgX = centerX - ((centerX - state.imgX) / state.scale * newScale);
    const newImgY = centerY - ((centerY - state.imgY) / state.scale * newScale);
    
    return constrainCrop({
        ...state,
        scale: newScale,
        imgX: newImgX,
        imgY: newImgY
    });
}

/**
 * Функция для перемещения изображения аватара
 * @param state Текущее состояние аватара
 * @param deltaX Изменение по оси X
 * @param deltaY Изменение по оси Y
 * @returns 
 */
export function moveImage(state: AvatarState, deltaX: number, deltaY: number): AvatarState {
    return constrainCrop({
        ...state,
        imgX: state.imgX + deltaX,
        imgY: state.imgY + deltaY
    });
}

/**
 * Функция для добавления обработчиков клавиатуры
 * @param handler Функция-обработчик событий клавиатуры
 */
export function addKeyboardHandlers(handler: (event: KeyboardEvent) => void): void {
    browser && window.addEventListener('keydown', handler);
}

/**
 * Функция для удаления обработчиков клавиатуры
 * @param handler Функция-обработчик событий клавиатуры
 */
export function removeKeyboardHandlers(handler: (event: KeyboardEvent) => void): void {
    browser && window.removeEventListener('keydown', handler);
}

/**
 * Функция для обрезки изображения аватара на основе текущих параметров
 * @param canvas Холст для отрисовки и обрезки изображения
 * @param avatarPreviewUrl Ссылка на предварительный просмотр изображения
 * @param imgX Координата X изображения
 * @param imgY Координата Y изображения
 * @param scale Параметр масштабирования изображения
 * @param cropSize Размер области обрезки
 * @param containerSize Размер контейнера
 */
export async function cropAvatarImage(
    canvas: HTMLCanvasElement,
    avatarPreviewUrl: string,
    imgX: number,
    imgY: number,
    scale: number,
    cropSize: number,
    containerSize: number
): Promise<File | null> {
    return new Promise((resolve) => {
        const img = new Image();
        
        img.onload = () => {
            const context = canvas.getContext('2d');
            if (!context) {
                resolve(null);
                return;
            }
            
            const cropLeft = (containerSize - cropSize) / 2;
            const cropTop = (containerSize - cropSize) / 2;
            
            const sourceX = (cropLeft - imgX) / scale;
            const sourceY = (cropTop - imgY) / scale;
            const sourceWidth = cropSize / scale;
            const sourceHeight = cropSize / scale;
            
            canvas.width = 256;
            canvas.height = 256;
            
            context.clearRect(0, 0, canvas.width, canvas.height);
            
            context.beginPath();
            context.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2, true);
            context.closePath();
            context.clip();
            
            context.drawImage(
                img,
                sourceX, sourceY, sourceWidth, sourceHeight,
                0, 0, canvas.width, canvas.height
            );
            
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], 'avatar.jpg', { 
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(file);
                } else {
                    resolve(null);
                }
            }, 'image/jpeg', 0.95);
        };
        
        img.src = avatarPreviewUrl;
    });
}

/**
 * Функция для загрузки аватара на сервер
 * @param file Файл изображения аватара
 */
export async function uploadAvatar(file: File): Promise<string | null> {
    try {
        const formData = new FormData();
        formData.append('avatar', file);
        
        const response = await api.put<{ avatar_url: string }>('/api/v1/user/avatar', formData, 'json', false);
        
        if (response.success) {
            notification('Аватар успешно обновлен', NotificationType.Success);
            
            currentUser.update(user => {
                if (!user) return null;
                else 
                    return {
                        ...user,
                        avatar_key: response.data!.avatar_url
                    };
            });
            
            return response.data?.avatar_url || '';
        } else {
            notification('Ошибка при обновлении аватара', NotificationType.Warning);
            return null;
        }
    } catch (error) {
        notification('Ошибка при загрузке аватара', NotificationType.Warning);
        return null;
    }
}

/**
 * Функция для обновления изображения аватара в компоненте.
 * @param avatarComponent Элемент компонента аватара
 * @param url Ссылка на новое изображение
 */
export async function updateAvatarImage(avatarComponent: HTMLElement | null, url: string): Promise<void> {
    if (!avatarComponent) return;
    
    await tick();
    
    const imgElements = avatarComponent.querySelectorAll('img');
    if (imgElements.length > 0) {
        imgElements.forEach(img => {
            img.src = url;
        });
    } else {
        const possibleAvatarElements = avatarComponent.querySelectorAll('[style*="background"]');
        possibleAvatarElements.forEach(el => {
            (el as HTMLElement).style.backgroundImage = `url(${url})`;
        });
    }
}

/**
 * Генерирует аватар с инициалами на основе имени пользователя
 * @param name Имя пользователя
 * @param size Размер аватара
 * @returns Data URI изображения
 */
function generateLetterAvatar(name: string, size: number): string {
    const avatarColors = [
        "#1abc9c", "#2ecc71", "#3498db", "#9b59b6", "#34495e",
        "#16a085", "#27ae60", "#2980b9", "#8e44ad", "#2c3e50",
        "#f1c40f", "#e67e22", "#e74c3c", "#ecf0f1", "#95a5a6",
        "#f39c12", "#d35400", "#c0392b", "#bdc3c7", "#7f8c8d"
    ];

    name = name || "";
    size = size || 60;

    const nameSplit = String(name).toUpperCase().split(" ");
    let initials: string;

    initials = nameSplit.length == 1 ?
        nameSplit[0] ? nameSplit[0].charAt(0) : "?" :
        nameSplit[0].charAt(0) + nameSplit[1].charAt(0);

    size = window.devicePixelRatio ? size * window.devicePixelRatio : size;

    const charIndex = (initials == "?" ? 72 : initials.charCodeAt(0)) - 64;
    const colourIndex = charIndex % 20;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");

    if (!context) return "";
    else {
        context.fillStyle = avatarColors[colourIndex - 1];
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.font = Math.round(canvas.width / 2) + "px Arial";
        context.textAlign = "center";
        context.fillStyle = "#FFF";
        context.fillText(initials, size / 2, size / 1.5);

        const dataURI = canvas.toDataURL();
        return dataURI;
    }
}

/**
 * Функция для получения и отображения аватара пользователя
 * @param user Объект пользователя
 * @param container HTML элемент, в который нужно вставить аватар
 * @param width Ширина аватара (по умолчанию 48)
 * @param round Круглый ли аватар (по умолчанию true)
 */
export async function getAvatar(
    user: IUserData | { name: string; avatar_key?: string },
    container: HTMLElement | null,
    width: number = 48,
    round: boolean = true
): Promise<void> {
    if (!container) return;

    if (container.children.length > 0)
        container.innerHTML = '';

    const img = document.createElement('img');
    img.alt = user.name;
    img.style.width = `${width}px`;
    img.style.height = `${width}px`;
    img.style.objectFit = 'cover';
    
    if (round)
        img.style.borderRadius = '50%';

    if (user.avatar_key) {
        try {
            const response = await api.get<Blob>(
                `/api/v1/attachments/avatars/${user.avatar_key}.webp`,
                undefined,
                'blob',
                false
            );
            
            if (response.success && response.data) {
                const imageUrl = URL.createObjectURL(response.data);
                img.src = imageUrl;
                
                img.onerror = () => {
                    URL.revokeObjectURL(imageUrl);
                    img.src = generateLetterAvatar(user.name, width);
                };
                
                img.addEventListener('load', () => {
                    setTimeout(() => URL.revokeObjectURL(imageUrl), 100);
                });
            } else {
                img.src = generateLetterAvatar(user.name, width);
            }
        } catch (error) {
            img.src = generateLetterAvatar(user.name, width);
        }
    } else {
        img.src = generateLetterAvatar(user.name, width);
    }

    container.appendChild(img);
}
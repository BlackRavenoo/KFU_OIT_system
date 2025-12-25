<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { formatDate } from '$lib/utils/validation/validate';

    import { 
        initAvatarState, centerImage, constrainCrop, updateImagePosition, updateCropFrame,
        zoomImage, moveImage, addKeyboardHandlers, removeKeyboardHandlers,
        cropAvatarImage, uploadAvatar, updateAvatarImage, getAvatar
    } from '$lib/utils/account/avatar';
    
    import { saveUserProfile } from '$lib/utils/account/profile';
    import { setUserStatus } from '$lib/utils/admin/users';
    import { loadUserStats } from '$lib/utils/account/stats';
    import { loadActiveUserTickets } from '$lib/utils/tickets/api/get';

    import { validateEmail, validateName, validatePassword, validateLogin } from '$lib/utils/validation/validate';
    import { 
        getNameError, 
        getLoginError, 
        getEmailError, 
        getPasswordError, 
        getConfirmPasswordError 
    } from '$lib/utils/validation/error_messages';
    
    import { UserRole, UserStatus } from '$lib/utils/auth/types';
    import { currentUser } from '$lib/utils/auth/storage/initial';
    import { goto } from '$app/navigation';

    import { getSystemNotifications, SystemNotificationCategory, type SystemNotification } from '$lib/utils/notifications/system';
    
    export let userData: { id: string, name: string, email: string, login: string, role: string, status?: UserStatus };
    export let stats: { assignedToMe: number, completedTickets: number, cancelledTickets: number };
    export let activeTickets: any[] = [];
    
    let isEditing: boolean = false;
    let isLoading: boolean = false;
    let editedName: string = '';
    let editedEmail: string = '';
    let editedLogin: string = '';
    let currentPassword: string = '';
    let newPassword: string = '';
    let confirmPassword: string = '';
    let changePassword: boolean = false;
    
    let showAvatarModal: boolean = false;
    let avatarFile: File | null = null;
    let avatarPreviewUrl: string | null = null;
    let localAvatarUrl: string | null = null;
    let fileInput: HTMLInputElement;
    let avatarCanvas: HTMLCanvasElement;
    let avatarUpdateKey = Date.now();
    let displayAvatarContainer: HTMLDivElement | null = null;
    let avatarLoaded = false;
    
    let imageContainer: HTMLDivElement;
    let cropFrame: HTMLDivElement;
    
    let avatarState = initAvatarState();

    const CACHE_KEY_STATS = 'profile_stats_cache';
    const CACHE_KEY_TICKETS = 'profile_tickets_cache';
    const CACHE_TTL = 2 * 60 * 1000;

    let systemNotifications: SystemNotification[] = [];
    let loadingNotifications = true;

    /**
     * Обработчик изменения статуса пользователя
     * @param newStatus - Новый статус пользователя
     */
    async function handleStatusChange(newStatus: UserStatus) {
        const previousStatus = userData.status || UserStatus.Active;
        userData = { ...userData, status: newStatus };
        
        try {
            const success = await setUserStatus(parseInt(userData.id), newStatus);
            if (!success)
                userData = { ...userData, status: previousStatus };
        } catch (error) {
            userData = { ...userData, status: previousStatus };
        }
    }

    /**
     * Получить кэшированную статистику пользователя
     * @param userId ID пользователя
     * @param fallbackStats Статистика по умолчанию, если кэш недоступен
     */
    async function getCachedStats(userId: string, fallbackStats: any) {
        try {
            const cacheRaw = localStorage.getItem(CACHE_KEY_STATS);
            if (cacheRaw) {
                const cache = JSON.parse(cacheRaw);
                if (cache.userId === userId && Date.now() - cache.timestamp < CACHE_TTL) {
                    return cache.data;
                }
            }
            const fresh = await loadUserStats(userId, fallbackStats);
            localStorage.setItem(CACHE_KEY_STATS, JSON.stringify({
                userId,
                timestamp: Date.now(),
                data: fresh
            }));
            return fresh;
        } catch {
            return fallbackStats;
        }
    }

    /**
     * Получить кэшированные активные заявки пользователя
     * @param userId ID пользователя
     */
    async function getCachedTickets(userId: string) {
        try {
            const cacheRaw = localStorage.getItem(CACHE_KEY_TICKETS);
            if (cacheRaw) {
                const cache = JSON.parse(cacheRaw);
                if (cache.userId === userId && Date.now() - cache.timestamp < CACHE_TTL) return cache.data;
            }
            const fresh = await loadActiveUserTickets(userId);
            localStorage.setItem(CACHE_KEY_TICKETS, JSON.stringify({
                userId,
                timestamp: Date.now(),
                data: fresh
            }));
            return fresh;
        } catch {
            return [];
        }
    }

    /**
     * Загрузка аватара в контейнер
     */
    async function loadDisplayAvatar() {
        if (displayAvatarContainer && userData) {
            displayAvatarContainer.innerHTML = '';
            await getAvatar(userData, displayAvatarContainer, 100, true);
            avatarLoaded = true;
        }
    }

    $: nameValid = validateName(editedName);
    $: emailValid = validateEmail(editedEmail);
    $: loginValid = validateLogin(editedLogin);
    $: passwordValid = !changePassword || validatePassword(newPassword);
    $: confirmPasswordValid = !changePassword || (confirmPassword === newPassword);

    $: nameError = getNameError(editedName);
    $: emailError = getEmailError(editedEmail);
    $: loginError = getLoginError(editedLogin);
    $: passwordError = getPasswordError(newPassword);
    $: confirmPasswordError = getConfirmPasswordError(newPassword, confirmPassword);

    $: if (userData && displayAvatarContainer && !avatarLoaded) {
        loadDisplayAvatar();
    }

    /**
     * Начать редактирование профиля
     */
    function startEditingProfile() {
        editedName = userData.name || '';
        editedEmail = userData.email || '';
        editedLogin = userData.login || '';
        isEditing = true;
        avatarLoaded = false;
        
        setTimeout(() => {
            if (displayAvatarContainer) {
                loadDisplayAvatar();
            }
        }, 0);
    }
    
    /**
     * Отменить редактирование профиля
     */
    function cancelEditing() {
        editedName = '';
        editedEmail = '';
        editedLogin = '';
        currentPassword = '';
        newPassword = '';
        confirmPassword = '';
        avatarFile = null;
        changePassword = false;
        isEditing = false;
        avatarLoaded = false;
        
        if (localAvatarUrl) {
            URL.revokeObjectURL(localAvatarUrl);
            localAvatarUrl = null;
        }
        
        loadDisplayAvatar();
    }
    
    /**
     * Обработчик клика по аватару
     */
    function handleAvatarClick() {
        isEditing && fileInput && fileInput.click();
    }

    /**
     * Обработчик выбора файла аватара
     * @param event
     */
    function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            avatarFile = input.files[0];
            
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    avatarState = initAvatarState();
                    
                    avatarPreviewUrl = e.target.result as string;
                    showAvatarModal = true;
                    addKeyboardHandlers(handleKeyboardNavigation);
                    
                    const img = new Image();
                    img.onload = () => {
                        avatarState.imageSize = {
                            width: img.width,
                            height: img.height
                        };
                        
                        setTimeout(() => {
                            avatarState = centerImage(avatarState);
                            updateImagePosition(imageContainer, avatarState.imgX, avatarState.imgY, avatarState.scale);
                        }, 100);
                    };
                    img.src = avatarPreviewUrl;
                }
            };
            reader.readAsDataURL(input.files[0]);
            
            input.value = '';
        }
    }
    
    /**
     * Обработчик начала перетаскивания изображения
     * @param event
     */
    function handleMouseDown(event: MouseEvent) {
        if (avatarState.isResizing) return;
        avatarState.isDragging = true;
        avatarState.startX = event.clientX - avatarState.imgX;
        avatarState.startY = event.clientY - avatarState.imgY;
        event.preventDefault();
    }
    
    /**
     * Обработчик перемещения мыши
     * Изменяет позицию изображения или размер области кадрирования
     * @param event
     */
    function handleMouseMove(event: MouseEvent) {
        if (avatarState.isResizing) {
            const dx = event.clientX - avatarState.resizeStartX;
            const dy = event.clientY - avatarState.resizeStartY;
            
            const change = (dx + dy) / 2;
            
            let newSize = avatarState.startCropSize + change;
            
            newSize = Math.max(avatarState.minCropSize, Math.min(avatarState.maxCropSize, newSize));
            
            avatarState.cropSize = newSize;
            updateCropFrame(cropFrame, avatarState.cropSize, avatarState.containerSize);
            event.preventDefault();
        } else if (avatarState.isDragging) {
            const newImgX = event.clientX - avatarState.startX;
            const newImgY = event.clientY - avatarState.startY;
            
            avatarState.imgX = newImgX;
            avatarState.imgY = newImgY;
            
            avatarState = constrainCrop(avatarState);
            
            updateImagePosition(imageContainer, avatarState.imgX, avatarState.imgY, avatarState.scale);
            event.preventDefault();
        }
    }
    
    /**
     * Обработчик отпускания кнопки мыши
     * Завершает перетаскивание или изменение размера
     */
    function handleMouseUp() {
        avatarState.isDragging = false;
        avatarState.isResizing = false;
    }
    
    /**
     * Обработчик начала касания
     * Начинает перетаскивание изображения
     * Альтернатива для мобильных устройств
     * @param event
     */
    function handleTouchStart(event: TouchEvent) {
        if (event.touches.length !== 1) return;
        avatarState.isDragging = true;
        avatarState.startX = event.touches[0].clientX - avatarState.imgX;
        avatarState.startY = event.touches[0].clientY - avatarState.imgY;
        event.preventDefault();
    }
    
    /**
     * Обработчик перемещения касания
     * Изменяет позицию изображения
     * Альтернатива для мобильных устройств
     * @param event
     */
    function handleTouchMove(event: TouchEvent) {
        if (!avatarState.isDragging || event.touches.length !== 1) return;
        
        const newImgX = event.touches[0].clientX - avatarState.startX;
        const newImgY = event.touches[0].clientY - avatarState.startY;
        
        avatarState.imgX = newImgX;
        avatarState.imgY = newImgY;
        
        avatarState = constrainCrop(avatarState);
        
        updateImagePosition(imageContainer, avatarState.imgX, avatarState.imgY, avatarState.scale);
        event.preventDefault();
    }
    
    /**
     * Обработчик окончания касания
     * Завершает перетаскивание
     * Альтернатива для мобильных устройств
     */
    function handleTouchEnd() {
        avatarState.isDragging = false;
    }
    
    /**
     * Обработчик начала изменения размера области кадрирования
     * @param event
     */
    function handleResizeStart(event: MouseEvent) {
        avatarState.isResizing = true;
        avatarState.resizeStartX = event.clientX;
        avatarState.resizeStartY = event.clientY;
        avatarState.startCropSize = avatarState.cropSize;
        event.preventDefault();
        event.stopPropagation();
    }
    
    /**
     * Обработчик прокрутки колесика мыши
     * Масштабирует изображение
     * @param event
     */
    function handleWheel(event: WheelEvent) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -0.05 : 0.05;
        
        avatarState = zoomImage(avatarState, delta);
        updateImagePosition(imageContainer, avatarState.imgX, avatarState.imgY, avatarState.scale);
    }
    
    /**
     * Обработчик клавиатурной навигации
     * Позволяет управлять масштабом и позицией изображения с клавиатуры
     * @param event
     */
    function handleKeyboardNavigation(event: KeyboardEvent) {
        if (!showAvatarModal) return;
        
        const moveStep = 10;
        const scaleStep = 0.05;
        
        switch (event.key) {
            case "+":
            case "=":
                avatarState = zoomImage(avatarState, scaleStep);
                updateImagePosition(imageContainer, avatarState.imgX, avatarState.imgY, avatarState.scale);
                event.preventDefault();
                break;
                
            case "-":
            case "_":
                avatarState = zoomImage(avatarState, -scaleStep);
                updateImagePosition(imageContainer, avatarState.imgX, avatarState.imgY, avatarState.scale);
                event.preventDefault();
                break;
                
            case "ArrowUp":
                avatarState = moveImage(avatarState, 0, moveStep);
                updateImagePosition(imageContainer, avatarState.imgX, avatarState.imgY, avatarState.scale);
                event.preventDefault();
                break;
                
            case "ArrowDown":
                avatarState = moveImage(avatarState, 0, -moveStep);
                updateImagePosition(imageContainer, avatarState.imgX, avatarState.imgY, avatarState.scale);
                event.preventDefault();
                break;
                
            case "ArrowLeft":
                avatarState = moveImage(avatarState, moveStep, 0);
                updateImagePosition(imageContainer, avatarState.imgX, avatarState.imgY, avatarState.scale);
                event.preventDefault();
                break;
                
            case "ArrowRight":
                avatarState = moveImage(avatarState, -moveStep, 0);
                updateImagePosition(imageContainer, avatarState.imgX, avatarState.imgY, avatarState.scale);
                event.preventDefault();
                break;
                
            case "Enter":
                applyAvatarCrop();
                event.preventDefault();
                break;
                
            case "Escape":
                closeAvatarModal();
                event.preventDefault();
                break;
        }
    }
    
    /**
     * Закрыть модальное окно редактирования аватара
     */
    function closeAvatarModal() {
        showAvatarModal = false;
        removeKeyboardHandlers(handleKeyboardNavigation);
        
        if (avatarPreviewUrl && avatarPreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(avatarPreviewUrl);
            avatarPreviewUrl = null;
        }
    }
    
    /**
     * Применить обрезку аватара и загрузить на сервер
     */
    async function applyAvatarCrop() {
        if (!avatarPreviewUrl || !avatarCanvas) return;
        
        const file = await cropAvatarImage(
            avatarCanvas,
            avatarPreviewUrl,
            avatarState.imgX,
            avatarState.imgY,
            avatarState.scale,
            avatarState.cropSize,
            avatarState.containerSize
        );
        
        if (file) {
            localAvatarUrl && URL.revokeObjectURL(localAvatarUrl);
            localAvatarUrl = URL.createObjectURL(file);
            
            if (displayAvatarContainer) {
                displayAvatarContainer.innerHTML = '';
                const img = document.createElement('img');
                img.src = localAvatarUrl;
                img.alt = editedName || userData.name;
                img.style.width = '100px';
                img.style.height = '100px';
                img.style.borderRadius = '50%';
                img.style.objectFit = 'cover';
                displayAvatarContainer.appendChild(img);
            }
            
            avatarUpdateKey = Date.now();
            
            closeAvatarModal();
            
            isLoading = true;
            const serverUrl = await uploadAvatar(file);
            isLoading = false;
            
            if (serverUrl) {
                userData = { ...userData };
                avatarLoaded = false;
                await loadDisplayAvatar();
                avatarUpdateKey = Date.now();
                
                if (localAvatarUrl) {
                    URL.revokeObjectURL(localAvatarUrl);
                    localAvatarUrl = null;
                }
            }
        }
    }

    /**
     * Сохранить изменения профиля
     * Включает в себя обновление имени, email, логина и пароля
     */
    async function handleSaveProfile() {
        if (!nameValid || !emailValid || !loginValid || !passwordValid || !confirmPasswordValid) return;
        if (confirmPassword !== newPassword) return;
        
        isLoading = true;
        const success = await saveUserProfile(
            editedName,
            editedEmail,
            editedLogin,
            changePassword,
            currentPassword,
            newPassword
        );
        
        if (success) {
            isEditing = false;
            cancelEditing();
        }
        isLoading = false;
    }
    
    /**
     * Инициализация данных при монтировании компонента 
     * Загрузка активных заявок и статистики пользователя
    */
    onMount(() => {
        (async () => {
            editedName = userData?.name || '';
            editedEmail = userData?.email || '';
            editedLogin = userData?.login || '';
            
            if ($currentUser?.role !== UserRole.Anonymous) {
                if ($currentUser?.role !== UserRole.Client) activeTickets = await getCachedTickets(userData.id);
                stats = await getCachedStats(userData.id, stats);
            } else {
                goto('/account?tab=request');
            }

            loadingNotifications = true;
            const res = await getSystemNotifications();
            if (res.success && Array.isArray(res.data)) {
                const now = new Date();
                systemNotifications = res.data.filter(n =>
                    !n.active_until || new Date(n.active_until) > now
                );
            }
            loadingNotifications = false;
        })();
        
        return () => {
            removeKeyboardHandlers(handleKeyboardNavigation);
        };
    });

    onDestroy(() => {
        localAvatarUrl && URL.revokeObjectURL(localAvatarUrl);
    });
</script>

<div class="content-section">
    <h1>Личный кабинет</h1>

    {#if loadingNotifications}
        <div class="system-notifications-loading">Загрузка уведомлений...</div>
    {:else if systemNotifications && systemNotifications.length > 0}
        <div class="system-notifications-list">
            {#each systemNotifications as n (n.id)}
                <div class="system-notification {n.category === SystemNotificationCategory.INFO || (n.category as any as string) == "Info" ? 'info' : 'warning'}">
                    {#if n.category === SystemNotificationCategory.INFO || (n.category as any as string) == "Info"}
                        <span class="notif-icon info-icon">
                            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                                <circle cx="11" cy="11" r="10" stroke="#1976d2" stroke-width="2" fill="#e3f2fd"/>
                                <text x="11" y="13" text-anchor="middle" font-size="14" fill="#1976d2" font-family="Arial" font-weight="bold" dominant-baseline="middle">i</text>
                            </svg>
                        </span>
                    {:else}
                        <span class="notif-icon warning-icon">
                            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                                <polygon points="11,3 21,19 1,19" fill="#fffde7" stroke="#fbc02d" stroke-width="2"/>
                                <text x="11" y="16" text-anchor="middle" font-size="16" fill="#fbc02d" font-family="Arial" font-weight="bold" dominant-baseline="middle">!</text>
                            </svg>
                        </span>
                    {/if}
                    <span class="notif-text">{n.text}</span>
                </div>
            {/each}
        </div>
    {/if}
    
    <div class="profile-dashboard">
        <div class="profile-section">
            <h2>Информация профиля</h2>
            {#if isEditing && $currentUser?.role !== UserRole.Client}
                <div class="edit-profile">
                    <div class="edit-avatar">
                        <input 
                            type="file" 
                            id="avatarInput"
                            accept="image/*" 
                            style="display: none;" 
                            bind:this={ fileInput }
                            on:change={ handleFileSelect }
                        />
                        
                        <button 
                            class="avatar-edit-container" 
                            on:click={ handleAvatarClick } 
                            on:keydown={ (e) => e.key === 'Enter' && handleAvatarClick() }
                            aria-label="Редактировать аватар"
                            type="button"
                        >
                            <div class="avatar-wrapper">
                                <div 
                                    class="display-avatar-container"
                                    bind:this={ displayAvatarContainer }
                                ></div>
                            </div>
                            <div class="avatar-edit-overlay">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </div>
                        </button>
                    </div>
                    
                    <div class="form-section">
                        <h3>Основная информация</h3>
                        <div class="form-group">
                            <label for="name">ФИО</label>
                            <input 
                                type="text" 
                                id="name" 
                                class="form-input"
                                class:red-border={ !nameValid }
                                bind:value={ editedName }
                                placeholder="Введите имя"
                            />
                            {#if nameError}
                                <div class="input-error">{ nameError }</div>
                            {/if}
                        </div>
                        <div class="form-group">
                            <label for="email">Email</label>
                            <input 
                                type="email" 
                                id="email" 
                                class="form-input"
                                class:red-border={ !emailValid }
                                bind:value={ editedEmail }
                                placeholder="Введите email"
                            />
                            {#if emailError}
                                <div class="input-error">{ emailError }</div>
                            {/if}
                        </div>
                        <div class="form-group">
                            <label for="login">Логин</label>
                            <input 
                                type="text" 
                                id="login" 
                                class="form-input"
                                class:red-border={ !loginValid }
                                bind:value={ editedLogin }
                                placeholder="Введите логин"
                            />
                            {#if loginError}
                                <div class="input-error">{ loginError }</div>
                            {/if}
                        </div>
                    </div>
                    
                    <div class="form-section password-section">
                        <div class="password-header">
                            <h3>Смена пароля</h3>
                            <label class="switch">
                                <input type="checkbox" bind:checked={ changePassword }>
                                <span class="slider"></span>
                            </label>
                        </div>
                        
                        {#if changePassword}
                            <div class="form-group">
                                <label for="currentPassword">Текущий пароль</label>
                                <div class="password-input-wrapper">
                                    <input 
                                        type="password" 
                                        id="currentPassword" 
                                        class="form-input" 
                                        bind:value={ currentPassword }
                                        placeholder="Введите текущий пароль"
                                    />
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="newPassword">Новый пароль</label>
                                <div class="password-input-wrapper">
                                    <input 
                                        type="password" 
                                        id="newPassword" 
                                        class="form-input"
                                        class:red-border={ !passwordValid }
                                        bind:value={ newPassword }
                                        placeholder="Введите новый пароль"
                                    />
                                </div>
                                {#if passwordError}
                                    <div class="input-error">{ passwordError }</div>
                                {/if}
                            </div>
                            <div class="form-group">
                                <label for="confirmPassword">Подтвердите пароль</label>
                                <div class="password-input-wrapper">
                                    <input 
                                        type="password" 
                                        id="confirmPassword" 
                                        class="form-input"
                                        class:red-border={ !confirmPasswordValid }
                                        bind:value={ confirmPassword }
                                        placeholder="Подтвердите новый пароль"
                                    />
                                </div>
                                {#if confirmPasswordError}
                                    <div class="input-error">{ confirmPasswordError }</div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                    
                    <div class="form-actions">
                        <button class="btn btn-primary" type="button" on:click={ handleSaveProfile } disabled={ isLoading }>
                            { isLoading ? 'Сохранение...' : 'Сохранить' }
                        </button>
                        <button class="btn btn-secondary" type="button" on:click={ cancelEditing }>
                            Отмена
                        </button>
                    </div>
                </div>
            {:else}
                <div class="profile-info">
                    <div class="profile-info-sections">
                        <div class="info-section">
                            <div class="info-grid">
                                <div class="info-item">
                                    <div class="info-icon">
                                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    </div>
                                    <div>
                                        <span class="info-label">ФИО</span>
                                        <span class="info-value">{ userData?.name || '' }</span>
                                    </div>
                                </div>
                                <div class="info-item">
                                    <div class="info-icon">
                                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                    </div>
                                    <div>
                                        <span class="info-label">Email</span>
                                        <span class="info-value">{ userData?.email || '' }</span>
                                    </div>
                                </div>
                                <div class="info-item">
                                    <div class="info-icon">
                                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                    </div>
                                    <div>
                                        <span class="info-label">Логин</span>
                                        <span class="info-value">{ userData?.login || '' }</span>
                                    </div>
                                </div>
                                {#if $currentUser?.role !== UserRole.Client}
                                    <div class="info-item">
                                        <div class="info-icon">
                                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path></svg>
                                        </div>
                                        <div class="status-info">
                                            <span class="info-label">Статус</span>
                                            <select 
                                                class="role-badge status-badge-select { 'status-' + (userData.status || UserStatus.Active) }"
                                                value={ userData.status || UserStatus.Active }
                                                on:change={ (e: Event) => handleStatusChange((e.currentTarget as HTMLSelectElement).value as unknown as UserStatus) }
                                            >
                                                <option value={ UserStatus.Active }>Активен</option>
                                                <option value={ UserStatus.Sick }>Больничный</option>
                                                <option value={ UserStatus.Vacation }>Отпуск</option>
                                                <option value={ UserStatus.Busy }>Занят</option>
                                            </select>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    </div>

                    {#if $currentUser?.role !== UserRole.Client}
                        <button class="btn edit-btn" type="button" on:click={ startEditingProfile }>
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            Редактировать профиль
                        </button>
                    {/if}
                </div>
            {/if}
        </div>
        
        <div class="profile-stats">
            <h2>Моя статистика</h2>
            <div class="stats-summary">
                <div class="stat-item">
                    <div class="stat-value">{ stats.assignedToMe }</div>
                    <div class="stat-label">Активных</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">{ stats.cancelledTickets }</div>
                    <div class="stat-label">Отменённых</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">{ stats.completedTickets }</div>
                    <div class="stat-label">Завершенных</div>
                </div>
            </div>
        </div>
    </div>
    
    {#if $currentUser?.role !== UserRole.Client}
        <div class="active-tickets-section">
            <div class="section-header">
                <h2>Активные заявки</h2>
                <a href="/ticket" class="view-all">Все заявки</a>
            </div>
            
            {#if activeTickets.length > 0}
                <div class="tickets-grid">
                    {#each activeTickets.slice(0, 3) as ticket}
                        <a href={`/ticket/${ ticket.id }`} class="ticket-card">
                            <div class="ticket-header">
                                <span class="ticket-id">{ ticket.building?.code || '' }-{ ticket.id }</span>
                            </div>
                            <h3 class="ticket-title">{ ticket.title }</h3>
                            <div class="ticket-meta">
                                { formatDate(ticket.planned_at) }
                            </div>
                        </a>
                    {/each}
                </div>
            {:else}
                <div class="empty-state">
                    <p>У вас нет активных заявок</p>
                </div>
            {/if}
        </div>
    {/if}
</div>

{#if showAvatarModal && avatarPreviewUrl}
    <div class="modal-backdrop" role="presentation" on:click={ closeAvatarModal }></div>
    <div class="modal avatar-modal" role="dialog" aria-modal="true" aria-labelledby="avatar-modal-title">
        <div class="modal-header">
            <h3 id="avatar-modal-title">Редактирование аватара</h3>
            <button class="modal-close" type="button" aria-label="Закрыть" on:click={ closeAvatarModal }>×</button>
        </div>
        <div class="modal-body">
            <div class="avatar-editor-container">
                <div 
                    class="crop-frame" 
                    bind:this={ cropFrame }
                    style="width: {avatarState.cropSize}px; height: {avatarState.cropSize}px; left: {(avatarState.containerSize - avatarState.cropSize) / 2}px; top: {(avatarState.containerSize - avatarState.cropSize) / 2}px;"
                >
                    <div class="resize-handle"
                         on:mousedown={ handleResizeStart }
                         on:touchstart={(e) => {
                            e.preventDefault();
                            const touch = e.touches[0];
                            const evt = { clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {}, stopPropagation: () => {} };
                            handleResizeStart(evt as any);
                         }}
                         aria-label="Изменить размер области"
                         role="button"
                         tabindex="0"
                         on:keydown={ (e) => (e.key === 'Enter' || e.key === ' ') && handleResizeStart(e as any) }
                    ></div>
                </div>
                
                <div 
                    class="image-editor-view"
                    style="width: { avatarState.containerSize }px; height: { avatarState.containerSize }px;"
                    on:mousedown={ handleMouseDown }
                    on:mousemove={ handleMouseMove }
                    on:mouseup={ handleMouseUp }
                    on:mouseleave={ handleMouseUp }
                    on:touchstart={ handleTouchStart }
                    on:touchmove={ handleTouchMove }
                    on:touchend={ handleTouchEnd }
                    on:wheel={ handleWheel }
                    aria-label="Область редактирования аватара"
                    role="button"
                    tabindex="0"
                >
                    <div 
                        class="image-container" 
                        bind:this={ imageContainer }
                        style="transform: translate({ avatarState.imgX }px, { avatarState.imgY }px) scale({ avatarState.scale });"
                    >
                        <img src={ avatarPreviewUrl } alt="" />
                    </div>
                </div>
                
                <canvas bind:this={ avatarCanvas } style="display: none;"></canvas>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-primary" type="button" on:click={ applyAvatarCrop }>Применить</button>
            <button class="btn btn-secondary" type="button" on:click={ closeAvatarModal }>Отмена</button>
        </div>
    </div>
{/if}

<style>
    @import './Profile.css';
</style>
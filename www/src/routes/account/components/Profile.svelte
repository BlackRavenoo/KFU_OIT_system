<script lang="ts">
    import { onMount } from 'svelte';
    import { formatDate } from '$lib/utils/tickets/support';
    import Avatar from '$lib/components/Avatar/Avatar.svelte';

    import { 
        initAvatarState, centerImage, constrainCrop, updateImagePosition, updateCropFrame,
        zoomImage, moveImage, addKeyboardHandlers, removeKeyboardHandlers,
        cropAvatarImage, uploadAvatar, updateAvatarImage
    } from '$lib/utils/account/avatar';
    
    import { saveUserProfile } from '$lib/utils/account/profile';
    import { loadUserStats } from '$lib/utils/account/stats';
    import { loadActiveUserTickets } from '$lib/utils/tickets/api/get';

    import { validateEmail, validateName, validatePassword } from '$lib/utils/setup/validate';
    
    export let userData: { id: string, name: string, email: string, role: string };
    export let stats: { assignedToMe: number, completedTickets: number, cancelledTickets: number };
    export let activeTickets: any[] = [];
    
    let isEditing: boolean = false;
    let isLoading: boolean = false;
    let editedName: string = '';
    let editedEmail: string = '';
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
    let avatarComponent: HTMLElement;
    let avatarUpdateKey = Date.now();
    
    let imageContainer: HTMLDivElement;
    let cropFrame: HTMLDivElement;
    
    let avatarState = initAvatarState();

    const CACHE_KEY_STATS = 'profile_stats_cache';
    const CACHE_KEY_TICKETS = 'profile_tickets_cache';
    const CACHE_TTL = 2 * 60 * 1000;

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
                if (cache.userId === userId && Date.now() - cache.timestamp < CACHE_TTL) {
                    return cache.data;
                }
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

    let nameError = '';
    let emailError = '';
    let passwordError = '';
    let confirmPasswordError = '';

    $: nameValid = validateName(editedName);
    $: emailValid = validateEmail(editedEmail);
    $: passwordValid = !changePassword || validatePassword(newPassword);
    $: confirmPasswordValid = !changePassword || (confirmPassword === newPassword);

    $: nameError = nameValid ? '' : 'Имя должно содержать минимум 3 буквы кириллицей';
    $: emailError = emailValid ? '' : 'Некорректный email';
    $: passwordError = passwordValid ? '' : 'Пароль должен быть не менее 8 символов, содержать буквы в верхнем и нижнем регистре, а также цифры';
    $: confirmPasswordError = confirmPasswordValid ? '' : 'Пароли не совпадают';

    /**
     * Начать редактирование профиля
     */
    function startEditingProfile() {
        editedName = userData.name || '';
        editedEmail = userData.email || '';
        isEditing = true;
    }
    
    /**
     * Отменить редактирование профиля
     */
    function cancelEditing() {
        editedName = '';
        editedEmail = '';
        currentPassword = '';
        newPassword = '';
        confirmPassword = '';
        avatarFile = null;
        changePassword = false;
        isEditing = false;
        nameError = '';
        emailError = '';
        passwordError = '';
        confirmPasswordError = '';
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
            
            await updateAvatarImage(avatarComponent, localAvatarUrl);
            avatarUpdateKey = Date.now();
            
            closeAvatarModal();
            
            isLoading = true;
            const serverUrl = await uploadAvatar(file);
            isLoading = false;
            
            if (serverUrl) {
                await updateAvatarImage(avatarComponent, serverUrl);
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
     * Включает в себя обновление имени, email и пароля
     */
    async function handleSaveProfile() {
        if (!nameValid || !emailValid || !passwordValid || !confirmPasswordValid) return;
        if (confirmPassword !== newPassword) return;
        
        isLoading = true;
        const success = await saveUserProfile(
            editedName,
            editedEmail,
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
            
            activeTickets = await getCachedTickets(userData.id);
            stats = await getCachedStats(userData.id, stats);
        })();
        
        return () => {
            removeKeyboardHandlers(handleKeyboardNavigation);
        };
    });
</script>

<div class="content-section">
    <h1>Личный кабинет</h1>
    
    <div class="profile-dashboard">
        <div class="profile-section">
            <h2>Информация профиля</h2>
            {#if isEditing}
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
                            <div class="avatar-wrapper" bind:this={ avatarComponent }>
                                <div id="custom-avatar" style={ localAvatarUrl ? `background-image: url(${localAvatarUrl}); background-size: cover; width: 100%; height: 100%; border-radius: 50%;` : '' }>
                                    {#if !localAvatarUrl}
                                        <Avatar 
                                            width={ 100 } 
                                            round={ true } 
                                            userFullName={ userData?.name || 'Пользователь' }
                                        />
                                    {/if}
                                </div>
                            </div>
                            <div class="avatar-edit-overlay">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </div>
                        </button>
                    </div>
                    
                    <div class="form-section">
                        <h3>Основная информация</h3>
                        <div class="form-group">
                            <label for="name">Имя пользователя</label>
                            <input 
                                type="text" 
                                id="name" 
                                class="form-input"
                                class:red-border={!nameValid}
                                bind:value={ editedName }
                                placeholder="Введите имя"
                                on:input={() => { nameError = validateName(editedName) ? '' : 'Имя должно содержать минимум 3 буквы кириллицей'; }}
                            />
                            {#if nameError}
                                <div class="input-error">{nameError}</div>
                            {/if}
                        </div>
                        <div class="form-group">
                            <label for="email">Email</label>
                            <input 
                                type="email" 
                                id="email" 
                                class="form-input"
                                class:red-border={!emailValid}
                                bind:value={ editedEmail }
                                placeholder="Введите email"
                                on:input={() => { emailError = validateEmail(editedEmail) ? '' : 'Некорректный email'; }}
                            />
                            {#if emailError}
                                <div class="input-error">{emailError}</div>
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
                                        class:red-border={!passwordValid}
                                        bind:value={ newPassword }
                                        placeholder="Введите новый пароль"
                                        on:input={() => { passwordError = validatePassword(newPassword) ? '' : 'Пароль должен быть не менее 8 символов, содержать буквы и цифры'; }}
                                    />
                                </div>
                                {#if passwordError}
                                    <div class="input-error">{passwordError}</div>
                                {/if}
                            </div>
                            <div class="form-group">
                                <label for="confirmPassword">Подтвердите пароль</label>
                                <div class="password-input-wrapper">
                                    <input 
                                        type="password" 
                                        id="confirmPassword" 
                                        class="form-input"
                                        class:red-border={!confirmPasswordValid}
                                        bind:value={ confirmPassword }
                                        placeholder="Подтвердите новый пароль"
                                        on:input={() => { confirmPasswordError = (confirmPassword === newPassword) ? '' : 'Пароли не совпадают'; }}
                                    />
                                </div>
                                {#if confirmPasswordError}
                                    <div class="input-error">{confirmPasswordError}</div>
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
                                        <span class="info-label">Имя</span>
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
                            </div>
                        </div>
                    </div>

                    <button class="btn edit-btn" type="button" on:click={ startEditingProfile }>
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Редактировать профиль
                    </button>
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
    
    <div class="active-tickets-section">
        <div class="section-header">
            <h2>Активные заявки</h2>
            <a href="/tickets" class="view-all">Все заявки</a>
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
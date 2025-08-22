<script lang="ts">
    import { onMount, afterUpdate, tick } from 'svelte';
    import { get } from 'svelte/store';
    import { browser } from '$app/environment';
    
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    import { fetchTickets } from '$lib/utils/tickets/api/get';
    import { formatDate } from '$lib/utils/tickets/support';
    import { api } from '$lib/utils/api';
    
    import Avatar from '$lib/components/Avatar/Avatar.svelte';
    import { currentUser } from '$lib/utils/auth/storage/initial';
    
    export let userData: { id: string, name: string, email: string, role: string };
    export let stats: { assignedToMe: number, completedTickets: number, cancelledTickets: number };
    export let activeTickets: any[] = [];
    
    let isEditing: boolean = false;
    let isLoading: boolean = false;
    let editedName: string = '';
    let editedEmail: string = '';
    let newPassword: string = '';
    let confirmPassword: string = '';
    let avatarFile: File | null = null;
    let changePassword: boolean = false;
    
    let showAvatarModal: boolean = false;
    let avatarPreviewUrl: string | null = null;
    let localAvatarUrl: string | null = null;
    let fileInput: HTMLInputElement;
    let avatarCanvas: HTMLCanvasElement;
    
    let avatarComponent: HTMLElement;
    
    let isDragging: boolean = false;
    let isResizing: boolean = false;
    let resizeStartX: number = 0;
    let resizeStartY: number = 0;
    let startCropSize: number = 0;
    let startX: number = 0;
    let startY: number = 0;
    let imgX: number = 0;
    let imgY: number = 0;
    let scale: number = 1;
    let cropSize: number = 150;
    let maxCropSize: number = 280;
    let minCropSize: number = 80;
    let containerSize: number = 300;
    let imageSize: {width: number, height: number} = {width: 0, height: 0};
    
    let imageContainer: HTMLDivElement;
    let cropFrame: HTMLDivElement;
    
    let avatarUpdateKey = Date.now();
    
    function startEditingProfile() {
        editedName = userData.name || '';
        editedEmail = userData.email || '';
        isEditing = true;
    }
    
    function cancelEditing() {
        editedName = '';
        editedEmail = '';
        newPassword = '';
        confirmPassword = '';
        avatarFile = null;
        changePassword = false;
        isEditing = false;
    }
    
    function handleAvatarClick() {
        isEditing && fileInput && fileInput.click();
    }
    
    function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            avatarFile = input.files[0];
            
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    imgX = 0;
                    imgY = 0;
                    scale = 1;
                    cropSize = 150;
                    
                    avatarPreviewUrl = e.target.result as string;
                    showAvatarModal = true;
                    addKeyboardHandlers();
                    
                    const img = new Image();
                    img.onload = () => {
                        imageSize = {
                            width: img.width,
                            height: img.height
                        };
                        
                        setTimeout(centerImage, 100);
                    };
                    img.src = avatarPreviewUrl;
                }
            };
            reader.readAsDataURL(input.files[0]);
            
            input.value = '';
        }
    }
    
    function centerImage() {
        if (!imageSize.width || !imageSize.height) return;

        const isPortrait = imageSize.height > imageSize.width;
        
        scale = isPortrait ? 
            containerSize / (imageSize.width * 1.2) :
            containerSize / (imageSize.height * 1.2);

        scale = isPortrait && imageSize.width * scale < cropSize * 1.1 ?
            cropSize * 1.1 / imageSize.width : 
            !isPortrait && imageSize.height * scale < cropSize * 1.1 ?
            cropSize * 1.1 / imageSize.height : scale;

        imgX = (containerSize - imageSize.width * scale) / 2;
        imgY = (containerSize - imageSize.height * scale) / 2;

        constrainCrop();
        updateImagePosition();
    }
    
    function closeAvatarModal() {
        showAvatarModal = false;
        removeKeyboardHandlers();
        
        if (avatarPreviewUrl && avatarPreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(avatarPreviewUrl);
            avatarPreviewUrl = null;
        }
    }
    
    function constrainCrop() {
        if (!imageSize.width || !imageSize.height) return;
        
        const cropLeft = (containerSize - cropSize) / 2;
        const cropRight = cropLeft + cropSize;
        const cropTop = (containerSize - cropSize) / 2;
        const cropBottom = cropTop + cropSize;
        
        const scaledWidth = imageSize.width * scale;
        const scaledHeight = imageSize.height * scale;
        
        imgX = imgX > cropLeft ? cropLeft : imgX;
        imgX = imgX + scaledWidth < cropRight ? cropRight - scaledWidth : imgX;
        imgY = imgY > cropTop ? cropTop : imgY;
        imgY = imgY + scaledHeight < cropBottom ? cropBottom - scaledHeight : imgY;
    }
    
    function handleMouseDown(event: MouseEvent) {
        if (isResizing) return;
        isDragging = true;
        startX = event.clientX - imgX;
        startY = event.clientY - imgY;
        event.preventDefault();
    }
    
    function handleMouseMove(event: MouseEvent) {
        if (isResizing) {
            const dx = event.clientX - resizeStartX;
            const dy = event.clientY - resizeStartY;
            
            const change = (dx + dy) / 2;
            
            let newSize = startCropSize + change;
            
            newSize = Math.max(minCropSize, Math.min(maxCropSize, newSize));
            
            cropSize = newSize;
            updateCropFrame();
            event.preventDefault();
        } else if (isDragging) {
            const newImgX = event.clientX - startX;
            const newImgY = event.clientY - startY;
            
            imgX = newImgX;
            imgY = newImgY;
            
            constrainCrop();
            
            updateImagePosition();
            event.preventDefault();
        }
    }
    
    function handleMouseUp() {
        isDragging = false;
        isResizing = false;
    }
    
    function handleTouchStart(event: TouchEvent) {
        if (event.touches.length !== 1) return;
        isDragging = true;
        startX = event.touches[0].clientX - imgX;
        startY = event.touches[0].clientY - imgY;
        event.preventDefault();
    }
    
    function handleTouchMove(event: TouchEvent) {
        if (!isDragging || event.touches.length !== 1) return;
        
        const newImgX = event.touches[0].clientX - startX;
        const newImgY = event.touches[0].clientY - startY;
        
        imgX = newImgX;
        imgY = newImgY;
        
        constrainCrop();
        
        updateImagePosition();
        event.preventDefault();
    }
    
    function handleTouchEnd() {
        isDragging = false;
    }
    
    function handleResizeStart(event: MouseEvent) {
        isResizing = true;
        resizeStartX = event.clientX;
        resizeStartY = event.clientY;
        startCropSize = cropSize;
        event.preventDefault();
        event.stopPropagation();
    }
    
    function handleWheel(event: WheelEvent) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -0.05 : 0.05;
        const newScale = Math.max(0.1, Math.min(5, scale + delta));
        
        const centerX = containerSize / 2;
        const centerY = containerSize / 2;
        
        imgX = centerX - ((centerX - imgX) / scale * newScale);
        imgY = centerY - ((centerY - imgY) / scale * newScale);
        
        scale = newScale;
        
        constrainCrop();
        updateImagePosition();
    }
    
    function updateImagePosition() {
        if (imageContainer)
            imageContainer.style.transform = `translate(${imgX}px, ${imgY}px) scale(${scale})`;
    }
    
    function updateCropFrame() {
        if (cropFrame) {
            cropFrame.style.width = `${cropSize}px`;
            cropFrame.style.height = `${cropSize}px`;
            cropFrame.style.left = `${(containerSize - cropSize) / 2}px`;
            cropFrame.style.top = `${(containerSize - cropSize) / 2}px`;
        }
    }

    function handleKeyboardNavigation(event: KeyboardEvent) {
        if (!showAvatarModal) return;
        
        const moveStep = 10;
        const scaleStep = 0.05;
        
        switch (event.key) {
            case "+":
            case "=":
                zoomImage(scaleStep);
                event.preventDefault();
                break;
                
            case "-":
            case "_":
                zoomImage(-scaleStep);
                event.preventDefault();
                break;
                
            case "ArrowUp":
                moveImage(0, moveStep);
                event.preventDefault();
                break;
                
            case "ArrowDown":
                moveImage(0, -moveStep);
                event.preventDefault();
                break;
                
            case "ArrowLeft":
                moveImage(moveStep, 0);
                event.preventDefault();
                break;
                
            case "ArrowRight":
                moveImage(-moveStep, 0);
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
    
    function zoomImage(delta: number) {
        const newScale = Math.max(0.1, Math.min(5, scale + delta));
        
        const centerX = containerSize / 2;
        const centerY = containerSize / 2;
        
        imgX = centerX - ((centerX - imgX) / scale * newScale);
        imgY = centerY - ((centerY - imgY) / scale * newScale);
        
        scale = newScale;
        
        constrainCrop();
        updateImagePosition();
    }
    
    function moveImage(deltaX: number, deltaY: number) {
        imgX += deltaX;
        imgY += deltaY;
        
        constrainCrop();
        updateImagePosition();
    }
    
    function addKeyboardHandlers() {
        browser && window.addEventListener('keydown', handleKeyboardNavigation);
    }
    
    function removeKeyboardHandlers() {
        browser && window.removeEventListener('keydown', handleKeyboardNavigation);
    }
    
    async function updateAvatarImage(url: string) {
        await tick();
        
        if (avatarComponent) {
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
            avatarUpdateKey = Date.now();
        }
    }
    
    async function applyAvatarCrop() {
        if (!avatarPreviewUrl || !avatarCanvas) return;
        
        const canvas = avatarCanvas;
        const context = canvas.getContext('2d');
        if (!context) return;
        
        const img = new Image();
        img.onload = async () => {
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
            
            canvas.toBlob(async (blob) => {
                if (blob) {
                    localAvatarUrl && URL.revokeObjectURL(localAvatarUrl);
                    localAvatarUrl = URL.createObjectURL(blob);
                    
                    currentUser.update(user => {
                        if (!user) return user;
                        return {
                            ...user,
                            avatar: localAvatarUrl,
                            id: user.id || '',
                            name: user.name || '',
                            email: user.email || '',
                            role: user.role || ''
                        };
                    });
                    
                    await updateAvatarImage(localAvatarUrl);
                    
                    const file = new File([blob], avatarFile?.name || 'avatar.jpg', { 
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    
                    closeAvatarModal();
                    
                    await uploadAvatar(file);
                }
            }, 'image/jpeg', 0.95);
        };
        
        img.src = avatarPreviewUrl;
    }
    
    async function uploadAvatar(file: File) {
        isLoading = true;
        
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            
            const response = await api.post('/api/v1/user/change_avatar', {
                body: formData,
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            if (response.success) {
                notification('Аватар успешно обновлен', NotificationType.Success);
                
                const prevLocalUrl = localAvatarUrl;
                
                const responseData = response.data as { avatar_url: string };
                currentUser.update(user => ({
                    ...user,
                    avatar: responseData.avatar_url,
                    id: user?.id || '',
                    name: user?.name || '',
                    email: user?.email || '',
                    role: user?.role || ''
                }));
                
                await updateAvatarImage(responseData.avatar_url);
                
                if (prevLocalUrl) {
                    URL.revokeObjectURL(prevLocalUrl);
                    if (localAvatarUrl === prevLocalUrl)
                        localAvatarUrl = null;
                }
            } else {
                notification('Ошибка при обновлении аватара', NotificationType.Warning);
            }
        } catch (error) {
            notification('Ошибка при загрузке аватара', NotificationType.Warning);
        } finally {
            isLoading = false;
        }
    }
    
    async function loadActiveTickets() {
        if (!userData?.id || userData.id.length === 0) return;
        try {
            const result = await fetchTickets('', {
                assigned_to: userData.id,
                page: 1,
                page_size: 3,
                order_by: 'id',
                sort_order: 'asc',
                statuses: ['inprogress']
            });
            activeTickets = result.tickets;
        } catch (error) {
            notification('Ошибка загрузки заявок', NotificationType.Error);
        }
    }

    async function loadStats() {
        try {
            const response = await api.get(`/api/v1/user/stats?user_id=${userData.id}`);

            if (response.success){
                stats.assignedToMe = (response.data as any).active_tickets_count || 0;
                stats.completedTickets = (response.data as any).closed_tickets_count || 0;
                stats.cancelledTickets = (response.data as any).cancelled_tickets_count || 0;
            }
        } catch (error) {
            notification('Ошибка загрузки статистики', NotificationType.Error);
        }
    }
    
    async function saveProfile() {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (editedEmail.trim() && !emailRegex.test(editedEmail.trim())) {
            notification('Некорректный формат email', NotificationType.Error);
            return;
        }

        if (changePassword && newPassword !== confirmPassword) {
            notification('Пароли не совпадают', NotificationType.Error);
            return;
        }
        
        isLoading = true;
        
        try {
            try {
                if (editedName.trim()) await api.put('/api/v1/user/name', { name: editedName.trim() });
            } catch (error) {
                notification('Ошибка при обновлении имени', NotificationType.Error);
            }

            try {
                if (editedEmail.trim()) await api.put('/api/v1/user/email', { email: editedEmail.trim() });
            } catch (error) {
                notification('Ошибка при обновлении email', NotificationType.Error);
            }

            try {
                if (changePassword) await api.put('/api/v1/user/password', { password: newPassword.trim() });
            } catch (error) {
                notification('Ошибка при смене пароля', NotificationType.Error);
            }

            const userValue = get(currentUser);
            if (userValue) {
                currentUser.update(_ => ({
                    ...userValue,
                    name: editedName.trim() || userValue.name,
                    email: editedEmail.trim() || userValue.email
                }));
            }

            notification('Профиль успешно обновлен', NotificationType.Success);
            isEditing = false;
        } catch (error) {
            notification('Ошибка при обновлении профиля', NotificationType.Error);
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        editedName = userData?.name || '';
        editedEmail = userData?.email || '';
        
        loadActiveTickets();
        loadStats();

        return () => {
            removeKeyboardHandlers();
        };
    });
    
    afterUpdate(() => {
        localAvatarUrl && avatarComponent && updateAvatarImage(localAvatarUrl);
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
                                bind:value={ editedName }
                                placeholder="Введите имя"
                            />
                        </div>
                        
                        <div class="form-group">
                            <label for="email">Email</label>
                            <input 
                                type="email" 
                                id="email" 
                                class="form-input" 
                                bind:value={ editedEmail }
                                placeholder="Введите email"
                            />
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
                                <label for="newPassword">Новый пароль</label>
                                <div class="password-input-wrapper">
                                    <input 
                                        type="password" 
                                        id="newPassword" 
                                        class="form-input" 
                                        bind:value={ newPassword }
                                        placeholder="Введите новый пароль"
                                    />
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="confirmPassword">Подтвердите пароль</label>
                                <div class="password-input-wrapper">
                                    <input 
                                        type="password" 
                                        id="confirmPassword" 
                                        class="form-input" 
                                        bind:value={ confirmPassword }
                                        placeholder="Подтвердите новый пароль"
                                    />
                                </div>
                            </div>
                        {/if}
                    </div>
                    
                    <div class="form-actions">
                        <button class="btn btn-primary" type="button" on:click={ saveProfile } disabled={ isLoading }>
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
                    style="width: { cropSize }px; height: { cropSize }px; left: { (containerSize - cropSize) / 2 }px; top: { (containerSize - cropSize) / 2 }px;"
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
                    style="width: { containerSize }px; height: { containerSize }px;"
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
                        style="transform: translate({ imgX }px, { imgY }px) scale({ scale });"
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
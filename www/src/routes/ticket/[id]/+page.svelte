<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { fade } from 'svelte/transition';
    import { page } from '$app/stores';
    import { statusOptions, statusPriority } from '$lib/utils/tickets/types';
    import { currentUser, isAuthenticated } from '$lib/utils/auth/storage/initial';
    import { pageTitle, pageDescription, buildings, departments } from '$lib/utils/setup/stores';
    import { formatDate, formatDescription } from '$lib/utils/validation/validate';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    import { getById, fetchImages } from '$lib/utils/tickets/api/get';
    import { unassign, assign, assignUserToTicket as assignUserToTicketApi, unassignUserFromTicket as unassignUserFromTicketApi } from '$lib/utils/tickets/api/assign';
    import { updateTicket, deleteTicket } from '$lib/utils/tickets/api/set';
    import { UserRole } from '$lib/utils/auth/types';
    import { getAvatar } from '$lib/utils/account/avatar';
    import { loadUsersData } from '$lib/utils/admin/users';
    import type { Ticket, Building, UiStatus, PriorityStatus } from '$lib/utils/tickets/types';
    import type { IUserData } from '$lib/utils/auth/types';
    import Confirmation from '$lib/components/Modal/Confirmation.svelte';
    import FileCard from './File.svelte';
    import { handleAuthError, api } from '$lib/utils/api';

    let ticketId: string | undefined = undefined;
    $: ticketId = $page?.params?.id;

    let ticketData: Ticket | null = null;
    let images: string[] = [];
    let files: { name: string; url: string; ext: string; class: string }[] = [];
    let modalOpen = false;
    let modalImg: string | null = null;
    let lastFocused: HTMLElement | null = null;

    let isEditing: boolean = false;
    let showDeleteConfirm: boolean = false;

    let showRemoveConfirm: boolean = false;
    let executorToRemove: { id: string; name: string } | null = null;

    let status: UiStatus;
    let priority: PriorityStatus;
    let title: string = '';
    let description: string = '';
    let author: string = '';
    let author_contacts: string = '';
    let building_id: number | null = null;
    let cabinet: string = '';
    let note: string = '';
    let department_id = null as number | null;

    const NOTE_MAX = 1024;

    let buildingsList: Building[] = [];
    $: buildings.subscribe(val => buildingsList = val);

    let isWideScreen = window.innerWidth > 1280;

    let authorAvatarContainer: HTMLDivElement | null = null;
    let authorAvatarLoaded = false;
    let authorAvatarLoading = false;
    
    let executorAvatarContainers: Map<string, HTMLDivElement> = new Map();
    let loadedExecutorAvatars: Set<string> = new Set();
    let loadingExecutorAvatars: Set<string> = new Set();

    let isSubmitting: boolean = false;

    let showAssignModal: boolean = false;
    let assignSearchQuery: string = '';
    let assignSearchResults: IUserData[] = [];
    let assignSearchLoading: boolean = false;

    function updateScreenWidth() {
        isWideScreen = window.innerWidth > 1280;
    }

    function openModal(img: string): void {
        modalImg = img;
        modalOpen = true;
        lastFocused = document.activeElement as HTMLElement;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleEsc);
        window.addEventListener('keydown', handleArrowKeys);
        setTimeout(() => {
            const modal = document.getElementById('modal-image-dialog');
            modal?.focus();
        }, 0);
    }

    function closeModal(): void {
        modalOpen = false;
        modalImg = null;
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleEsc);
        window.removeEventListener('keydown', handleArrowKeys);
        lastFocused?.focus();
    }

    function handleEsc(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            closeModal();
            showDeleteConfirm = false;
            closeAssignModal();
            closeRemoveConfirm();
        }
    }

    async function assignHandler() {
        assign(ticketId as string)
            .then(() => {
                notification('Заявка взята в работу', NotificationType.Success);
                if (ticketData) {
                    const currentAssigned = Array.isArray(ticketData.assigned_to) ? ticketData.assigned_to : [];
                    ticketData = {
                        ...ticketData,
                        assigned_to: [
                            ...currentAssigned,
                            { id: $currentUser?.id as string, name: $currentUser?.name as string }
                        ],
                        status: 'inprogress'
                    } as Ticket;
                    loadedExecutorAvatars.clear();
                    loadingExecutorAvatars.clear();
                    setTimeout(() => loadExecutorAvatars(), 100);
                }
            })
            .catch(() => {
                notification('Ошибка при взятии заявки в работу', NotificationType.Error);
            });
    }

    async function unassignHandler() {
        unassign(ticketId as string)
            .then(() => {
                notification('Заявка снята с выполнения', NotificationType.Success);
                if (ticketData) {
                    const removedId = $currentUser?.id;
                    ticketData = {
                        ...ticketData,
                        assigned_to: ticketData.assigned_to.filter(
                            (executor) => executor.id !== removedId
                        )
                    } as Ticket;
                    if (removedId) {
                        loadedExecutorAvatars.delete(removedId);
                        loadingExecutorAvatars.delete(removedId);
                        executorAvatarContainers.delete(removedId);
                    }
                    setTimeout(() => loadExecutorAvatars(), 100);
                }
            })
            .catch(() => {
                notification('Ошибка при снятии заявки с выполнения', NotificationType.Error);
            });
    }

    async function onExecutorClick(executorId: string, executorName: string) {
        if (!canAssignExecutors) return;
        executorToRemove = { id: executorId, name: executorName };
        showRemoveConfirm = true;
        document.body.style.overflow = 'hidden';
    }

    function onRemoveBtnClick(e: MouseEvent | KeyboardEvent, executorId: string, executorName: string) {
        if (e && typeof (e as MouseEvent).stopPropagation === 'function')
            (e as MouseEvent).stopPropagation();
        executorToRemove = { id: executorId, name: executorName };
        showRemoveConfirm = true;
        document.body.style.overflow = 'hidden';
    }

    async function confirmRemoveExecutor() {
        const id = executorToRemove?.id;
        showRemoveConfirm = false;
        executorToRemove = null;
        document.body.style.overflow = '';
        if (!id || !ticketId) return;

        try {
            const res = await unassignUserFromTicketApi(ticketId as string, id);
            if (res && (res as any).success && (res as any).ticket) {
                ticketData = (res as any).ticket;
                loadedExecutorAvatars.clear();
                loadingExecutorAvatars.clear();
                setTimeout(() => loadExecutorAvatars(), 100);
            }
        } catch (e) { }
    }

    function closeRemoveConfirm() {
        showRemoveConfirm = false;
        executorToRemove = null;
        document.body.style.overflow = '';
    }

    function handleDelete() {
        showDeleteConfirm = true;
        window.addEventListener('keydown', handleEsc);
    }

    function closeDeleteConfirm() {
        showDeleteConfirm = false;
        window.removeEventListener('keydown', handleEsc);
    }

    async function confirmDelete() {
        try {
            deleteTicket(ticketId as string)
                .then(() => {
                    notification('Заявка удалена', NotificationType.Success);
                    window.location.href = '/ticket';
                })
                .catch(() => {
                    notification('Ошибка при удалении заявки', NotificationType.Error);
                });
        } catch (e) {
            notification('Ошибка при удалении', NotificationType.Error);
        } finally {
            closeDeleteConfirm();
        }
    }

    async function finishHandler() {
        if (!ticketData) return;
        priority = ticketData.priority;
        description = ticketData.description;
        author = ticketData.author;
        author_contacts = ticketData.author_contacts;
        building_id = ticketData.building?.id ?? null;
        cabinet = ticketData.cabinet ?? '';
        note = ticketData.note ?? '';
        department_id = ticketData.department?.id ?? null;
        status = 'closed';
        await saveEdit();
    }

    function handleArrowKeys(e: KeyboardEvent): void {
        if (!modalImg || images.length === 0) return;
        const currentIndex = images.indexOf(modalImg);
        if (e.key === 'ArrowLeft') {
            const prevIndex = (currentIndex - 1 + images.length) % images.length;
            modalImg = images[prevIndex];
        } else if (e.key === 'ArrowRight') {
            const nextIndex = (currentIndex + 1) % images.length;
            modalImg = images[nextIndex];
        }
    }

    async function handleCancel() {
        if (!ticketData) return;
        priority = ticketData.priority;
        description = ticketData.description;
        author = ticketData.author;
        author_contacts = ticketData.author_contacts;
        building_id = ticketData.building?.id ?? null;
        cabinet = ticketData.cabinet ?? '';
        note = ticketData.note ?? '';
        department_id = ticketData.department?.id ?? null;
        status = 'cancelled';
        await saveEdit();
    }

    function startEdit() {
        if (!ticketData) return;
        isEditing = true;
        status = ticketData.status;
        priority = ticketData.priority;
        title = ticketData.title;
        description = ticketData.description;
        author = ticketData.author;
        author_contacts = ticketData.author_contacts;
        building_id = ticketData.building?.id ?? null;
        cabinet = ticketData.cabinet ?? '';
        note = ticketData.note ?? '';
        department_id = ticketData.department?.id ? Number(ticketData.department.id) : null;
    }

    async function saveEdit() {
        if (!ticketData) return;
        if (isSubmitting) return;

        if (typeof note === 'string' && note.length > NOTE_MAX)
            note = note.slice(0, NOTE_MAX);

        const updatedFields: Partial<Ticket> = {
            id: ticketData.id
        };

        if (isEditing && title !== ticketData.title) updatedFields.title = title;
        if (description !== ticketData.description) updatedFields.description = description;
        if (author !== ticketData.author) updatedFields.author = author;
        if (author_contacts !== ticketData.author_contacts) updatedFields.author_contacts = author_contacts;
        if (status !== ticketData.status) updatedFields.status = status as UiStatus;
        if (priority !== ticketData.priority) updatedFields.priority = priority as PriorityStatus;
        if (building_id !== ticketData.building?.id)
            updatedFields.building = buildingsList.find(b => b.id === building_id) || ticketData.building;
        if (cabinet !== ticketData.cabinet) updatedFields.cabinet = cabinet;
        if (note !== (ticketData.note ?? '')) updatedFields.note = note;
        if (department_id !== null && Number(department_id) !== Number(ticketData.department?.id ?? null))
            (updatedFields as any).department_id = Number(department_id);

        const hasAssignedToChanged = updatedFields.assigned_to !== undefined && 
            JSON.stringify(updatedFields.assigned_to) !== JSON.stringify(ticketData.assigned_to);

        try {
            isSubmitting = true;
            
            const dataToUpdate: any = { ...updatedFields };
            
            if (hasAssignedToChanged)
                dataToUpdate.assigned_to = updatedFields.assigned_to ? JSON.stringify(updatedFields.assigned_to) : null;
            
            await updateTicket(ticketId as string, dataToUpdate);

            ticketData = {
                ...ticketData,
                title: updatedFields.title ?? ticketData?.title,
                description: description,
                author: author,
                author_contacts: author_contacts,
                status: status,
                priority: priority,
                cabinet: cabinet,
                building: updatedFields.building || ticketData?.building,
                note: note,
                department: $departments.find(d => Number(d.id) === Number(department_id)) || ticketData?.department
            } as Ticket;

            notification('Заявка обновлена', NotificationType.Success);
            isEditing = false;
            authorAvatarLoaded = false;
            authorAvatarLoading = false;
            loadAuthorAvatar();
        } catch (e) {
            notification('Ошибка при обновлении заявки', NotificationType.Error);
        } finally {
            isSubmitting = false;
        }
    }

    async function loadAuthorAvatar() {
        if (!ticketData || !authorAvatarContainer || authorAvatarLoaded || authorAvatarLoading) return;
        
        authorAvatarLoading = true;
        authorAvatarContainer.innerHTML = '';
        try {
            await getAvatar(
                { name: isEditing ? author : ticketData.author },
                authorAvatarContainer,
                64,
                true
            );
            authorAvatarLoaded = true;
        } finally {
            authorAvatarLoading = false;
        }
    }

    async function loadExecutorAvatar(executorId: string, container: HTMLDivElement) {
        if (loadedExecutorAvatars.has(executorId) || loadingExecutorAvatars.has(executorId)) return;
        
        const executor = ticketData?.assigned_to?.find(e => e.id === executorId);
        if (!executor) return;
        
        loadingExecutorAvatars.add(executorId);
        container.innerHTML = '';
        try {
            await getAvatar(executor, container, isWideScreen ? 48 : 64, true);
            loadedExecutorAvatars.add(executorId);
        } finally {
            loadingExecutorAvatars.delete(executorId);
        }
    }

    async function loadExecutorAvatars() {
        if (!ticketData || !ticketData.assigned_to) return;
        
        for (const executor of ticketData.assigned_to) {
            if (loadedExecutorAvatars.has(executor.id) || loadingExecutorAvatars.has(executor.id)) continue;
            
            const container = executorAvatarContainers.get(executor.id);
            container && await loadExecutorAvatar(executor.id, container);
        }
    }

    function setExecutorAvatarContainer(node: HTMLDivElement, executorId?: string) {
        let currentId = executorId;
        
        if (currentId && node) {
            executorAvatarContainers.set(currentId, node);
            loadExecutorAvatar(currentId, node);
        }
        
        return {
            update(newId?: string) {
                if (newId === currentId) return;
                if (currentId) {
                    executorAvatarContainers.delete(currentId);
                    loadedExecutorAvatars.delete(currentId);
                    loadingExecutorAvatars.delete(currentId);
                }
                currentId = newId;
                if (currentId && node) {
                    executorAvatarContainers.set(currentId, node);
                    loadExecutorAvatar(currentId, node);
                }
            },
            destroy() {
                if (currentId) {
                    executorAvatarContainers.delete(currentId);
                    loadedExecutorAvatars.delete(currentId);
                    loadingExecutorAvatars.delete(currentId);
                }
            }
        };
    }

    function openAssignModal() {
        showAssignModal = true;
        assignSearchQuery = '';
        assignSearchResults = [];
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleEsc);
    }

    function closeAssignModal() {
        showAssignModal = false;
        assignSearchQuery = '';
        assignSearchResults = [];
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleEsc);
    }

    async function searchUsers() {
        if (!assignSearchQuery.trim()) {
            assignSearchResults = [];
            return;
        }

        assignSearchLoading = true;
        try {
            const result = await loadUsersData(1, 10, assignSearchQuery);
            if (!result.error) {
                const assignedIds = new Set(ticketData?.assigned_to?.map(e => e.id) || []);
                assignSearchResults = result.users.filter(u => !assignedIds.has(u.id));
            } else {
                assignSearchResults = [];
            }
        } catch (e) {
            assignSearchResults = [];
            notification('Ошибка при поиске сотрудников', NotificationType.Error);
        } finally {
            assignSearchLoading = false;
        }
    }

    async function assignUserToTicket(userId: string) {
        if (!ticketId) return;

        try {
            const res = await assignUserToTicketApi(ticketId as string, userId);
            if (res && (res as any).success && (res as any).ticket) {
                ticketData = (res as any).ticket;
                loadedExecutorAvatars.clear();
                loadingExecutorAvatars.clear();
                setTimeout(() => loadExecutorAvatars(), 100);
                closeAssignModal();
            }
        } catch (e) { }
    }

    $: if (ticketData && authorAvatarContainer && !authorAvatarLoaded && !authorAvatarLoading) {
        loadAuthorAvatar();
    }

    $: if (ticketData && ticketData.assigned_to && ticketData.assigned_to.length > 0) {
        setTimeout(() => loadExecutorAvatars(), 100);
    }

    $: if (assignSearchQuery) {
        setTimeout(() => searchUsers(), 300);
    }

    const IMAGE_EXTS = new Set(['png','jpg','jpeg','gif','webp','bmp','svg']);
    const FILE_COLOR_CLASS = (ext: string) => {
        const e = ext.toLowerCase();
        if (e === 'pdf') return 'file-pdf';
        else if (e === 'doc' || e === 'docx') return 'file-doc';
        else if (e === 'ppt' || e === 'pptx') return 'file-ppt';
        else return 'file-default';
    };

    function getAttachmentName(att: any): string {
        if (!att) return '';
        if (typeof att === 'string') {
            const parts = att.split('/');
            return parts[parts.length - 1];
        }
        return att.name || att.filename || String(att.id || att.path || '');
    }

    function getAttachmentUrl(att: any): string {
        if (!att) return '';
        else if (typeof att === 'string') return att.startsWith('http') ? att : `/api/v1/attachments/${att}`;
        else return String(att);
    }

    function getExtFromName(name: string) {
        const idx = name.lastIndexOf('.');
        if (idx === -1) return '';
        return name.slice(idx + 1).toLowerCase();
    }

    const canAssignExecutors = $currentUser && ($currentUser.role === UserRole.Administrator || $currentUser.role === UserRole.Moderator);

    onMount(async () => {
        if (!ticketId) return;

        if (!$isAuthenticated || $currentUser === null || $currentUser.role === UserRole.Client)
            handleAuthError(`/page/${ ticketId }`);
        else {
            ticketData = await getById(ticketId);
            if (ticketData && ticketData.building && ticketData.building.code)
                pageTitle.set(`Заявка ${ticketData.building.code}-${ticketId} | Система управления заявками ЕИ КФУ`);
    
            if (ticketData && Array.isArray(ticketData.attachments) && ticketData.attachments.length > 0) {
                const atts = ticketData.attachments || [];
                const imageAtts = atts.filter((att: any) => {
                    const name = getAttachmentName(att);
                    const ext = getExtFromName(name);
                    return IMAGE_EXTS.has(ext);
                });
                const fetched = imageAtts.length ? await fetchImages(imageAtts) : [];
                images = Array.isArray(fetched)
                    ? fetched.filter((u) => typeof u === 'string' && u.trim().length > 0)
                    : [];
                files = atts.map((att: any) => {
                    const name = getAttachmentName(att);
                    const ext = getExtFromName(name);
                    const url = getAttachmentUrl(att);
                    return { name, ext, url, class: FILE_COLOR_CLASS(ext) };
                }).filter(f => !IMAGE_EXTS.has(f.ext));
            } else {
                images = [];
                files = [];
            }
    
            if (ticketData) title = ticketData.title;
    
            window.addEventListener('resize', updateScreenWidth);
        }
    });

    onDestroy(() => {
        pageTitle.set('Service Desk | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Елабужского института Казанского Федерального Университета. Система позволяет создавать заявки на услуги ОИТ, отслеживать их статус, получать советы для самостоятельного решения проблемы и многое другое.');
        
        images.forEach(url => {
            try { URL.revokeObjectURL(url); } catch {}
        });
        
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleEsc);
        window.removeEventListener('resize', updateScreenWidth);
        
        executorAvatarContainers.clear();
        loadedExecutorAvatars.clear();
        loadingExecutorAvatars.clear();
        
        authorAvatarLoaded = false;
        authorAvatarLoading = false;
    });
</script>

{#if isWideScreen}
<main>
    <div class="ticket-container">
        <div class="ticket-info-container">
            <div class="ticket-meta">
                {#if ticketData}
                    <span class="ticket-id">Заявка { ticketData.building.code }-{ ticketId }</span>
                    {#if isEditing}
                        <input
                            type="text"
                            class="ticket-title-input edit-mode"
                            bind:value={ title }
                            aria-label="Заголовок заявки"
                        />
                    {:else}
                        <h1 class="ticket-title">{ ticketData.title }</h1>
                    {/if}
                    <p class="ticket-tag">Время создания: <span>{ formatDate(ticketData.created_at) }</span></p>
                    <p class="ticket-tag">
                        Запланированное время:
                        <span>{ formatDate(ticketData.planned_at || '') || 'Без даты' }</span>
                    </p>
                    <p class="ticket-tag">
                        Отдел:
                        {#if isEditing}
                            <select bind:value={ department_id } class="edit-mode">
                                {#each $departments as dept}
                                    <option value={ dept.id }>{ dept.name }</option>
                                {/each}
                            </select>
                        {:else}
                            <span>{ ticketData.department?.name || 'Не указан' }</span>
                        {/if}
                    </p>
                    <br>
                    <p class="ticket-tag">
                        Статус:
                        {#if isEditing}
                            <select bind:value={ status } class="edit-mode">
                                {#each statusOptions as option}
                                    <option value={ option.serverValue }>{ option.label }</option>
                                {/each}
                            </select>
                        {:else}
                            <span class="{ ticketData.status + '-status' }">{ statusOptions.find(option => option.serverValue === ticketData?.status)?.label }</span>
                        {/if}
                    </p>
                    <p class="ticket-tag">
                        Приоритет:
                        {#if isEditing}
                            <select bind:value={ priority } class="edit-mode">
                                {#each statusPriority as option}
                                    <option value={ option.serverValue }>{ option.label }</option>
                                {/each}
                                {#if !statusPriority.some(p => String(p.serverValue).toLowerCase() === 'critical' || String(p.value).toLowerCase() === 'critical')}
                                    <option value="critical">Критичный</option>
                                {/if}
                            </select>
                        {:else}
                            <span class="{ ticketData.priority + '-priority' }">
                                { statusPriority.find(option => option.serverValue === ticketData?.priority)?.label
                                    || (String(ticketData?.priority ?? '').toLowerCase() === 'critical' ? 'Критичный' : '') }
                            </span>
                        {/if}
                    </p>
                    {#if isEditing}
                        <p class="ticket-tag">
                            Здание:
                            <select bind:value={ building_id } class="edit-mode">
                                <option value="" disabled selected>Выберите здание</option>
                                {#each buildingsList as b}
                                    <option value={ b.id }>{ b.name }</option>
                                {/each}
                            </select>
                        </p>
                    {/if}
                    {#if isEditing}
                        <p class="ticket-tag">
                            Кабинет:
                            <input
                                type="text"
                                class="edit-mode"
                                bind:value={ cabinet }
                                style="width: 120px;"
                                aria-label="Кабинет"
                            />
                        </p>
                    {/if}
                {:else}
                    <p>Загрузка...</p>
                {/if}
            </div>
            {#if ticketData}
                <div class="ticket-meta" style="margin-top: 2rem;">
                    <div style="font-weight: bold; margin-bottom: 0.5rem;">Исполнители:</div>
                    <div class="executors-list">
                        {#if ticketData.assigned_to?.length > 0}
                            {#each ticketData.assigned_to as executor (executor.id)}
                                <button
                                    type="button"
                                    class="executor executor-wrapper"
                                    class:removable={ canAssignExecutors }
                                    on:click={ () => onExecutorClick(executor.id, executor.name) }
                                    on:keydown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            onExecutorClick(executor.id, executor.name);
                                        }
                                    }}
                                    aria-label={`Открыть меню для исполнителя ${ executor.name }`}
                                    tabindex="0"
                                >
                                    <div 
                                        class="avatar-container"
                                        use:setExecutorAvatarContainer={ executor.id }
                                    >
                                        {#if canAssignExecutors}
                                            <span 
                                                class="remove-executor-btn"
                                                role="button"
                                                tabindex="0"
                                                on:click|stopPropagation={(e) => onRemoveBtnClick(e, executor.id, executor.name)}
                                                on:keydown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        onRemoveBtnClick(new MouseEvent('click'), executor.id, executor.name);
                                                    }
                                                }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                                </svg>
                                            </span>
                                        {/if}
                                    </div>
                                    <div class="executor-text">
                                        <span class="executor-name">{ executor.name }</span>
                                        <span class="executor-status">{ executor.id === $currentUser?.id ? "Вы" : "Сотрудник" }</span>
                                    </div>
                                </button>
                            {/each}
                        {:else}
                            <p>Нет исполнителей</p>
                        {/if}
                        {#if canAssignExecutors}
                            <button class="executor executor-add" on:click={ openAssignModal } aria-label="Назначить исполнителя">
                                <div class="avatar-container avatar-add">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                        <path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                    </svg>
                                </div>
                                <div class="executor-text">
                                    <span class="executor-name">Назначить</span>
                                </div>
                            </button>
                        {/if}
                    </div>
                    {#if $currentUser && ticketData.assigned_to && ticketData.assigned_to.some(e => e.id === $currentUser.id)}
                        <div class="ticket-actions" style="margin-top: 1rem;">
                            {#if ticketData.status === 'inprogress'}
                                <button class="btn btn-primary" on:click={ finishHandler }>Завершить</button>
                            {/if}
                            <button class="btn btn-outline" on:click={ unassignHandler }>Отказаться</button>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
        <div class="ticket-description">
            <h2>Задача</h2>
            {#if ticketData && ticketData.building}
                <span class="ticket-building">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z"/></svg>
                    { ticketData.building.name } { ticketData.cabinet ? `| Кб. ${ticketData.cabinet}` : '' }
                </span>
            {/if}
            {#if ticketData}
                {#if isEditing}
                    <textarea bind:value={ description } rows="5" style="width: 100%; margin-bottom: 1em;" class="edit-mode"></textarea>
                {:else}
                    <p>{ formatDescription(ticketData.description, false) }</p>
                {/if}
            {:else}
                <p>Загрузка...</p>
            {/if}
            {#if ticketData && (ticketData.note || isEditing)}
                <div class="ticket-notes">
                    {#if isEditing}
                        <textarea
                            bind:value={ note }
                            class="edit-mode"
                            rows="4"
                            placeholder="Введите примечания"
                            maxlength={ NOTE_MAX }
                            on:input={ (e) => {
                                const el = e.target as HTMLTextAreaElement;
                                if (el.value.length > NOTE_MAX) el.value = el.value.slice(0, NOTE_MAX);
                                note = el.value;
                            } }
                        ></textarea>
                    {:else}
                        <p class="ticket-notes-text">{ ticketData.note }</p>
                    {/if}
                </div>
            {/if}
            {#if images.length > 0 || files.length > 0}
                <div class="attachments-list">
                    {#each images as img}
                        <button
                            class="attachment-img-button"
                            aria-haspopup="dialog"
                            aria-label="Открыть изображение во всплывающем окне"
                            on:click={() => openModal(img)}
                            on:keydown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openModal(img);
                                }
                            }}
                            style="all: unset; cursor: pointer;"
                            type="button"
                        >
                            <img
                                src={img}
                                alt="Вложение"
                                class="attachment-img"
                                loading="lazy"
                            />
                        </button>
                    {/each}

                    {#each files as f}
                        <FileCard
                            name={f.name}
                            url={f.url}
                            ext={f.ext}
                            colorClass={f.class}
                        />
                    {/each}
                </div>
            {/if}
            <div class="author-contacts">
                {#if ticketData}
                    <div 
                        class="avatar-container"
                        bind:this={authorAvatarContainer}
                    ></div>
                    <div class="author-data">
                        {#if isEditing}
                            <input
                                type="text"
                                class="edit-mode"
                                bind:value={ author }
                                style="margin-bottom: 0.5em; width: 100%;"
                                aria-label="Имя заявителя"
                            />
                            <input
                                type="tel"
                                class="edit-mode"
                                bind:value={ author_contacts }
                                style="margin-bottom: 0.5em; width: 100%;"
                                aria-label="Телефон заявителя"
                            />
                        {:else}
                            <p class="ticket-author">{ ticketData.author }</p>
                            <p class="contacts-tag">Телефон: <span>
                                <a href={ "tel:" + ticketData.author_contacts } 
                                    style="
                                    outline: none; 
                                    color: inherit;
                                    text-decoration: none;">
                                    { ticketData.author_contacts }
                                </a>
                            </span></p>
                        {/if}
                    </div>
                {:else}
                    <p>Загрузка...</p>
                {/if}
            </div>
            <div class="ticket-actions">
                {#if !isEditing}
                    {#if ticketData && $currentUser && (!ticketData.assigned_to || !ticketData.assigned_to.some(e => e.id === $currentUser.id))}
                        <button class="btn btn-primary" on:click={ assignHandler }>Взять в работу</button>
                    {/if}
                    <button class="btn btn-outline" on:click={ startEdit }>Редактировать</button>
                    {#if ticketData && ticketData.status !== 'cancelled'}
                        <button class="btn btn-secondary" on:click={ handleCancel }>Отменить</button>
                    {/if}
                    {#if $currentUser && ($currentUser.role === UserRole.Administrator || $currentUser.role === UserRole.Moderator) }
                        <button class="btn btn-danger" on:click={ handleDelete }>Удалить</button>
                    {/if}
                {:else}
                    <button class="btn btn-primary" on:click={ saveEdit } disabled={isSubmitting} aria-busy={isSubmitting} aria-disabled={isSubmitting} data-disabled={isSubmitting}>Сохранить</button>
                {/if}
            </div>
        </div>
    </div>

    {#if modalOpen && modalImg}
        <div
            class="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-image-dialog"
            tabindex="0"
            transition:fade={{ duration: 180 }}
            on:click={ closeModal }
            on:keydown={(e) => {
                if (e.key === 'Escape') closeModal();
            }}
        >
            <button
                class="modal-image"
                id="modal-image-dialog"
                type="button"
                on:click={ closeModal }
                style="background: none; border: none; padding: 0; margin: 0; cursor: pointer;"
            >
                <img src={ modalImg } alt="Просмотр изображения" />
            </button>
            <button
                class="modal-close"
                type="button"
                on:click={ closeModal }
                aria-label="Закрыть"
            >&times;</button>
        </div>
    {/if}
    {#if showDeleteConfirm}
        <Confirmation 
            title="Подтвердите действие"
            message="Вы уверены, что хотите удалить заявку?"
            confirmText="Удалить"
            cancelText="Отмена"
            onConfirm={ confirmDelete }
            onCancel={ closeDeleteConfirm }
        />
    {/if}
    {#if showAssignModal}
        <div
            class="modal-backdrop"
            role="dialog"
            aria-modal="true"
            tabindex="0"
            transition:fade={{ duration: 180 }}
            on:click={ (e) => { if (e.target === e.currentTarget) closeAssignModal(); } }
            on:keydown={(e) => {
                if (e.key === 'Escape') closeAssignModal();
            }}
        >
            <section
                class="assign-modal"
                role="document"
                aria-label="Назначить исполнителя"
            >
                <div class="assign-modal-header">
                    <h2>Назначить исполнителя</h2>
                    <button class="modal-close-btn" on:click={ closeAssignModal }>&times;</button>
                </div>
                <div class="assign-modal-body">
                    <input
                        type="text"
                        class="assign-search-input"
                        placeholder="Поиск сотрудников..."
                        bind:value={ assignSearchQuery }
                        aria-label="Поиск сотрудников"
                        on:keydown={(e) => {
                            if (e.key === 'Escape') closeAssignModal();
                        }}
                    />
                    {#if assignSearchLoading}
                        <p style="text-align: center; padding: 1rem;">Загрузка...</p>
                    {:else if assignSearchResults.length > 0}
                        <div class="assign-results-list">
                            {#each assignSearchResults as user (user.id)}
                                <button class="assign-result-item" on:click={ () => assignUserToTicket(user.id) }>
                                    <span>{ user.name }</span>
                                    <span class="user-email">{ user.email || '' }</span>
                                </button>
                            {/each}
                        </div>
                    {:else if assignSearchQuery.trim()}
                        <p style="text-align: center; padding: 1rem; color: var(--text-secondary);">
                            Сотрудники не найдены
                        </p>
                    {:else}
                        <p style="text-align: center; padding: 1rem; color: var(--text-secondary);">
                            Введите имя сотрудника для поиска
                        </p>
                    {/if}
                </div>
            </section>
        </div>
    {/if}

    {#if showRemoveConfirm}
        <Confirmation
            title="Снять исполнителя"
            message={ executorToRemove ? `Вы уверены, что хотите снять ${ executorToRemove.name } с заявки?` : 'Вы уверены?' }
            confirmText="Снять"
            cancelText="Отмена"
            onConfirm={ confirmRemoveExecutor }
            onCancel={ closeRemoveConfirm }
        />
    {/if}
</main>

{:else}
<main>
    <div class="ticket-container">
        <div class="ticket-description mobile-view">
            {#if ticketData}
                <span class="ticket-id">Заявка { ticketData.building.code }-{ ticketId }</span>
                {#if isEditing}
                    <input
                        type="text"
                        class="ticket-title-input edit-mode"
                        bind:value={ title }
                        aria-label="Заголовок заявки"
                    />
                {:else}
                    <h1 class="ticket-title">{ ticketData.title }</h1>
                {/if}
                <p class="ticket-tag">Время создания: <span>{ formatDate(ticketData.created_at) }</span></p>
                <p class="ticket-tag">
                    Запланированное время:
                    <span>{ formatDate(ticketData.planned_at || '') || 'Без даты' }</span>
                </p>
                <p class="ticket-tag">
                    Отдел:
                    {#if isEditing}
                        <select bind:value={ department_id } class="edit-mode">
                            {#each $departments as dept}
                                <option value={ dept.id }>{ dept.name }</option>
                            {/each}
                        </select>
                    {:else}
                        <span>{ ticketData.department?.name || 'Не указан' }</span>
                    {/if}
                </p>
                <br>
                <p class="ticket-tag">
                    Статус:
                    {#if isEditing}
                        <select bind:value={ status } class="edit-mode">
                            {#each statusOptions as option}
                                <option value={ option.serverValue }>{ option.label }</option>
                            {/each}
                        </select>
                    {:else}
                        <span class="{ ticketData.status + '-status' }">{ statusOptions.find(option => option.serverValue === ticketData?.status)?.label }</span>
                    {/if}
                </p>
                <p class="ticket-tag">
                    Приоритет:
                    {#if isEditing}
                        <select bind:value={ priority } class="edit-mode">
                            {#each statusPriority as option}
                                <option value={ option.serverValue }>{ option.label }</option>
                            {/each}
                            {#if !statusPriority.some(p => String(p.serverValue).toLowerCase() === 'critical' || String(p.value).toLowerCase() === 'critical')}
                                <option value="critical">Критичный</option>
                            {/if}
                        </select>
                    {:else}
                        <span class="{ ticketData.priority + '-priority' }">
                            { statusPriority.find(option => option.serverValue === ticketData?.priority)?.label
                                || (String(ticketData?.priority ?? '').toLowerCase() === 'critical' ? 'Критичный' : '') }
                        </span>
                    {/if}
                </p>
            {:else}
                <span>Загрузка...</span>
            {/if}
            {#if isEditing}
                <p class="ticket-tag">
                    Здание:
                    <select bind:value={ building_id } class="edit-mode">
                        <option value="" disabled selected>Выберите здание</option>
                        {#each buildingsList as b}
                            <option value={ b.id }>{ b.name }</option>
                        {/each}
                    </select>
                </p>
            {/if}
            {#if isEditing}
                <p class="ticket-tag">
                    Кабинет:
                    <input
                        type="text"
                        class="edit-mode"
                        bind:value={ cabinet }
                        style="width: 120px;"
                        aria-label="Кабинет"
                    />
                </p>
            {/if}
            <hr>
            {#if ticketData && ticketData.building}
                <span class="ticket-building">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z"/></svg>
                    { ticketData.building.name } { ticketData.cabinet ? `| Кб. ${ ticketData.cabinet }` : '' }
                </span>
            {/if}
            {#if ticketData}
                {#if isEditing}
                    <textarea bind:value={ description } rows="5" style="width: 100%; margin-bottom: 1em;" class="edit-mode"></textarea>
                {:else}
                    <p>{ formatDescription(ticketData.description, false) }</p>
                {/if}
            {:else}
                <p>Загрузка...</p>
            {/if}
            {#if ticketData && (ticketData.note || isEditing)}
                <div class="ticket-notes">
                    {#if isEditing}
                        <textarea
                            bind:value={ note }
                            class="edit-mode"
                            rows="4"
                            placeholder="Введите примечания"
                            maxlength={ NOTE_MAX }
                            on:input={ (e) => {
                                const el = e.target as HTMLTextAreaElement;
                                if (el.value.length > NOTE_MAX) el.value = el.value.slice(0, NOTE_MAX);
                                note = el.value;
                            } }
                        ></textarea>
                    {:else}
                        <p class="ticket-notes-text">{ ticketData.note }</p>
                    {/if}
                </div>
            {/if}
            {#if images.length > 0 || files.length > 0}
                <div class="attachments-list">
                    {#each images as img}
                        <button
                            class="attachment-img-button"
                            aria-haspopup="dialog"
                            aria-label="Открыть изображение во всплывающем окне"
                            on:click={() => openModal(img)}
                            on:keydown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openModal(img);
                                }
                            }}
                            style="all: unset; cursor: pointer;"
                            type="button"
                        >
                            <img
                                src={img}
                                alt="Вложение"
                                class="attachment-img"
                                loading="lazy"
                            />
                        </button>
                    {/each}

                    {#each files as f}
                        <FileCard
                            name={f.name}
                            url={f.url}
                            ext={f.ext}
                            colorClass={f.class}
                        />
                    {/each}
                </div>
            {/if}
            <div class="author-contacts">
                {#if ticketData}
                    <div 
                        class="avatar-container"
                        bind:this={authorAvatarContainer}
                    ></div>
                    <div class="author-data">
                        {#if isEditing}
                            <input
                                type="text"
                                class="edit-mode"
                                bind:value={ author }
                                style="margin-bottom: 0.5em; width: 100%;"
                                aria-label="Имя заявителя"
                            />
                            <input
                                type="tel"
                                class="edit-mode"
                                bind:value={ author_contacts }
                                style="margin-bottom: 0.5em; width: 100%;"
                                aria-label="Телефон заявителя"
                            />
                        {:else}
                            <p class="ticket-author">{ ticketData.author }</p>
                            <p class="contacts-tag">Телефон: <span>
                                <a href={ "tel:" + ticketData.author_contacts } 
                                    style="
                                    outline: none; 
                                    color: inherit;
                                    text-decoration: none;">
                                    { ticketData.author_contacts }
                                </a>
                            </span></p>
                        {/if}
                    </div>
                {:else}
                    <p>Загрузка...</p>
                {/if}
            </div>
            <div class="ticket-actions">
                {#if !isEditing}
                    {#if ticketData && ticketData.assigned_to?.length > 0}
                        <div class="executors-mobile">
                            <h3 style="margin-top:1.5rem;">Исполнители</h3>
                            <div class="executors-list">
                                {#each ticketData.assigned_to as executor (executor.id)}
                                    <button
                                        type="button"
                                        class="executor executor-wrapper"
                                        class:removable={ canAssignExecutors }
                                        on:click={ () => onExecutorClick(executor.id, executor.name) }
                                        on:keydown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                onExecutorClick(executor.id, executor.name);
                                            }
                                        }}
                                        aria-label={`Открыть меню для исполнителя ${ executor.name }`}
                                        tabindex="0"
                                    >
                                        <div
                                            class="avatar-container"
                                            use:setExecutorAvatarContainer={ executor.id }
                                        >
                                            {#if canAssignExecutors}
                                                <span 
                                                    class="remove-executor-btn"
                                                    role="button"
                                                    tabindex="0"
                                                    on:click|stopPropagation={ (e) => onRemoveBtnClick(e, executor.id, executor.name) }
                                                    aria-label="Снять исполнителя"
                                                    title="Снять с заявки"
                                                    on:keydown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            onRemoveBtnClick(new MouseEvent('click'), executor.id, executor.name);
                                                        }
                                                    }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                                    </svg>
                                                </span>
                                            {/if}
                                        </div>
                                        <div class="executor-text executor-text-mobile">
                                            <span class="executor-name">{ executor.name }</span>
                                            <span class="executor-status">{ executor.id === $currentUser?.id ? 'Вы' : 'Программист' }</span>
                                        </div>
                                    </button>
                                {/each}
                                {#if canAssignExecutors}
                                    <button class="executor executor-add" on:click={ openAssignModal }>
                                        <div class="avatar-container avatar-add">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                                <path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                            </svg>
                                        </div>
                                        <div class="executor-text executor-text-mobile">
                                            <span class="executor-name">Назначить</span>
                                        </div>
                                    </button>
                                {/if}
                            </div>
                            {#if $currentUser && ticketData.assigned_to.some(e => e.id === $currentUser.id)}
                                <div class="ticket-actions" style="margin-top: .75rem;">
                                    {#if ticketData.status === 'inprogress'}
                                        <button class="btn btn-primary" on:click={ finishHandler }>Завершить</button>
                                    {/if}
                                    <button class="btn btn-outline" style="margin-bottom: 1.5rem" on:click={ unassignHandler }>Отказаться</button>
                                </div>
                            {/if}
                        </div>
                    {:else if ticketData}
                        <div class="executors-mobile" style="margin-top:1.5rem;">
                            <h3>Исполнители</h3>
                            <p>Нет исполнителей</p>
                            {#if canAssignExecutors}
                                <button class="executor executor-add" on:click={ openAssignModal } style="margin-top: 0.5rem;">
                                    <div class="avatar-container avatar-add">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                            <path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                        </svg>
                                    </div>
                                    <div class="executor-text executor-text-mobile">
                                        <span class="executor-name">Назначить</span>
                                    </div>
                                </button>
                            {/if}
                        </div>
                    {/if}

                    <div class="mobile-actions-container">
                        {#if ticketData && $currentUser && (!ticketData.assigned_to || !ticketData.assigned_to.some(e => e.id === $currentUser.id))}
                            <button class="btn btn-primary" on:click={ assignHandler }>Взять в работу</button>
                        {/if}
                        <button class="btn btn-outline" on:click={ startEdit }>Редактировать</button>
                        {#if ticketData && ticketData.status !== 'cancelled'}
                            <button class="btn btn-secondary" on:click={ handleCancel }>Отменить</button>
                        {/if}
                        {#if $currentUser && $currentUser.role === UserRole.Administrator }
                            <button class="btn btn-danger" on:click={ handleDelete }>Удалить</button>
                        {/if}
                    </div>
                {:else}
                    <button class="btn btn-primary" on:click={ saveEdit } disabled={ isSubmitting } aria-busy={ isSubmitting } aria-disabled={ isSubmitting } data-disabled={ isSubmitting }>Сохранить</button>
                {/if}
            </div>
        </div>
    </div>

    {#if showRemoveConfirm}
        <Confirmation
            title="Снять исполнителя"
            message={ executorToRemove ? `Вы уверены, что хотите снять ${ executorToRemove.name } с заявки?` : 'Вы уверены?'}
            confirmText="Снять"
            cancelText="Отмена"
            onConfirm={ confirmRemoveExecutor }
            onCancel={ closeRemoveConfirm }
        />
    {/if}

    {#if showAssignModal}
        <div
            class="modal-backdrop"
            role="dialog"
            aria-modal="true"
            tabindex="0"
            transition:fade={{ duration: 180 }}
            on:click={(e) => { if (e.target === e.currentTarget) closeAssignModal(); }}
            on:keydown={(e) => {
                if (e.key === 'Escape') closeAssignModal();
            }}
        >
            <div
                class="assign-modal"
                role="document"
                aria-label="Назначить исполнителя"
            >
                <div class="assign-modal-header">
                    <h2>Назначить исполнителя</h2>
                    <button class="modal-close-btn" on:click={ closeAssignModal }>&times;</button>
                </div>
                <div class="assign-modal-body">
                    <input
                        type="text"
                        class="assign-search-input"
                        placeholder="Поиск сотрудников..."
                        bind:value={ assignSearchQuery }
                        aria-label="Поиск сотрудников"
                        on:keydown={(e) => {
                            if (e.key === 'Escape') closeAssignModal();
                        }}
                    />
                    {#if assignSearchLoading}
                        <p style="text-align: center; padding: 1rem;">Загрузка...</p>
                    {:else if assignSearchResults.length > 0}
                        <div class="assign-results-list">
                            {#each assignSearchResults as user (user.id)}
                                <button class="assign-result-item" on:click={ () => assignUserToTicket(user.id) }>
                                    <span>{ user.name }</span>
                                    <span class="user-email">{ user.email || '' }</span>
                                </button>
                            {/each}
                        </div>
                    {:else if assignSearchQuery.trim()}
                        <p style="text-align: center; padding: 1rem; color: var(--text-secondary);">
                            Сотрудники не найдены
                        </p>
                    {:else}
                        <p style="text-align: center; padding: 1rem; color: var(--text-secondary);">
                            Введите имя сотрудника для поиска
                        </p>
                    {/if}
                </div>
            </div>
        </div>
    {/if}
</main>
{/if}

<style>
    @import './page.css';
</style>
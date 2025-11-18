<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { fade } from 'svelte/transition';
    import { page } from '$app/stores';
    import { statusOptions, statusPriority } from '$lib/utils/tickets/types';
    import { currentUser, isAuthenticated } from '$lib/utils/auth/storage/initial';
    import { pageTitle, pageDescription, buildings } from '$lib/utils/setup/stores';
    import { formatDate, formatDescription } from '$lib/utils/validation/validate';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    import { getById, fetchImages } from '$lib/utils/tickets/api/get';
    import { unassign, assign } from '$lib/utils/tickets/api/assign';
    import { updateTicket, deleteTicket } from '$lib/utils/tickets/api/set';
    import { UserRole } from '$lib/utils/auth/types';
    import { getAvatar } from '$lib/utils/account/avatar';
    import type { Ticket, Building, UiStatus, PriorityStatus } from '$lib/utils/tickets/types';
    import Confirmation from '$lib/components/Modal/Confirmation.svelte';
    import FileCard from './File.svelte';
    import { handleAuthError } from '$lib/utils/api';

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

    let status: UiStatus;
    let priority: PriorityStatus;
    let title: string = '';
    let description: string = '';
    let author: string = '';
    let author_contacts: string = '';
    let building_id: number | null = null;
    let cabinet: string = '';
    let note: string = '';

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
        if (note !== ticketData.note) updatedFields.note = note;

        try {
            isSubmitting = true;
            await updateTicket(ticketId as string, {
                ...updatedFields,
                assigned_to: updatedFields.assigned_to ? JSON.stringify(updatedFields.assigned_to) : null
            });

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
                note: note
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

    $: if (ticketData && authorAvatarContainer && !authorAvatarLoaded && !authorAvatarLoading) {
        loadAuthorAvatar();
    }

    $: if (ticketData && ticketData.assigned_to && ticketData.assigned_to.length > 0) {
        setTimeout(() => loadExecutorAvatars(), 100);
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
            {#if ticketData && ticketData.assigned_to?.length > 0}
                <div class="ticket-meta" style="margin-top: 2rem;">
                    <div style="font-weight: bold; margin-bottom: 0.5rem;">Исполнители:</div>
                    <div class="executors-list">
                        {#each ticketData.assigned_to as executor (executor.id)}
                            <div class="executor">
                                <div 
                                    class="avatar-container"
                                    use:setExecutorAvatarContainer={ executor.id }
                                ></div>
                                <div class="executor-text">
                                    <span class="executor-name">{ executor.name }</span>
                                    <span class="executor-status">{ executor.id === $currentUser?.id ? "Вы" : "Программист" }</span>
                                </div>
                            </div>
                        {/each}
                    </div>
                    {#if $currentUser && ticketData.assigned_to.some(e => e.id === $currentUser.id)}
                        <div class="ticket-actions" style="margin-top: 1rem;">
                            {#if ticketData.status === 'inprogress'}
                                <button class="btn btn-primary" on:click={ finishHandler }>Завершить</button>
                            {/if}
                            <button class="btn btn-outline" on:click={ unassignHandler }>Отказаться</button>
                        </div>
                    {/if}
                </div>
            {:else}
                <div class="ticket-meta" style="margin-top: 2rem;">
                    <div style="font-weight: bold;">Исполнители:</div>
                    <p>Нет исполнителей</p>
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
                                    <div class="executor">
                                        <div
                                            class="avatar-container"
                                            use:setExecutorAvatarContainer={ executor.id }
                                        ></div>
                                        <div class="executor-text executor-text-mobile">
                                            <span class="executor-name">{ executor.name }</span>
                                            <span class="executor-status">{ executor.id === $currentUser?.id ? 'Вы' : 'Программист' }</span>
                                        </div>
                                    </div>
                                {/each}
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
                        </div>
                    {/if}
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
                {:else}
                    <button class="btn btn-primary" on:click={ saveEdit } disabled={ isSubmitting } aria-busy={ isSubmitting } aria-disabled={ isSubmitting } data-disabled={ isSubmitting }>Сохранить</button>
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
</main>
{/if}

<style scoped>
    @import './page.css';
</style>
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { fade } from 'svelte/transition';
    import { page } from '$app/stores';

    import { getAuthTokens } from '$lib/utils/auth/tokens/tokens';
    import { statusOptions, statusPriority } from '$lib/utils/tickets/types';
    import { currentUser, isAuthenticated } from '$lib/utils/auth/storage/initial';
    import { pageTitle, pageDescription, buildings } from '$lib/utils/setup/stores';
    import { formatDate } from '$lib/utils/tickets/support';
    import { TICKETS_API_ENDPOINTS } from '$lib/utils/tickets/api/endpoints';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    import { getById, fetchImages } from '$lib/utils/tickets/api/get';
    import { unassign, assign } from '$lib/utils/tickets/api/assign';
    import { update } from '$lib/utils/tickets/api/update';

    import type { Ticket, Building } from '$lib/utils/tickets/types';

    import Avatar from '$lib/components/Avatar/Avatar.svelte';

    let ticketId: string | undefined = undefined;
    $: ticketId = $page?.params?.id;

    let ticketData: Ticket | null = null;
    let images: string[] = [];
    let modalOpen = false;
    let modalImg: string | null = null;
    let lastFocused: HTMLElement | null = null;

    let isEditing = false;
    let showDeleteConfirm = false;

    let status = '';
    let priority = '';
    let description = '';
    let author = '';
    let author_contacts = '';
    let building_id: number | null = null;
    let cabinet = '';

    let buildingsList: Building[] = [];
    $: buildings.subscribe(val => buildingsList = val);

    function openModal(img: string): void {
        modalImg = img;
        modalOpen = true;
        lastFocused = document.activeElement as HTMLElement;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleEsc);
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
        lastFocused?.focus();
    }

    function handleEsc(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            closeModal();
            showDeleteConfirm = false;
        }
        if (modalOpen && e.key === 'Tab') {
            const modal = document.getElementById('modal-image-dialog');
            if (!modal) return;
            const focusable = modal.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    last.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === last) {
                    first.focus();
                    e.preventDefault();
                }
            }
        }
    }

    async function assignHandler() {
        assign(ticketId as string)
            .then(() => {
                notification('Заявка взята в работу', NotificationType.Success);
                ticketData = { ...ticketData, assigned_to: $currentUser } as Ticket;
            })
            .catch(() => {
                notification('Ошибка при взятии заявки в работу', NotificationType.Error);
            });
    }

    async function unassignHandler() {
        unassign(ticketId as string)
            .then(() => {
                notification('Заявка снята с выполнения', NotificationType.Success);
                ticketData = { ...ticketData, assigned_to: null } as Ticket;
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
            const response = await fetch(`${TICKETS_API_ENDPOINTS.delete}${ticketId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getAuthTokens()?.accessToken}`
                }
            });
            if (!response.ok) throw new Error('Ошибка при удалении');
            notification('Заявка удалена', NotificationType.Success);
            window.location.href = '/tickets';
        } catch (e) {
            notification('Ошибка при удалении', NotificationType.Error);
        } finally {
            closeDeleteConfirm();
        }
    }

    async function finishHandler() {
        if (!ticketData) return;
        status = 'closed';
        await saveEdit();
    }

    function startEdit() {
        if (!ticketData) return;
        isEditing = true;
        status = ticketData.status;
        priority = ticketData.priority;
        description = ticketData.description;
        author = ticketData.author;
        author_contacts = ticketData.author_contacts;
        building_id = ticketData.building?.id ?? null;
        cabinet = ticketData.cabinet ?? '';
    }

    async function saveEdit() {
        if (!ticketData) return;
        const updated = {
            id: ticketData.id,
            title: ticketData.title,
            description: description,
            author: author,
            author_contacts: author_contacts,
            status: status,
            priority: priority,
            building_id: building_id,
            cabinet: cabinet
        };
        update(ticketId as string, updated)
            .then(() => {
                notification('Заявка обновлена', NotificationType.Success);
                ticketData = { ...ticketData, ...updated } as Ticket;
                isEditing = false;
            })
            .catch(() => {
                notification('Ошибка при обновлении заявки', NotificationType.Error);
            });
    }

    onMount(async () => {
        if (!ticketId) return;
        
        ticketData = await getById(ticketId);
        if (ticketData && ticketData.building && ticketData.building.code)
            pageTitle.set(`Заявка ${ticketData.building.code}-${ticketId} | Система управления заявками ЕИ КФУ`);
        if (ticketData && Array.isArray(ticketData.attachments) && ticketData.attachments.length > 0)
            images = await fetchImages(ticketData.attachments);
        
        if (!$isAuthenticated) window.location.href = '/';
    });

    onDestroy(() => {
        pageTitle.set('ОИТ | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Отдела Информационных Технологий Елабужского института Казанского Федерального Университета. Система позволяет создавать заявки на услуги ОИТ, отслеживать их статус, получать советы для самостоятельного решения проблемы и многое другое.');
        
        images.forEach(url => URL.revokeObjectURL(url));
        
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleEsc);
    });
</script>

<main>
    <div class="ticket-container">
        <div class="ticket-info-container">
            <div class="ticket-meta">
                {#if ticketData}
                    <span class="ticket-id">Заявка { ticketData.building.code }-{ ticketId }</span>
                    <h1 class="ticket-title">{ ticketData.title }</h1>
                    <p class="ticket-tag">Время создания: <span>{ formatDate(ticketData.created_at) }</span></p>
                    <p class="ticket-tag">
                        Запланированное время:
                        <span>{ formatDate(ticketData.planned_at || '') || 'Без даты' }</span>
                    </p>
                    <br>
                    <p class="ticket-tag">
                        Статус:
                        {#if isEditing}
                            <select bind:value={ status } style="margin-left: 0.5em;">
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
                            <select bind:value={ priority } style="margin-left: 0.5em;">
                                {#each statusPriority as option}
                                    <option value={ option.serverValue }>{ option.label }</option>
                                {/each}
                            </select>
                        {:else}
                            <span class="{ ticketData.priority + '-priority' }">{ statusPriority.find(option => option.serverValue === ticketData?.priority)?.label }</span>
                        {/if}
                    </p>
                    {#if isEditing}
                        <p class="ticket-tag">
                            Здание:
                            <select bind:value={ building_id } style="margin-left: 0.5em;">
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
                                bind:value={ cabinet }
                                style="margin-left: 0.5em; width: 120px;"
                                aria-label="Кабинет"
                            />
                        </p>
                    {/if}
                {:else}
                    <p>Загрузка...</p>
                {/if}
            </div>
            {#if ticketData && ticketData.assigned_to}
                <div class="ticket-meta" style="margin-top: 2rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <Avatar width={48} round={true} userFullName={ticketData.assigned_to.name} />
                        <div>
                            <div style="font-weight: bold;">Исполнитель</div>
                            <div>{ticketData.assigned_to.name}</div>
                            <div style="font-size: 0.95em; color: #888; margin-top: 0.25em;">
                                {#if ticketData.status === 'inprogress'}
                                    Статус: В работе
                                {:else if ticketData.status === 'closed'}
                                    Статус: Завершено
                                {:else}
                                    Статус: Ожидает выполнения
                                {/if}
                            </div>
                        </div>
                    </div>
                    {#if $currentUser && ticketData.assigned_to.id === $currentUser.id}
                        <div class="ticket-actions" style="margin-top: 1rem;">
                            <button class="btn btn-warning" on:click={ unassignHandler }>Отказаться</button>
                            {#if ticketData.status === 'inprogress'}
                                <button class="btn btn-primary" on:click={ finishHandler }>Завершить</button>
                            {/if}
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
                    <textarea bind:value={description} rows="5" style="width: 100%; margin-bottom: 1em;"></textarea>
                {:else}
                    <p>{ ticketData.description }</p>
                {/if}
            {:else}
                <p>Загрузка...</p>
            {/if}
            {#if images.length > 0}
                <div class="attachments-list">
                    {#each images as img, i}
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
                        >
                            <img
                                src={img}
                                alt="Вложение"
                                class="attachment-img"
                                loading="lazy"
                            />
                        </button>
                    {/each}
                </div>
            {/if}
            <div class="author-contacts">
                {#if ticketData}
                    <Avatar width={64} round={true} userFullName={ isEditing ? author : ticketData.author } />	
                    <div class="author-data">
                        {#if isEditing}
                            <input
                                type="text"
                                bind:value={ author }
                                style="margin-bottom: 0.5em; width: 100%;"
                                aria-label="Имя заявителя"
                            />
                            <input
                                type="tel"
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
                    {#if ticketData && !ticketData.assigned_to}
                        <button class="btn btn-primary" on:click={ assignHandler }>Взять в работу</button>
                    {/if}
                    <button class="btn btn-outline" on:click={ startEdit }>Редактировать</button>
                    {#if ticketData && ticketData.status !== 'cancelled'}
                        <button class="btn btn-secondary">Отменить</button>
                    {/if}
                    {#if $currentUser && $currentUser.role !== 0}
                        <button class="btn btn-danger" on:click={ handleDelete }>Удалить</button>
                    {/if}
                {:else}
                    <button class="btn btn-primary" on:click={ saveEdit }>Сохранить</button>
                {/if}
            </div>
        </div>
    </div>
    {#if modalOpen && modalImg}
    <div
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Просмотр изображения"
        transition:fade={{ duration: 180 }}
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
        <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Подтвердите удаление" transition:fade={{ duration: 180 }}>
            <div class="modal-image" style="min-width:320px; max-width:90vw; background:#fff; border-radius:10px; padding:2em; box-shadow:0 4px 32px rgba(0,0,0,0.25); display:flex; flex-direction:column; align-items:center;">
                <p style="font-size:1.15em; margin-bottom:1.5em;">Вы уверены, что хотите удалить заявку?</p>
                <div style="display:flex; gap:1em;">
                    <button class="btn btn-danger" on:click={ confirmDelete }>Удалить</button>
                    <button class="btn btn-secondary" on:click={ closeDeleteConfirm }>Отмена</button>
                </div>
            </div>
        </div>
    {/if}
</main>

<style scoped>
    @import './page.css';
</style>
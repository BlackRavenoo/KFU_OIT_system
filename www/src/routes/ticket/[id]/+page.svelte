<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    import { page } from '$app/stores';
    import { getAuthTokens } from '$lib/utils/auth/tokens/tokens';
    import { statusOptions, statusPriority } from '$lib/utils/tickets/types';
    import { currentUser, isAuthenticated } from '$lib/utils/auth/storage/initial';
    import { pageTitle, pageDescription } from '$lib/utils/setup/stores';
    import { formatDate } from '$lib/utils/tickets/support';
    import Avatar from '$lib/components/Avatar/Avatar.svelte';
    import type { Ticket } from '$lib/utils/tickets/types';

    let ticketId: string | undefined = undefined;
    $: ticketId = $page?.params?.id;

    let ticketData: Ticket | null = null;
    let images: string[] = [];
    let modalOpen = false;
    let modalImg: string | null = null;

    let lastFocused: HTMLElement | null = null;

    async function getById(id: string): Promise<Ticket> {
        const result = fetch(`/api/v1/tickets/${id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthTokens()?.accessToken}`
            }
        })
        .then(response => {
            if (!response.ok) throw new Error('Ошибка получения заявки');
            return response.json();
        })
        .catch(error => {
            return {
                id: 0,
                title: 'Ошибка',
                description: error.message,
                author: 'system',
                author_contacts: '',
                status: 'cancelled',
                priority: 'critical',
                planned_at: null,
                assigned_to: null,
                created_at: new Date().toISOString(),
                attachments: []
            } as Ticket;
        });
        return result;
    }

    async function fetchImages(attachments: string[]) {
        images = [];
        for (const key of attachments) {
            try {
                const res = await fetch(`/api/v1/images/attachments/${key.split('/').pop()}`);
                if (!res.ok) continue;
                const blob = await res.blob();
                images = [...images, URL.createObjectURL(blob)];
            } catch { 
            }
        }
    }

    function openModal(img: string) {
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

    function closeModal() {
        modalOpen = false;
        modalImg = null;
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleEsc);
        lastFocused?.focus();
    }

    function handleEsc(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            closeModal();
        }
        // Trap focus inside modal
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

    onMount(async () => {
        if (!ticketId) return;
        pageTitle.set(`Заявка №${ticketId} | Система управления заявками ЕИ КФУ`);
        ticketData = await getById(ticketId);
        if (ticketData && Array.isArray(ticketData.attachments) && ticketData.attachments.length > 0)
            await fetchImages(ticketData.attachments);
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
        <div class="ticket-meta">
            <span class="ticket-id">Заявка №{ ticketId }</span>
            {#if ticketData}
                <h1 class="ticket-title">{ ticketData.title }</h1>
                <p class="ticket-tag">Время создания: <span>{ formatDate(ticketData.created_at) }</span></p>
                <p class="ticket-tag">Запланированное время: <span>{ formatDate(ticketData.planned_at || '') || 'Без даты' }</span></p>
                <br>
                <p class="ticket-tag">Статус: <span class="{ ticketData.status + '-status' }">{ statusOptions.find(option => option.serverValue === ticketData?.status)?.label }</span></p>
                <p class="ticket-tag">Приоритет: <span class="{ ticketData.priority + '-priority' }">{ statusPriority.find(option => option.serverValue === ticketData?.priority)?.label }</span></p>
                {#if ticketData.assigned_to}
                    <div class="executor-block">
                        <h3>Исполнитель</h3>
                        <p>{ ticketData.assigned_to }</p>
                    </div>
                {/if}
            {:else}
                <p class="ticket-tag">Загрузка...</p>
            {/if}
        </div>
        <div class="ticket-description">
            <h2>Описание</h2>
            {#if ticketData}
                <p>{ ticketData.description }</p>
            {:else}
                <p>Загрузка...</p>
            {/if}
            {#if images.length > 0}
                <h3>Фото</h3>
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
                    <Avatar width={64} round={true} userFullName={ ticketData.author } />	
                    <div class="author-data">
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
                    </div>
                {:else}
                    <p>Загрузка...</p>
                {/if}
            </div>
            <div class="ticket-actions">
                {#if ticketData && !ticketData.assigned_to}
                    <button class="btn btn-primary">Взять в работу</button>
                {:else if ticketData && ticketData.assigned_to === $currentUser?.id}
                    <button class="btn btn-warning">Отказаться</button>
                    <button class="btn btn-success">Завершить</button>
                {/if}
                <button class="btn btn-outline">Редактировать</button>
                <button class="btn btn-secondary">Отменить</button>
                {#if $currentUser && $currentUser.role !== 0}
                    <button class="btn btn-danger">Удалить</button>
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
</main>

<style scoped>
    @import './page.css';
</style>
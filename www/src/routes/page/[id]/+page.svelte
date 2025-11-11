<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { page as pageStore } from '$app/stores';
    import { get } from 'svelte/store';
    import { pageDescription, pageTitle } from '$lib/utils/setup/stores';
    import { api } from '$lib/utils/api';
    import { getAvatar } from '$lib/utils/account/avatar';
    import { deserialize } from '$lib/utils/texteditor/serialize';
    import { currentUser } from '$lib/utils/auth/storage/initial';
    import { UserRole } from '$lib/utils/auth/types';
    import Confirmation from '$lib/components/Modal/Confirmation.svelte';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';

    type Tag = { id: number; name: string };
    type Author = { id: number; name: string; avatar_key?: string | null };

    type PageData = {
        id: number;
        is_public: boolean;
        title: string;
        key: string;
        tags: Tag[];
        authors?: Author[];
    };

    let loading = true;
    let contentLoading = false;
    let error: string | null = null;
    let contentError: string | null = null;

    let doc: PageData | null = null;
    let contentHtml = '';
    let deleting = false;
    let showDeleteConfirm = false;

    function goBack() { 
        history.back(); 
    }

    function avatarAction(node: HTMLDivElement, author: Author | undefined) {
        if (!author) return {};
        node.innerHTML = '';
        getAvatar({ id: author.id, name: author.name, avatar_key: author.avatar_key ?? null } as any, node, 48, true)
            .catch(() => { node.textContent = (author.name || '?')[0] ?? '?'; });
        return {
            update(next: Author | undefined) {
                if (!next) return;
                node.innerHTML = '';
                getAvatar({ id: next.id, name: next.name, avatar_key: next.avatar_key ?? null } as any, node, 48, true)
                    .catch(() => { node.textContent = (next.name || '?')[0] ?? '?'; });
            }
        };
    }

    async function loadSerializedContent(key: string) {
        contentLoading = true;
        contentError = null;
        contentHtml = '';

        try {
            const url = `https://ticketing-attachments.s3.cloud.ru/${key.replace(/^\/+/, '')}`;

            const r = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-cache' });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);

            let data: unknown;
            try {
                data = await r.json();
            } catch {
                const txt = await r.text();
                data = JSON.parse(txt);
            }

            if (Array.isArray(data))
                contentHtml = deserialize(data as any);
            else
                throw new Error('Некорректный формат контента (ожидался массив)');
        } catch (e: any) {
            contentError = e?.message || 'Ошибка загрузки контента';
            contentHtml = '<p>Контент недоступен.</p>';
        } finally {
            contentLoading = false;
        }
    }

    async function loadPage() {
        loading = true;
        error = null;
        doc = null;
        contentHtml = '';
        try {
            const id = get(pageStore).params.id;
            const resp = await api.get<PageData>(`/api/v1/pages/${id}`);

            const ok = resp.status === 200 || resp.status === 201 || resp.status === 304;
            if (!ok) throw new Error(resp.error || `HTTP ${resp.status}`);

            doc = resp.data as PageData;
            pageTitle.set(`${doc.title} | Система управления заявками ЕИ КФУ`);
            
            await loadSerializedContent(doc.key);
        } catch (e: any) {
            error = e?.message || 'Не удалось загрузить страницу';
        } finally {
            loading = false;
        }
    }

    function requestDelete() {
        showDeleteConfirm = true;
    }
    function cancelDelete() {
        showDeleteConfirm = false;
    }

    async function confirmDelete() {
        if (!doc) { showDeleteConfirm = false; return; }
        try {
            deleting = true;
            const resp = await api.delete(`/api/v1/pages/${doc.id}`);
            const ok = resp.status === 200 || resp.status === 201 || resp.status === 204 || resp.status === 304;
            if (!ok) throw new Error(resp.error || `HTTP ${resp.status}`);
            showDeleteConfirm = false;
            window.location.href = '/';
        } catch (e: any) {
            showDeleteConfirm = false;
            notification(e?.message || 'Не удалось удалить статью', NotificationType.Error);
        } finally {
            deleting = false;
        }
    }

    onMount(() => { 
        pageTitle.set('Загрузка... | Система управления заявками ЕИ КФУ');
        pageDescription.set('Просмотр страницы в системе управления заявками ЕИ КФУ.');
        void loadPage(); 
    });

    onDestroy(() => { 
        pageTitle.set('ОИТ | Система управления заявками ЕИ КФУ'); 
        pageDescription.set('Система управления заявками ЕИ КФУ. Создание и отслеживание заявок на IT-услуги для сотрудников и студентов Казанского федерального университета.');
    });
</script>

<div id="content-panel">
    <header class="editor-header viewer-header">
        <div class="title-container">
            <button class="back-btn" title="Назад" on:click={ goBack } aria-label="Назад">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                    <path d="M18 22L10 14L18 6" stroke="var(--blue)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="doc-title-block">
                <div class="doc-title" aria-live="polite">
                    {#if loading} Загрузка...
                    {:else if error} Ошибка
                    {:else}{ doc?.title }{/if}
                </div>
            </div>
        </div>

        {#if doc && !loading && !error}
            <div class="header-actions">
                <span class="doc-status-chip" data-state={ doc.is_public ? 'public' : 'private' }>
                    <span class="dot" aria-hidden="true"></span>
                    { doc.is_public ? 'Публичная' : 'Приватная' }
                </span>
                {#if $currentUser !== null && $currentUser.role !== UserRole.Client}
                    <a class="edit-link" href={ `/texteditor?edit=${ doc.id }` } aria-label="Редактировать">
                        Редактировать
                    </a>
                {/if}
            </div>
        {/if}
    </header>

    <main class="viewer-main">
        {#if loading}
            <div class="doc-area">Загрузка...</div>
        {:else if error}
            <div class="doc-area">{ error }</div>
        {:else if doc}
            <section class="editor-column">
                <article id="content" class="content-editable doc-area" aria-label={ doc.title }>
                    {#if contentLoading}
                        <p>Загрузка контента...</p>
                    {:else if contentError}
                        <p>{ contentError }</p>
                        {@html contentHtml}
                    {:else}
                        {@html contentHtml}
                    {/if}
                </article>

                <section class="metadata-section">
                    {#if doc.tags?.length}
                        <div class="tag-container" aria-label="Тэги">
                            {#each doc.tags as t (t.id)}
                                <span class="tag-btn">{ t.name }</span>
                            {/each}
                        </div>
                    {/if}

                    {#if doc.authors && doc.authors.length > 0}
                        <div class="user-section">
                            <h3>Авторы</h3>
                            <div class="user-list">
                                {#each doc.authors as a (a.id)}
                                    <div class="user-item">
                                        <div class="avatar-container" use:avatarAction={ a }></div>
                                        <div class="user-text">
                                            <span class="user-name">{ a.name }</span>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </section>

                {#if $currentUser !== null && ($currentUser.role === UserRole.Moderator || $currentUser.role === UserRole.Administrator)}
                    <div class="bottom-actions">
                        <button class="danger-btn" on:click={ requestDelete } disabled={ deleting } aria-label="Удалить статью">
                            { deleting ? 'Удаление...' : 'Удалить статью' }
                        </button>
                    </div>
                {/if}
            </section>
        {/if}
    </main>

    {#if showDeleteConfirm}
        <Confirmation
            title="Удаление статьи"
            message="Вы уверены, что хотите безвозвратно удалить эту статью?"
            confirmText="Удалить"
            cancelText="Отмена"
            onConfirm={ confirmDelete }
            onCancel={ cancelDelete }
        />
    {/if}
</div>

<style scoped>
    @import '../../texteditor/page.css';
    @import './page.css';
</style>
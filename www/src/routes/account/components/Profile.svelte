<script lang="ts">
    import { onMount } from 'svelte';
    import { get } from 'svelte/store';
    
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
    
    async function loadActiveTickets() {
        if (userData.id.length === 0) return;
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

        if (!emailRegex.test(editedEmail.trim()) && (editedEmail.trim().length > 128 || editedEmail.trim().length === 1)) {
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
                if (editedName.trim()) await api.post('/api/v1/user/change_name', { name: editedName.trim() });
            } catch (error) {
                notification('Ошибка при обновлении имени', NotificationType.Error);
            }

            try {
                if (editedEmail.trim()) await api.post('/api/v1/user/change_email', { email: editedEmail.trim() });
            } catch (error) {
                notification('Ошибка при обновлении email', NotificationType.Error);
            }

            try {
                if (changePassword) await api.post('/api/v1/user/change_password', { password: newPassword.trim() });
            } catch (error) {
                notification('Ошибка при смене пароля', NotificationType.Error);
            }

            currentUser.update(_ => ({
                id: get(currentUser)?.id as string,
                name: editedName.trim() || get(currentUser)?.name as string,
                email: editedEmail.trim() || get(currentUser)?.email as string,
                role: get(currentUser)?.role as string
            }));

            notification('Профиль успешно обновлен', NotificationType.Success);
            isEditing = false;
        } catch (error) {
            notification('Ошибка при обновлении профиля', NotificationType.Error);
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        editedName = userData.name || '';
        editedEmail = userData.email || '';
        loadActiveTickets();
        loadStats();
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
                        <button class="avatar-edit-container" on:click={ startEditingProfile } on:keydown={ (e) => e.key === 'Enter' && startEditingProfile() } aria-label="Редактировать аватар">
                            <Avatar width={ 100 } round={ true } userFullName={ userData.name || 'Пользователь' } />
                            <div class="avatar-edit-overlay">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
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
                        <button class="btn btn-primary" on:click={ saveProfile } disabled={ isLoading }>
                            { isLoading ? 'Сохранение...' : 'Сохранить' }
                        </button>
                        <button class="btn btn-secondary" on:click={ cancelEditing }>
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
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    </div>
                                    <div>
                                        <span class="info-label">Имя</span>
                                        <span class="info-value">{ userData.name }</span>
                                    </div>
                                </div>
                                <div class="info-item">
                                    <div class="info-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                    </div>
                                    <div>
                                        <span class="info-label">Email</span>
                                        <span class="info-value">{ userData.email }</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button class="btn edit-btn" on:click={ startEditingProfile }>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
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
                            <span class="ticket-id">{ ticket.building.code }-{ ticket.id }</span>
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

<style>
    @import './Profile.css';
</style>
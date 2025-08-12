<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    import Avatar from '$lib/components/Avatar/Avatar.svelte';
    
    export let userData: { name: string, email: string, role: string };
    export let stats: { totalTickets: number, assignedToMe: number, completedTickets: number, cancelledTickets: number };
    export let activeTickets: any[];
    
    let isEditing: boolean = false;
    let isLoading: boolean = false;
    let editedName: string = '';
    let avatarFile: File | null = null;
    let avatarPreview: string | null = null;
    
    const dispatch = createEventDispatcher();
    
    function startEditingProfile() {
        editedName = userData.name || '';
        isEditing = true;
    }
    
    function cancelEditing() {
        editedName = '';
        avatarFile = null;
        avatarPreview = null;
        isEditing = false;
    }
    
    function handleAvatarChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            avatarFile = input.files[0];
            avatarPreview = URL.createObjectURL(avatarFile);
        }
    }
    
    async function saveProfile() {
        // !!! TDD !!!
        
        isLoading = true;
        
        try {
            notification('Профиль успешно обновлен', NotificationType.Success);
            dispatch('reloadData');
        } catch (error) {
            notification('Ошибка при обновлении профиля', NotificationType.Error);
        } finally {
            isLoading = false;
        }
    }
</script>

<div class="content-section">
    <h1>Личный кабинет</h1>
    
    <div class="profile-dashboard">
        <div class="profile-section">
            <h2>Информация профиля</h2>
            {#if isEditing}
                <div class="edit-profile">
                    <div class="edit-avatar">
                        {#if avatarPreview}
                            <img src={ avatarPreview } alt="Avatar preview" class="avatar-preview" />
                        {:else}
                            <Avatar width={ 100 } round={ true } userFullName={ userData.name || 'Пользователь' } />
                        {/if}
                        <label class="avatar-upload">
                            Изменить аватар
                            <input 
                                type="file" 
                                accept="image/*" 
                                style="display: none;" 
                                on:change={ handleAvatarChange }
                            />
                        </label>
                    </div>
                    
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
                    <div class="profile-info-fields">
                        <div class="info-item">
                            <strong>Имя:</strong> { userData.name }
                        </div>
                        <div class="info-item">
                            <strong>Email:</strong> { userData.email }
                        </div>
                        <div class="info-item">
                            <strong>Роль:</strong> { userData.role === "Admin" ? 'Администратор' : 'Пользователь' }
                        </div>
                    </div>

                    <button class="btn btn-primary" on:click={ startEditingProfile }>
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
                    <div class="stat-value">{ stats.completedTickets }</div>
                    <div class="stat-label">Завершенных</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">{ stats.cancelledTickets }</div>
                    <div class="stat-label">Отменённых</div>
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
                {#each activeTickets.slice(0, 4) as ticket}
                    <a href={`/tickets/${ticket.id}`} class="ticket-card">
                        <div class="ticket-header">
                            <span class="ticket-id">{ ticket.building.code }-{ ticket.id }</span>
                            <span class={`status-badge ${ ticket.status }`}>
                                { ticket.status === 'new' ? 'Новая' : 'В работе' }
                            </span>
                        </div>
                        <h3 class="ticket-title">{ ticket.title }</h3>
                        <div class="ticket-footer">
                            <span class="ticket-date">
                                { new Date(ticket.created_at).toLocaleDateString() }
                            </span>
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
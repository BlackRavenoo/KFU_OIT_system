<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';

    import SearchBar from '$lib/components/Search/Searchfield.svelte';
    import Pagination from '$lib/components/Search/Pagination.svelte';

    import { pageTitle, pageDescription } from '$lib/utils/setup/stores';
    import { api } from '$lib/utils/api';

    import { currentUser } from '$lib/utils/auth/storage/initial';
    import { UserRole } from '$lib/utils/auth/types';

    import Asset from './Asset.svelte';
    import Model from './Model.svelte';
    import Category from './Category.svelte';

    type Category = { id: number; name: string; color: string; notes?: string };
    type AssetModel = { id: number; name: string; category: number };
    type Status = { id: number; name: string; color: string };
    type Asset = {
        id: number;
        model_id: number;
        status: number;
        name: string;
        description?: string;
        serial_number?: string;
        inventory_number?: string;
        location?: string;
        assigned_to?: string;
        ip?: string;
        mac?: string;
    };
    type PaginatedResponse = {
        items?: any[];
        data?: any[];
        total?: number;
        total_items?: number;
    };

    // --- TEST DATA ---
    let categories: Category[] = [
        { id: 1, name: 'Компьютеры', color: '#3B82F6', notes: 'ПК и рабочие станции' },
        { id: 2, name: 'Принтеры', color: '#8B5CF6', notes: 'Лазерные и струйные' },
        { id: 3, name: 'Сетевое оборудование', color: '#10B981', notes: 'Маршрутизаторы, коммутаторы' },
    ];
    let models: AssetModel[] = [
        { id: 1, name: 'HP ProDesk 400', category: 1 },
        { id: 2, name: 'Canon LBP2900', category: 2 },
        { id: 3, name: 'TP-Link TL-SG108', category: 3 },
    ];
    let statuses: Status[] = [
        { id: 1, name: 'Используется', color: '#3B82F6' },
        { id: 2, name: 'В наличии', color: '#10B981' },
        { id: 3, name: 'В ремонте', color: '#F59E0B' },
        { id: 4, name: 'Утеряно', color: '#EF4444' },
    ];
    let assets: Asset[] = [
        {
            id: 1,
            model_id: 1,
            status: 1,
            name: 'ПК Иванова',
            description: 'Основной рабочий компьютер',
            serial_number: 'SN123456',
            inventory_number: 'INV-001',
            location: 'Каб. 101',
            assigned_to: 'Иванов И.И.',
            ip: '192.168.1.10',
            mac: 'AA:BB:CC:DD:EE:01',
        },
        {
            id: 2,
            model_id: 2,
            status: 2,
            name: 'Принтер бухгалтерии',
            description: 'Принтер для печати документов',
            serial_number: 'SN987654',
            inventory_number: 'INV-002',
            location: 'Каб. 102',
            assigned_to: 'Петрова А.А.',
            ip: '192.168.1.20',
            mac: 'AA:BB:CC:DD:EE:02',
        },
        {
            id: 3,
            model_id: 3,
            status: 3,
            name: 'Свич серверной',
            description: '8-портовый гигабитный свич',
            serial_number: 'SN555555',
            inventory_number: 'INV-003',
            location: 'Серверная',
            assigned_to: 'Сидоров В.В.',
            ip: '192.168.1.30',
            mac: 'AA:BB:CC:DD:EE:03',
        },
    ];

    let loading = false;
    let error: string | null = null;

    let search = '';
    let page = 1;
    let pageSize = 10;
    let totalItems = 0;

    $: totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    $: categoryMap = new Map(categories.map(c => [c.id, c]));
    $: modelMap = new Map(models.map(m => [m.id, m]));
    $: statusMap = new Map(statuses.map(s => [s.id, s]));

    function getCategoryColorForAsset(asset: Asset): string {
        const model = modelMap.get(asset.model_id);
        if (!model) return '#6B7280';
        const cat = categoryMap.get(model.category);
        return cat?.color || '#6B7280';
    }

    function getStatusForAsset(asset: Asset): Status | undefined {
        return statusMap.get(asset.status);
    }

    function getModelForAsset(asset: Asset): AssetModel | undefined {
        return modelMap.get(asset.model_id);
    }

    function getCategoryForAsset(asset: Asset): Category | undefined {
        const model = modelMap.get(asset.model_id);
        if (!model) return undefined;
        return categoryMap.get(model.category);
    }

    function handleSearch() {
        page = 1;
        // await fetchAssets();
    }

    function handlePageChange(newPage: number) {
        if (newPage >= 1 && newPage <= totalPages) {
            page = newPage;
            // await fetchAssets();
        }
    }

    function handlePageSizeChange(e: Event) {
        const val = Number((e.currentTarget as HTMLInputElement).value);
        if (!Number.isNaN(val) && val > 0) {
            pageSize = val;
            page = 1;
            // await fetchAssets();
        }
    }

    let showAssetModal = false;
    let editingAsset: Asset | null = null;

    let showModelModal = false;
    let editingModel: AssetModel | null = null;
    let modelModalMode: 'create' | 'edit' | 'view' = 'create';

    let showCategoryModal = false;

    function openCreateAsset() {
        editingAsset = null;
        showAssetModal = true;
    }

    function openViewAsset(asset: Asset) {
        editingAsset = asset;
        showAssetModal = true;
    }

    function openCreateModel() {
        editingModel = null;
        modelModalMode = 'create';
        showModelModal = true;
    }

    function openCreateCategory() {
        showCategoryModal = true;
    }

    async function handleAssetSaved() {
        showAssetModal = false;
        editingAsset = null;
        await Promise.all([fetchAssets(), fetchModels(), fetchCategories()]);
    }

    function handleAssetClose() {
        showAssetModal = false;
        editingAsset = null;
    }

    async function handleModelSaved() {
        showModelModal = false;
        editingModel = null;
        await Promise.all([fetchModels(), fetchCategories()]);
    }

    function handleModelClose() {
        showModelModal = false;
        editingModel = null;
    }

    async function handleCategorySaved() {
        showCategoryModal = false;
        await fetchCategories();
    }

    function handleCategoryClose() {
        showCategoryModal = false;
    }

    $: canManageAssets =
        $currentUser?.role === UserRole.Administrator ||
        $currentUser?.role === UserRole.Moderator ||
        $currentUser?.role === UserRole.Programmer;

    onMount(() => {
        pageTitle.set('Активы | Система управления заявками ЕИ КФУ');
        pageDescription.set('Управление активами и оборудованием организации.');
        // await Promise.all([fetchCategories(), fetchModels(), fetchStatuses()]);
        // await fetchAssets();
    });

    onDestroy(() => {
        pageTitle.set('Service Desk | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Елабужского института КФУ.');
    });
</script>

<div class="content fullwidth-content-panel">
    <div class="search-controls-wrapper">
        <SearchBar
            bind:searchQuery={ search }
            placeholder="Поиск по активам"
            onSearch={ handleSearch }
        />
        <div class="search-controls">
            <input
                type="number"
                class="page-size-input"
                min="10"
                max="50"
                step="1"
                bind:value={ pageSize }
                on:change={ handlePageSizeChange }
                aria-label="Размер страницы"
            />
        </div>
    </div>

    <div class="tickets-list list-view">
        {#if loading}
            <div class="ticket-item" style="align-items:center;">
                Загрузка...
            </div>
        {:else if error}
            <div class="ticket-item" style="align-items:center;">
                { error }
            </div>
        {:else if assets.length === 0}
            <div class="empty-state">Нет активов</div>
        {:else}
            {#each assets as asset (asset.id)}
                {@const catColor = getCategoryColorForAsset(asset)}
                {@const status = getStatusForAsset(asset)}
                {@const model = getModelForAsset(asset)}
                {@const category = getCategoryForAsset(asset)}
                <div
                    class="ticket-item asset-item"
                    style="border-left: 4px solid { catColor };"
                    role="button"
                    tabindex="0"
                    aria-label="Открыть актив { asset.name }"
                    on:click={ () => openViewAsset(asset) }
                    on:keydown={ (e) => (e.key === 'Enter' || e.key === ' ') && openViewAsset(asset) }
                >
                    <div class="asset-heading">
                        <span
                            class="asset-color-dot"
                            style="background: { catColor };"
                            aria-hidden="true"
                        ></span>
                        <div class="ticket-title">{ asset.name }</div>
                        {#if status}
                            <span
                                class="asset-status-chip"
                                style="background: { status.color }20; color: { status.color }; border-color: { status.color };"
                            >
                                { status.name }
                            </span>
                        {/if}
                    </div>

                    <div class="ticket-meta asset-meta">
                        {#if model}
                            <span class="asset-tag">{ model.name }</span>
                        {/if}
                        {#if category}
                            <span
                                class="asset-tag"
                                style="background: { catColor }18; color: { catColor };"
                            >
                                { category.name }
                            </span>
                        {/if}
                        {#if asset.location}
                            <span class="asset-info">📍 { asset.location }</span>
                        {/if}
                        {#if asset.assigned_to}
                            <span class="asset-info">👤 { asset.assigned_to }</span>
                        {/if}
                    </div>

                    {#if asset.serial_number || asset.inventory_number || asset.ip || asset.mac}
                        <div class="asset-numbers">
                            {#if asset.serial_number}
                                <span>S/N: { asset.serial_number }</span>
                            {/if}
                            {#if asset.inventory_number}
                                <span>Инв.: { asset.inventory_number }</span>
                            {/if}
                            {#if asset.ip}
                                <span>IP: { asset.ip }</span>
                            {/if}
                            {#if asset.mac}
                                <span>MAC: { asset.mac }</span>
                            {/if}
                        </div>
                    {/if}
                </div>
            {/each}
        {/if}
    </div>

    {#if totalPages > 1}
        <Pagination currentPage={ page } { totalPages } onPageChange={ handlePageChange } />
    {/if}

    {#if canManageAssets}
        <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem;">
            <button class="filter-btn primary add-asset" on:click={ openCreateAsset }>
                + Добавить актив
            </button>
        </div>
    {/if}
</div>

{#if showAssetModal}
    <Asset
        asset={ editingAsset }
        { models }
        { statuses }
        { categories }
        on:save={ handleAssetSaved }
        on:close={ handleAssetClose }
        on:openModel={ openCreateModel }
    />
{/if}

{#if showModelModal}
    <Model
        model={ editingModel }
        mode={ modelModalMode }
        { categories }
        on:save={ handleModelSaved }
        on:close={ handleModelClose }
        on:openCategory={ openCreateCategory }
    />
{/if}

{#if showCategoryModal}
    <Category
        on:save={ handleCategorySaved }
        on:close={ handleCategoryClose }
    />
{/if}

<style scoped>
    @import '../ticket/page.css';
    @import './page.css';
</style>

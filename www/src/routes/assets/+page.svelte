<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { fade, slide } from 'svelte/transition';

    import SearchBar from '$lib/components/Search/Searchfield.svelte';
    import Pagination from '$lib/components/Search/Pagination.svelte';

    import { pageTitle, pageDescription } from '$lib/utils/setup/stores';
    import {
        createCategoryMap,
        createModelMap,
        createStatusMap,
        getPaginatedItems,
        getPaginatedTotal,
        getCategoryColorForAsset,
        getCategoryForAsset,
        getModelForAsset,
        getStatusForAsset,
    } from '$lib/utils/assets/helpers';
    import {
        getAssets,
        getCategories,
        getModels,
    } from '$lib/utils/assets/api';
    import { getStatuses } from '$lib/utils/assets/statuses-api';
    import { clearAssetsFilters, getAssetsFilters, setAssetsFilters } from '$lib/utils/assets/stores';
    import type {
        Asset as AssetItem,
        AssetCategory,
        AssetModel,
        AssetStatus,
    } from '$lib/utils/assets/types';

    import { currentUser } from '$lib/utils/auth/storage/initial';
    import { UserRole } from '$lib/utils/auth/types';

    import Asset from './Asset.svelte';
    import Model from './Model.svelte';
    import Category from './Category.svelte';

    let categories: AssetCategory[] = [];
    let models: AssetModel[] = [];
    let statuses: AssetStatus[] = [];
    let assets: AssetItem[] = [];

    let loading = false;
    let error: string | null = null;

    const savedFilters = getAssetsFilters();

    let search = savedFilters.search;
    let page = savedFilters.page;
    let pageSize = savedFilters.page_size;
    let totalItems = 0;
    let sortOrder: 'asc' | 'desc' = savedFilters.sort_order;

    let filterModelId: number | string = savedFilters.model_id;
    let filterStatusId: number | string = savedFilters.status;
    let filterSerialNumber = savedFilters.serial_number;
    let filterInventoryNumber = savedFilters.inventory_number;
    let filterLocation = savedFilters.location;
    let filterAssignedTo = savedFilters.assigned_to;
    let filterIp = savedFilters.ip;
    let filterMac = savedFilters.mac;

    let isMobile = false;
    let filtersCollapsed = true;

    $: totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    $: setAssetsFilters({
        search,
        page,
        page_size: pageSize,
        sort_order: sortOrder,
        model_id: filterModelId === '' ? '' : Number(filterModelId),
        status: filterStatusId === '' ? '' : Number(filterStatusId),
        serial_number: filterSerialNumber,
        inventory_number: filterInventoryNumber,
        location: filterLocation,
        assigned_to: filterAssignedTo,
        ip: filterIp,
        mac: filterMac,
    });

    $: categoryMap = createCategoryMap(categories);
    $: modelMap = createModelMap(models);
    $: statusMap = createStatusMap(statuses);

    function toOptional(value: string): string | undefined {
        const normalized = value.trim();
        return normalized.length > 0 ? normalized : undefined;
    }

    function toAssetPhotoUrl(value?: string, cacheVersion?: number): string | undefined {
        if (!value) return undefined;

        const withVersion = (url: string): string => {
            if (!cacheVersion) return url;
            const separator = url.includes('?') ? '&' : '?';
            return `${ url }${ separator }v=${ cacheVersion }`;
        };

        if (/^https?:\/\//i.test(value)) return withVersion(value);
        if (value.startsWith('/api/v1/attachments')) return withVersion(value);

        const normalizedPath = value.startsWith('/') ? value : `/${ value }`;
        return withVersion(`/api/v1/attachments${ normalizedPath }`);
    }

    function normalizeMac(value: string): string {
        const hex = value.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 12);
        return hex.match(/.{1,2}/g)?.join(':') ?? '';
    }

    function handleMacFilterInput(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        filterMac = normalizeMac(input.value);
    }

    function lockScroll() {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
    }

    function unlockScroll() {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
    }

    function checkMobile() {
        isMobile = window.innerWidth <= 900;
        if (!isMobile) {
            filtersCollapsed = true;
            unlockScroll();
        }
    }

    function toggleFiltersCollapsed() {
        filtersCollapsed = !filtersCollapsed;
        if (isMobile) {
            if (!filtersCollapsed) lockScroll();
            else unlockScroll();
        }
    }

    async function handleSearch() {
        page = 1;
        await fetchAssets();
    }

    async function handleFilterChange() {
        page = 1;
        await fetchAssets();

        if (isMobile) {
            filtersCollapsed = true;
            unlockScroll();
        }
    }

    async function handleClearFilters() {
        clearAssetsFilters();

        const defaults = getAssetsFilters();
        search = defaults.search;
        sortOrder = defaults.sort_order;
        filterModelId = defaults.model_id;
        filterStatusId = defaults.status;
        filterSerialNumber = defaults.serial_number;
        filterInventoryNumber = defaults.inventory_number;
        filterLocation = defaults.location;
        filterAssignedTo = defaults.assigned_to;
        filterIp = defaults.ip;
        filterMac = defaults.mac;

        page = 1;
        await fetchAssets();

        if (isMobile) {
            filtersCollapsed = true;
            unlockScroll();
        }
    }

    async function handlePageChange(newPage: number) {
        if (newPage >= 1 && newPage <= totalPages) {
            page = newPage;
            await fetchAssets();
        }
    }

    async function handlePageSizeChange(e: Event) {
        const val = Number((e.currentTarget as HTMLInputElement).value);
        if (!Number.isNaN(val) && val > 0) {
            pageSize = val;
            page = 1;
            await fetchAssets();
        }
    }

    let showAssetModal = false;
    let editingAsset: AssetItem | null = null;

    let showModelModal = false;
    let editingModel: AssetModel | null = null;
    let modelModalMode: 'create' | 'edit' | 'view' = 'create';

    let showCategoryModal = false;

    async function fetchAssets() {
        loading = true;
        error = null;

        const resp = await getAssets({
            page,
            page_size: pageSize,
            sort_order: sortOrder,
            ...(filterModelId ? { model_id: Number(filterModelId) } : {}),
            ...(filterStatusId ? { status: Number(filterStatusId) } : {}),
            ...(search.trim() ? { name: search.trim() } : {}),
            ...(toOptional(filterSerialNumber) ? { serial_number: toOptional(filterSerialNumber) } : {}),
            ...(toOptional(filterInventoryNumber) ? { inventory_number: toOptional(filterInventoryNumber) } : {}),
            ...(toOptional(filterLocation) ? { location: toOptional(filterLocation) } : {}),
            ...(toOptional(filterAssignedTo) ? { assigned_to: toOptional(filterAssignedTo) } : {}),
            ...(toOptional(filterIp) ? { ip: toOptional(filterIp) } : {}),
            ...(toOptional(filterMac) ? { mac: toOptional(filterMac) } : {}),
        });

        if (!resp.success) {
            error = resp.error || 'Не удалось загрузить активы';
            loading = false;
            return false;
        }

        const items = getPaginatedItems(resp.data) as any[];

        const photoCacheVersion = Date.now();

        assets = items.map((item) => ({
            id: item.id,
            model_id: item.model?.id ?? item.model_id,
            status: item.status?.id ?? item.status,
            name: item.name,
            description: item.description,
            serial_number: item.serial_number,
            inventory_number: item.inventory_number,
            location: item.location,
            assigned_to: item.assigned_to,
            ip: item.ip,
            mac: item.mac,
            photo_url: toAssetPhotoUrl(item.photo_url ?? item.photo_key, photoCacheVersion),
            commission_date: item.commission_date,
            decommission_date: item.decommission_date,
        }));

        totalItems = getPaginatedTotal(resp.data);
        loading = false;
        return true;
    }

    async function fetchModelsList() {
        const resp = await getModels({ page: 1, page_size: 100 });
        if (!resp.success) return false;

        const items = getPaginatedItems(resp.data);
        if (items.length > 0) models = items;
        return true;
    }

    async function fetchCategoriesList() {
        const resp = await getCategories({ page: 1, page_size: 100 });
        if (!resp.success) return false;

        const items = getPaginatedItems(resp.data);
        if (items.length > 0) categories = items;
        return true;
    }

    async function fetchStatuses() {
        const resp = await getStatuses({ page: 1, page_size: 100 });
        if (!resp.success) return false;

        const items = getPaginatedItems(resp.data);
        if (items.length > 0) statuses = items;
        return true;
    }

    async function openCreateAsset() {
        await fetchModelsList();
        editingAsset = null;
        showAssetModal = true;
    }

    function openViewAsset(asset: AssetItem) {
        editingAsset = asset;
        showAssetModal = true;
    }

    async function openModelModal(event?: CustomEvent<{ mode?: 'create' | 'edit'; modelId?: number }>) {
        const detail = event?.detail;
        await fetchCategoriesList();

        if (detail?.mode === 'edit' && detail.modelId) {
            const existingModel = models.find((m) => m.id === detail.modelId) ?? null;
            editingModel = existingModel;
            modelModalMode = 'edit';
        } else {
            editingModel = null;
            modelModalMode = 'create';
        }

        showModelModal = true;
    }

    function openCreateCategory() {
        showCategoryModal = true;
    }

    async function handleAssetSaved(event: CustomEvent<{ asset: AssetItem }>) {
        const savedAsset = event.detail.asset;
        const index = assets.findIndex((item) => item.id === savedAsset.id);

        if (index >= 0) {
            assets[index] = savedAsset;
            assets = [...assets];
        } else {
            assets = [savedAsset, ...assets];
        }

        await fetchAssets();
        showAssetModal = false;
        editingAsset = null;
    }

    function handleAssetClose() {
        showAssetModal = false;
        editingAsset = null;
    }

    async function handleAssetDeleted(event: CustomEvent<{ id: number }>) {
        const { id } = event.detail;

        assets = assets.filter((item) => item.id !== id);
        showAssetModal = false;
        editingAsset = null;

        await fetchAssets();
    }

    async function handleModelSaved() {
        showModelModal = false;
        editingModel = null;
        await fetchModelsList();
    }

    async function handleModelDeleted(event: CustomEvent<{ id: number }>) {
        const { id } = event.detail;

        models = models.filter((item) => item.id !== id);
        assets = assets.filter((item) => item.model_id !== id);

        showModelModal = false;
        editingModel = null;

        await Promise.all([fetchModelsList(), fetchAssets()]);
    }

    async function handleCategoryDeleted(event: CustomEvent<{ id: number }>) {
        const { id } = event.detail;

        categories = categories.filter((item) => item.id !== id);
        models = models.filter((item) => {
            if (typeof item.category === 'number') return item.category !== id;
            return item.category.id !== id;
        });

        showModelModal = false;
        editingModel = null;

        await Promise.all([fetchCategoriesList(), fetchModelsList(), fetchAssets()]);
    }

    function handleModelClose() {
        showModelModal = false;
        editingModel = null;
    }

    async function handleCategorySaved() {
        showCategoryModal = false;
        await fetchCategoriesList();
    }

    function handleCategoryClose() {
        showCategoryModal = false;
    }

    $: canManageAssets =
        $currentUser?.role === UserRole.Administrator ||
        $currentUser?.role === UserRole.Moderator ||
        $currentUser?.role === UserRole.Programmer;

    $: canDeleteEntities =
        $currentUser?.role === UserRole.Administrator ||
        $currentUser?.role === UserRole.Moderator;

    onMount(async () => {
        pageTitle.set('Активы | Система управления заявками ЕИ КФУ');
        pageDescription.set('Управление активами и оборудованием организации.');
        checkMobile();
        window.addEventListener('resize', checkMobile);
        await Promise.all([fetchCategoriesList(), fetchModelsList(), fetchStatuses()]);
        await fetchAssets();
    });

    onDestroy(() => {
        window.removeEventListener('resize', checkMobile);
        unlockScroll();
        pageTitle.set('Service Desk | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Елабужского института КФУ.');
    });
</script>

<div id="content-panel">
    {#if isMobile}
        <button type="button" class="filters-toggle-row" on:click={ toggleFiltersCollapsed } aria-label="Показать/скрыть фильтры">
            <span>Фильтры</span>
            <svg class="arrow" width="24" height="24" viewBox="0 0 24 24">
                <path d={ filtersCollapsed ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6' } stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
            </svg>
        </button>
    {/if}

    {#if !isMobile}
        <aside in:slide={{ duration: 250 }} out:fade={{ duration: 200 }}>
            <button id="clear_filters" on:click={ handleClearFilters }>Сбросить</button>

            <div class="filter">
                <span class="filter_name">Модель</span>
                <div class="filter_case">
                    <select bind:value={ filterModelId }>
                        <option value="">Все модели</option>
                        {#each models as m}
                            <option value={ m.id }>{ m.name }</option>
                        {/each}
                    </select>
                </div>
            </div>

            <div class="filter">
                <span class="filter_name">Статус</span>
                <div class="filter_case">
                    <select bind:value={ filterStatusId }>
                        <option value="">Все статусы</option>
                        {#each statuses as s}
                            <option value={ s.id }>{ s.name }</option>
                        {/each}
                    </select>
                </div>
            </div>

            <div class="filter">
                <span class="filter_name">Поля</span>
                <div class="filter_case filter_case-assets">
                    <label for="asset-sn">Серийный номер</label>
                    <input id="asset-sn" type="text" bind:value={ filterSerialNumber } placeholder="S/N" />

                    <label for="asset-inv">Инвентарный номер</label>
                    <input id="asset-inv" type="text" bind:value={ filterInventoryNumber } placeholder="Инв. №" />

                    <label for="asset-location">Локация</label>
                    <input id="asset-location" type="text" bind:value={ filterLocation } placeholder="Кабинет/корпус" />

                    <label for="asset-assigned">Ответственный</label>
                    <input id="asset-assigned" type="text" bind:value={ filterAssignedTo } placeholder="ФИО" />

                    <label for="asset-ip">IP</label>
                    <input id="asset-ip" type="text" bind:value={ filterIp } placeholder="192.168.1.1" />

                    <label for="asset-mac">MAC</label>
                    <input id="asset-mac" type="text" bind:value={ filterMac } on:input={ handleMacFilterInput } placeholder="AA:BB:CC:DD:EE:FF" maxlength="17" />
                </div>
            </div>

            <div class="filter">
                <span class="filter_name">Сортировка</span>
                <div class="filter_case">
                    <select bind:value={ sortOrder }>
                        <option value="asc">Сначала старые</option>
                        <option value="desc">Сначала новые</option>
                    </select>
                </div>
            </div>

            <button class="filter_access" on:click={ handleFilterChange }>Применить</button>
        </aside>
    {:else}
        <div class="filters-mobile-overlay {filtersCollapsed ? '' : 'open'}" transition:fade>
            {#if !filtersCollapsed}
                <aside class="mobile-full" in:slide={{ duration: 250 }} out:slide={{ duration: 180 }}>
                    <button type="button" class="filters-mobile-close" on:click={ toggleFiltersCollapsed } aria-label="Свернуть фильтры">
                        Фильтры
                        <svg width="24" height="24" viewBox="0 0 24 24">
                            <path d="M6 15l6-6 6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
                        </svg>
                    </button>

                    <button id="clear_filters" on:click={ handleClearFilters }>Сбросить</button>

                    <div class="filter">
                        <span class="filter_name">Модель</span>
                        <div class="filter_case">
                            <select bind:value={ filterModelId }>
                                <option value="">Все модели</option>
                                {#each models as m}
                                    <option value={ m.id }>{ m.name }</option>
                                {/each}
                            </select>
                        </div>
                    </div>

                    <div class="filter">
                        <span class="filter_name">Статус</span>
                        <div class="filter_case">
                            <select bind:value={ filterStatusId }>
                                <option value="">Все статусы</option>
                                {#each statuses as s}
                                    <option value={ s.id }>{ s.name }</option>
                                {/each}
                            </select>
                        </div>
                    </div>

                    <div class="filter">
                        <span class="filter_name">Поля</span>
                        <div class="filter_case filter_case-assets">
                            <label for="asset-sn-m">Серийный номер</label>
                            <input id="asset-sn-m" type="text" bind:value={ filterSerialNumber } placeholder="S/N" />

                            <label for="asset-inv-m">Инвентарный номер</label>
                            <input id="asset-inv-m" type="text" bind:value={ filterInventoryNumber } placeholder="Инв. №" />

                            <label for="asset-location-m">Локация</label>
                            <input id="asset-location-m" type="text" bind:value={ filterLocation } placeholder="Кабинет/корпус" />

                            <label for="asset-assigned-m">Ответственный</label>
                            <input id="asset-assigned-m" type="text" bind:value={ filterAssignedTo } placeholder="ФИО" />

                            <label for="asset-ip-m">IP</label>
                            <input id="asset-ip-m" type="text" bind:value={ filterIp } placeholder="192.168.1.1" />

                            <label for="asset-mac-m">MAC</label>
                            <input id="asset-mac-m" type="text" bind:value={ filterMac } on:input={ handleMacFilterInput } placeholder="AA:BB:CC:DD:EE:FF" maxlength="17" />
                        </div>
                    </div>

                    <div class="filter">
                        <span class="filter_name">Сортировка</span>
                        <div class="filter_case">
                            <select bind:value={ sortOrder }>
                                <option value="asc">Сначала старые</option>
                                <option value="desc">Сначала новые</option>
                            </select>
                        </div>
                    </div>

                    <button class="filters-mobile-apply" on:click={ handleFilterChange } aria-label="Применить фильтры">
                        Применить
                    </button>
                </aside>
            {/if}
        </div>
    {/if}

    <main class="assets-main">
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
                    {@const catColor = getCategoryColorForAsset(asset, modelMap, categoryMap)}
                    {@const status = getStatusForAsset(asset, statusMap)}
                    {@const model = getModelForAsset(asset, modelMap)}
                    {@const category = getCategoryForAsset(asset, modelMap, categoryMap)}
                    <div
                        class="ticket-item asset-item"
                        style="border-left: 4px solid { catColor };"
                        role="button"
                        tabindex="0"
                        aria-label="Открыть актив { asset.name }"
                        on:click={ () => openViewAsset(asset) }
                        on:keydown={ (e) => (e.key === 'Enter' || e.key === ' ') && openViewAsset(asset) }
                    >
                        <div class="asset-photo-wrap" aria-hidden="true">
                            {#if asset.photo_url}
                                <img class="asset-photo" src={ asset.photo_url } alt="" loading="lazy" />
                            {:else}
                                <div class="asset-photo-placeholder">🖼️</div>
                            {/if}
                        </div>

                        <div class="asset-content">
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
                    </div>
                {/each}
            {/if}
        </div>

        {#if totalPages > 1}
            <Pagination currentPage={ page } { totalPages } onPageChange={ handlePageChange } />
        {/if}

        {#if canManageAssets}
            <div class="create-asset-cta">
                <button class="filter-btn primary add-asset" on:click={ openCreateAsset }>
                    + Добавить актив
                </button>
            </div>
        {/if}
    </main>
</div>

{#if showAssetModal}
    <Asset
        asset={ editingAsset }
        { models }
        { statuses }
        { categories }
        canDelete={ canDeleteEntities }
        on:save={ handleAssetSaved }
        on:delete={ handleAssetDeleted }
        on:close={ handleAssetClose }
        on:openModel={ openModelModal }
    />
{/if}

{#if showModelModal}
    <Model
        model={ editingModel }
        mode={ modelModalMode }
        { categories }
        canDelete={ canDeleteEntities }
        on:save={ handleModelSaved }
        on:deleteModel={ handleModelDeleted }
        on:deleteCategory={ handleCategoryDeleted }
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

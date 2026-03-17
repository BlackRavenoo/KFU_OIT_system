<script lang="ts">
    import { onMount, onDestroy } from 'svelte';

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

    let search = '';
    let page = 1;
    let pageSize = 10;
    let totalItems = 0;

    $: totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    $: categoryMap = createCategoryMap(categories);
    $: modelMap = createModelMap(models);
    $: statusMap = createStatusMap(statuses);

    async function handleSearch() {
        page = 1;
        await fetchAssets();
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
            ...(search.trim() ? { name: search.trim() } : {}),
        });

        if (!resp.success) {
            error = resp.error || 'Не удалось загрузить активы';
            loading = false;
            return false;
        }

        const items = getPaginatedItems(resp.data) as any[];

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

    async function openCreateModel() {
        await fetchCategoriesList();
        editingModel = null;
        modelModalMode = 'create';
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

    async function handleModelSaved() {
        showModelModal = false;
        editingModel = null;
        await fetchModelsList();
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

    onMount(async () => {
        pageTitle.set('Активы | Система управления заявками ЕИ КФУ');
        pageDescription.set('Управление активами и оборудованием организации.');
        await Promise.all([fetchCategoriesList(), fetchModelsList(), fetchStatuses()]);
        await fetchAssets();
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

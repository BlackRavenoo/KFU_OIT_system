<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { fade } from 'svelte/transition';
    import { page } from '$app/stores';
    import { statusOptions, statusPriority } from '$lib/utils/tickets/types';
    import { currentUser, isAuthenticated } from '$lib/utils/auth/storage/initial';
    import { pageTitle, pageDescription, buildings, departments, sources } from '$lib/utils/setup/stores';
    import { formatDate, formatDescription } from '$lib/utils/validation/validate';
    import { notification } from '$lib/utils/notifications/notification';
    import { NotificationType } from '$lib/utils/notifications/types';
    import { getById, fetchImages, fetchConsts } from '$lib/utils/tickets/api/get';
    import { unassign, assign, assignUserToTicket as assignUserToTicketApi, unassignUserFromTicket as unassignUserFromTicketApi } from '$lib/utils/tickets/api/assign';
    import { updateTicket, deleteTicket } from '$lib/utils/tickets/api/set';
    import { UserRole } from '$lib/utils/auth/types';
    import { getAvatar } from '$lib/utils/account/avatar';
    import { loadUsersData } from '$lib/utils/admin/users';
    import { handleAuthError } from '$lib/utils/api';
    import { api } from '$lib/utils/api';
    import { getAssets } from '$lib/utils/assets/api';
    import type { Ticket, Building, UiStatus, PriorityStatus, TicketSource } from '$lib/utils/tickets/types';
    import type { Asset } from '$lib/utils/assets/types';
    import type { IUserData } from '$lib/utils/auth/types';
    import Confirmation from '$lib/components/Modal/Confirmation.svelte';
    import FileCard from './File.svelte';
    import Chat from './Chat.svelte';

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
    let source_id: number | null = null;
    let building_id: number | null = null;
    let cabinet: string = '';
    let department_id = null as number | null;
    let planned_at: string | null = null;

    let editingFiles: { name: string; url: string; ext: string; class: string }[] = [];
    let attachments_to_delete: string[] = [];
    let attachments_to_add: File[] = [];
    let showFileRemoveConfirm: boolean = false;
    let attachmentToRemove: { type: 'image' | 'file', idx: number } | null = null;
    let showAttachmentRemoveConfirm = false;
    let originalImageNames: string[] = [];

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
    let isMobile = window.innerWidth <= 900;

    let showChat = false;

    let showAssignModal: boolean = false;
    let assignSearchQuery: string = '';
    let assignSearchResults: IUserData[] = [];
    let assignSearchLoading: boolean = false;

    type LinkedTicketAsset = {
        id: number;
        name: string;
        inventory_number?: string;
        serial_number?: string;
        location?: string;
        comment?: string;
    };

    let linkedAssets: LinkedTicketAsset[] = [];
    let showAttachAssetModal = false;
    let assetSearchQuery = '';
    let assetSearchLoading = false;
    let assetSearchResults: Asset[] = [];
    let linkedAssetIds: Set<number> = new Set();
    let availableAttachAssets: Asset[] = [];
    let selectedAssetId: number | null = null;
    let attachAssetComment = '';
    let isAttachingAsset = false;
    let assetSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    function updateIsMobile() {
        isMobile = window.innerWidth <= 900;
    }

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
            closeAttachAssetModal();
            closeRemoveConfirm();
            showFileRemoveConfirm = false;
        }
    }

    function normalizeLinkedAssets(ticket: any): LinkedTicketAsset[] {
        const raw = ticket?.ticket_assets ?? ticket?.assets ?? ticket?.attached_assets ?? [];
        if (!Array.isArray(raw)) return [];

        return raw
            .map((row: any) => {
                const asset = row?.asset ?? row;
                const id = Number(row?.asset_id ?? asset?.id ?? 0);

                if (!id) return null;

                return {
                    id,
                    name: String(asset?.name ?? `Ассет #${ id }`),
                    inventory_number: asset?.inventory_number ?? undefined,
                    serial_number: asset?.serial_number ?? undefined,
                    location: asset?.location ?? undefined,
                    comment: row?.comment ?? asset?.comment ?? undefined,
                } as LinkedTicketAsset;
            })
            .filter((v): v is LinkedTicketAsset => v !== null);
    }

    let canManageTicketAssets = false;
    $: canManageTicketAssets =
        !!$currentUser
        && ($currentUser.role === UserRole.Programmer || $currentUser.role === UserRole.Moderator || $currentUser.role === UserRole.Administrator);

    $: linkedAssetIds = new Set(linkedAssets.map((asset) => asset.id));
    $: availableAttachAssets = assetSearchResults.filter((asset) => !linkedAssetIds.has(asset.id));

    function openAttachAssetModal() {
        showAttachAssetModal = true;
        assetSearchQuery = '';
        assetSearchResults = [];
        selectedAssetId = null;
        attachAssetComment = '';
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleEsc);
    }

    function closeAttachAssetModal() {
        showAttachAssetModal = false;
        assetSearchQuery = '';
        assetSearchResults = [];
        selectedAssetId = null;
        attachAssetComment = '';
        assetSearchLoading = false;
        if (assetSearchDebounceTimer) {
            clearTimeout(assetSearchDebounceTimer);
            assetSearchDebounceTimer = null;
        }
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleEsc);
    }

    async function searchAssetsToAttach() {
        const query = assetSearchQuery.trim();
        if (!query) {
            assetSearchResults = [];
            selectedAssetId = null;
            return;
        }

        assetSearchLoading = true;
        try {
            const response = await getAssets({ page: 1, page_size: 10, name: query });
            if (!response.success) {
                assetSearchResults = [];
                return;
            }

            const items = ((response.data as any)?.items ?? (response.data as any)?.data ?? []) as any[];

            assetSearchResults = items
                .map((row) => ({
                    id: Number(row?.id ?? 0),
                    model_id: Number(row?.model?.id ?? row?.model_id ?? 0),
                    status: Number(row?.status?.id ?? row?.status ?? 0),
                    name: String(row?.name ?? ''),
                    inventory_number: row?.inventory_number ?? undefined,
                    serial_number: row?.serial_number ?? undefined,
                    location: row?.location ?? undefined,
                }))
                .filter((item) => item.id > 0 && item.name.length > 0);
        } catch {
            assetSearchResults = [];
        } finally {
            assetSearchLoading = false;
        }
    }

    function queueAssetsSearch() {
        if (assetSearchDebounceTimer) clearTimeout(assetSearchDebounceTimer);
        assetSearchDebounceTimer = setTimeout(() => {
            searchAssetsToAttach();
        }, 250);
    }

    async function attachSelectedAsset() {
        if (!ticketId || !selectedAssetId || isAttachingAsset) return;

        const comment = attachAssetComment.trim() || undefined;
        isAttachingAsset = true;
        try {
            const res = await api.post(`/api/v1/tickets/${ ticketId }/assets`, {
                asset_id: selectedAssetId,
                comment,
            });

            if (!res.success) {
                if (res.status === 404 || res.status === 405 || res.status === 501) {
                    const selected = availableAttachAssets.find((asset) => asset.id === selectedAssetId)
                        || assetSearchResults.find((asset) => asset.id === selectedAssetId);

                    if (!selected) {
                        notification('Ассет не найден в текущем списке', NotificationType.Error);
                        return;
                    }

                    if (!linkedAssets.some((asset) => asset.id === selected.id)) {
                        linkedAssets = [
                            ...linkedAssets,
                            {
                                id: selected.id,
                                name: selected.name,
                                inventory_number: selected.inventory_number ?? undefined,
                                serial_number: selected.serial_number ?? undefined,
                                location: selected.location ?? undefined,
                                comment,
                            }
                        ];
                    }

                    notification('Ассет привязан локально (серверная ручка ещё не готова)', NotificationType.Warning);
                    closeAttachAssetModal();
                    return;
                }

                notification(res.error || 'Не удалось привязать ассет', NotificationType.Error);
                return;
            }

            await reloadLinkedAssets();

            notification('Ассет привязан к заявке', NotificationType.Success);
            closeAttachAssetModal();
        } catch {
            notification('Не удалось привязать ассет', NotificationType.Error);
        } finally {
            isAttachingAsset = false;
        }
    }

    async function detachLinkedAsset(assetId: number) {
        if (!ticketId || !assetId) return;

        try {
            const res = await api.delete(`/api/v1/tickets/${ ticketId }/assets/${ assetId }`);
            if (!res.success) {
                if (res.status === 404 || res.status === 405 || res.status === 501) {
                    linkedAssets = linkedAssets.filter((asset) => asset.id !== assetId);
                    notification('Ассет отвязан локально (серверная ручка ещё не готова)', NotificationType.Warning);
                    return;
                }

                notification(res.error || 'Не удалось отвязать ассет', NotificationType.Error);
                return;
            }

            await reloadLinkedAssets();
            notification('Ассет отвязан от заявки', NotificationType.Success);
        } catch {
            notification('Не удалось отвязать ассет', NotificationType.Error);
        }
    }

    async function reloadLinkedAssets() {
        if (!ticketId) return;

        try {
            const refreshed = await getById(ticketId);
            linkedAssets = normalizeLinkedAssets(refreshed);
        } catch {}
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
        source_id = ticketData.source?.id ?? null;
        building_id = ticketData.building?.id ?? null;
        cabinet = ticketData.cabinet ?? '';
        department_id = ticketData.department?.id ?? null;
        planned_at = ticketData.planned_at ?? null;
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
        source_id = ticketData.source?.id ?? null;
        building_id = ticketData.building?.id ?? null;
        cabinet = ticketData.cabinet ?? '';
        department_id = ticketData.department?.id ?? null;
        planned_at = ticketData.planned_at ?? null;
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
        source_id = ticketData.source?.id ?? null;
        building_id = ticketData.building?.id ?? null;
        cabinet = ticketData.cabinet ?? '';
        department_id = ticketData.department?.id ? Number(ticketData.department.id) : null;
        planned_at = ticketData.planned_at ?? null;

        editingFiles = files.map(f => ({ ...f }));
        attachments_to_delete = [];
        attachments_to_add = [];
    }

    function handlePlannedAtChange(e: Event) {
        planned_at = (e.target as HTMLInputElement).value || null;
    }

    function handleFileAdd(e: Event) {
        const input = e.target as HTMLInputElement;
        if (!input.files) return;
        for (const file of Array.from(input.files)) {
            attachments_to_add = [...attachments_to_add, file];
        }
        input.value = '';
    }

    $: totalFilesCount = editingFiles.length + images.length + attachments_to_add.length;
    $: newImagePreviews = attachments_to_add
        .filter(f => IMAGE_EXTS.has((f.name.split('.').pop() ?? '').toLowerCase()))
        .map((f, i) => ({
            type: 'newimage',
            idx: i,
            name: f.name,
            url: URL.createObjectURL(f),
            ext: f.name.split('.').pop() ?? '',
            class: FILE_COLOR_CLASS(f.name.split('.').pop() ?? ''),
            isNew: true,
            file: f
        }));
    
    function handleAttachmentRemove(type: 'image' | 'file' | 'newfile' | 'newimage', idx: number) {
        if (type === 'image') {
            const originalName = originalImageNames[idx];
            
            const att = ticketData?.attachments.find((a: string) => 
                a.endsWith(originalName)
            );

            if (att) attachments_to_delete = [...attachments_to_delete, att];
            images = images.filter((_, i) => i !== idx);
            originalImageNames = originalImageNames.filter((_, i) => i !== idx);
        } else if (type === 'file') {
            const fileName = editingFiles[idx].name;
            
            const att = ticketData?.attachments.find((a: string) => 
                a.endsWith(fileName)
            );
            
            if (att) attachments_to_delete = [...attachments_to_delete, att];
            editingFiles = editingFiles.filter((_, i) => i !== idx);
        } else if (type === 'newfile') {
            attachments_to_add = attachments_to_add.filter((_, i) => i !== idx);
        } else if (type === 'newimage') {
            URL.revokeObjectURL(newImagePreviews[idx].url);
            attachments_to_add = attachments_to_add.filter((_, i) => i !== idx);
        }
    }

    async function saveEdit() {
        if (!ticketData) return;
        if (isSubmitting) return;

        const updatedFields: any = {
            id: ticketData.id
        };

        if (isEditing && title !== ticketData.title) updatedFields.title = title;
        if (description !== ticketData.description) updatedFields.description = description;
        if (author !== ticketData.author) updatedFields.author = author;
        if (author_contacts !== ticketData.author_contacts) updatedFields.author_contacts = author_contacts;
        if (source_id !== (ticketData.source?.id ?? null) && source_id !== null)
            updatedFields.source = source_id;
        if (status !== ticketData.status) updatedFields.status = status as UiStatus;
        if (priority !== ticketData.priority) updatedFields.priority = priority as PriorityStatus;
        if (building_id !== ticketData.building?.id)
            updatedFields.building = buildingsList.find(b => b.id === building_id) || ticketData.building;
        if (cabinet !== ticketData.cabinet) updatedFields.cabinet = cabinet;
        if (department_id !== null && Number(department_id) !== Number(ticketData.department?.id ?? null))
            updatedFields.department_id = Number(department_id);
        if (planned_at !== ticketData.planned_at)
            updatedFields.planned_at = planned_at;

        if (attachments_to_delete.length > 0)
            updatedFields.attachments_to_delete = attachments_to_delete;
        if (attachments_to_add.length > 0)
            updatedFields.attachments_to_add = attachments_to_add;

        const hasAssignedToChanged = updatedFields.assigned_to !== undefined && 
            JSON.stringify(updatedFields.assigned_to) !== JSON.stringify(ticketData.assigned_to);

        try {
            isSubmitting = true;
            
            if (hasAssignedToChanged)
                updatedFields.assigned_to = updatedFields.assigned_to ? JSON.stringify(updatedFields.assigned_to) : null;
            
            await updateTicket(ticketId as string, updatedFields);

            ticketData = {
                ...ticketData,
                title: updatedFields.title ?? ticketData?.title,
                description: description,
                author: author,
                author_contacts: author_contacts,
                source: $sources.find((s: TicketSource) => Number(s.id) === Number(source_id)) || ticketData?.source,
                status: status,
                priority: priority,
                cabinet: cabinet,
                building: updatedFields.building || ticketData?.building,
                department: $departments.find(d => Number(d.id) === Number(department_id)) || ticketData?.department,
                planned_at: planned_at
            } as Ticket;

            if (attachments_to_delete.length > 0)
                editingFiles = editingFiles.filter(f => !attachments_to_delete.includes(f.name));
            if (attachments_to_add.length > 0)
                attachments_to_add = [];

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
            const result = await loadUsersData(1, 10, assignSearchQuery, UserRole.Programmer);
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

        if (!$isAuthenticated || $currentUser === null || $currentUser.role === UserRole.Anonymous)
            handleAuthError(`/page/${ ticketId }`);
        else {
            await fetchConsts();
            ticketData = await getById(ticketId);
            linkedAssets = normalizeLinkedAssets(ticketData);
            if (ticketData && ticketData.building && ticketData.building.code)
                pageTitle.set(`Заявка ${ticketData.building.code}-${ticketId} | Система управления заявками ЕИ КФУ`);
    
            if (ticketData && Array.isArray(ticketData.attachments) && ticketData.attachments.length > 0) {
                const atts = ticketData.attachments || [];
                const imageAtts = atts.filter((att: any) => {
                    const name = getAttachmentName(att);
                    const ext = getExtFromName(name);
                    return IMAGE_EXTS.has(ext);
                });
                
                originalImageNames = imageAtts.map((att: any) => getAttachmentName(att));
                
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
                originalImageNames = [];
            }
    
            if (ticketData) title = ticketData.title;
    
            window.addEventListener('resize', updateScreenWidth);
            window.addEventListener('resize', updateIsMobile);
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
        window.removeEventListener('resize', updateIsMobile);
        if (assetSearchDebounceTimer) clearTimeout(assetSearchDebounceTimer);
        
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
                    {#if isEditing}
                        <p class="ticket-tag">
                            Запланированное время:
                            <input
                                type="datetime-local"
                                bind:value={ planned_at }
                                class="edit-mode"
                                aria-label="Запланированное время"
                                on:change={ handlePlannedAtChange }
                            />
                        </p>
                    {:else}
                        <p class="ticket-tag">
                            Запланированное время:
                            <span>{ formatDate(ticketData.planned_at || '') || 'Без даты' }</span>
                        </p>
                    {/if}
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
            {#if images.length > 0 || files.length > 0 || isEditing}
                {#if isEditing}
                    <div class="attachments-list editing">
                        {#each [
                            ...images.map((img, i) => ({
                                type: 'image',
                                idx: i,
                                name: img.split('/').pop(),
                                url: img,
                                ext: img.split('.').pop() ?? '',
                                class: FILE_COLOR_CLASS(img.split('.').pop() ?? ''),
                                isNew: false
                            })),
                            ...newImagePreviews,
                            ...editingFiles.map((f, i) => ({
                                type: 'file',
                                idx: i,
                                name: f.name,
                                url: f.url,
                                ext: f.ext,
                                class: f.class,
                                isNew: false
                            })),
                            ...attachments_to_add
                                .filter(f => !IMAGE_EXTS.has((f.name.split('.').pop() ?? '').toLowerCase()))
                                .map((f, i) => ({
                                    type: 'newfile',
                                    idx: i,
                                    name: f.name,
                                    url: '',
                                    ext: f.name.split('.').pop() ?? '',
                                    class: FILE_COLOR_CLASS(f.name.split('.').pop() ?? ''),
                                    isNew: true
                                }))
                        ] as att}
                            {#if att.type === 'image' || att.type === 'newimage'}
                                <button
                                    class="attachment-img-button editing"
                                    aria-label="Удалить изображение"
                                    type="button"
                                    on:click={() => {
                                        attachmentToRemove = { type: (att.type as 'file' || 'image'), idx: att.idx };
                                        showAttachmentRemoveConfirm = true;
                                    }}
                                    style="all: unset; cursor: pointer;"
                                >
                                    <img
                                        src={ att.url }
                                        alt="Вложение"
                                        class="attachment-img"
                                        loading="lazy"
                                    />
                                </button>
                            {:else}
                                <FileCard
                                    name={ (att.name as string) || 'Вложение' }
                                    url={ att.url }
                                    ext={ att.ext }
                                    colorClass={ att.class }
                                    editing={ true }
                                    on:click={(event) => {
                                        event.preventDefault();
                                        attachmentToRemove = { type: (att.type as 'file' || 'image'), idx: att.idx };
                                        showAttachmentRemoveConfirm = true;
                                    }}
                                />
                            {/if}
                        {/each}
                        <div class="file-upload">
                            {#if editingFiles.length + images.length + attachments_to_add.length < 5}
                                <input type="file" id="file-edit" multiple on:change={ handleFileAdd } />
                                <label for="file-edit">
                                    <span class="file-icon">📎</span>
                                    Добавить файлы ({ totalFilesCount }/5)
                                </label>
                            {/if}
                        </div>
                    </div>
                {:else}
                    <div class="attachments-list">
                        {#each images as img}
                            <button
                                class="attachment-img-button"
                                aria-haspopup="dialog"
                                aria-label="Открыть изображение во всплывающем окне"
                                on:click={ () => openModal(img) }
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
                                    src={ img }
                                    alt="Вложение"
                                    class="attachment-img"
                                    loading="lazy"
                                />
                            </button>
                        {/each}

                        {#each files as f}
                            <FileCard
                                name={ f.name }
                                url={ f.url }
                                ext={ f.ext }
                                colorClass={ f.class }
                            />
                        {/each}
                    </div>
                {/if}
            {/if}

            <div class="assets-mobile-block assets-inline-block">
                <div class="assets-card-header">
                    <div class="assets-title">Ассеты ({ linkedAssets.length })</div>
                    {#if canManageTicketAssets}
                        <button class="asset-add-btn" on:click={ openAttachAssetModal }>+ Ассет</button>
                    {/if}
                </div>

                {#if linkedAssets.length === 0}
                    <div class="assets-empty">Нет ассетов</div>
                {:else}
                    <div class="assets-compact-list">
                        {#each linkedAssets as linkedAsset (linkedAsset.id)}
                            <article class="asset-compact-item">
                                <div class="asset-compact-main">
                                    <strong>{ linkedAsset.name }</strong>
                                    <span class="asset-chip-id">#{ linkedAsset.id }</span>
                                </div>
                                {#if linkedAsset.inventory_number || linkedAsset.serial_number || linkedAsset.location}
                                    <div class="asset-compact-meta">
                                        {#if linkedAsset.inventory_number}<span>Инв: { linkedAsset.inventory_number }</span>{/if}
                                        {#if linkedAsset.serial_number}<span>SN: { linkedAsset.serial_number }</span>{/if}
                                        {#if linkedAsset.location}<span>{ linkedAsset.location }</span>{/if}
                                    </div>
                                {/if}
                                {#if canManageTicketAssets}
                                    <button class="asset-unlink-btn compact" on:click={ () => detachLinkedAsset(linkedAsset.id) }>
                                        Отвязать
                                    </button>
                                {/if}
                            </article>
                        {/each}
                    </div>
                {/if}
            </div>

            <div class="author-contacts">
                {#if ticketData}
                    <div 
                        class="avatar-container"
                        bind:this={ authorAvatarContainer }
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
                            <select
                                class="edit-mode"
                                bind:value={ source_id }
                                style="width: 100%;"
                                aria-label="Источник заявки"
                            >
                                <option value={ null } disabled>Выберите источник</option>
                                {#each $sources as src}
                                    <option value={ src.id }>{ src.name }</option>
                                {/each}
                            </select>
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
                                </span>
                            </p>
                            <p class="contacts-tag">Источник: <span>{ ticketData.source?.name || 'Не указан' }</span></p>
                            {/if}
                        </div>
                        <button
                            class="chat-open-btn"
                            type="button"
                            style="margin-left: 1em;"
                            on:click={ () => showChat = true }
                            aria-label="Открыть чат по заявке"
                        >
                            <svg viewBox="0 0 48 48" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#075cef">
                                <g>
                                    <path d="M24 10V10C33.732 10 42 16.268 42 24V32.909C42 33.923 42 34.43 41.9086 34.8502C41.5758 36.3804 40.3804 37.5758 38.8502 37.9086C38.43 38 37.923 38 36.909 38H24C14.268 38 6 29.732 6 20V20" stroke="#075cef" stroke-width="3"/>
                                    <path d="M18 22L30 22" stroke="#075cef" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M10 16L10 4" stroke="#075cef" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M4 10L16 10" stroke="#075cef" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M24 30H30" stroke="#075cef" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                </g>
                            </svg>
                        </button>
                {:else}
                    <p>Загрузка...</p>
                {/if}
            </div>
            <div class="ticket-actions">
                {#if !isEditing}
                    {#if ticketData && $currentUser && (!ticketData.assigned_to || !ticketData.assigned_to.some(e => e.id === $currentUser.id)) && ($currentUser.role === UserRole.Programmer || $currentUser.role === UserRole.Moderator || $currentUser.role === UserRole.Administrator)}
                        <button class="btn btn-primary" on:click={ assignHandler }>Взять в работу</button>
                    {/if}
                    {#if $currentUser && $currentUser.role !== UserRole.Client && $currentUser.role !== UserRole.Anonymous}
                        <button class="btn btn-outline" on:click={ startEdit }>Редактировать</button>
                    {/if}
                    {#if ticketData && ticketData.status !== 'cancelled' && $currentUser && ($currentUser.role === UserRole.Programmer || $currentUser.role === UserRole.Moderator || $currentUser.role === UserRole.Administrator || $currentUser.role === UserRole.Client && ticketData.status === 'open')}
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
    {#if showAttachmentRemoveConfirm && attachmentToRemove}
        <Confirmation
            title="Удалить вложение"
            message="Вы уверены, что хотите удалить это вложение из заявки?"
            confirmText="Удалить"
            cancelText="Отмена"
            onConfirm={() => {
                attachmentToRemove && handleAttachmentRemove(attachmentToRemove.type, attachmentToRemove.idx);
                showAttachmentRemoveConfirm = false;
                attachmentToRemove = null;
            }}
            onCancel={() => {
                showAttachmentRemoveConfirm = false;
                attachmentToRemove = null;
            }}
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

    {#if showAttachmentRemoveConfirm && attachmentToRemove}
        <Confirmation
            title="Удалить вложение"
            message="Вы уверены, что хотите удалить это вложение из заявки?"
            confirmText="Удалить"
            cancelText="Отмена"
            onConfirm={() => {
                attachmentToRemove && handleAttachmentRemove(attachmentToRemove.type, attachmentToRemove.idx);
                showAttachmentRemoveConfirm = false;
                attachmentToRemove = null;
            }}
            onCancel={() => {
                showAttachmentRemoveConfirm = false;
                attachmentToRemove = null;
            }}
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
                {#if isEditing}
                    <p class="ticket-tag">
                        Запланированное время:
                        <input
                            type="datetime-local"
                            bind:value={ planned_at }
                            class="edit-mode"
                            aria-label="Запланированное время"
                            on:change={ handlePlannedAtChange }
                        />
                    </p>
                {:else}
                    <p class="ticket-tag">
                        Запланированное время:
                        <span>{ formatDate(ticketData.planned_at || '') || 'Без даты' }</span>
                    </p>
                {/if}
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
            {#if images.length > 0 || files.length > 0 || isEditing}
                {#if isEditing}
                    <div class="attachments-list editing">
                        {#each [
                            ...images.map((img, i) => ({
                                type: 'image',
                                idx: i,
                                name: img.split('/').pop(),
                                url: img,
                                ext: img.split('.').pop() ?? '',
                                class: FILE_COLOR_CLASS(img.split('.').pop() ?? ''),
                                isNew: false
                            })),
                            ...newImagePreviews,
                            ...editingFiles.map((f, i) => ({
                                type: 'file',
                                idx: i,
                                name: f.name,
                                url: f.url,
                                ext: f.ext,
                                class: f.class,
                                isNew: false
                            })),
                            ...attachments_to_add
                                .filter(f => !IMAGE_EXTS.has((f.name.split('.').pop() ?? '').toLowerCase()))
                                .map((f, i) => ({
                                    type: 'newfile',
                                    idx: i,
                                    name: f.name,
                                    url: '',
                                    ext: f.name.split('.').pop() ?? '',
                                    class: FILE_COLOR_CLASS(f.name.split('.').pop() ?? ''),
                                    isNew: true
                                }))
                        ] as att}
                            {#if att.type === 'image' || att.type === 'newimage'}
                                <button
                                    class="attachment-img-button editing"
                                    aria-label="Удалить изображение"
                                    type="button"
                                    on:click={() => {
                                        attachmentToRemove = { type: (att.type as 'file' || 'image'), idx: att.idx };
                                        showAttachmentRemoveConfirm = true;
                                    }}
                                    style="all: unset; cursor: pointer;"
                                >
                                    <img
                                        src={ att.url }
                                        alt="Вложение"
                                        class="attachment-img"
                                        loading="lazy"
                                    />
                                </button>
                            {:else}
                                <FileCard
                                    name={ (att.name as string) || 'Вложение' }
                                    url={ att.url }
                                    ext={ att.ext }
                                    colorClass={ att.class }
                                    editing={ true }
                                    on:click={(event) => {
                                        event.preventDefault();
                                        attachmentToRemove = { type: (att.type as 'file' || 'image'), idx: att.idx };
                                        showAttachmentRemoveConfirm = true;
                                    }}
                                />
                            {/if}
                        {/each}
                        <div class="file-upload">
                            {#if editingFiles.length + attachments_to_add.length < 5}
                                <input type="file" id="file-edit" multiple on:change={ handleFileAdd } />
                                <label for="file-edit">
                                    <span class="file-icon">📎</span>
                                    Добавить файлы ({ totalFilesCount }/5)
                                </label>
                            {/if}
                        </div>
                    </div>
                {:else}
                    <div class="attachments-list">
                        {#each images as img}
                            <button
                                class="attachment-img-button"
                                aria-haspopup="dialog"
                                aria-label="Открыть изображение во всплывающем окне"
                                on:click={ () => openModal(img) }
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
                                    src={ img }
                                    alt="Вложение"
                                    class="attachment-img"
                                    loading="lazy"
                                />
                            </button>
                        {/each}

                        {#each files as f}
                            <FileCard
                                name={ f.name }
                                url={ f.url }
                                ext={ f.ext }
                                colorClass={ f.class }
                            />
                        {/each}
                    </div>
                {/if}
            {/if}
            <div class="assets-mobile-block assets-inline-block">
                <div class="assets-card-header">
                    <div class="assets-title">Ассеты ({ linkedAssets.length })</div>
                    {#if canManageTicketAssets}
                        <button class="asset-add-btn" on:click={ openAttachAssetModal }>+ Ассет</button>
                    {/if}
                </div>

                {#if linkedAssets.length === 0}
                    <div class="assets-empty">Нет ассетов</div>
                {:else}
                    <div class="assets-compact-list">
                        {#each linkedAssets as linkedAsset (linkedAsset.id)}
                            <article class="asset-compact-item">
                                <div class="asset-compact-main">
                                    <strong>{ linkedAsset.name }</strong>
                                    <span class="asset-chip-id">#{ linkedAsset.id }</span>
                                </div>
                                {#if linkedAsset.inventory_number || linkedAsset.serial_number || linkedAsset.location}
                                    <div class="asset-compact-meta">
                                        {#if linkedAsset.inventory_number}<span>Инв: { linkedAsset.inventory_number }</span>{/if}
                                        {#if linkedAsset.serial_number}<span>SN: { linkedAsset.serial_number }</span>{/if}
                                        {#if linkedAsset.location}<span>{ linkedAsset.location }</span>{/if}
                                    </div>
                                {/if}
                                {#if canManageTicketAssets}
                                    <button class="asset-unlink-btn compact" on:click={ () => detachLinkedAsset(linkedAsset.id) }>
                                        Отвязать
                                    </button>
                                {/if}
                            </article>
                        {/each}
                    </div>
                {/if}
            </div>
            <div class="author-contacts">
                {#if ticketData}
                    <div 
                        class="avatar-container"
                        bind:this={ authorAvatarContainer }
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
                            <select
                                class="edit-mode"
                                bind:value={ source_id }
                                style="width: 100%;"
                                aria-label="Источник заявки"
                            >
                                <option value={ null } disabled>Выберите источник</option>
                                {#each $sources as src}
                                    <option value={ src.id }>{ src.name }</option>
                                {/each}
                            </select>
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
                                </span>
                            </p>
                            <p class="contacts-tag">Источник: <span>{ ticketData.source?.name || 'Не указан' }</span></p>
                            {/if}
                        </div>
                        <button
                            class="chat-open-btn"
                            type="button"
                            style="margin-left: 1em;"
                            on:click={ () => showChat = true }
                            aria-label="Открыть чат по заявке"
                        >
                            <svg viewBox="0 0 48 48" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#075cef">
                                <g>
                                    <path d="M24 10V10C33.732 10 42 16.268 42 24V32.909C42 33.923 42 34.43 41.9086 34.8502C41.5758 36.3804 40.3804 37.5758 38.8502 37.9086C38.43 38 37.923 38 36.909 38H24C14.268 38 6 29.732 6 20V20" stroke="#075cef" stroke-width="3"/>
                                    <path d="M18 22L30 22" stroke="#075cef" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M10 16L10 4" stroke="#075cef" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M4 10L16 10" stroke="#075cef" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M24 30H30" stroke="#075cef" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                </g>
                            </svg>
                        </button>
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
                        {#if ticketData && $currentUser && (!ticketData.assigned_to || !ticketData.assigned_to.some(e => e.id === $currentUser.id)) && ($currentUser.role === UserRole.Programmer || $currentUser.role === UserRole.Moderator || $currentUser.role === UserRole.Administrator) }
                            <button class="btn btn-primary" on:click={ assignHandler }>Взять в работу</button>
                        {/if}
                        {#if $currentUser && $currentUser.role !== UserRole.Client && $currentUser.role !== UserRole.Anonymous}
                            <button class="btn btn-outline" on:click={ startEdit }>Редактировать</button>
                        {/if}
                        {#if ticketData && ticketData.status !== 'cancelled' && $currentUser && $currentUser.role !== UserRole.Anonymous && (($currentUser.role === UserRole.Client && ticketData.status === 'open') || $currentUser.role === UserRole.Programmer || $currentUser.role === UserRole.Moderator || $currentUser.role === UserRole.Administrator) }
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

{#if showChat && ticketData}
    <div
        class="draggable-chat-modal { isMobile ? 'mobile' : '' }"
        role="dialog"
        aria-modal="true"
        tabindex="0"
        style={ isMobile
            ? 'position:fixed; left:0; top:0; right:0; bottom:0; width:100vw; height:100vh; z-index:2000;'
            : 'position:fixed; right:40px; bottom:40px; z-index:2000;'
        }
    >
        <Chat
            ticketId={ ticketData?.id || 0 }
            userRole={ $currentUser?.role || UserRole.Anonymous }
            on:close={ () => showChat = false }
        />
    </div>
{/if}

{#if showAttachAssetModal}
    <div
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        tabindex="0"
        transition:fade={{ duration: 180 }}
        on:click={(e) => { if (e.target === e.currentTarget) closeAttachAssetModal(); }}
        on:keydown={(e) => {
            if (e.key === 'Escape') closeAttachAssetModal();
        }}
    >
        <section class="asset-modal" role="document" aria-label="Привязать ассет">
            <div class="asset-modal-header">
                <h2>Привязать ассет</h2>
                <button class="asset-modal-close" on:click={ closeAttachAssetModal }>&times;</button>
            </div>
            <div class="asset-modal-body">
                <input
                    type="text"
                    class="asset-search-input"
                    placeholder="Поиск ассета по названию..."
                    bind:value={ assetSearchQuery }
                    on:input={ queueAssetsSearch }
                    aria-label="Поиск ассета"
                />

                {#if assetSearchLoading}
                    <p class="asset-search-state">Загрузка...</p>
                {:else if availableAttachAssets.length > 0}
                    <div class="asset-results-list">
                        {#each availableAttachAssets as asset (asset.id)}
                            <button
                                type="button"
                                class="asset-result-item attach-asset-result"
                                class:selected={ selectedAssetId === asset.id }
                                on:click={() => selectedAssetId = asset.id}
                            >
                                <span>{ asset.name }</span>
                                <span class="user-email">#{ asset.id }{ asset.inventory_number ? ` • Инв. ${asset.inventory_number}` : '' }</span>
                            </button>
                        {/each}
                    </div>
                {:else if assetSearchQuery.trim()}
                    <p class="asset-search-state">Подходящие ассеты не найдены</p>
                {:else}
                    <p class="asset-search-state">Введите название ассета</p>
                {/if}

                <label for="asset-comment" class="asset-comment-label">Комментарий к привязке</label>
                <textarea
                    id="asset-comment"
                    rows="3"
                    bind:value={ attachAssetComment }
                    class="asset-comment-input"
                    placeholder="Например: используется для выполнения заявки"
                ></textarea>

                <div class="attach-asset-actions">
                    <button class="btn btn-outline" type="button" on:click={ closeAttachAssetModal }>
                        Отмена
                    </button>
                    <button
                        class="btn btn-primary"
                        type="button"
                        disabled={ !selectedAssetId || isAttachingAsset }
                        on:click={ attachSelectedAsset }
                    >
                        Привязать
                    </button>
                </div>
            </div>
        </section>
    </div>
{/if}

<style>
    @import './page.css';
</style>
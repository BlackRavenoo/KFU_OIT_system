<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { fade, fly } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    import { createCategory } from '$lib/utils/assets/api';
    import { setupKeydownListener, removeKeydownListener } from '$lib/components/Modal/Modal';

    const dispatch = createEventDispatcher();

    let name = '';
    let color = '#3B82F6';
    let notes = '';

    let saving = false;
    let errorMsg = '';

    const CATEGORY_NAME_MAX = 32;
    const NOTES_MAX = 512;

    $: validationErrors = {
        name: !name.trim()
            ? 'Имя категории — обязательное поле'
            : (name.trim().length > CATEGORY_NAME_MAX ? `Максимум ${ CATEGORY_NAME_MAX } символа` : ''),
        color: /^#[0-9A-Fa-f]{6}$/.test(color) ? '' : 'Цвет должен быть в формате #RRGGBB',
        notes: notes.trim().length > NOTES_MAX ? `Максимум ${ NOTES_MAX } символов` : '',
    };
    $: isFormInvalid = Object.values(validationErrors).some((msg) => Boolean(msg));

    async function handleSave() {
        if (isFormInvalid) {
            errorMsg = 'Проверьте корректность заполнения полей';
            return;
        }

        saving = true;
        errorMsg = '';

        try {
            const payload = {
                name: name.trim(),
                color: color,
                notes: notes.trim() || undefined,
            };

            const resp = await createCategory(payload);

            if (resp.success) dispatch('save');
            else errorMsg = resp.error || 'Ошибка сохранения';
        } catch (e: any) {
            errorMsg = e?.message || 'Ошибка сохранения';
        } finally {
            saving = false;
        }
    }

    function close() {
        dispatch('close');
    }

    function keydownHandler(e: KeyboardEvent) {
        if (e.key === 'Escape') close();
    }

    onMount(() => {
        setupKeydownListener(keydownHandler);
    });

    onDestroy(() => {
        removeKeydownListener(keydownHandler);
    });
</script>

<div
    class="modal-backdrop"
    transition:fade={{ duration: 180 }}
    on:click|self={ close }
    role="presentation"
    style="background: transparent"
>
    <div
        class="modal-window category-modal"
        transition:fly={{ y: 50, duration: 340, easing: quintOut }}
        role="dialog"
        aria-modal="true"
        aria-label="Создание категории"
    >
        <div class="modal-header">
            <h2>Создание категории</h2>
            <button class="close-btn" on:click={ close } aria-label="Закрыть">×</button>
        </div>

        {#if errorMsg}
            <div class="modal-error">{ errorMsg }</div>
        {/if}

        <div class="modal-body">
            <label class="field">
                <span class="field-label">Имя категории <span class="required">*</span></span>
                <input type="text" bind:value={ name } maxlength={ CATEGORY_NAME_MAX } placeholder="Название категории" />
                {#if validationErrors.name}
                    <span class="field-error">{ validationErrors.name }</span>
                {/if}
            </label>

            <label class="field">
                <span class="field-label">Цвет <span class="required">*</span></span>
                <div class="color-picker-row">
                    <input type="color" bind:value={ color } class="color-input" />
                    <span class="color-hex">{ color }</span>
                    <span class="color-preview" style="background: { color };"></span>
                </div>
                {#if validationErrors.color}
                    <span class="field-error">{ validationErrors.color }</span>
                {/if}
            </label>

            <label class="field">
                <span class="field-label">Заметки</span>
                <textarea bind:value={ notes } maxlength={ NOTES_MAX } placeholder="Заметки о категории (необязательно)" rows="3"></textarea>
                {#if validationErrors.notes}
                    <span class="field-error">{ validationErrors.notes }</span>
                {/if}
            </label>
        </div>

        <div class="modal-footer">
            <button class="btn btn-secondary" on:click={ close }>Отмена</button>
            <button
                class="btn btn-primary"
                on:click={ handleSave }
                disabled={ saving || isFormInvalid }
            >
                { saving ? 'Создание...' : 'Создать' }
            </button>
        </div>
    </div>
</div>

<style scoped>
    @import './page.css';
</style>

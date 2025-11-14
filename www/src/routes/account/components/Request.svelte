<script lang="ts">
	import { UserRole } from '$lib/utils/auth/types';
    import { fetchTicket } from '$lib/utils/tickets/api/set';
    import { handleFileChange, removeFile } from '$lib/utils/files/inputs';
    import { showModalWithFocus } from '$lib/components/Modal/Modal';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    import { buildings } from '$lib/utils/setup/stores';
    import { validateFiles, validateName, validatePhone } from '$lib/utils/validation/validate';
    import Modal from '$lib/components/Modal/Modal.svelte';
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { currentUser } from '$lib/utils/auth/storage/initial';

    let Title = '';
    let Description = '';
    let Name = '';
    let Contact = '';
    let Building: number = 1;
    let Cabinet = '';
    let DateVal = '';
    let fileName: string[] = [];
    let File: File[] = [];
    let moreOptionsVisible = false;
    let showModal = false;

    let modalElement: Modal;

    let touched = {
        Title: false,
        Description: false,
        Name: false,
        Contact: false,
        Building: false
    };

    let errors = {
        Title: '',
        Description: '',
        Name: '',
        Contact: '',
        Building: ''
    };

    $: nameValid = validateName(Name);
    $: phoneValid = validatePhone(Contact);

    function validateForm() {
        errors.Title = Title.trim() === '' ? 'Заполните заголовок' : '';
        errors.Description = Description.trim() === '' ? 'Заполните описание' : '';
        errors.Name = Name.trim() === '' ? 'Введите ФИО' : (!nameValid ? 'Имя должно содержать минимум 3 буквы кириллицей' : '');
        errors.Contact = Contact.trim() === '' ? 'Введите телефон' : (!phoneValid ? 'Некорректный телефон' : '');
        errors.Building = !Building ? 'Выберите здание' : '';
        return Object.values(errors).every(e => e === '');
    }

    function onFileChange(event: Event) {
        const result = handleFileChange(event, File, fileName, () => {
            showModalWithFocus(
                (val) => showModal = val,
                modalElement,
            );
        });
        File = result.files;
        fileName = result.fileNames;
    }

    function onRemoveFile(index: number) {
        const result = removeFile(index, File, fileName);
        File = result.files;
        fileName = result.fileNames;
    }

    function resetForm() {
        Title = '';
        Description = '';
        Contact = '';
        Cabinet = '';
        DateVal = '';
        File = [];
        fileName = [];
        Object.keys(touched).forEach(k => (touched as any)[k] = false);
    }

    async function onSubmitForm() {
        Object.keys(touched).forEach(k => (touched as any)[k] = true);
        if (!validateForm() || !validateFiles(File)) return;
        try {
            await fetchTicket(Title, Description, Name, Contact, Building, Cabinet, DateVal, File);
            notification('Заявка отправлена!', NotificationType.Success);
            resetForm();
            dispatchEvent(new CustomEvent('ticket-sent'));
        } catch {
            notification('Ошибка при отправке заявки', NotificationType.Error);
        }
    }

    onMount(() => {
        const sp = $page?.url?.searchParams;
        /** !!! TDD !!! */
        if (!sp && $currentUser && $currentUser.role !== UserRole.Client) {
            if ($currentUser?.name) Name = $currentUser.name;
            return;
        }

        const maybe = (k: string) => sp.get(k);

        const title = maybe('title');
        if (title !== null) Title = title;

        const description = maybe('description');
        if (description !== null) Description = description;

        const building = maybe('building');
        if (building !== null) {
            const n = Number(building);
            if (!Number.isNaN(n)) Building = n;
        }

        const cabinet = maybe('cabinet');
        if (cabinet !== null) Cabinet = cabinet;

        const date = maybe('date');
        if (date !== null) DateVal = date;

        const nameParam = maybe('name');
        if (nameParam !== null) {
            Name = nameParam;
        } else if ($currentUser?.name) {
            Name = $currentUser.name;
        }

        const contactParam = maybe('contact');
        if (contactParam !== null) Contact = contactParam;
    });
</script>

<div class="main-container">
    <h1>Создание заявки</h1>

    <div class="intro-block">
        <p class="lead">
            Здесь вы можете оставить заявку для ОИТ. Укажите краткий и понятный заголовок, затем подробно опишите проблему.
            Чем точнее описание — тем быстрее решение.
        </p>
        <div class="info-panels">
            <div class="panel">
                <h4>Советы по оформлению</h4>
                <ul>
                    <li>Уточните помещение и оборудование (пример: ПК в 81 кабинете).</li>
                    <li>Добавьте скриншоты или фото ошибки — это ускорит диагностику.</li>
                    <li>Если нужна помощь к определённому времени — заполните поле даты.</li>
                </ul>
            </div>
            <div class="panel">
                <h4>Файлы</h4>
                <p>Можно прикрепить до 5 файлов (JPEG/PNG/PDF). Не добавляйте конфиденциальные данные.</p>
            </div>
            <div class="panel">
                <h4>Обработка</h4>
                <p>Среднее время первичного ответа: до 30 минут в рабочее время.</p>
            </div>
        </div>
    </div>

    <div class="form-container">
        <form on:submit|preventDefault={ onSubmitForm } class="form_container account_request_form">
            <h3>Форма заявки</h3>

            <div class="form-field">
                <input
                    type="text"
                    id="Title"
                    name="Title"
                    placeholder=" "
                    required
                    bind:value={ Title }
                    class:red-border={ touched.Title && errors.Title }
                    on:input={() => { if (touched.Title) validateForm(); }}
                    on:blur={() => { touched.Title = true; validateForm(); }}
                >
                <label for="Title">Заголовок заявки</label>
                {#if touched.Title && errors.Title}
                    <div class="input-error">{ errors.Title }</div>
                {/if}
            </div>

            <div class="form-field">
                <textarea
                    id="Description"
                    name="Description"
                    placeholder=" "
                    required
                    bind:value={ Description }
                    class:red-border={ touched.Description && errors.Description }
                    on:input={() => { if (touched.Description) validateForm(); }}
                    on:blur={() => { touched.Description = true; validateForm(); }}
                ></textarea>
                <label for="Description">Описание проблемы</label>
                {#if touched.Description && errors.Description}
                    <div class="input-error">{ errors.Description }</div>
                {/if}
            </div>

            <div class="form-row">
                <div class="form-field">
                    <input
                        type="text"
                        id="Name"
                        name="Name"
                        placeholder=" "
                        required
                        bind:value={ Name }
                        class:red-border={ touched.Name && errors.Name }
                        on:input={() => { if (touched.Name) validateForm(); }}
                        on:blur={() => { touched.Name = true; validateForm(); }}
                    >
                    <label for="Name">ФИО</label>
                    {#if touched.Name && errors.Name}
                        <div class="input-error">{ errors.Name }</div>
                    {/if}
                </div>

                <div class="form-field">
                    <input
                        type="text"
                        id="Contact"
                        name="Contact"
                        placeholder=" "
                        required
                        bind:value={ Contact }
                        class:red-border={ touched.Contact && errors.Contact }
                        on:input={() => { if (touched.Contact) validateForm(); }}
                        on:blur={() => { touched.Contact = true; validateForm(); }}
                    >
                    <label for="Contact">Контактный телефон</label>
                    {#if touched.Contact && errors.Contact}
                        <div class="input-error">{ errors.Contact }</div>
                    {/if}
                </div>
            </div>

            <div class="form-row">
                <div class="form-field">
                    <select
                        id="Building"
                        name="Building"
                        class="{ Building ? 'selected' : '' } { touched.Building && errors.Building ? 'red-border' : '' }"
                        placeholder=" "
                        required
                        bind:value={ Building }
                        on:change={() => { if (touched.Building) validateForm(); }}
                        on:blur={() => { touched.Building = true; validateForm(); }}
                    >
                        <option value="" disabled selected>Выберите здание</option>
                        {#each $buildings as building}
                            <option value={ building.id }>{ building.name }</option>
                        {/each}
                    </select>
                    <label for="Building">Здание</label>
                    {#if touched.Building && errors.Building}
                        <div class="input-error">{ errors.Building }</div>
                    {/if}
                </div>

                <div class="form-field">
                    <input type="text" id="Cabinet" name="Cabinet" placeholder=" " bind:value={ Cabinet }>
                    <label for="Cabinet">Кабинет</label>
                </div>
            </div>

            <button
                class="more_options"
                on:click|preventDefault={() => { moreOptionsVisible = !moreOptionsVisible; }}
            >
                Дополнительные поля <span class="arrow { moreOptionsVisible ? 'arrow_up' : '' }">▼</span>
            </button>

            <div class="more { moreOptionsVisible ? 'more_visible' : '' }">
                <div class="form-field">
                    <input
                        type="datetime-local"
                        id="Date" name="Date"
                        min="2025-06-07T00:00"
                        max="2045-06-14T00:00"
                        bind:value={ DateVal } />
                    <label for="Date" class="date-label">Желаемые дата и время</label>
                </div>

                <div class="file-upload">
                    <input type="file" id="file" multiple accept=".jpg, .jpeg, .png, .pdf" on:change={ onFileChange } />
                    <label for="file">
                        <span class="file-icon">📎</span>
                        Прикрепить файлы ({ File.length }/5)
                    </label>
                    {#if fileName.length > 0}
                        <div class="file-list">
                            {#each fileName as name, i}
                                <div class="file-item">
                                    <button type="button" class="file-name" on:click={ () => onRemoveFile(i) }>{ name }</button>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                <div class="hint-block">
                    <p class="hint-title">Важно:</p>
                    <ul class="hint-list">
                        <li>Не прикладывайте исполняемые файлы (.exe).</li>
                        <li>Чем больше контекст — тем быстрее диагностика.</li>
                    </ul>
                </div>
            </div>

            <div class="disclaimer">
                Отправляя данные, вы подтверждаете корректность введённой информации. Контактный телефон используется только для связи по вашей заявке.
            </div>

            <button class="promo submit-btn" type="submit">
                Оставить заявку
                <span class="btn-arrow">→</span>
            </button>
        </form>
    </div>
</div>

{#if showModal}
    <Modal
        bind:this={ modalElement }
        modalMessage="Доступно максимум 5 изображений для загрузки."
        on:close={() => showModal = false}
    />
{/if}

<style>
    @import './Request.css';
</style>
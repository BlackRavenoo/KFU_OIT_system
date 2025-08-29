<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { load } from 'js-yaml';
    
    import { pageTitle, pageDescription } from '$lib/utils/setup/stores';
    
    import yamlText from '../../assets/privacy.yaml?raw';

    const privacyPolicy = load(yamlText);
    const sections = privacyPolicy.sections;
    const lastUpdated = privacyPolicy.lastUpdated;

    let currentSection = 0;
    
    /**
     * Прокручивает страницу к выбранной секции политики конфиденциальности.
     * @param index Индекс секции в массиве sections
     */
    function scrollToSection(index: number) {
        currentSection = index;
        const element = document.getElementById(`section-${index}`);
        element && element.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Устанавливает заголовок и описание страницы при монтировании компонента,
    */
    onMount(() => {
        pageTitle.set('Политика конфиденциальности | Система управления заявками ЕИ КФУ');
        pageDescription.set('Информация о том, как обрабатываются данные в Системе управления заявками ОИТ ЕИ КФУ');
    });

    /**
     * Восстанавливает заголовок и описание страницы при размонтировании компонента,
    */
    onDestroy(() => {
        pageTitle.set('ОИТ | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Отдела Информационных Технологий Елабужского института Казанского Федерального Университета. Система позволяет создавать заявки на услуги ОИТ, отслеживать их статус, получать советы для самостоятельного решения проблемы и многое другое.');
    });
</script>

<div class="privacy-policy-container">
    <header class="privacy-header">
        <h1>Политика <span class="gradient-text">конфиденциальности</span></h1>
        <p class="privacy-description">
            Информация о правилах обработки и защиты данных в Системе управления заявками ОИТ ЕИ КФУ
        </p>
    </header>

    <div class="privacy-content">
        <aside class="navigation-sidebar">
            <div class="navigation-container">
                <h2>Содержание</h2>
                <nav class="sections-navigation">
                    {#each sections as section, index}
                        <button 
                            class="nav-item { currentSection === index ? 'active' : '' }" 
                            on:click={ () => scrollToSection(index) }
                        >
                            { section.title }
                        </button>
                    {/each}
                </nav>
                
                <div class="last-updated">
                    <p>Последнее обновление: { lastUpdated }</p>
                </div>
            </div>
        </aside>

        <main class="policy-sections">
            {#each sections as section, index}
                <section id="section-{ index }" class="policy-section">
                    <h2>{ section.title }</h2>
                    <div class="section-content">
                        { @html section.content }
                    </div>
                </section>
            {/each}
        </main>
    </div>
</div>

<style>
    @import './page.css';
</style>
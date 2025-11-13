<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { fly } from 'svelte/transition';
    import { load } from 'js-yaml';

    import { pageTitle, pageDescription } from '$lib/utils/setup/stores';
    
    import yamlText from '../../assets/faq.yaml?raw';
    
    interface FAQItem {
        question: string;
        answer: string;
        isOpen: boolean;
    }
    
    interface FAQCategory {
        title: string;
        items: FAQItem[];
    }
    
    const faqData = load(yamlText);
    
    /**
     * Преобразование данных FAQ из YAML в формат, удобный для работы в компоненте
     */
    let faqCategories: FAQCategory[] = (faqData.categories as any[]).map((category: FAQCategory) => ({
        title: category.title,
        items: category.items.map((item: any) => ({
            question: item.question,
            answer: item.answer,
            isOpen: false
        }))
    }));
    
    /**
     * Переключение состояния FAQ (открыт/закрыт)
     * @param categoryIndex Номер категории
     * @param itemIndex Номер вопроса в категории
     */
    function toggleFAQ(categoryIndex: number, itemIndex: number) {
        faqCategories[categoryIndex].items[itemIndex].isOpen = !faqCategories[categoryIndex].items[itemIndex].isOpen;
        faqCategories = [...faqCategories];
    }
    
    /**
     * Установка мета-тегов страницы при монтировании
    */
    onMount(() => {
        pageTitle.set('Часто задаваемые вопросы | Система управления заявками ЕИ КФУ');
        pageDescription.set('Ответы на часто задаваемые вопросы по использованию системы управления заявками Елабужского института Казанского Федерального Университета.');
    });
    
    /**
     * Сброс мета-тегов страницы при размонтированииы
    */
    onDestroy(() => {
        pageTitle.set('Service Desk | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Елабужского института Казанского Федерального Университета.');
    });
</script>

<div class="faq-page" in:fly={{ y: 30, duration: 800, delay: 300 }}>
    <div class="faq-container">
        <h1>Часто задаваемые <span class="gradient-text">вопросы</span></h1>
        
        <div class="faq-intro">
            <p>
                Мы собрали наиболее часто встречающиеся вопросы о работе системы управления заявками Елабужского института КФУ. 
                Если вы не нашли ответ на свой вопрос, пожалуйста, свяжитесь с нашей 
                <a href="/contact" class="gradient-link">службой поддержки</a>.
            </p>
        </div>
        
        {#each faqCategories as category, categoryIndex}
            <div class="faq-section">
                <h2>{ category.title }</h2>
                
                <div class="faq-items">
                    {#each category.items as item, itemIndex}
                        <div class="faq-item">
                            <button 
                                class="faq-question { item.isOpen ? 'active' : '' }"
                                on:click={ () => toggleFAQ(categoryIndex, itemIndex) }
                                aria-expanded={ item.isOpen }
                                aria-controls="faq-answer-{ categoryIndex }-{ itemIndex }"
                            >
                                { item.question }
                                <span class="faq-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d={ item.isOpen ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6" }></path>
                                    </svg>
                                </span>
                            </button>
                            
                            {#if item.isOpen}
                                <div 
                                    class="faq-answer"
                                    id="faq-answer-{ categoryIndex }-{ itemIndex }"
                                    transition:fly={ { y: -10, duration: 200 } }
                                >
                                    <p>{ item.answer }</p>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>
        {/each}
        
        <div class="faq-cta">
            <p>У вас остались вопросы?</p>
            <a href="/contact" class="cta-button">Связаться с нами</a>
        </div>
    </div>
</div>

<style>
    @import './page.css';
</style>
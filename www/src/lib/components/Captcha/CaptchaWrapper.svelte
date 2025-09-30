<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { SimpleCaptcha } from '$lib/utils/captcha/Simple/initial';
    import type { Captcha } from '$lib/utils/captcha/initial';
    
    export let containerId: string;
    export let onValidityChange: (isValid: boolean) => void = () => {};

    let captchaInstance: Captcha | null = null;

    /**
     * Функция для валидации капчи.
     * @returns {Promise<string | null>} - Возвращает токен капчи, если валидация успешна, иначе null.
     */
    export async function validate(): Promise<string | null> {
        if (!captchaInstance) return null;
        
        const result = await captchaInstance.verify();
        onValidityChange(result.success);
        return result.success ? result.token || null : null;
    }

    /**
     * Инициализация капчи при монтировании компонента.
    */
    onMount(() => {
        const captchaKey = import.meta.env.VITE_CAPTCHA_KEY;
        if (!captchaKey) return;

        (async () => {
            try {
                captchaInstance = new SimpleCaptcha(captchaKey, containerId);
                await captchaInstance.render();
            } catch (error) { }
        })();
    });
    
    /**
     * Очистка ресурсов капчи при размонтировании компонента.
     */
    onDestroy(() => {
        captchaInstance && captchaInstance.dispose();
    });
</script>

<div id={ containerId } class="captcha-container"></div>

<style>
    .captcha-container {
        position: relative;
        width: calc(100% - 5rem);
        color: var(--dark);
        margin: 1rem 0;
    }
</style>
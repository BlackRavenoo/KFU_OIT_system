export enum NotificationType {
    Success = 'success',
    Error = 'error',
    Warning = 'warning',
    Info = 'info'
}

/**
 * Показывает всплывающее уведомление.
 * Закрывается по ЛКМ, ПКМ, среднему клику и по контекстному меню.
 */
export function notification(message: string, type: NotificationType) {
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.textContent = message;
    el.style.opacity = '0';
    el.style.transform = 'translateY(-20px)';
    el.style.transition = 'opacity 0.4s, transform 0.4s';
    el.style.padding = '10px 20px';
    el.style.borderRadius = '5px';
    el.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    el.style.fontSize = '16px';
    el.style.cursor = 'pointer';
    el.style.userSelect = 'none';
    el.style.pointerEvents = 'auto';

    el.style.backgroundColor =
        type === NotificationType.Error   ? 'rgba(238, 80, 69, 0.92)'   :
        type === NotificationType.Success ? 'rgba(76,175,80,0.92)'    :
        type === NotificationType.Warning ? 'rgba(243, 215, 58, 0.92)' :
        type === NotificationType.Info    ? 'rgba(58, 160, 243, 0.92)'  :
        'rgba(60,60,60,0.92)';
    
    el.style.color =
        type === NotificationType.Error   ? '#ffeaea' :
        type === NotificationType.Success ? '#eaffea' :
        type === NotificationType.Warning ? '#fff7e0' :
        type === NotificationType.Info    ? '#e0f4ff' :
        '#f0f0f0';

    let container = document.getElementById('notificationContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notificationContainer';
        container.style.position = 'fixed';
        container.style.top = '1rem';
        container.style.right = '1rem';
        container.style.zIndex = '9999';
        container.style.pointerEvents = 'auto';
        document.body.appendChild(container);
    } else {
        try {
            container.style.pointerEvents = 'auto';
            if (container.closest && container.closest('button, [data-no-pointer]'))
                document.body.appendChild(container);
        } catch {}
    }

    container.appendChild(el);

    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let removeTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanupListeners = () => {
        el.removeEventListener('pointerdown', pointerdownHandler);
        el.removeEventListener('click', clickHandler);
        el.removeEventListener('auxclick', auxclickHandler);
        el.removeEventListener('contextmenu', contextmenuHandler);
    };

    const close = () => {
        if (showTimer) { clearTimeout(showTimer); showTimer = null; }
        if (hideTimer)  { clearTimeout(hideTimer);  hideTimer = null; }
        if (removeTimer){ clearTimeout(removeTimer); removeTimer = null; }
        try {
            el.style.opacity = '0';
            el.style.transform = 'translateY(-20px)';
        } catch {}
        cleanupListeners();
        el.remove();
    };

    const pointerdownHandler = (ev: PointerEvent) => {
        ev.stopPropagation();
        const b = (ev as PointerEvent & { button: number }).button;
        if (b === 0 || b === 1 || b === 2) {
            if (b === 2) ev.preventDefault();
            close();
        } else {
            ev.preventDefault();
        }
    };

    const clickHandler = (ev: MouseEvent) => {
        ev.stopPropagation();
        if (ev.button === 0) close();
        else ev.preventDefault();
    };

    const auxclickHandler = (ev: MouseEvent) => {
        ev.stopPropagation();
        if (ev.button === 1 || ev.button === 3) {
            ev.preventDefault();
            close();
        } else ev.preventDefault();
    };

    const contextmenuHandler = (ev: Event) => {
        ev.preventDefault();
        ev.stopPropagation();
        close();
    };

    el.addEventListener('pointerdown', pointerdownHandler);
    el.addEventListener('click', clickHandler);
    el.addEventListener('auxclick', auxclickHandler);
    el.addEventListener('contextmenu', contextmenuHandler);

    showTimer = setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        showTimer = null;
    }, 10);

    hideTimer = setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-20px)';
        hideTimer = null;
        removeTimer = setTimeout(() => {
            el.remove();
            removeTimer = null;
            cleanupListeners();
        }, 400);
    }, 3000);
}
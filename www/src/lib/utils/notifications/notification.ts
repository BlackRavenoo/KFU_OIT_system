export enum NotificationType {
    Success = 'success',
    Error = 'error',
    Warning = 'warning',
    Info = 'info'
}

/**
 * Показывает всплывающее уведомление.
 */
export function notification(message: string, type: NotificationType) {
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.textContent = message;
    el.style.position = 'fixed';
    el.style.top = '20px';
    el.style.right = '20px';
    el.style.zIndex = '1000';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-20px)';
    el.style.transition = 'opacity 0.4s, transform 0.4s';
    el.style.padding = '10px 20px';
    el.style.borderRadius = '5px';
    el.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    el.style.fontSize = '16px';
    el.style.backgroundColor =
        type === NotificationType.Error   ? 'rgba(238, 80, 69, 0.92)'   : 
        type === NotificationType.Success ? 'rgba(76,175,80,0.92)'   :
        type === NotificationType.Warning ? 'rgba(243, 215, 58, 0.92)'   :
        type === NotificationType.Info    ? 'rgba(58, 160, 243, 0.92)'  : 
        'rgba(60,60,60,0.92)';
    
    el.style.color =
        type === NotificationType.Error   ? '#ffeaea' :
        type === NotificationType.Success ? '#eaffea' :
        type === NotificationType.Warning ? '#fff7e0' :
        type === NotificationType.Info    ? '#e0f4ff' :
        '#f0f0f0';

    document.body.appendChild(el);

    setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
    }, 10);

    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-20px)';
        setTimeout(() => el.remove(), 400);
    }, 3000);
}
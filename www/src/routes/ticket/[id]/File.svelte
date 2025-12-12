<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    
    export let name: string;
    export let url: string;
    export let ext: string;
    export let colorClass: string = '';
    export let editing: boolean = false;

    const uid = Math.random().toString(36).slice(2,9);
    const dispatch = createEventDispatcher();

    function downloadFile(u: string) {
        window.open(u, '_blank', 'noopener');
    }

    function fileIconSvg(eRaw: string): string {
        const e = (eRaw || '').toLowerCase();
        const W = 64;
        const H = 80;
        const F = 18;
        if (e === 'pdf') {
            return `
                <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img">
                    <defs>
                        <linearGradient id="g-pdf-${uid}" x1="0" x2="1">
                            <stop offset="0" stop-color="#ef2d4a"/>
                            <stop offset="1" stop-color="#cf1236"/>
                        </linearGradient>
                        <mask id="m-pdf-${uid}">
                            <rect x="0" y="0" width="${W}" height="${H}" rx="6" ry="6" fill="white"/>
                            <!-- вырезаем треугольник в маске (черный = прозрачный) -->
                            <polygon points="${W-F},0 ${W},0 ${W},${F}" fill="black"/>
                        </mask>
                    </defs>

                    <!-- основной прямоугольник с вырезанным уголком через маску -->
                    <rect x="0" y="0" width="${W}" height="${H}" rx="6" fill="url(#g-pdf-${uid})" mask="url(#m-pdf-${uid})"/>
                    <!-- складка поверх (визуальный отгиб) -->
                    <path d="M ${W-F} 0 L ${W} ${F} L ${W-F} ${F} Z" fill="#b10f33" opacity="0.95"/>

                    <text x="${W/2}" y="48" font-size="14" font-weight="700" text-anchor="middle" fill="#fff" font-family="Segoe UI, Roboto, Arial, sans-serif">PDF</text>
                    <g fill="rgba(255,255,255,0.18)">
                        <rect x="10" y="56" width="44" height="4" rx="1.5"/>
                        <rect x="10" y="64" width="30" height="4" rx="1.5"/>
                    </g>
                </svg>`;
        } else if (e === 'doc' || e === 'docx') {
            return `
                <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img">
                    <defs>
                        <linearGradient id="g-doc-${uid}" x1="0" x2="1">
                            <stop offset="0" stop-color="#17b6ec"/>
                            <stop offset="1" stop-color="#038fc0"/>
                        </linearGradient>
                        <mask id="m-doc-${uid}">
                            <rect x="0" y="0" width="${W}" height="${H}" rx="6" ry="6" fill="white"/>
                            <polygon points="${W-F},0 ${W},0 ${W},${F}" fill="black"/>
                        </mask>
                    </defs>

                    <rect x="0" y="0" width="${W}" height="${H}" rx="6" fill="url(#g-doc-${uid})" mask="url(#m-doc-${uid})"/>
                    <path d="M ${W-F} 0 L ${W} ${F} L ${W-F} ${F} Z" fill="#0b87b0" opacity="0.95"/>

                    <text x="${W/2}" y="48" font-size="13" font-weight="700" text-anchor="middle" fill="#fff" font-family="Segoe UI, Roboto, Arial, sans-serif">DOC</text>
                    <g fill="rgba(255,255,255,0.18)">
                        <rect x="10" y="64" width="36" height="4" rx="1.5"/>
                        <rect x="10" y="56" width="36" height="3" rx="1"/>
                    </g>
                </svg>`;
        } else if (e === 'ppt' || e === 'pptx') {
            return `
                <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img">
                    <defs>
                        <linearGradient id="g-ppt-${uid}" x1="0" x2="1">
                            <stop offset="0" stop-color="#ff8a3d"/>
                            <stop offset="1" stop-color="#e75f10"/>
                        </linearGradient>
                        <mask id="m-ppt-${uid}">
                            <rect x="0" y="0" width="${W}" height="${H}" rx="6" ry="6" fill="white"/>
                            <polygon points="${W-F},0 ${W},0 ${W},${F}" fill="black"/>
                        </mask>
                    </defs>

                    <rect x="0" y="0" width="${W}" height="${H}" rx="6" fill="url(#g-ppt-${uid})" mask="url(#m-ppt-${uid})"/>
                    <path d="M ${W-F} 0 L ${W} ${F} L ${W-F} ${F} Z" fill="#d35b12" opacity="0.95"/>

                    <text x="${W/2}" y="48" font-size="13" font-weight="700" text-anchor="middle" fill="#fff" font-family="Segoe UI, Roboto, Arial, sans-serif">PPT</text>
                    <g fill="rgba(255,255,255,0.18)">
                        <rect x="10" y="56" width="20" height="10" rx="1.5"/>
                        <rect x="32" y="56" width="22" height="10" rx="1.5"/>
                    </g>
                </svg>`;
        } else {
            return `
                <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img">
                    <defs>
                        <mask id="m-def-${uid}">
                            <rect x="0" y="0" width="${W}" height="${H}" rx="6" ry="6" fill="white"/>
                            <polygon points="${W-F},0 ${W},0 ${W},${F}" fill="black"/>
                        </mask>
                    </defs>

                    <rect x="0" y="0" width="${W}" height="${H}" rx="6" fill="#6b7280" mask="url(#m-def-${uid})"/>
                    <path d="M ${W-F} 0 L ${W} ${F} L ${W-F} ${F} Z" fill="#565b63" opacity="0.95"/>

                    <text x="${W/2}" y="48" font-size="12" font-weight="700" text-anchor="middle" fill="#fff" font-family="Segoe UI, Roboto, Arial, sans-serif">TXT</text>
                    <g fill="rgba(255,255,255,0.18)">
                        <rect x="10" y="56" width="44" height="3" rx="1"/>
                        <rect x="10" y="62" width="36" height="3" rx="1"/>
                        <rect x="10" y="68" width="28" height="3" rx="1"/>
                    </g>
                </svg>`;
        }
    }
</script>

<button
    class="file-card { colorClass }"
    type="button"
    on:click={e => {
        if (editing) {
            e.preventDefault();
            dispatch('click', e);
        } else downloadFile(url);
    }}
    on:keydown={ (e) => { 
        if (e.key === 'Enter' || e.key === ' ') { 
            e.preventDefault(); 
            if (editing) dispatch('click', e);
            else downloadFile(url);
        } 
    } }
    aria-label={ `Скачать файл ${ name } `}
>
    <div class="file-icon" aria-hidden="true">
        {@html fileIconSvg(ext)}
    </div>
    <div class="file-name" title={ name }>{ name }</div>
</button>

<style>
    .file-card {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        width: 133px;
        height: 133px;
        padding: 0.6rem 0.6rem;
        border-radius: 12px;
        cursor: pointer;
        text-align: center;
        border: 2px solid transparent;
        background: transparent;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        color: inherit;
        margin-top: 0;
    }

    .file-card:focus { 
        outline: 3px solid rgba(0,0,0,0.06); 
    }

    .file-icon {
        width: 64px;
        height: 64px;
        border-radius: 10px;
        display:flex;
        align-items:center;
        justify-content:center;
        flex-shrink:0;
        background: transparent;
    }

    .file-icon svg { 
        width:64px; 
        height:80px; 
        display:block; 
    }

    .file-name {
        position: relative;
        top: .5rem;
        font-size: 0.87rem;
        line-height: 1.1;
        max-width: 110px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: inherit;
    }

    .file-pdf { 
        --file-color: #e11d48; 
        color: var(--file-color); 
        border-color: rgba(225,29,72,0.18); 
        background: rgba(225,29,72,0.04); 
    }

    .file-doc { 
        --file-color: #0ea5e9; 
        color: var(--file-color); 
        border-color: rgba(14,165,233,0.18); 
        background: rgba(14,165,233,0.04); 
    }

    .file-ppt { 
        --file-color: #f97316; 
        color: var(--file-color); 
        border-color: rgba(249,115,22,0.18); 
        background: rgba(249,115,22,0.04); 
    }

    .file-default { 
        --file-color: var(--low); 
        color: var(--file-color); 
        border-color: rgba(107,114,128,0.18); 
        background: rgba(107,114,128,0.04); 
    }

    @media (max-width: 900px) {
        .file-card { 
            width: 100px; 
            height: 108px; 
            padding: 0.45rem; 
        }

        .attachment-img-button { 
            width: 100px; 
            height: 72px; 
        }

        .file-icon { 
            width: 56px; 
            height: 64px; 
        }

        .file-icon svg { 
            width:56px; 
            height:72px; 
        }

        .file-name { 
            max-width: 90px; 
            font-size: 0.82rem; 
        }
    }
</style>
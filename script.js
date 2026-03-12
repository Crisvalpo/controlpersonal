/**
 * CONTROL PERSONAL - LÓGICA DE APLICACIÓN
 * Maneja la conexión con Google Sheets y la visualización de datos.
 */

// URL del archivo JSON en Google Drive (Debe ser el ID del archivo exportado)
const JSON_URL_DRIVE = 'https://drive.google.com/uc?export=download&id=1_z3eo-JW_YsLdbB4pwuE65D6pjI1S6UZ';

// Proxies CORS disponibles (se probarán en orden como en buscarspool)
const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://cors.sh/'
];

let rawData = [];
let currentView = 'all';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupEventListeners();
    updatePrintDate();

    // Intentar cargar datos
    await fetchData();
}

function setupEventListeners() {
    // Búsqueda
    document.getElementById('main-search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        renderData(filterData(term));
    });

    // Navegación Sidebar
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelector('.nav-btn.active').classList.remove('active');
            btn.classList.add('active');
            currentView = btn.dataset.view;
            renderData(rawData);
        });
    });

    // Botón Imprimir
    document.getElementById('btn-print').addEventListener('click', () => {
        window.print();
    });
}

function updatePrintDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    document.getElementById('print-date').innerText = `Fecha de emisión: ${now.toLocaleDateString('es-ES', options)}`;
}

async function fetchData() {
    const loader = document.getElementById('main-loader');
    console.log('🔄 Iniciando carga de datos desde Drive: ' + JSON_URL_DRIVE);

    // Intentar acceso directo
    try {
        const response = await fetch(`${JSON_URL_DRIVE}&t=${Date.now()}`);
        if (response.ok) {
            rawData = await response.json();
            renderData(rawData);
            loader.style.display = 'none';
            console.log('✅ Acceso directo exitoso');
            return;
        }
    } catch (e) {
        console.log('⚠️ Acceso directo bloqueado (CORS). Intentando proxies...');
    }

    // Configuración de proxies
    const proxies = [
        {
            name: 'AllOrigins JSON',
            url: 'https://api.allorigins.win/get?url=',
            process: async (res) => {
                const json = await res.json();
                return JSON.parse(json.contents);
            }
        },
        {
            name: 'CorsProxy.io',
            url: 'https://corsproxy.io/?',
            process: async (res) => await res.json()
        },
        {
            name: 'AllOrigins Raw',
            url: 'https://api.allorigins.win/raw?url=',
            process: async (res) => await res.json()
        }
    ];

    for (const proxy of proxies) {
        try {
            console.log(`📡 Probando con proxy: ${proxy.name}`);
            const targetUrl = JSON_URL_DRIVE + '&t=' + Date.now();
            const finalUrl = proxy.url + encodeURIComponent(targetUrl);

            const res = await fetch(finalUrl);
            if (res.ok) {
                rawData = await proxy.process(res);
                if (Array.isArray(rawData) && rawData.length > 0) {
                    renderData(rawData);
                    console.log(`✅ Carga exitosa vía ${proxy.name}`);
                    loader.style.display = 'none';
                    return;
                }
            }
            throw new Error('Respuesta no válida');
        } catch (err) {
            console.warn(`❌ Falló ${proxy.name}:`, err.message);
        }
    }

    // Si todo falla
    loader.innerHTML = `
        <div style="padding: 30px; text-align: center; background: rgba(255,255,255,0.1); border-radius: 20px; backdrop-filter: blur(10px);">
            <p style="color:#ff4d4d; font-size: 1.2rem; font-weight: bold; margin-bottom: 10px;">❌ Error de conexión</p>
            <p style="font-size: 0.9rem; color: #a1a1a1; margin-bottom: 20px;">
                No pudimos obtener los datos. Verifica que el archivo en Drive esté compartido como "Cualquiera con el enlace".
            </p>
            <button onclick="location.reload()" style="background: linear-gradient(135deg, #2563eb, #0ea5e9); color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
                Reintentar conexión
            </button>
        </div>
    `;
}

function filterData(term) {
    if (!term) return rawData;
    return rawData.filter(p =>
        String(p.NOMBRE).toLowerCase().includes(term) ||
        String(p.RUT).toLowerCase().includes(term) ||
        String(p.ROL).toLowerCase().includes(term) ||
        String(p.CATEGORIA).toLowerCase().includes(term)
    );
}

function renderData(data) {
    const container = document.getElementById('cards-container');
    container.innerHTML = '';

    updateStats(data);

    if (currentView === 'all') {
        renderListView(data, container);
    } else {
        // En vista resumen, mostrar AMBOS para el informe completo
        renderSummaryView(data, container);

        // Separador para impresión
        const hr = document.createElement('hr');
        hr.className = 'print-divider';
        container.appendChild(hr);

        // Título opcional para el detalle
        const detailTitle = document.createElement('h2');
        detailTitle.innerText = "Detalle de Cuadrillas";
        detailTitle.style.margin = "20px 0";
        detailTitle.style.color = "var(--text)";
        container.appendChild(detailTitle);

        renderListView(data, container);
    }
}

function updateStats(data) {
    const statsContainer = document.getElementById('header-stats');
    const hhCount = data.filter(p => !p.CONTABLE_HH || String(p.CONTABLE_HH).toUpperCase() === 'SI').length;
    statsContainer.innerHTML = `
        <div class="stat-pill">Total: ${data.length} personas</div>
        <div class="stat-pill">HH Contables: ${hhCount}</div>
    `;
}

function renderListView(data, container) {
    // Agrupar por CUADRILLA
    const groups = data.reduce((acc, curr) => {
        const group = curr.CUADRILLA || 'Sin Cuadrilla';
        if (!acc[group]) acc[group] = [];
        acc[group].push(curr);
        return acc;
    }, {});

    Object.entries(groups).forEach(([groupName, members]) => {
        const groupSection = document.createElement('div');
        groupSection.className = 'group-section';
        groupSection.innerHTML = `<h2 class="group-title">📍 ${groupName} <span>(${members.length})</span></h2>`;

        const grid = document.createElement('div');
        grid.className = 'personnel-grid';

        members.forEach(p => {
            const isNoHH = p.CONTABLE_HH && String(p.CONTABLE_HH).toUpperCase() === 'NO';
            const card = document.createElement('div');
            card.className = `person-card ${isNoHH ? 'no-hh' : ''}`;
            card.innerHTML = `
                <div class="card-top">
                    <span class="role-tag">${p.ROL || '---'}</span>
                    <span class="cat-label">${p.CATEGORIA || 'General'}</span>
                </div>
                <div class="person-details">
                    <h3 class="person-name">${p.NOMBRE}</h3>
                    <p class="person-rut">RUT: ${p.RUT || '---'}</p>
                    ${isNoHH ? '<span class="hh-badge">NO CONTABLE HH</span>' : ''}
                </div>
            `;
            grid.appendChild(card);
        });

        groupSection.appendChild(grid);
        container.appendChild(groupSection);
    });
}

function renderSummaryView(data, container) {
    // Columnas: ITEM | SUBTOTAL(TODOS) | NO CONTABLE HH | CONTABLE HH
    const categories = Array.from(new Set(data.map(p => p.CATEGORIA || 'OTRAS'))).sort();

    const stats = categories.map(cat => {
        const catMembers = data.filter(p => (p.CATEGORIA || 'OTRAS') === cat);
        const subtotal = catMembers.length;
        const noContable = catMembers.filter(p => p.CONTABLE_HH && String(p.CONTABLE_HH).toUpperCase() === 'NO').length;
        const contable = subtotal - noContable;
        return { cat, subtotal, noContable, contable };
    });

    const totalSubtotal = data.length;
    const totalNoContable = data.filter(p => p.CONTABLE_HH && String(p.CONTABLE_HH).toUpperCase() === 'NO').length;
    const totalContable = totalSubtotal - totalNoContable;

    const table = document.createElement('table');
    table.className = 'summary-table hh-summary';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Ítem / Categoría</th>
                <th>Subtotal</th>
                <th>No Contable HH</th>
                <th>Contables (Cobrar)</th>
            </tr>
        </thead>
        <tbody>
            ${stats.map(s => `
                <tr>
                    <td><strong>${s.cat}</strong></td>
                    <td>${s.subtotal}</td>
                    <td>${s.noContable > 0 ? `<span class="red-text">${s.noContable}</span>` : '0'}</td>
                    <td class="bold-text">${s.contable}</td>
                </tr>
            `).join('')}
        </tbody>
        <tfoot class="total-row">
            <tr>
                <td>TOTAL DOTACIÓN</td>
                <td>${totalSubtotal}</td>
                <td>${totalNoContable}</td>
                <td class="final-count">${totalContable}</td>
            </tr>
        </tfoot>
    `;
    container.appendChild(table);
}

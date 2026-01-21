// Konfigurasi Spreadsheet
const SPREADSHEET_ID = '15WY6r-LWkxmBn0agPJdM7oEgkOUHZghNHxfGWATGNHM';
const SHEET_TABS = [
    "DN1", "DN2", "GK1", "GK2", "GM", "GT", "JT", "KG1", "KG2", 
    "KT", "MJ", "MG", "NG", "PA", "UH1", "UH2", "TR", "WB", 
    "Labkes", "DINKES", "RSUD", "RSP"
];

let ALL_DATA = [];
let DETECTED_YEARS = [];
let charts = {}; // Menyimpan instance chart

document.addEventListener('DOMContentLoaded', () => {
    // 1. Jalankan Animasi Intro Splash Screen
    startSplashScreenSequence();

    // 2. Setup Event Listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Event Dropdown Tahun Global
    document.getElementById('yearFilter').addEventListener('change', function() {
        const selectedYear = parseInt(this.value);
        updateDynamicCharts(selectedYear);
    });

    // Event Dropdown Filter Unit (Top 5)
    document.getElementById('unitFilterTop5').addEventListener('change', function() {
        const selectedYear = parseInt(document.getElementById('yearFilter').value);
        renderTop5(selectedYear);
    });
}

// ... (Kode lain tetap)

// UPDATE: Samakan nama fungsi dengan rekapan
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    // Toggle class active
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

// ... (Sisa kode tetap)

// === LOGIKA SPLASH SCREEN & DATA FETCHING ===
function startSplashScreenSequence() {
    const splashText = document.getElementById('splash-text');
    
    // Tahap 1: Tampilkan Intro (Sudah via CSS)
    
    // Tahap 2: Setelah 1.5 detik, ubah teks jadi "Sinkronisasi..." dan mulai fetch data
    setTimeout(() => {
        splashText.innerText = "Sinkronisasi Data Pegawai...";
        fetchAllData(); // Mulai ambil data
    }, 1500);
}

async function fetchAllData() {
    try {
        // Ambil data dari semua tab secara paralel
        let promises = SHEET_TABS.map(sheetName => {
            const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
            return fetch(url)
                .then(res => res.text())
                .then(text => {
                    const json = JSON.parse(text.substring(47).slice(0, -2));
                    return normalizeData(json.table.rows, json.table.cols, sheetName);
                });
        });

        const results = await Promise.all(promises);
        ALL_DATA = results.flat();
        
        // Hapus data kosong
        ALL_DATA = ALL_DATA.filter(item => item.nama !== '-' && item.nama !== '');

        // Setup UI Filters
        setupYearFilter();
        setupTop5Filter();
        
        // Update Info Data
        document.getElementById('totalDataInfo').innerText = `Total: ${ALL_DATA.length} Pegawai dari ${SHEET_TABS.length} Unit Kerja`;

        // Render Grafik Awal
        const latestYear = DETECTED_YEARS[DETECTED_YEARS.length - 1];
        updateDynamicCharts(latestYear);
        renderTrendChart(); 

        // TAHAP 3: Data Selesai, Sembunyikan Splash Screen
        setTimeout(() => {
            document.getElementById('splash-screen').classList.add('hidden');
        }, 1000); // Beri jeda sedikit agar user melihat teks "Selesai" jika perlu

    } catch (error) {
        console.error("Error:", error);
        document.getElementById('splash-text').innerText = "Gagal memuat data. Cek koneksi.";
        alert("Gagal memuat data. Cek koneksi internet anda.");
    }
}

// === PARSING DATA ===
function normalizeData(rows, cols, sheetName) {
    const colIdx = {
        nama: findCol(cols, ["nama", "name"]),
        jabatan: findCol(cols, ["jabatan", "posisi"])
    };

    let akYearMap = {}; 
    cols.forEach((col, index) => {
        if (col && col.label) {
            const label = col.label.toLowerCase();
            const matchYear = label.match(/(\d{4})/);
            const hasKeyword = label.includes("ak") || label.includes("total") || label.includes("nilai");

            if (hasKeyword && matchYear) {
                const year = parseInt(matchYear[1]);
                if (year >= 2023) {
                    akYearMap[year] = index;
                    if (!DETECTED_YEARS.includes(year)) DETECTED_YEARS.push(year);
                }
            }
        }
    });

    return rows.map(row => {
        const c = row.c;
        if (!c) return null;

        let akValues = {};
        for (const [year, idx] of Object.entries(akYearMap)) {
            let val = c[idx] ? (c[idx].v || c[idx].f || 0) : 0;
            if (typeof val === 'string') val = parseFloat(val.replace(',', '.'));
            akValues[year] = val || 0;
        }

        return {
            unit: sheetName,
            nama: getVal(c, colIdx.nama),
            jabatan: getVal(c, colIdx.jabatan),
            akData: akValues
        };
    }).filter(i => i !== null);
}

// === SETUP UI HELPERS ===
function setupYearFilter() {
    DETECTED_YEARS.sort((a, b) => a - b);
    const select = document.getElementById('yearFilter');
    select.innerHTML = "";
    
    DETECTED_YEARS.forEach(year => {
        let option = document.createElement("option");
        option.value = year;
        option.innerText = `Tahun ${year}`;
        select.appendChild(option);
    });

    select.value = DETECTED_YEARS[DETECTED_YEARS.length - 1];
}

function setupTop5Filter() {
    const select = document.getElementById('unitFilterTop5');
    SHEET_TABS.forEach(tab => {
        let option = document.createElement("option");
        option.value = tab;
        option.innerText = tab;
        select.appendChild(option);
    });
}

function updateDynamicCharts(year) {
    renderTop5(year);
    renderUnitChart(year);
    renderJabatanChart();
}

// === CHART FUNCTIONS ===

// 1. TOP 5 CHART
function renderTop5(year) {
    const ctx = document.getElementById("topFiveChart").getContext("2d");
    const unitFilter = document.getElementById('unitFilterTop5').value;
    
    let sourceData = ALL_DATA;
    if (unitFilter !== "ALL") {
        sourceData = ALL_DATA.filter(item => item.unit === unitFilter);
    }

    let sorted = [...sourceData].sort((a, b) => (b.akData[year] || 0) - (a.akData[year] || 0));
    let top5 = sorted.slice(0, 5);

    const labels = top5.map(d => d.nama); 
    const values = top5.map(d => d.akData[year] || 0);

    if (charts.top5) charts.top5.destroy();

    charts.top5 = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Total AK ${year}`,
                data: values,
                backgroundColor: unitFilter === "ALL" ? 'rgba(78, 115, 223, 0.8)' : 'rgba(28, 200, 138, 0.8)',
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true } }
        }
    });
}

// 2. UNIT CHART
function renderUnitChart(year) {
    const ctx = document.getElementById("unitChart").getContext("2d");

    let unitStats = {};
    ALL_DATA.forEach(d => {
        if (!unitStats[d.unit]) unitStats[d.unit] = { sum: 0, count: 0 };
        let val = d.akData[year] || 0;
        unitStats[d.unit].sum += val;
        unitStats[d.unit].count += 1;
    });

    const labels = Object.keys(unitStats);
    const values = labels.map(u => (unitStats[u].sum / unitStats[u].count).toFixed(2));

    if (charts.unit) charts.unit.destroy();

    charts.unit = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Rata-rata AK (${year})`,
                data: values,
                backgroundColor: '#36b9cc',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

// 3. JABATAN CHART
function renderJabatanChart() {
    const ctx = document.getElementById("jabatanChart").getContext("2d");

    let counts = {};
    ALL_DATA.forEach(d => {
        let j = d.jabatan ? d.jabatan.trim() : "Lainnya";
        if (j === "" || j === "-") j = "Lainnya";
        counts[j] = (counts[j] || 0) + 1;
    });

    let sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    let labels = [], data = [];
    
    sorted.slice(0, 7).forEach(item => { labels.push(item[0]); data.push(item[1]); });
    
    let other = sorted.slice(7).reduce((acc, curr) => acc + curr[1], 0);
    if (other > 0) { labels.push("Lainnya"); data.push(other); }

    if (charts.jabatan) charts.jabatan.destroy();

    charts.jabatan = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796', '#5a5c69', '#2c9faf']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
        }
    });
}

// 4. TREND CHART
function renderTrendChart() {
    const ctx = document.getElementById("trendChart").getContext("2d");

    let averages = DETECTED_YEARS.map(year => {
        let sum = 0, count = 0;
        ALL_DATA.forEach(d => {
            if (d.akData[year]) {
                sum += d.akData[year];
                count++;
            }
        });
        return count > 0 ? (sum / count).toFixed(2) : 0;
    });

    if (charts.trend) charts.trend.destroy();

    charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: DETECTED_YEARS,
            datasets: [{
                label: 'Rata-rata Instansi',
                data: averages,
                borderColor: '#f6c23e',
                backgroundColor: 'rgba(246, 194, 62, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function findCol(cols, keys) {
    return cols.findIndex(c => c && keys.some(k => c.label.toLowerCase().includes(k)));
}
function getVal(c, idx) {
    return (idx !== -1 && c[idx]) ? (c[idx].v || c[idx].f || '-') : '-';
}



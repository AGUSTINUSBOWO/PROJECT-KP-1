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
    fetchAllData();

    // Event saat dropdown Tahun Global berubah
    document.getElementById('yearFilter').addEventListener('change', function() {
        const selectedYear = parseInt(this.value);
        updateDynamicCharts(selectedYear);
    });

    // Event saat dropdown Filter Unit (Top 5) berubah
    document.getElementById('unitFilterTop5').addEventListener('change', function() {
        const selectedYear = parseInt(document.getElementById('yearFilter').value);
        // Hanya render ulang chart Top 5
        renderTop5(selectedYear);
    });
});

async function fetchAllData() {
    const loading = document.getElementById('loading');
    
    try {
        // Ambil data dari semua tab secara paralel
        let promises = SHEET_TABS.map(sheetName => {
            const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
            return fetch(url)
                .then(res => res.text())
                .then(text => {
                    const json = JSON.parse(text.substring(47).slice(0, -2));
                    // Kirim nama sheet juga agar bisa dikelompokkan per Unit
                    return normalizeData(json.table.rows, json.table.cols, sheetName);
                });
        });

        const results = await Promise.all(promises);
        ALL_DATA = results.flat();
        
        // Hapus data kosong
        ALL_DATA = ALL_DATA.filter(item => item.nama !== '-' && item.nama !== '');

        // Setup UI Filters
        setupYearFilter();
        setupTop5Filter(); // <-- FUNGSI BARU UNTUK ISI DROPDOWN UNIT
        
        // Update Info Data
        document.getElementById('totalDataInfo').innerText = `Total: ${ALL_DATA.length} Pegawai dari ${SHEET_TABS.length} Unit Kerja`;

        // Render Grafik Awal (Tahun Terakhir)
        const latestYear = DETECTED_YEARS[DETECTED_YEARS.length - 1];
        updateDynamicCharts(latestYear);
        renderTrendChart(); // Grafik Trend Global (Semua Tahun)

    } catch (error) {
        console.error("Error:", error);
        alert("Gagal memuat data. Cek koneksi.");
    } finally {
        loading.classList.add('hidden');
    }
}

// === PARSING DATA ===
function normalizeData(rows, cols, sheetName) {
    // Cari index kolom
    const colIdx = {
        nama: findCol(cols, ["nama", "name"]),
        jabatan: findCol(cols, ["jabatan", "posisi"])
    };

    // Cari Kolom Tahun (misal: "AK 2023", "Total 2024")
    let akYearMap = {}; 
    cols.forEach((col, index) => {
        if (col && col.label) {
            const label = col.label.toLowerCase();
            const matchYear = label.match(/(\d{4})/);
            // Keyword pencarian kolom angka kredit
            const hasKeyword = label.includes("ak") || label.includes("total") || label.includes("nilai");

            if (hasKeyword && matchYear) {
                const year = parseInt(matchYear[1]);
                if (year >= 2023) { // Filter sesuai request: mulai 2023
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
            unit: sheetName, // Nama Tab (Unit Kerja)
            nama: getVal(c, colIdx.nama), // Nama Lengkap
            jabatan: getVal(c, colIdx.jabatan),
            akData: akValues
        };
    }).filter(i => i !== null);
}

// === SETUP UI ===
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

    // Pilih tahun terakhir otomatis
    select.value = DETECTED_YEARS[DETECTED_YEARS.length - 1];
}

// FUNGSI BARU: ISI DROPDOWN UNIT FILTER
function setupTop5Filter() {
    const select = document.getElementById('unitFilterTop5');
    // Jangan hapus opsi pertama "Semua Unit"
    
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

// === 1. TOP 5 CHART (FULL NAME + FILTER UNIT) ===
function renderTop5(year) {
    const ctx = document.getElementById("topFiveChart").getContext("2d");
    const unitFilter = document.getElementById('unitFilterTop5').value;
    
    // 1. Filter Data Berdasarkan Unit (Jika user memilih selain "ALL")
    let sourceData = ALL_DATA;
    if (unitFilter !== "ALL") {
        sourceData = ALL_DATA.filter(item => item.unit === unitFilter);
    }

    // 2. Urutkan berdasarkan AK tahun terpilih
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
                // Jika filter unit aktif, ganti warna jadi hijau, jika all jadi biru
                backgroundColor: unitFilter === "ALL" ? 'rgba(78, 115, 223, 0.8)' : 'rgba(28, 200, 138, 0.8)',
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y', // Horizontal
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { beginAtZero: true }
            }
        }
    });
}

// === 2. CHART PER TAB / UNIT KERJA ===
function renderUnitChart(year) {
    const ctx = document.getElementById("unitChart").getContext("2d");

    // Hitung Rata-rata per Unit (Tab)
    let unitStats = {};
    ALL_DATA.forEach(d => {
        if (!unitStats[d.unit]) unitStats[d.unit] = { sum: 0, count: 0 };
        // Hanya hitung jika data tahun tersebut ada
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
                backgroundColor: '#1cc88a',
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

// === 3. SEBARAN JABATAN (REAL DATA) ===
function renderJabatanChart() {
    const ctx = document.getElementById("jabatanChart").getContext("2d");

    let counts = {};
    ALL_DATA.forEach(d => {
        let j = d.jabatan ? d.jabatan.trim() : "Lainnya";
        if (j === "" || j === "-") j = "Lainnya";
        counts[j] = (counts[j] || 0) + 1;
    });

    // Urutkan dan ambil Top 7, sisanya "Lainnya"
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
                backgroundColor: [
                    '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', 
                    '#858796', '#5a5c69', '#2c9faf'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
        }
    });
}

// === 4. TREND GLOBAL ===
function renderTrendChart() {
    const ctx = document.getElementById("trendChart").getContext("2d");

    // Hitung rata-rata seluruh instansi per tahun
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

// Helper
function findCol(cols, keys) {
    return cols.findIndex(c => c && keys.some(k => c.label.toLowerCase().includes(k)));
}
function getVal(c, idx) {
    return (idx !== -1 && c[idx]) ? (c[idx].v || c[idx].f || '-') : '-';
}
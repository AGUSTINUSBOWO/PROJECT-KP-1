// Konfigurasi URL Google Apps Script & ID Spreadsheet
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbykpDdk0JXHd88PqQPrGMcT1RATR50Sl2iS1RYoP8tmwytzZQx9uZ5wQfb6KNfblYDE/exec"; 
const SPREADSHEET_ID_KUOTA = "1XMTaUh51lSltPwx0uAdwmm6IsPybTfzqu74cI1eejqY";

// DAFTAR NAMA SHEET (Harus SAMA PERSIS dengan di Google Spreadsheet)
const TABS = [
    "DN1", "DN2", "GK1", "GK2", "GM", "GT", "JT", "KG1", "KG2",
    "KT", "MJ", "MG", "NG", "PA", "UH1", "UH2", "TR", "WB","DINKES", "RSUD", "RSP"
];

let allData = {};
let currentTab = TABS[0];

// Variable Global untuk Chart
let chartInstanceBar = null;
let chartInstancePie = null;
let chartInstanceHorizontal = null; // Tambahan untuk grafik jabatan

// ================= 1. INISIALISASI =================
document.addEventListener('DOMContentLoaded', () => {
    // LOGIKA HALAMAN TABEL
    if (document.getElementById('dataTable')) {
        generateTabs();
        loadDataForTable();
        document.getElementById('tableSearch').addEventListener('keyup', (e) => {
            renderTable(currentTab, e.target.value);
        });
    }

    // LOGIKA HALAMAN STATISTIK
    if (document.getElementById('barChart')) {
        populateFilterDropdown(); 
        loadDataForStats();       
    }
});

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}
document.querySelector('.sidebar-overlay').addEventListener('click', toggleSidebar);

// ================= 2. CORE DATA FETCHING =================
async function fetchAllData() {
    const promises = TABS.map(tab => 
        fetch(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID_KUOTA}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`)
        .then(res => {
            if (!res.ok) throw new Error(`Gagal akses sheet: ${tab}`);
            return res.text();
        })
        .then(text => {
            const jsonString = text.substring(47).slice(0, -2);
            const json = JSON.parse(jsonString);
            return { tab: tab, rows: json.table.rows };
        })
        .catch(err => {
            console.warn(`Melewati sheet "${tab}" karena error.`, err);
            return null;
        })
    );
    
    const results = await Promise.all(promises);
    return results.filter(item => item !== null);
}

function processDataResults(results) {
    results.forEach(res => {
        const processedRows = res.rows.map((r, idx) => {
            const c = r.c;
            if(!c || !c[2]) return null;
            const rawJabatan = c[2]?.v || '';
            if (rawJabatan.toLowerCase().includes('jumlah') || rawJabatan === '') return null;
            
            // Deteksi Jenjang (PENTING UNTUK STATISTIK)
            let jenjang = "Lainnya/Umum";
            const low = rawJabatan.toLowerCase();
            if(low.includes('pertama')) jenjang = "Ahli Pertama";
            else if(low.includes('muda')) jenjang = "Ahli Muda";
            else if(low.includes('madya')) jenjang = "Ahli Madya";
            else if(low.includes('utama')) jenjang = "Ahli Utama";
            else if(low.includes('terampil')) jenjang = "Terampil";
            else if(low.includes('mahir')) jenjang = "Mahir";
            else if(low.includes('penyelia')) jenjang = "Penyelia";
            else if(low.includes('pemula')) jenjang = "Pemula";

            const rawKuota = c[3]?.v;
            let finalKuota = null; 
            if (rawKuota !== null && rawKuota !== undefined && rawKuota !== "") {
                finalKuota = parseInt(rawKuota);
            }

            return {
                id: idx + 1, excelRow: idx + 2,
                jabatan: rawJabatan, jenjang: jenjang,
                kuota: finalKuota 
            };
        }).filter(i => i);
        allData[res.tab] = processedRows;
    });
}

// ================= 3. LOGIKA HALAMAN TABEL (Tetap Sama) =================
async function loadDataForTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">Sedang mengambil data terbaru...</td></tr>`;
    try {
        const results = await fetchAllData();
        processDataResults(results);
        if (!allData[currentTab] && results.length > 0) currentTab = results[0].tab;
        renderTable(currentTab);
        generateTabs(); 
    } catch (e) { 
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Gagal koneksi.</td></tr>`; 
    }
}

function renderTable(tab, search = "") {
    const tbody = document.getElementById('tableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const data = allData[tab] || [];
    const filtered = data.filter(item => item.jabatan.toLowerCase().includes(search.toLowerCase()));

    if (filtered.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="5" class="text-center">Data tidak ditemukan</td></tr>`; return; 
    }

    filtered.forEach((item, index) => {
        let displayKuota = item.kuota !== null ? `<span class="badge-kuota">${item.kuota}</span>` : `<span style="color:#ccc;">-</span>`;
        const paramKuota = item.kuota !== null ? item.kuota : "null"; 

        tbody.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td style="font-weight:600;">${item.jabatan}</td>
                <td><span class="badge-jenjang">${item.jenjang}</span></td>
                <td class="text-center">${displayKuota}</td>
                <td class="text-center">
                    <button class="btn-edit" onclick="openEditModal('${tab}', ${item.excelRow}, '${item.jabatan}', ${paramKuota})"><i class="fas fa-edit"></i> Edit</button>
                </td>
            </tr>`;
    });
}

function generateTabs() {
    const container = document.getElementById('tabContainer');
    if(!container) return;
    container.innerHTML = '';
    TABS.forEach((tab) => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${tab === currentTab ? 'active' : ''}`;
        btn.innerText = tab;
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = tab;
            document.getElementById('currentSheetTitle').innerText = `Data Formasi Jabatan - ${tab}`;
            renderTable(tab);
        };
        container.appendChild(btn);
    });
}

// ================= 4. LOGIKA HALAMAN STATISTIK (DIPERBAIKI) =================

function populateFilterDropdown() {
    const select = document.getElementById('unitFilter');
    select.innerHTML = '<option value="ALL">Semua Unit Kerja (Global)</option>';
    TABS.forEach(tab => {
        const option = document.createElement('option');
        option.value = tab;
        option.innerText = `Unit: ${tab}`;
        select.appendChild(option);
    });
}

async function loadDataForStats() {
    try {
        const results = await fetchAllData();
        processDataResults(results);
        updateStatsView(); 
    } catch (e) { console.error("Error stats:", e); }
}

function updateStatsView() {
    const filter = document.getElementById('unitFilter').value;
    const getVal = (val) => val === null ? 0 : val;

    // Variables for Cards
    let totalFormasi = 0;
    let maxUnitName = "-"; let maxUnitValue = 0;
    let minUnitName = "-"; let minUnitValue = Infinity;

    // Variables for Charts
    let barLabels = []; let barValues = []; // Main Chart
    let jenjangCounts = {}; // Pie Chart Data
    let jabatanCounts = {}; // Horizontal Bar Chart Data (Top Jobs)

    // --- PENGUMPULAN DATA ---
    const targetTabs = (filter === "ALL") ? TABS : [filter];

    targetTabs.forEach(tab => {
        const rows = allData[tab] || [];
        
        // 1. Hitung Total per Tab (untuk Bar Chart Utama & Card)
        const tabTotal = rows.reduce((sum, item) => sum + getVal(item.kuota), 0);
        
        if (filter === "ALL") {
            // Mode Global: Bar Chart = Nama Unit
            if(rows.length > 0) {
                barLabels.push(tab);
                barValues.push(tabTotal);
                
                // Cari Max & Min Unit
                if(tabTotal > maxUnitValue) { maxUnitValue = tabTotal; maxUnitName = tab; }
                if(tabTotal < minUnitValue && tabTotal > 0) { minUnitValue = tabTotal; minUnitName = tab; }
            }
        }

        totalFormasi += tabTotal;

        // 2. Loop detail item untuk Jenjang & Top Jabatan
        rows.forEach(item => {
            const kuota = getVal(item.kuota);
            
            // Agregasi Jenjang
            jenjangCounts[item.jenjang] = (jenjangCounts[item.jenjang] || 0) + kuota;
            
            // Agregasi Nama Jabatan (Bersihkan nama agar duplikat terminimalisir)
            let cleanJabatan = item.jabatan.trim(); 
            // Opsional: Bisa di lowercase jika ingin penggabungan lebih agresif
            jabatanCounts[cleanJabatan] = (jabatanCounts[cleanJabatan] || 0) + kuota;
        });
    });

    if (filter !== "ALL") {
        // Mode Single Unit: Bar Chart = Top 10 Jabatan di unit tersebut (bukan unit lagi)
        document.getElementById('barChartTitle').innerHTML = `<i class="fas fa-chart-bar"></i> Top 10 Jabatan di ${filter}`;
        
        // Convert jabatanCounts ke array sorted
        let sortedJabatan = Object.keys(jabatanCounts).map(key => ({ label: key, value: jabatanCounts[key] }))
                                .sort((a,b) => b.value - a.value).slice(0, 10);
        barLabels = sortedJabatan.map(i => i.label.length > 15 ? i.label.substring(0,15)+'...' : i.label);
        barValues = sortedJabatan.map(i => i.value);

        // Card logic for single unit
        maxUnitName = "Lihat Grafik"; maxUnitValue = ""; // Tidak relevan di single view
        minUnitName = "-"; minUnitValue = "";
    } else {
        document.getElementById('barChartTitle').innerHTML = `<i class="fas fa-chart-bar"></i> Distribusi Formasi per Unit`;
        if(minUnitValue === Infinity) minUnitValue = 0;
    }

    // --- UPDATE KARTU ---
    document.getElementById('labelCard1').innerText = filter === "ALL" ? "Total Unit Kerja" : "Total Jenis Jabatan";
    document.getElementById('valCard1').innerText = filter === "ALL" ? barLabels.length : Object.keys(jabatanCounts).length;
    
    document.getElementById('valCard2').innerText = totalFormasi.toLocaleString('id-ID');
    
    document.getElementById('labelCard3').innerText = filter === "ALL" ? "Unit Terpadat" : "Jabatan Terbanyak";
    if (filter === "ALL") {
        document.getElementById('valCard3').innerText = `${maxUnitName} (${maxUnitValue})`;
        document.getElementById('labelCard4').innerText = "Unit Terkecil";
        document.getElementById('valCard4').innerText = `${minUnitName} (${minUnitValue})`;
    } else {
        // Cari jabatan terbanyak di unit ini
        let maxJ = Object.keys(jabatanCounts).reduce((a, b) => jabatanCounts[a] > jabatanCounts[b] ? a : b);
        document.getElementById('valCard3').innerText = `${maxJ.substring(0,15)}..`;
        document.getElementById('valCard4').innerText = "-";
    }

    // --- PREPARE CHART DATA ---

    // 1. Pie Chart Data (Jenjang)
    const pieLabels = Object.keys(jenjangCounts);
    const pieValues = Object.values(jenjangCounts);

    // 2. Horizontal Bar Data (Top 10 Global Jabatan)
    // Urutkan jabatanCounts dari terbesar
    const sortedGlobalJobs = Object.keys(jabatanCounts)
        .map(key => ({ label: key, value: jabatanCounts[key] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10); // Ambil Top 10
    
    const horzLabels = sortedGlobalJobs.map(i => i.label.length > 40 ? i.label.substring(0,40)+'...' : i.label);
    const horzValues = sortedGlobalJobs.map(i => i.value);

    // --- RENDER CHARTS ---
    renderCharts(barLabels, barValues, pieLabels, pieValues, horzLabels, horzValues, filter === "ALL");
}

function renderCharts(barLabels, barValues, pieLabels, pieValues, horzLabels, horzValues, isGlobal) {
    const ctxBar = document.getElementById('barChart').getContext('2d');
    const ctxPie = document.getElementById('pieChart').getContext('2d');
    const ctxHorz = document.getElementById('horizontalBarChart').getContext('2d');

    // Destroy Old Instances
    if (chartInstanceBar) chartInstanceBar.destroy();
    if (chartInstancePie) chartInstancePie.destroy();
    if (chartInstanceHorizontal) chartInstanceHorizontal.destroy();

    // 1. MAIN BAR CHART (Vertical)
    chartInstanceBar = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: barLabels,
            datasets: [{
                label: 'Jumlah Kuota',
                data: barValues,
                backgroundColor: '#4e73df',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true }, x: { ticks: { autoSkip: false, maxRotation: 90 } } }
        }
    });

    // 2. PIE CHART (JENJANG - DIGANTI DARI UNIT)
    // Warna custom untuk jenjang agar menarik
    const pieColors = ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796', '#5a5c69', '#2e59d9'];
    
    chartInstancePie = new Chart(ctxPie, {
        type: 'doughnut', // Doughnut lebih modern dari Pie biasa
        data: {
            labels: pieLabels,
            datasets: [{
                data: pieValues,
                backgroundColor: pieColors.slice(0, pieLabels.length),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '60%', // Lubang tengah
            plugins: { 
                legend: { position: 'bottom', labels: { boxWidth: 12, font: {size: 11} } },
                tooltip: { 
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            let value = context.raw || 0;
                            let total = context.chart._metasets[context.datasetIndex].total;
                            let percentage = Math.round((value / total) * 100) + '%';
                            return label + ': ' + value + ' (' + percentage + ')';
                        }
                    }
                }
            }
        }
    });

    // 3. HORIZONTAL BAR CHART (TOP JOBS - BARU)
    chartInstanceHorizontal = new Chart(ctxHorz, {
        type: 'bar',
        data: {
            labels: horzLabels,
            datasets: [{
                label: 'Total Kuota',
                data: horzValues,
                backgroundColor: '#36b9cc',
                borderRadius: 3
            }]
        },
        options: {
            indexAxis: 'y', // MENJADIKAN HORIZONTAL
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true } }
        }
    });
}

// ================= 5. MODAL & SIMPAN (Tetap Sama) =================
let editingData = null;
function openEditModal(tab, rowId, jabatan, kuota) {
    editingData = { tab, rowId };
    document.getElementById('editJabatan').value = jabatan;
    if (kuota === "null" || kuota === null) {
        document.getElementById('editKuota').value = "";
        document.getElementById('editKuota').placeholder = "Kosong (Isi angka jika perlu)";
    } else {
        document.getElementById('editKuota').value = kuota;
    }
    document.getElementById('editModal').classList.remove('hidden');
}
function closeModal() { document.getElementById('editModal').classList.add('hidden'); }

const editFormElement = document.getElementById('editForm');
if(editFormElement) {
    editFormElement.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (!WEB_APP_URL || WEB_APP_URL.includes("URL_APPS_SCRIPT")) {
            alert("Konfigurasi URL error."); return;
        }

        const btn = document.getElementById('btnSave');
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Menyimpan...`;
        btn.disabled = true;

        const rawInput = document.getElementById('editKuota').value;
        const newKuota = rawInput === "" ? "" : parseInt(rawInput);

        fetch(WEB_APP_URL, {
            method: 'POST', mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                sheetName: editingData.tab, 
                row: editingData.rowId,     
                kuota: newKuota             
            })
        })
        .then(() => {
            alert(`Berhasil update data!`);
            const tabRows = allData[editingData.tab];
            const targetRow = tabRows.find(r => r.excelRow === editingData.rowId);
            if(targetRow) targetRow.kuota = (newKuota === "") ? null : newKuota;
            
            if (document.getElementById('dataTable')) renderTable(currentTab);
            else if (document.getElementById('barChart')) loadDataForStats();
            
            closeModal();
        })
        .catch(err => { console.error(err); alert("Gagal terhubung ke server."); })
        .finally(() => { btn.innerHTML = originalText; btn.disabled = false; });
    });
}
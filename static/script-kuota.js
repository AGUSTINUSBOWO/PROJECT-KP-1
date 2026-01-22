// Konfigurasi URL Google Apps Script & ID Spreadsheet
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbykpDdk0JXHd88PqQPrGMcT1RATR50Sl2iS1RYoP8tmwytzZQx9uZ5wQfb6KNfblYDE/exec"; 
const SPREADSHEET_ID_KUOTA = "1XMTaUh51lSltPwx0uAdwmm6IsPybTfzqu74cI1eejqY";

// DAFTAR NAMA SHEET (Harus SAMA PERSIS dengan di Google Spreadsheet)
const TABS = [
    "DN1", "DN2", "GK1", "GK2", "GM", "GT", "JT", "KG1", "KG2",
    "KT", "MJ", "MG", "NG", "PA", "UH1", "UH2", "TR", "WB",
    "Labkes", "DINKES", "RSUD", "RSP", "PSC119" 
];

let allData = {};
let currentTab = TABS[0];

// Variable Global untuk Chart
let chartInstanceBar = null;
let chartInstancePie = null;

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
        populateFilterDropdown(); // Isi dropdown
        loadDataForStats();       // Load data
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
        // Menggunakan encodeURIComponent agar nama sheet yg ada spasi tidak error
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
            console.warn(`Melewati sheet "${tab}" karena error atau nama tidak sesuai.`, err);
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
            
            // Deteksi Jenjang
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

            // LOGIKA BARU: Cek apakah sel kosong (null) atau angka (0, 1, dst)
            const rawKuota = c[3]?.v;
            let finalKuota = null; // Default NULL (Kosong)

            // Jika tidak null, tidak undefined, dan bukan string kosong, maka ambil angkanya
            // Ini akan menangkap angka 0 sebagai angka 0, bukan sebagai null.
            if (rawKuota !== null && rawKuota !== undefined && rawKuota !== "") {
                finalKuota = parseInt(rawKuota);
            }

            return {
                id: idx + 1, excelRow: idx + 2,
                jabatan: rawJabatan, jenjang: jenjang,
                kuota: finalKuota // Bisa berupa Angka (0, 5, 10) atau null (kosong)
            };
        }).filter(i => i);
        allData[res.tab] = processedRows;
    });
}

// ================= 3. LOGIKA HALAMAN TABEL =================
async function loadDataForTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">Sedang mengambil data terbaru...</td></tr>`;
    try {
        const results = await fetchAllData();
        processDataResults(results);
        if (!allData[currentTab] && results.length > 0) {
            currentTab = results[0].tab;
        }
        renderTable(currentTab);
        generateTabs(); 
    } catch (e) { 
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Gagal koneksi atau Spreadsheet dikunci.</td></tr>`; 
    }
}

function renderTable(tab, search = "") {
    const tbody = document.getElementById('tableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const data = allData[tab] || [];
    const filtered = data.filter(item => item.jabatan.toLowerCase().includes(search.toLowerCase()));

    if (filtered.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="5" class="text-center">Data tidak ditemukan / Sheet Kosong</td></tr>`; 
        return; 
    }

    filtered.forEach((item, index) => {
        // LOGIKA TAMPILAN:
        // Jika null -> Tampilkan kosong ""
        // Jika 0 atau angka lain -> Tampilkan badge angka
        let displayKuota = "";
        let editValue = ""; // Value untuk dikirim ke modal edit

        if (item.kuota !== null) {
            displayKuota = `<span class="badge-kuota">${item.kuota}</span>`;
            editValue = item.kuota;
        } else {
            // Jika kosong di spreadsheet, di web juga kosong (tanpa badge)
            displayKuota = `<span style="color:#ccc;">-</span>`; 
            editValue = ""; // Di modal edit nanti kosong
        }

        // Kita gunakan 'null' sebagai string di parameter onclick jika kosong
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
    
    TABS.forEach((tab, index) => {
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

// ================= 4. LOGIKA HALAMAN STATISTIK =================

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
    
    let totalFormasi = 0;
    let cardTitle1 = ""; let cardValue1 = "";
    let cardTitle3 = ""; let cardValue3 = "";
    
    let chartLabels = [];
    let chartValues = [];
    let pieLabels = [];
    let pieValues = [];

    // Helper: Jika null, anggap 0 untuk perhitungan statistik
    const getVal = (val) => val === null ? 0 : val;

    if (filter === "ALL") {
        document.getElementById('statsTitle').innerText = "Statistik Global";
        document.getElementById('barChartTitle').innerHTML = '<i class="fas fa-chart-bar"></i> Distribusi Formasi per Unit Kerja';
        document.getElementById('pieChartTitle').innerHTML = '<i class="fas fa-chart-pie"></i> Top 5 Unit Kerja Terbesar';

        let maxUnitName = "-"; let maxUnitValue = 0;

        TABS.forEach(tab => {
            const rows = allData[tab] || [];
            // Hitung total dengan menganggap null sebagai 0
            const subTotal = rows.reduce((sum, item) => sum + getVal(item.kuota), 0);
            totalFormasi += subTotal;
            
            if(rows.length > 0) {
                chartLabels.push(tab);
                chartValues.push(subTotal);
                if(subTotal > maxUnitValue) { maxUnitValue = subTotal; maxUnitName = tab; }
            }
        });

        cardTitle1 = "Total Unit Kerja"; cardValue1 = chartLabels.length;
        cardTitle3 = "Unit Terpadat"; cardValue3 = `${maxUnitName} (${maxUnitValue})`;

        let combined = chartLabels.map((l, i) => ({ label: l, value: chartValues[i] })).sort((a, b) => b.value - a.value);
        let top5 = combined.slice(0, 5);
        let others = combined.slice(5).reduce((a,b)=>a+b.value, 0);
        pieLabels = top5.map(i=>i.label).concat("Lainnya");
        pieValues = top5.map(i=>i.value).concat(others);

    } else {
        const unitData = allData[filter] || [];
        document.getElementById('statsTitle').innerText = `Statistik Unit: ${filter}`;
        document.getElementById('barChartTitle').innerHTML = '<i class="fas fa-chart-bar"></i> Top 10 Jabatan di Unit Ini';
        document.getElementById('pieChartTitle').innerHTML = '<i class="fas fa-chart-pie"></i> Proporsi Jenjang Jabatan';

        totalFormasi = unitData.reduce((sum, item) => sum + getVal(item.kuota), 0);

        let maxJabatan = "-"; let maxJabValue = 0;
        let sortedJabatan = [...unitData].sort((a,b) => getVal(b.kuota) - getVal(a.kuota));
        let top10Jabatan = sortedJabatan.slice(0, 10);
        
        chartLabels = top10Jabatan.map(i => i.jabatan.length > 20 ? i.jabatan.substring(0,20)+'...' : i.jabatan);
        chartValues = top10Jabatan.map(i => getVal(i.kuota));

        if(sortedJabatan.length > 0) {
            maxJabatan = sortedJabatan[0].jabatan;
            maxJabValue = getVal(sortedJabatan[0].kuota);
        }

        cardTitle1 = "Total Jenis Jabatan"; cardValue1 = unitData.length;
        cardTitle3 = "Jabatan Terbanyak"; cardValue3 = `${maxJabatan.substring(0,15)}.. (${maxJabValue})`;

        const jenjangCount = {};
        unitData.forEach(item => {
            jenjangCount[item.jenjang] = (jenjangCount[item.jenjang] || 0) + getVal(item.kuota);
        });
        pieLabels = Object.keys(jenjangCount);
        pieValues = Object.values(jenjangCount);
    }

    document.getElementById('labelCard1').innerText = cardTitle1;
    document.getElementById('valCard1').innerText = cardValue1;
    document.getElementById('valCard2').innerText = totalFormasi.toLocaleString('id-ID');
    document.getElementById('labelCard3').innerText = cardTitle3;
    document.getElementById('valCard3').innerText = cardValue3;

    renderDynamicCharts(chartLabels, chartValues, pieLabels, pieValues, filter === "ALL");
}

function renderDynamicCharts(barLabels, barValues, pieLabels, pieValues, isGlobal) {
    const ctxBar = document.getElementById('barChart').getContext('2d');
    const ctxPie = document.getElementById('pieChart').getContext('2d');

    if (chartInstanceBar) chartInstanceBar.destroy();
    if (chartInstancePie) chartInstancePie.destroy();

    chartInstanceBar = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: barLabels,
            datasets: [{
                label: 'Jumlah Formasi',
                data: barValues,
                backgroundColor: isGlobal ? '#3b82f6' : '#8b5cf6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { beginAtZero: true },
                x: { ticks: { autoSkip: false, maxRotation: 90, minRotation: 0 } }
            }
        }
    });

    chartInstancePie = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: pieLabels,
            datasets: [{
                data: pieValues,
                backgroundColor: ['#2563eb', '#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899', '#cbd5e1', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { boxWidth: 10, usePointStyle: true } } }
        }
    });
}

// ================= 5. MODAL & SIMPAN KE SPREADSHEET =================
let editingData = null;

// Parameter kuota bisa berupa angka atau string "null"
function openEditModal(tab, rowId, jabatan, kuota) {
    editingData = { tab, rowId };
    document.getElementById('editJabatan').value = jabatan;
    
    // Jika data aslinya null (kosong), input form juga dikosongkan
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
            alert("Konfigurasi URL error.");
            return;
        }

        const btn = document.getElementById('btnSave');
        const originalText = btn.innerHTML;
        
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Menyimpan...`;
        btn.disabled = true;

        const rawInput = document.getElementById('editKuota').value;
        // Jika user mengosongkan input, kirim "" (string kosong) ke spreadsheet
        // Jika user mengisi angka, kirim angka.
        const newKuota = rawInput === "" ? "" : parseInt(rawInput);

        fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                sheetName: editingData.tab, 
                row: editingData.rowId,     
                kuota: newKuota             
            })
        })
        .then(() => {
            alert(`Berhasil update data!`);
            
            // Update UI (Optimistic)
            const tabRows = allData[editingData.tab];
            const targetRow = tabRows.find(r => r.excelRow === editingData.rowId);
            
            // Update data lokal agar sesuai inputan user (angka atau null)
            if(targetRow) {
                targetRow.kuota = (newKuota === "") ? null : newKuota;
            }
            
            if (document.getElementById('dataTable')) {
                renderTable(currentTab);
            } else if (document.getElementById('barChart')) {
                loadDataForStats();
            }
            closeModal();
        })
        .catch(err => {
            console.error(err);
            alert("Gagal terhubung ke server Google.");
        })
        .finally(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
    });
}
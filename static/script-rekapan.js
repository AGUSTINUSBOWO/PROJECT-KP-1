// ================= KONFIGURASI =================
const SPREADSHEET_ID = '15WY6r-LWkxmBn0agPJdM7oEgkOUHZghNHxfGWATGNHM'; 
const SHEET_TABS = [
    "DN1", "DN2", "GK1", "GK2", "GM", "GT", "JT", "KG1", "KG2", 
    "KT", "MJ", "MG", "NG", "PA", "UH1", "UH2", "TR", "WB", 
    "Labkes", "DINKES", "RSUD", "RSP"
];

// Variabel Global untuk menyimpan data mentah sheet aktif
let CURRENT_SHEET_DATA = [];
let ACTIVE_TAB = SHEET_TABS[0];

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
    generateTabs();
    setupFilters(); // Siapkan isi dropdown
    setupEventListeners(); // Siapkan listener search & filter
    loadSheetData(SHEET_TABS[0]); // Load awal
});

// 1. Setup Data Dropdown (Sesuai Request)
function setupFilters() {
    const jabatanOpts = `
        <optgroup label="Jabatan Struktural">
            <option value="JPT Utama">JPT Utama</option>
            <option value="JPT Madya">JPT Madya</option>
            <option value="JPT Pratama">JPT Pratama</option>
            <option value="Administrator">Administrator</option>
            <option value="Pengawas">Pengawas</option>
        </optgroup>
        <optgroup label="Jabatan Fungsional">
            <option value="Ahli Pertama">Ahli Pertama</option>
            <option value="Ahli Muda">Ahli Muda</option>
            <option value="Ahli Madya">Ahli Madya</option>
            <option value="Ahli Utama">Ahli Utama</option>
            <option value="Pemula">Pemula</option>
            <option value="Terampil">Terampil</option>
            <option value="Mahir">Mahir</option>
            <option value="Penyelia">Penyelia</option>
        </optgroup>
        <optgroup label="Jabatan Pelaksana">
            <option value="Pengadministrasi">Pengadministrasi Umum</option>
            <option value="Pengolah Data">Pengolah Data</option>
            <option value="Pengelola Keuangan">Pengelola Keuangan</option>
            <option value="Pranata Kearsipan">Pranata Kearsipan</option>
            <option value="Pengelola Barang">Pengelola Barang Milik Negara</option>
            <option value="Pengelola Layanan">Pengelola Layanan Operasional</option>
            <option value="Petugas Pelayanan">Petugas Pelayanan</option>
        </optgroup>
    `;

    const pangkatOpts = `
        <optgroup label="Golongan II (Pengatur)">
            <option value="II/a">Pengatur Muda, II/a</option>
            <option value="II/b">Pengatur Muda Tk.I, II/b</option>
            <option value="II/c">Pengatur, II/c</option>
            <option value="II/d">Pengatur Tk.I, II/d</option>
        </optgroup>
        <optgroup label="Golongan III (Penata)">
            <option value="III/a">Penata Muda, III/a</option>
            <option value="III/b">Penata Muda Tk.I, III/b</option>
            <option value="III/c">Penata, III/c</option>
            <option value="III/d">Penata Tk.I, III/d</option>
        </optgroup>
        <optgroup label="Golongan IV (Pembina)">
            <option value="IV/a">Pembina, IV/a</option>
            <option value="IV/b">Pembina Tk.I, IV/b</option>
            <option value="IV/c">Pembina Utama Muda, IV/c</option>
            <option value="IV/d">Pembina Utama Madya, IV/d</option>
            <option value="IV/e">Pembina Utama, IV/e</option>
        </optgroup>
    `;

    const profesiList = [
        "Dokter", "Dokter Spesialis", "Dokter Subspesialis", "Dokter Gigi", "Dokter Gigi Spesialis",
        "Bidan", "Perawat", "Apoteker", "Asisten Apoteker", "Perawat Gigi", "Nutrisionis", "Dietisien",
        "Sanitarian", "Epidemiolog Kesehatan", "Penyuluh Kesehatan Masyarakat", "Adminkes", "PKM",
        "Pranata Laboratorium Kesehatan", "Radiografer", "Teknisi Elektromedis", "Fisikawan Medis",
        "Penata Anestesi", "Teknisi Transfusi Darah", "Fisioterapis", "Okupasi Terapis", "Terapis Wicara",
        "Psikolog Klinis", "Perekam Medis", "Teknisi Gigi"
    ];
    let profesiOpts = "";
    profesiList.forEach(p => { profesiOpts += `<option value="${p}">${p}</option>`; });

    document.getElementById('filterJabatan').insertAdjacentHTML('beforeend', jabatanOpts);
    document.getElementById('filterPangkat').insertAdjacentHTML('beforeend', pangkatOpts);
    document.getElementById('filterProfesi').insertAdjacentHTML('beforeend', profesiOpts);
}

// 2. Event Listeners untuk Search & Filter
function setupEventListeners() {
    const inputs = ['globalSearch', 'filterJabatan', 'filterPangkat', 'filterProfesi'];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener('input', applyLogicAndRender);
    });
}

function generateTabs() {
    const container = document.getElementById('tab-container');
    SHEET_TABS.forEach((sheetName, index) => {
        const btn = document.createElement('button');
        btn.innerText = sheetName;
        btn.onclick = () => {
            document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            ACTIVE_TAB = sheetName;
            
            // Reset Filters saat ganti tab
            document.getElementById('globalSearch').value = '';
            document.getElementById('filterJabatan').value = '';
            document.getElementById('filterPangkat').value = '';
            document.getElementById('filterProfesi').value = '';

            loadSheetData(sheetName);
        };
        if (index === 0) btn.classList.add('active');
        container.appendChild(btn);
    });
}

// 3. Load Data & Normalisasi
async function loadSheetData(sheetName) {
    const loading = document.getElementById('loading');
    loading.classList.remove('hidden'); // Tampilkan loading
    loading.style.display = 'flex';

    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

    try {
        const response = await fetch(url);
        const text = await response.text();
        const jsonText = text.substring(47).slice(0, -2);
        const json = JSON.parse(jsonText);
        
        // --- PROSES DATA MENTAH MENJADI OBJECT BERSIH ---
        CURRENT_SHEET_DATA = normalizeData(json.table.rows, json.table.cols, sheetName);
        
        // Render Awal
        applyLogicAndRender();
        
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('table-body').innerHTML = `<tr><td colspan="8" class="text-center" style="color:red;">Gagal mengambil data.</td></tr>`;
    } finally {
        setTimeout(() => {
            loading.classList.add('hidden'); // Sembunyikan loading
        }, 300);
    }
}

// Fungsi Mengubah Data Mentah GVIZ menjadi Array Object
function normalizeData(rows, cols, sheetName) {
    const colIdx = {
        nama: findColumnIndex(cols, ["nama", "name"]),
        nip: findColumnIndex(cols, ["nip"]),
        jabatan: findColumnIndex(cols, ["jabatan"]),
        nik: findColumnIndex(cols, ["nik"]),
        profesi: findColumnIndex(cols, ["profesi"]),
        pangkat: findColumnIndex(cols, ["pangkat", "golongan"]),
        total: findColumnIndex(cols, ["total"])
    };

    // Logika Unit Kerja (Sama seperti sebelumnya)
    let fixedUnitName = null;
    const sLower = sheetName.toLowerCase();
    if (sLower.includes('dinkes') || sLower.includes('dinas')) fixedUnitName = "Dinas Kesehatan";
    else if (sLower.includes('lab')) fixedUnitName = "Labkesmas";
    else if (sLower.includes('rsud')) fixedUnitName = "RSUD";
    else if (sLower.includes('rsp') || sLower.includes('pratama')) fixedUnitName = "RS Pratama";

    return rows.map(row => {
        const c = row.c;
        if (!c) return null;

        let unit = fixedUnitName;
        if (!unit) {
            unit = (c[1]) ? (c[1].v || c[1].f || sheetName) : sheetName;
        }

        let valTotal = getRawVal(c, colIdx.total);
        if (valTotal !== '-' && !isNaN(parseFloat(valTotal))) {
            valTotal = parseFloat(valTotal).toFixed(3);
        }

        return {
            nama: getRawVal(c, colIdx.nama),
            nip: getRawVal(c, colIdx.nip),
            jabatan: getRawVal(c, colIdx.jabatan),
            unit: unit,
            nik: getRawVal(c, colIdx.nik),
            profesi: getRawVal(c, colIdx.profesi),
            pangkat: getRawVal(c, colIdx.pangkat),
            total: valTotal,
            // Simpan versi lowercase untuk searching cepat
            _searchStr: (getRawVal(c, colIdx.nama) + " " + getRawVal(c, colIdx.nip)).toLowerCase()
        };
    }).filter(item => item !== null); // Hapus baris null
}

// 4. LOGIKA FILTERING & SEARCHING (INTI FITUR BARU)
function applyLogicAndRender() {
    const searchKey = document.getElementById('globalSearch').value.toLowerCase().trim();
    const filterJabatan = document.getElementById('filterJabatan').value.toLowerCase();
    const filterPangkat = document.getElementById('filterPangkat').value.toLowerCase();
    const filterProfesi = document.getElementById('filterProfesi').value.toLowerCase();

    // A. FILTERING TAHAP 1 (STRICT FILTER)
    // Saring data berdasarkan Dropdown. Jika tidak cocok, buang.
    let filteredData = CURRENT_SHEET_DATA.filter(item => {
        const matchJabatan = filterJabatan === "" || item.jabatan.toLowerCase().includes(filterJabatan);
        const matchPangkat = filterPangkat === "" || item.pangkat.toLowerCase().includes(filterPangkat);
        const matchProfesi = filterProfesi === "" || item.profesi.toLowerCase().includes(filterProfesi);
        return matchJabatan && matchPangkat && matchProfesi;
    });

    // B. SEARCHING TAHAP 2 (REORDERING & HIGHLIGHT)
    // Jika ada keyword search, jangan dibuang, tapi pindahkan yang cocok ke atas.
    let finalData = [];
    
    if (searchKey !== "") {
        const matches = [];
        const nonMatches = [];

        filteredData.forEach(item => {
            if (item._searchStr.includes(searchKey)) {
                // Tandai sebagai match untuk CSS
                item.isHighlight = true;
                matches.push(item);
            } else {
                item.isHighlight = false;
                nonMatches.push(item);
            }
        });

        // Gabungkan: Match duluan, baru sisanya
        finalData = [...matches, ...nonMatches];
    } else {
        // Jika tidak ada search, reset highlight
        finalData = filteredData.map(item => ({ ...item, isHighlight: false }));
    }

    renderTableDOM(finalData);
}

// 5. Render ke HTML
function renderTableDOM(data) {
    const tableBody = document.getElementById('table-body');
    const footerInfo = document.getElementById('footerInfo');
    tableBody.innerHTML = '';

    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:20px;">Data tidak ditemukan sesuai filter.</td></tr>`;
        footerInfo.innerText = "0 Data";
        return;
    }

    data.forEach(item => {
        const tr = document.createElement('tr');
        
        // Tambahkan class highlight jika hasil search
        if (item.isHighlight) {
            tr.classList.add('highlight-row');
        }

        tr.innerHTML = `
            <td>${item.nama}</td>
            <td>${item.nip}</td>
            <td>${item.jabatan}</td>
            <td>${item.unit}</td>
            <td>${item.nik}</td>
            <td>${item.profesi}</td>
            <td>${item.pangkat}</td>
            <td style="font-weight:bold; color: #007bff; text-align:center;">${item.total}</td>
        `;
        tableBody.appendChild(tr);
    });

    footerInfo.innerText = `Menampilkan ${data.length} Data Pegawai`;
}

// Helper Utils
function getRawVal(c, idx) {
    if (idx !== -1 && c[idx]) {
        return c[idx].v !== null ? String(c[idx].v) : (c[idx].f || '-');
    }
    return '-';
}

function findColumnIndex(cols, keywords) {
    return cols.findIndex(col => {
        if (!col || !col.label) return false;
        const label = col.label.toLowerCase();
        return keywords.some(keyword => label.includes(keyword));
    });
}
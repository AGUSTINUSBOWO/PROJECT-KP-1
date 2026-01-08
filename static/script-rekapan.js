// ================= KONFIGURASI =================
const SPREADSHEET_ID = '15WY6r-LWkxmBn0agPJdM7oEgkOUHZghNHxfGWATGNHM'; 
const SHEET_TABS = [
    "DN1", "DN2", "GK1", "GK2", "GM", "GT", "JT", "KG1", "KG2", 
    "KT", "MJ", "MG", "NG", "PA", "UH1", "UH2", "TR", "WB", 
    "Labkes", "DINKES", "RSUD", "RSP"
];

let CURRENT_SHEET_DATA = [];
let DETECTED_YEARS = []; // Menyimpan tahun yang ditemukan (misal: 2023, 2024)
let ACTIVE_TAB = SHEET_TABS[0];

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
    generateTabs();
    setupFilters(); 
    setupEventListeners(); 
    loadSheetData(SHEET_TABS[0]); 
});

function setupFilters() {
    // 1. Dropdown Jabatan (Lengkap sesuai request sebelumnya)
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
            <option value="Pengadministrasi">Pengadministrasi</option>
            <option value="Pengolah Data">Pengolah Data</option>
            <option value="Pengelola">Pengelola</option>
            <option value="Pranata">Pranata</option>
            <option value="Petugas">Petugas</option>
        </optgroup>
    `;

    // 2. Dropdown Pangkat
    const pangkatOpts = `
        <optgroup label="Golongan II">
            <option value="II/a">II/a - Pengatur Muda</option>
            <option value="II/b">II/b - Pengatur Muda Tk.I</option>
            <option value="II/c">II/c - Pengatur</option>
            <option value="II/d">II/d - Pengatur Tk.I</option>
        </optgroup>
        <optgroup label="Golongan III">
            <option value="III/a">III/a - Penata Muda</option>
            <option value="III/b">III/b - Penata Muda Tk.I</option>
            <option value="III/c">III/c - Penata</option>
            <option value="III/d">III/d - Penata Tk.I</option>
        </optgroup>
        <optgroup label="Golongan IV">
            <option value="IV/a">IV/a - Pembina</option>
            <option value="IV/b">IV/b - Pembina Tk.I</option>
            <option value="IV/c">IV/c - Pembina Utama Muda</option>
            <option value="IV/d">IV/d - Pembina Utama Madya</option>
            <option value="IV/e">IV/e - Pembina Utama</option>
        </optgroup>
    `;

    // 3. Dropdown Profesi
    const profesiList = [
        "Dokter", "Dokter Spesialis", "Dokter Gigi", "Bidan", "Perawat", "Apoteker", "Asisten Apoteker",
        "Nutrisionis", "Sanitarian", "Epidemiolog", "Penyuluh", "Adminkes", "Pranata Lab", 
        "Radiografer", "Fisioterapis", "Perekam Medis", "Teknisi Elektromedis"
    ];
    let profesiOpts = "";
    profesiList.forEach(p => { profesiOpts += `<option value="${p}">${p}</option>`; });

    document.getElementById('filterJabatan').insertAdjacentHTML('beforeend', jabatanOpts);
    document.getElementById('filterPangkat').insertAdjacentHTML('beforeend', pangkatOpts);
    document.getElementById('filterProfesi').insertAdjacentHTML('beforeend', profesiOpts);
}

function setupEventListeners() {
    // Tambahkan 'filterTahun' ke listener agar tabel berubah saat tahun diganti
    const inputs = ['globalSearch', 'filterJabatan', 'filterPangkat', 'filterProfesi', 'filterTahun'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', applyLogicAndRender);
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
            
            // Reset Filters saat pindah tab
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

// ================= LOGIKA INTI (DYNAMIC COLUMN & RENDERING) =================

async function loadSheetData(sheetName) {
    const loading = document.getElementById('loading');
    loading.classList.remove('hidden'); 
    loading.style.display = 'flex';

    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

    try {
        const response = await fetch(url);
        const text = await response.text();
        const jsonText = text.substring(47).slice(0, -2);
        const json = JSON.parse(jsonText);
        
        // 1. Deteksi Kolom & Normalisasi Data
        const normalized = normalizeData(json.table.rows, json.table.cols, sheetName);
        CURRENT_SHEET_DATA = normalized.data;
        DETECTED_YEARS = normalized.years; // List tahun yang ditemukan (misal: ['2024', '2023'])

        // 2. Isi Dropdown Tahun berdasarkan kolom yang ditemukan
        populateYearDropdown(DETECTED_YEARS);

        // 3. Render Tabel
        applyLogicAndRender();
        
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('table-body').innerHTML = `<tr><td colspan="8" class="text-center" style="color:red; padding:20px;">Gagal mengambil data atau Sheet kosong.</td></tr>`;
    } finally {
        setTimeout(() => { loading.classList.add('hidden'); }, 300);
    }
}

function normalizeData(rows, cols, sheetName) {
    // A. Cari Index Kolom Standar
    const colIdx = {
        nama: findColumnIndex(cols, ["nama", "name"]),
        nip: findColumnIndex(cols, ["nip"]),
        jabatan: findColumnIndex(cols, ["jabatan", "posisi"]),
        nik: findColumnIndex(cols, ["nik"]),
        profesi: findColumnIndex(cols, ["profesi"]),
        pangkat: findColumnIndex(cols, ["pangkat", "golongan"]),
    };

    // B. Cari Index Kolom AK per Tahun (Logic Baru)
    // Mencari header yang mengandung "AK" dan "20xx"
    // Contoh Header Valid: "AK 2023", "Total AK 2024", "Capaian AK Tahun 2022"
    let akYearMap = {}; // Map: { "2023": 7, "2024": 8 } (Tahun -> Index Kolom)
    let foundYears = [];

    cols.forEach((col, index) => {
        if (col && col.label) {
            const label = col.label.toLowerCase();
            // Regex: Mencari 4 digit angka (tahun) yang didahului atau diikuti kata "ak"/"total"
            // Sederhananya: Jika ada 'ak' atau 'total' DAN ada angka '20xx'
            const hasKeyword = label.includes("ak") || label.includes("total") || label.includes("jumlah");
            const matchYear = label.match(/(\d{4})/); // Cari 4 digit angka

            if (hasKeyword && matchYear) {
                const year = matchYear[1]; // Ambil tahunnya (misal "2023")
                akYearMap[year] = index;
                if (!foundYears.includes(year)) foundYears.push(year);
            }
        }
    });

    // Urutkan tahun dari terbaru (Descending: 2024, 2023, 2022)
    foundYears.sort((a, b) => b - a);

    // C. Logic Unit Kerja
    let fixedUnitName = null;
    const sLower = sheetName.toLowerCase();
    if (sLower.includes('dinkes') || sLower.includes('dinas')) fixedUnitName = "Dinas Kesehatan";
    else if (sLower.includes('lab')) fixedUnitName = "Labkesmas";
    else if (sLower.includes('rsud')) fixedUnitName = "RSUD";
    else if (sLower.includes('rsp') || sLower.includes('pratama')) fixedUnitName = "RS Pratama";

    // D. Map Data Baris
    const data = rows.map(row => {
        const c = row.c;
        if (!c) return null;

        let unit = fixedUnitName || ((c[1]) ? (c[1].v || c[1].f || sheetName) : sheetName);

        // Ambil SEMUA nilai AK berdasarkan tahun yang ditemukan
        let akValues = {};
        foundYears.forEach(year => {
            const idx = akYearMap[year];
            let rawVal = getRawVal(c, idx);
            
            // Bersihkan format angka (100,50 -> 100.50) untuk kalkulasi
            // Hapus huruf, simpan angka, titik, koma, minus
            let cleanVal = rawVal.replace(/[^\d.,-]/g, '').replace(',', '.');
            let floatVal = parseFloat(cleanVal);
            
            // Simpan sebagai string terformat (3 desimal) atau strip jika kosong
            if (!isNaN(floatVal)) {
                akValues[year] = floatVal.toFixed(3);
            } else {
                akValues[year] = "-";
            }
        });

        return {
            nama: getRawVal(c, colIdx.nama),
            nip: getRawVal(c, colIdx.nip),
            jabatan: getRawVal(c, colIdx.jabatan),
            unit: unit,
            nik: getRawVal(c, colIdx.nik),
            profesi: getRawVal(c, colIdx.profesi),
            pangkat: getRawVal(c, colIdx.pangkat),
            akData: akValues, // Object berisi { "2023": "10.500", "2024": "15.000" }
            _searchStr: (getRawVal(c, colIdx.nama) + " " + getRawVal(c, colIdx.nip)).toLowerCase()
        };
    }).filter(item => item !== null);

    return { data, years: foundYears };
}

function populateYearDropdown(years) {
    const select = document.getElementById('filterTahun');
    if (!select) return;

    select.innerHTML = ''; // Kosongkan dulu
    
    if (years.length === 0) {
        const opt = document.createElement('option');
        opt.text = "Data Kosong";
        opt.value = "";
        select.add(opt);
        return;
    }

    // Masukkan Tahun yang ditemukan ke dropdown
    years.forEach((year, index) => {
        const opt = document.createElement('option');
        opt.value = year;
        opt.text = `Tahun ${year}`;
        // Set default ke tahun terbaru (index 0)
        if (index === 0) opt.selected = true; 
        select.add(opt);
    });
}

function applyLogicAndRender() {
    const searchKey = document.getElementById('globalSearch').value.toLowerCase().trim();
    const filterJabatan = document.getElementById('filterJabatan').value.toLowerCase();
    const filterPangkat = document.getElementById('filterPangkat').value.toLowerCase();
    const filterProfesi = document.getElementById('filterProfesi').value.toLowerCase();
    
    // Ambil tahun yang sedang dipilih user di dropdown
    const selectedYear = document.getElementById('filterTahun').value; 

    // Filter Baris Data
    let filteredData = CURRENT_SHEET_DATA.filter(item => {
        const matchJabatan = filterJabatan === "" || item.jabatan.toLowerCase().includes(filterJabatan);
        const matchPangkat = filterPangkat === "" || item.pangkat.toLowerCase().includes(filterPangkat);
        const matchProfesi = filterProfesi === "" || item.profesi.toLowerCase().includes(filterProfesi);
        return matchJabatan && matchPangkat && matchProfesi;
    });

    // Searching Logic
    let finalData = [];
    if (searchKey !== "") {
        const matches = [], nonMatches = [];
        filteredData.forEach(item => {
            if (item._searchStr.includes(searchKey)) {
                item.isHighlight = true;
                matches.push(item);
            } else {
                item.isHighlight = false;
                nonMatches.push(item);
            }
        });
        finalData = [...matches, ...nonMatches];
    } else {
        finalData = filteredData.map(item => ({ ...item, isHighlight: false }));
    }

    renderTableDOM(finalData, selectedYear);
}

function renderTableDOM(data, selectedYear) {
    const tableBody = document.getElementById('table-body');
    const footerInfo = document.getElementById('footerInfo');
    tableBody.innerHTML = '';

    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:20px;">Data tidak ditemukan.</td></tr>`;
        footerInfo.innerText = "0 Data";
        return;
    }

    data.forEach(item => {
        const tr = document.createElement('tr');
        if (item.isHighlight) tr.classList.add('highlight-row');

        // AMBIL NILAI AK BERDASARKAN TAHUN YANG DIPILIH
        // Jika tahun tidak dipilih atau data kosong, tampilkan strip
        let displayAK = "-";
        if (selectedYear && item.akData && item.akData[selectedYear]) {
            displayAK = item.akData[selectedYear];
        }

        tr.innerHTML = `
            <td>${item.nama}</td>
            <td>${item.nip}</td>
            <td>${item.jabatan}</td>
            <td>${item.unit}</td>
            <td>${item.nik}</td>
            <td>${item.profesi}</td>
            <td>${item.pangkat}</td>
            <td style="font-weight:bold; color: #007bff; text-align:center;">
                ${displayAK}
            </td>
        `;
        tableBody.appendChild(tr);
    });
    
    // Update footer text
    const periodeText = selectedYear ? `(Periode ${selectedYear})` : "";
    footerInfo.innerText = `Menampilkan ${data.length} Data Pegawai ${periodeText}`;
}

// Utils Helper
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
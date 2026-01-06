// ================= KONFIGURASI =================
// PENTING: Ganti dengan ID Spreadsheet Anda
const SPREADSHEET_ID = '15WY6r-LWkxmBn0agPJdM7oEgkOUHZghNHxfGWATGNHM'; 

// Daftar Nama Tab sesuai Spreadsheet Anda
const SHEET_TABS = [
    "DN1", "DN2", "GK1", "GK2", "GM", "GT", "JT", "KG1", "KG2", 
    "KT", "MJ", "MG", "NG", "PA", "UH1", "UH2", "TR", "WB", 
    "Labkes", "DINKES", "RSUD", "RSP"
];

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
    generateTabs();
    loadSheetData(SHEET_TABS[0]); // Load tab pertama
});

// 1. Fungsi Membuat Tombol Tab
function generateTabs() {
    const container = document.getElementById('tab-container');
    SHEET_TABS.forEach((sheetName, index) => {
        const btn = document.createElement('button');
        btn.innerText = sheetName;
        btn.onclick = () => {
            document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadSheetData(sheetName);
        };
        if (index === 0) btn.classList.add('active');
        container.appendChild(btn);
    });
}

// 2. Fungsi Mengambil Data dari Google Sheets
async function loadSheetData(sheetName) {
    const tableBody = document.getElementById('table-body');
    const loading = document.getElementById('loading');
    
    tableBody.innerHTML = '';
    loading.style.display = 'block';

    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

    try {
        const response = await fetch(url);
        const text = await response.text();
        const jsonText = text.substring(47).slice(0, -2);
        const json = JSON.parse(jsonText);
        
        renderTable(json.table.rows, json.table.cols, sheetName);
        
    } catch (error) {
        console.error('Error fetching data:', error);
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red;">Gagal mengambil data tab ${sheetName}.</td></tr>`;
    } finally {
        loading.style.display = 'none';
    }
}

// 3. Fungsi Render Tabel (LOGIKA MENIRU APP.PY)
function renderTable(rows, cols, sheetName) {
    const tableBody = document.getElementById('table-body');

    // Mapping kolom lain tetap menggunakan pencarian Header
    // KECUALI Unit Kerja (kita pakai logika khusus di bawah)
    const columnMap = {
        nama:    findColumnIndex(cols, ["nama", "name"]),
        nip:     findColumnIndex(cols, ["nip"]),
        jabatan: findColumnIndex(cols, ["jabatan"]),
        // Unit kerja DIHAPUS dari sini, kita pakai logika hardcode
        nik:     findColumnIndex(cols, ["nik"]),
        profesi: findColumnIndex(cols, ["profesi"]),
        pangkat: findColumnIndex(cols, ["pangkat", "golongan"]), 
        total:   findColumnIndex(cols, ["total"])
    };

    // --- LOGIKA 1: TENTUKAN UNIT KERJA BERDASARKAN NAMA SHEET (Persis app.py) ---
    let fixedUnitName = null;
    const sheetLower = sheetName.toLowerCase();

    if (sheetLower.includes('dinkes') || sheetLower.includes('dinas')) {
        fixedUnitName = "Dinas Kesehatan";
    } else if (sheetLower.includes('lab') || sheetLower.includes('labkes')) {
        fixedUnitName = "Laboratorium Kesehatan Masyarakat";
    } else if (sheetLower.includes('rsud')) {
        fixedUnitName = "RSUD";
    } else if (sheetLower.includes('rsp') || sheetLower.includes('pratama')) {
        fixedUnitName = "RS Pratama";
    }
    // Jika bukan instansi khusus, fixedUnitName tetap null -> Nanti ambil kolom B
    // --------------------------------------------------------------------------

    rows.forEach(row => {
        const c = row.c; 
        if (!c) return;

        // --- LOGIKA 2: FINALISASI UNIT KERJA ---
        let displayUnit = "-";

        if (fixedUnitName) {
            // Skenario 1: Instansi Khusus (RSUD, Dinkes, dll)
            displayUnit = fixedUnitName;
        } else {
            // Skenario 2: Puskesmas / Lainnya
            // Ambil dari KOLOM KEDUA (Index 1 / Kolom B)
            // c[1] artinya kolom B (karena index mulai dari 0=A, 1=B)
            if (c[1]) {
                displayUnit = c[1].v || c[1].f || sheetName; 
            } else {
                displayUnit = sheetName; // Fallback ke nama sheet jika kolom B kosong
            }
        }

        // --- Perbaikan Angka Total AK (Desimal) ---
        let valTotal = getRawVal(c, columnMap.total);
        if (valTotal !== '-' && !isNaN(parseFloat(valTotal))) {
            valTotal = parseFloat(valTotal).toFixed(3);
            valTotal = parseFloat(valTotal); 
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${getRawVal(c, columnMap.nama)}</td>
            <td>${getRawVal(c, columnMap.nip)}</td>
            <td>${getRawVal(c, columnMap.jabatan)}</td>
            <td>${displayUnit}</td> <td>${getRawVal(c, columnMap.nik)}</td>
            <td>${getRawVal(c, columnMap.profesi)}</td>
            <td>${getRawVal(c, columnMap.pangkat)}</td>
            <td style="font-weight:bold; color: #007bff;">${valTotal}</td>
        `;
        tableBody.appendChild(tr);
    });
    
    if(rows.length === 0) {
         tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Data kosong di sheet ini.</td></tr>`;
    }
}

// Helper ambil nilai
function getRawVal(c, idx) {
    if (idx !== -1 && c[idx]) {
        return c[idx].v !== null ? c[idx].v : (c[idx].f || '-');
    }
    return '-';
}

// Fungsi Cari Index Kolom
function findColumnIndex(cols, keywords) {
    return cols.findIndex(col => {
        if (!col || !col.label) return false;
        const label = col.label.toLowerCase();
        return keywords.some(keyword => label.includes(keyword));
    });
}
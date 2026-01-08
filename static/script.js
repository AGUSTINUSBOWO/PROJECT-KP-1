// ==========================================
// KONFIGURASI SPREADSHEET
// ==========================================
// Ganti ID ini dengan ID Google Sheet Anda yang sebenarnya
const SPREADSHEET_ID = '15WY6r-LWkxmBn0agPJdM7oEgkOUHZghNHxfGWATGNHM'; 

// Daftar nama Sheet/Tab yang akan dibaca
const TABS = [
    "DN1", "DN2", "GK1", "GK2", "GM", "GT", "JT", "KG1", "KG2", 
    "KT", "MJ", "MG", "NG", "PA", "UH1", "UH2", "TR", "WB", 
    "Labkes", "DINKES", "RSUD", "RSP"
];

// Variabel Global untuk menyimpan data di memori
let cachedData = []; 
let isDataReady = false;

// ==========================================
// 1. INITIALIZATION & CACHING STRATEGY
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Cek apakah data sudah ada di LocalStorage (Cache Browser)
    const localData = localStorage.getItem('pegawaiData');
    const localTime = localStorage.getItem('pegawaiDataTime');
    const oneHour = 60 * 60 * 1000; // Kadaluarsa dalam 1 jam

    // Jika data ada & belum kadaluarsa, pakai data itu (Instan)
    if (localData && localTime && (new Date().getTime() - localTime < oneHour)) {
        cachedData = JSON.parse(localData);
        isDataReady = true;
        console.log("⚡ Data dimuat dari Cache (Instant Mode)");
        hideLoadingStatus();
    } else {
        // Jika tidak ada, download di background
        fetchAllDataBackground();
    }

    // Event Listener untuk tombol Enter
    const inputField = document.getElementById("searchInput");
    if(inputField) {
        inputField.addEventListener("keypress", function(event) {
            if (event.key === "Enter") {
                searchEmployee();
            }
        });
    }
});

// ==========================================
// 2. DATA FETCHING (BACKGROUND PROCESS)
// ==========================================
async function fetchAllDataBackground() {
    const statusDiv = document.getElementById('loadingStatus');
    if(statusDiv) statusDiv.classList.remove('hidden');

    console.log("🔄 Sedang mengunduh data terbaru...");

    try {
        // Fetch semua tab secara paralel (Asynchronous)
        const promises = TABS.map(tab => 
            fetch(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${tab}`)
                .then(res => res.text())
                .then(text => {
                    // Membersihkan format JSON dari Google Visualization API
                    const json = JSON.parse(text.substring(47).slice(0, -2));
                    return { tabName: tab, rows: json.table.rows, cols: json.table.cols };
                })
        );

        const results = await Promise.all(promises);
        
        // Menggabungkan semua data
        let allEmployees = [];
        results.forEach(sheet => {
            const processed = processSheetData(sheet.rows, sheet.cols, sheet.tabName);
            allEmployees = allEmployees.concat(processed);
        });

        // Simpan ke memori & LocalStorage
        cachedData = allEmployees;
        isDataReady = true;
        localStorage.setItem('pegawaiData', JSON.stringify(cachedData));
        localStorage.setItem('pegawaiDataTime', new Date().getTime());
        
        console.log("✅ Data berhasil diunduh dan disimpan.");
        hideLoadingStatus();

    } catch (error) {
        console.error("❌ Gagal mengambil data:", error);
        if(statusDiv) statusDiv.innerHTML = "<span style='color:red'>Gagal sinkronisasi data. Periksa koneksi.</span>";
    }
}

function hideLoadingStatus() {
    const statusDiv = document.getElementById('loadingStatus');
    if(statusDiv) statusDiv.classList.add('hidden');
}

// Fungsi untuk merapikan data mentah dari Google Sheets
function processSheetData(rows, cols, unitName) {
    // Mencari index kolom berdasarkan nama header (biar tidak error kalau kolom geser)
    const findIdx = (key) => cols.findIndex(c => c && c.label && c.label.toLowerCase().includes(key));
    
    const idxNama = findIdx('nama');
    const idxNip = findIdx('nip');
    const idxJab = findIdx('jabatan');
    const idxPangkat = findIdx('pangkat');
    const idxTmt = cols.findIndex(c => c && c.label && (c.label.toLowerCase().includes('tmt') || c.label.toLowerCase().includes('tanggal')));
    const idxAk = cols.findIndex(c => c && c.label && (c.label.toLowerCase().includes('total ak') || c.label.toLowerCase().includes('jumlah ak')));

    return rows.map(row => {
        const c = row.c;
        if (!c || !c[idxNama]) return null; // Skip baris kosong
        
        return {
            nama: c[idxNama] ? (c[idxNama].v || '') : '',
            nip: c[idxNip] ? String(c[idxNip].v).replace(/'/g, "") : '-',
            jabatan: c[idxJab] ? (c[idxJab].v || '-') : '-',
            pangkat: c[idxPangkat] ? (c[idxPangkat].v || '-') : '-',
            tmt: c[idxTmt] ? (c[idxTmt].f || c[idxTmt].v || '-') : '-',
            ak: c[idxAk] ? (parseFloat(c[idxAk].v) || 0) : 0,
            unit: unitName,
            // Kunci pencarian (gabungan nama & nip huruf kecil)
            searchKey: ((c[idxNama]?.v || '') + " " + (c[idxNip]?.v || '')).toLowerCase()
        };
    }).filter(item => item !== null && item.nama !== '');
}

// ==========================================
// 3. UI INTERACTION & SEARCH LOGIC
// ==========================================
function searchEmployee() {
    const input = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (!input) {
        alert("Mohon masukkan Nama atau NIP pegawai.");
        return;
    }

    // Ganti tampilan ke Loading Overlay
    document.getElementById('searchView').classList.add('hidden');
    document.getElementById('loadingView').classList.remove('hidden');

    // Delay buatan (0.6 detik) supaya transisi halus & tidak kaget
    setTimeout(() => {
        if (!isDataReady) {
            alert("Sedang mengunduh data terbaru, mohon tunggu sebentar lalu coba lagi.");
            resetView();
            return;
        }

        // --- PENCARIAN UTAMA ---
        const result = cachedData.find(p => p.searchKey.includes(input));
        
        document.getElementById('loadingView').classList.add('hidden');
        
        if (result) {
            showResult(result);
        } else {
            alert("Data pegawai tidak ditemukan! Pastikan nama atau NIP benar.");
            resetView();
        }
    }, 600); 
}

function showResult(data) {
    // Isi data ke elemen HTML
    setText('resNama', data.nama);
    setText('resNip', data.nip);
    setText('resJabatan', data.jabatan);
    setText('resUnit', data.unit);
    setText('resPangkat', data.pangkat);
    setText('resTMT', data.tmt);
    setText('resAK', data.ak.toFixed(3));

    // Logika Estimasi Sederhana
    let currentYear = new Date().getFullYear();
    let estimasiTahun = currentYear;
    
    // Contoh logika: Jika AK > 50, naik tahun depan. Jika kurang, 2 tahun lagi.
    if (data.ak >= 50) {
        estimasiTahun += 1;
    } else {
        estimasiTahun += 2;
    }

    document.getElementById('resEstimasi').innerHTML = `<i class="far fa-calendar-check"></i> 01 April ${estimasiTahun}`;
    
    // Tampilkan Card Hasil
    document.getElementById('resultView').classList.remove('hidden');
}

function resetView() {
    // Kembalikan ke tampilan awal
    document.getElementById('resultView').classList.add('hidden');
    document.getElementById('loadingView').classList.add('hidden');
    document.getElementById('searchView').classList.remove('hidden');
    
    const input = document.getElementById('searchInput');
    input.value = "";
    input.focus();
}

// Helper function
function setText(id, text) {
    const el = document.getElementById(id);
    if(el) el.innerText = text;
}
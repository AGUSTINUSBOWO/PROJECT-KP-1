// ==========================================
// 1. CONFIG & RULES
// ==========================================
const SPREADSHEET_ID = '15WY6r-LWkxmBn0agPJdM7oEgkOUHZghNHxfGWATGNHM';

const TABS = [
    "DN1", "DN2", "GK1", "GK2", "GM", "GT", "JT", "KG1", "KG2",
    "KT", "MJ", "MG", "NG", "PA", "UH1", "UH2", "TR", "WB",
    "Labkes", "DINKES", "RSUD", "RSP"
];

// ATURAN PENGHITUNGAN TAHUN PREDIKSI
const CAREER_RULES = {
    "terampil": { target: 100, coef: 5, type: "calc" },
    "mahir": { type: "info", msg: "Silahkan cek kriteria Penyelia / Naik ke Ahli" },
    "penyelia": { type: "stop", msg: "Sudah mentok, silahkan cek kriteria untuk naik ke ahli" },
    "ahli pertama": { target: 200, coef: 12.5, type: "calc" },
    "ahli muda": { target: 450, coef: 25, type: "calc" },
    "ahli madya": { target: 850, coef: 37.5, type: "calc" },
    "ahli utama": { type: "stop", msg: "Jenjang sudah mentok" }
};

let cachedData = [];
let isDataReady = false;

// ==========================================
// 2. INIT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    handleWelcomeScreen();

    // Gunakan versi cache baru untuk memaksa refresh data dengan logika baru
    const localData = localStorage.getItem('pegawaiDataFinalV2');
    const localTime = localStorage.getItem('pegawaiDataTimeFinalV2');
    const oneHour = 60 * 60 * 1000;

    if (localData && localTime && (Date.now() - localTime < oneHour)) {
        cachedData = JSON.parse(localData);
        isDataReady = true;
        hideLoadingStatus();
    } else {
        fetchAllDataBackground();
    }

    const input = document.getElementById("searchInput");
    if (input) {
        input.addEventListener("keypress", e => {
            if (e.key === "Enter") searchEmployee();
        });
    }
});

function handleWelcomeScreen() {
    const welcome = document.getElementById('welcomeScreen');
    const main = document.getElementById('mainAppContent');

    setTimeout(() => {
        welcome?.classList.add('slide-up');
        setTimeout(() => {
            main?.classList.remove('hidden-initially');
            setTimeout(() => welcome && (welcome.style.display = 'none'), 900);
        }, 300);
    }, 2500);
}

// ==========================================
// 3. FETCH DATA
// ==========================================
async function fetchAllDataBackground() {
    document.getElementById('loadingStatus')?.classList.remove('hidden');

    try {
        const promises = TABS.map(tab =>
            fetch(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${tab}`)
                .then(res => res.text())
                .then(text => {
                    const json = JSON.parse(text.substring(47).slice(0, -2));
                    return { tabName: tab, rows: json.table.rows, cols: json.table.cols };
                })
        );

        const results = await Promise.all(promises);
        let all = [];

        results.forEach(sheet => {
            all = all.concat(processSheetData(sheet.rows, sheet.cols, sheet.tabName));
        });

        cachedData = all;
        isDataReady = true;

        localStorage.setItem('pegawaiDataFinalV2', JSON.stringify(all));
        localStorage.setItem('pegawaiDataTimeFinalV2', Date.now());
        hideLoadingStatus();

    } catch (err) {
        console.error("Fetch error:", err);
    }
}

function hideLoadingStatus() {
    document.getElementById('loadingStatus')?.classList.add('hidden');
}

// ==========================================
// 4. HELPERS (LOGIKA REKAPAN)
// ==========================================

// Fungsi pembersih angka yang sama dengan fitur Rekapan
function cleanNumber(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    
    let str = String(val).trim();
    if (str === '-' || str === '') return 0;

    // Ganti koma dengan titik (Format Indonesia)
    str = str.replace(',', '.');
    // Hapus karakter selain angka, titik, minus
    str = str.replace(/[^\d.-]/g, '');

    const n = parseFloat(str);
    return isNaN(n) ? 0 : n;
}

// Format Tanggal untuk Tampilan
function formatGoogleDate(cell) {
    if (!cell) return '-';
    // Handle Date(yyyy,m,d) dari JSON Google
    if (cell.v && String(cell.v).includes("Date")) {
        const p = String(cell.v).match(/\d+/g);
        if (p && p.length >= 3) {
            return new Date(p[0], p[1], p[2])
                .toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        }
    }
    // Handle string biasa atau formatted value
    if (cell.f) return cell.f;
    if (cell.v) return String(cell.v);
    return '-';
}

// Ambil Tahun (Angka) dari data mentah untuk perhitungan prediksi
function getYearFromRaw(raw) {
    if (!raw) return new Date().getFullYear(); // Default tahun ini jika kosong
    
    // Jika format Date(2022,0,1)
    if (String(raw).includes("Date")) {
        const p = String(raw).match(/\d+/g);
        return p ? parseInt(p[0]) : new Date().getFullYear();
    }
    
    // Jika format string tanggal biasa
    const d = new Date(raw);
    if (!isNaN(d.getFullYear())) return d.getFullYear();
    
    return new Date().getFullYear();
}

// ==========================================
// 5. PROCESS SHEET DATA (INTI PERBAIKAN)
// ==========================================
function processSheetData(rows, cols, unitName) {
    // Helper cari index
    const findIdx = keys =>
        cols.findIndex(c => c?.label && keys.some(k => c.label.toLowerCase().includes(k)));

    // 1. Identifikasi Kolom Utama
    const idxNama = findIdx(['nama']);
    const idxNip = findIdx(['nip']);
    const idxJabatan = findIdx(['jabatan', 'jenjang']);
    const idxPangkat = findIdx(['pangkat']);

    // 2. DETEKSI TMT (Sesuai request: TMT Jabatan Terakhir & TMT Pangkat Terakhir)
    // Kita cari yang labelnya mengandung "tmt" DAN "jabatan"
    let idxTMTJabatan = cols.findIndex(c => 
        c?.label?.toLowerCase().includes('tmt') && 
        c.label.toLowerCase().includes('jabatan')
    );
    
    // Kita cari yang labelnya mengandung "tmt" DAN "pangkat"
    let idxTMTPangkat = cols.findIndex(c => 
        c?.label?.toLowerCase().includes('tmt') && 
        c.label.toLowerCase().includes('pangkat')
    );

    // 3. DETEKSI KOLOM TOTAL AK (Logika Rekapan)
    // Cari kolom yang mengandung "ak" DAN ("integrasi" ATAU tahun 4 digit)
    // Hindari kolom "target", "minimal", "jumlah", "total" (agar tidak double count jika ada kolom summary manual)
    const akIndexes = [];
    cols.forEach((c, i) => {
        const label = c?.label?.toLowerCase() || '';
        
        const isAK = label.includes('ak') || label.includes('angka kredit');
        const isYearOrIntegrasi = label.includes('integrasi') || /\d{4}/.test(label); // Regex 4 digit tahun
        const isExcluded = label.includes('target') || label.includes('syarat') || label.includes('min') || label.includes('total') || label.includes('jumlah');

        if (isAK && isYearOrIntegrasi && !isExcluded) {
            akIndexes.push(i);
        }
    });

    return rows.map(row => {
        const c = row.c;
        if (!c || !c[idxNama]) return null;

        // A. HITUNG TOTAL AK (Looping kolom yang terdeteksi)
        let totalAK = 0;
        akIndexes.forEach(i => {
            // Ambil value (v) atau formatted (f)
            const rawVal = c[i]?.v ?? c[i]?.f;
            // Bersihkan dengan cleanNumber (koma jadi titik)
            totalAK += cleanNumber(rawVal);
        });

        // B. AMBIL DATA TMT
        const cellTMTJab = idxTMTJabatan > -1 ? c[idxTMTJabatan] : null;
        const cellTMTPang = idxTMTPangkat > -1 ? c[idxTMTPangkat] : null;

        return {
            nama: c[idxNama]?.v || '',
            nip: c[idxNip]?.v ? String(c[idxNip].v).replace(/'/g, '') : '-',
            jabatan: (c[idxJabatan]?.v || '').toLowerCase(), // Lowercase untuk matching rules
            pangkat: c[idxPangkat]?.v || '-',
            
            // Simpan Total AK yang sudah dihitung
            ak: totalAK, 
            
            unit: unitName,

            // Simpan Data TMT (Raw untuk hitung, Display untuk UI)
            tmtJabatanRaw: cellTMTJab?.v,
            tmtPangkatRaw: cellTMTPang?.v,
            tmtJabatanDisplay: formatGoogleDate(cellTMTJab),
            tmtPangkatDisplay: formatGoogleDate(cellTMTPang),

            searchKey: ((c[idxNama]?.v || '') + ' ' + (c[idxNip]?.v || '')).toLowerCase()
        };
    }).filter(item => item && item.nama !== '');
}

// ==========================================
// 6. PREDIKSI SISTEM (OUTPUT TAHUN)
// ==========================================
function hitungPrediksiSistem(d) {
    const jabatanRaw = d.jabatan; // Sudah lowercase dari processSheetData
    let rule = null;

    // Matching Jabatan dengan Rules
    if (jabatanRaw.includes('terampil')) rule = CAREER_RULES['terampil'];
    else if (jabatanRaw.includes('mahir')) rule = CAREER_RULES['mahir'];
    else if (jabatanRaw.includes('penyelia')) rule = CAREER_RULES['penyelia'];
    else if (jabatanRaw.includes('pertama')) rule = CAREER_RULES['ahli pertama'];
    else if (jabatanRaw.includes('muda')) rule = CAREER_RULES['ahli muda'];
    else if (jabatanRaw.includes('madya')) rule = CAREER_RULES['ahli madya'];
    else if (jabatanRaw.includes('utama')) rule = CAREER_RULES['ahli utama'];

    // Jika Jabatan Tidak Dikenali
    if (!rule) {
        return { 
            status: 'info', 
            jabatanText: "Jabatan tidak terdaftar", 
            pangkatText: "-" 
        };
    }

    // Jika Status Mentok / Info Only
    if (rule.type === 'stop' || rule.type === 'info') {
        return {
            status: rule.type,
            jabatanText: rule.msg,
            pangkatText: "-"
        };
    }

    // --- KALKULASI TAHUN (Untuk tipe 'calc') ---
    const thisYear = new Date().getFullYear();

    // 1. Syarat Waktu (TMT + 2 Tahun)
    const yearTMTJab = getYearFromRaw(d.tmtJabatanRaw);
    const yearTMTPang = getYearFromRaw(d.tmtPangkatRaw);

    const readyYearJabByTime = yearTMTJab + 2;
    const readyYearPangByTime = yearTMTPang + 2;

    // 2. Syarat Angka Kredit (Total AK >= Target)
    const targetAK = rule.target;
    const currentAK = d.ak;
    const deficit = targetAK - currentAK;
    const coef = rule.coef; // Koefisien per tahun

    let yearsToCollectAK = 0;
    if (deficit > 0) {
        // Hitung berapa tahun lagi untuk menutup defisit
        yearsToCollectAK = Math.ceil(deficit / coef);
    }
    const readyYearByAK = thisYear + yearsToCollectAK;

    // 3. Kesimpulan Tahun (Ambil yang paling lama)
    // User baru bisa naik jika Syarat Waktu DAN Syarat AK terpenuhi
    let finalYearJabatan = Math.max(readyYearJabByTime, readyYearByAK);
    let finalYearPangkat = Math.max(readyYearPangByTime, readyYearByAK);

    // Format Tampilan
    const formatYear = (y) => y <= thisYear ? `${thisYear} (Siap)` : `Tahun ${y}`;

    return {
        status: 'calc',
        jabatanText: formatYear(finalYearJabatan),
        pangkatText: formatYear(finalYearPangkat)
    };
}

// ==========================================
// 7. SEARCH & UI
// ==========================================
function searchEmployee() {
    if (!isDataReady) return alert("Data sedang dimuat...");

    const input = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!input) return alert("Masukkan Nama atau NIP");

    document.getElementById('searchView')?.classList.add('hidden');
    document.getElementById('loadingView')?.classList.remove('hidden');

    setTimeout(() => {
        const d = cachedData.find(e => e.searchKey.includes(input));
        document.getElementById('loadingView')?.classList.add('hidden');
        d ? tampilkanHasil(d) : (alert("Pegawai tidak ditemukan"), resetView());
    }, 800);
}

function tampilkanHasil(d) {
    // Isi Data Dasar
    document.getElementById('resNama').innerText = d.nama;
    document.getElementById('resNip').innerText = d.nip;
    document.getElementById('resUnit').innerText = d.unit;
    // Tampilkan Jabatan (Kapitalisasi huruf pertama)
    document.getElementById('resJabatan').innerText = d.jabatan.replace(/\b\w/g, l => l.toUpperCase());
    document.getElementById('resPangkat').innerText = d.pangkat;
    
    // Tampilkan Total AK (Pembulatan 3 desimal untuk presisi, ditampilkan dengan format Indo)
    document.getElementById('resAK').innerText = d.ak.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

    // Tampilkan TMT (Diambil dari spreadsheet)
    document.getElementById('resTMTJabatan').innerText = d.tmtJabatanDisplay;
    document.getElementById('resTMTPangkat').innerText = d.tmtPangkatDisplay;

    // Tampilkan Hasil Prediksi
    const prediksi = hitungPrediksiSistem(d);
    
    // Kita cari container hasil prediksi, atau buat jika belum ada (sesuai struktur HTML Anda)
    // Asumsi di HTML ada elemen dengan ID 'resEstimasi'
    const estEl = document.getElementById('resEstimasi');
    
    if (prediksi.status === 'stop' || prediksi.status === 'info') {
        estEl.innerHTML = `
            <div style="text-align:center; width:100%;">
                <h3 style="margin-bottom:5px;"><i class="fas fa-info-circle"></i> Status Karir</h3>
                <p style="font-size:1.1rem; line-height:1.4;">${prediksi.jabatanText}</p>
            </div>
        `;
    } else {
        estEl.innerHTML = `
            <div>
                <p style="margin-bottom:5px; opacity:0.8; font-size:0.9rem;">Estimasi Naik Pangkat</p>
                <h3 style="font-size:1.6rem; color:#ffd700;">${prediksi.pangkatText}</h3>
            </div>
            <div style="border-left: 1px solid rgba(255,255,255,0.2);">
                <p style="margin-bottom:5px; opacity:0.8; font-size:0.9rem;">Estimasi Naik Jabatan</p>
                <h3 style="font-size:1.6rem; color:#ffd700;">${prediksi.jabatanText}</h3>
            </div>
        `;
    }

    document.getElementById('resultView')?.classList.remove('hidden');
}

function resetView() {
    document.getElementById('resultView')?.classList.add('hidden');
    document.getElementById('searchView')?.classList.remove('hidden');
    document.getElementById('searchInput').value = '';
}

function toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('active');
    document.querySelector('.sidebar-overlay')?.classList.toggle('active');
}
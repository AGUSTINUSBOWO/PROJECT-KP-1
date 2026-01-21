// ==========================================
// 1. CONFIG & RULES
// ==========================================
const SPREADSHEET_ID = '15WY6r-LWkxmBn0agPJdM7oEgkOUHZghNHxfGWATGNHM'; 

const TABS = [
    "DN1", "DN2", "GK1", "GK2", "GM", "GT", "JT", "KG1", "KG2", 
    "KT", "MJ", "MG", "NG", "PA", "UH1", "UH2", "TR", "WB", 
    "Labkes", "DINKES", "RSUD", "RSP"
];

const CAREER_RULES = {
    "Terampil": { targetPoint: 100, nextJenjang: "Mahir", coef: 5, isMax: false },
    "Mahir": { targetPoint: 100, nextJenjang: "Penyelia", coef: 12.5, isMax: false },
    "Penyelia": { isMax: true, message: "Pangkat Puncak (Mentok)", coef: 25 },
    "Ahli Pertama": { targetPoint: 200, nextJenjang: "Ahli Muda", coef: 12.5, isMax: false },
    "Ahli Muda": { targetPoint: 450, nextJenjang: "Ahli Madya", coef: 25, isMax: false },
    "Ahli Madya": { targetPoint: 850, nextJenjang: "Ahli Utama", coef: 37.5, isMax: false },
    "Ahli Utama": { isMax: true, message: "Pangkat Puncak (Mentok)", coef: 50 }
};

let cachedData = []; 
let isDataReady = false;

document.addEventListener('DOMContentLoaded', () => {
    handleWelcomeScreen();

    // Cache management (1 hour)
    const localData = localStorage.getItem('pegawaiDataV4'); // Versi cache dinaikkan
    const localTime = localStorage.getItem('pegawaiDataTimeV4');
    const oneHour = 60 * 60 * 1000; 

    if (localData && localTime && (new Date().getTime() - localTime < oneHour)) {
        cachedData = JSON.parse(localData);
        isDataReady = true;
        hideLoadingStatus();
    } else {
        fetchAllDataBackground();
    }

    const inputField = document.getElementById("searchInput");
    if(inputField) {
        inputField.addEventListener("keypress", function(event) {
            if (event.key === "Enter") searchEmployee();
        });
    }
});

function handleWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcomeScreen');
    const mainContent = document.getElementById('mainAppContent');
    setTimeout(() => {
        if(welcomeScreen) welcomeScreen.classList.add('slide-up');
        setTimeout(() => {
            if(mainContent) mainContent.classList.remove('hidden-initially');
            setTimeout(() => { 
                if(welcomeScreen) welcomeScreen.style.display = 'none'; 
            }, 900);
        }, 300); 
    }, 2500); 
}

// ==========================================
// 2. DATA FETCHING (SMART PARSING)
// ==========================================
async function fetchAllDataBackground() {
    const statusDiv = document.getElementById('loadingStatus');
    if(statusDiv) statusDiv.classList.remove('hidden');

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
        let allEmployees = [];
        results.forEach(sheet => {
            allEmployees = allEmployees.concat(processSheetData(sheet.rows, sheet.cols, sheet.tabName));
        });

        cachedData = allEmployees;
        isDataReady = true;
        localStorage.setItem('pegawaiDataV4', JSON.stringify(cachedData));
        localStorage.setItem('pegawaiDataTimeV4', new Date().getTime());
        hideLoadingStatus();

    } catch (error) {
        console.error("Gagal sinkronisasi:", error);
    }
}

function hideLoadingStatus() {
    const statusDiv = document.getElementById('loadingStatus');
    if(statusDiv) statusDiv.classList.add('hidden');
}

// HELPER PENTING: Membersihkan Angka (Mengatasi Koma vs Titik)
function cleanNumber(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    
    // Ubah ke string
    let str = String(val).trim();
    if (str === '-' || str === '') return 0;

    // Ganti koma dengan titik (Format Indonesia 12,5 -> 12.5)
    str = str.replace(',', '.');
    
    // Hapus karakter selain angka dan titik
    str = str.replace(/[^\d.-]/g, '');

    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

// HELPER: Format Tanggal
function formatGoogleDate(cell) {
    if (!cell) return '-';
    // Case 1: Format string "Date(2022,0,1)"
    if (cell.v && typeof cell.v === 'string' && cell.v.includes("Date")) {
        const parts = cell.v.match(/\d+/g);
        if (parts && parts.length >= 3) {
            const y = parseInt(parts[0]);
            const m = parseInt(parts[1]); 
            const d = parseInt(parts[2]);
            const dateObj = new Date(y, m, d);
            return dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        }
    }
    // Case 2: Formatted string
    if (cell.f) return cell.f;
    // Case 3: Value biasa
    if (cell.v) return String(cell.v);
    return '-';
}

function processSheetData(rows, cols, unitName) {
    const findIdx = (keywords) => cols.findIndex(c => 
        c && c.label && keywords.some(k => c.label.toLowerCase().includes(k))
    );
    
    // 1. Identifikasi Kolom Dasar
    const idxNama = findIdx(['nama']);
    const idxNip = findIdx(['nip']);
    const idxJab = findIdx(['jabatan', 'jenjang']);
    const idxPangkat = findIdx(['pangkat']);
    
    // 2. DETEKSI TMT (Lebih Luas)
    // Cari kolom yang mengandung "tmt" DAN ("jab" atau "lantik")
    // Ini menangkap: "TMT Jabatan", "TMT Jab.", "TMT Pelantikan", dll.
    let idxTmtJab = cols.findIndex(c => c && c.label && 
        c.label.toLowerCase().includes('tmt') && 
        (c.label.toLowerCase().includes('jab') || c.label.toLowerCase().includes('lantik'))
    );
    
    // Fallback ekstrem jika masih -1: Cari kolom yang namanya HANYA "tmt"
    if (idxTmtJab === -1) {
         idxTmtJab = cols.findIndex(c => c && c.label && c.label.toLowerCase().trim() === 'tmt');
    }

    let idxTmtPang = cols.findIndex(c => c && c.label && 
        c.label.toLowerCase().includes('tmt') && 
        c.label.toLowerCase().includes('pangkat')
    );

    // 3. DINAMIS AK CALCULATION (FUTURE PROOF)
    const akIndices = [];
    cols.forEach((c, index) => {
        if (c && c.label) {
            const label = c.label.toLowerCase();
            // Logic: Ada kata "ak" ATAU "angka kredit"
            // DAN (Ada kata "integrasi" ATAU ada 4 digit tahun)
            // TAPI BUKAN kolom "target" atau "minimal"
            const isAKKeyword = label.includes('ak') || label.includes('angka kredit');
            const isYearOrIntegrasi = label.includes('integrasi') || /\d{4}/.test(label);
            const isTarget = label.includes('target') || label.includes('min') || label.includes('syarat');

            if (isAKKeyword && isYearOrIntegrasi && !isTarget) {
                akIndices.push(index);
            }
        }
    });

    return rows.map(row => {
        const c = row.c;
        if (!c || !c[idxNama]) return null; 
        
        // --- LOGIKA PENJUMLAHAN AK ---
        let totalAK = 0;
        akIndices.forEach(idx => {
            if (c[idx]) {
                // Ambil nilai, prioritas value asli, fallback formatted
                const rawVal = c[idx].v !== null ? c[idx].v : (c[idx].f || 0);
                // Bersihkan angka (koma jadi titik)
                totalAK += cleanNumber(rawVal);
            }
        });

        // Ambil Data TMT
        const rawTmtJab = c[idxTmtJab];
        const rawTmtPang = c[idxTmtPang];

        return {
            nama: c[idxNama] ? (c[idxNama].v || '') : '',
            nip: c[idxNip] ? String(c[idxNip].v).replace(/'/g, "") : '-',
            jabatan: c[idxJab] ? (c[idxJab].v || '-') : '-',
            pangkat: c[idxPangkat] ? (c[idxPangkat].v || '-') : '-',
            
            // Simpan format tanggal untuk display UI
            tmtJabatanDisplay: formatGoogleDate(rawTmtJab),
            tmtPangkatDisplay: formatGoogleDate(rawTmtPang),
            
            // Simpan raw value untuk kalkulasi tahun
            tmtJabatanRaw: rawTmtJab ? (rawTmtJab.v || '') : '',
            tmtPangkatRaw: rawTmtPang ? (rawTmtPang.v || '') : '',
            
            ak: parseFloat(totalAK.toFixed(3)), // Hasil penjumlahan bersih
            unit: unitName,
            searchKey: ((c[idxNama]?.v || '') + " " + (c[idxNip]?.v || '')).toLowerCase()
        };
    }).filter(item => item !== null && item.nama !== '');
}

// ==========================================
// 3. UI & PREDIKSI
// ==========================================
function searchEmployee() {
    const input = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!input) return alert("Mohon masukkan Nama atau NIP.");

    document.getElementById('searchView').classList.add('hidden');
    document.getElementById('loadingView').classList.remove('hidden');

    setTimeout(() => {
        if (!isDataReady) {
            alert("Sedang sinkronisasi data. Coba lagi sebentar.");
            resetView(); return;
        }

        const result = cachedData.find(emp => emp.searchKey.includes(input));
        document.getElementById('loadingView').classList.add('hidden');

        if (result) tampilkanHasil(result);
        else { alert("Pegawai tidak ditemukan."); resetView(); }
    }, 1000);
}

function tampilkanHasil(data) {
    document.getElementById('resNama').innerText = data.nama;
    document.getElementById('resNip').innerText = data.nip;
    document.getElementById('resJabatan').innerText = data.jabatan;
    document.getElementById('resUnit').innerText = data.unit;
    document.getElementById('resPangkat').innerText = data.pangkat;
    document.getElementById('resAK').innerText = data.ak.toLocaleString('id-ID'); // Format angka Indo

    // Tampilkan TMT
    document.getElementById('resTMTJabatan').innerText = data.tmtJabatanDisplay;
    document.getElementById('resTMTPangkat').innerText = data.tmtPangkatDisplay;

    const prediksi = hitungPrediksi(data);
    const estEl = document.getElementById('resEstimasi');
    
    if (prediksi.status === 'mentok') {
        estEl.innerHTML = `
            <div style="flex:1;">
                <h3><i class="fas fa-check-circle"></i> Status Puncak</h3>
                <p>${prediksi.pesan}</p>
            </div>
        `;
    } else {
        estEl.innerHTML = `
            <div>
                <p>Estimasi Naik Pangkat</p>
                <h3>Tahun ${prediksi.tahunPangkat}</h3>
            </div>
            <div style="border-left: 1px solid rgba(255,255,255,0.2);">
                <p>Estimasi Naik Jabatan</p>
                <h3>Tahun ${prediksi.tahunJabatan}</h3>
            </div>
        `;
    }

    document.getElementById('resultView').classList.remove('hidden');
}

// Helper parsing tahun untuk kalkulasi
function getYearFromRaw(raw) {
    if (!raw) return new Date().getFullYear();
    if (typeof raw === 'string' && raw.includes("Date")) {
        const parts = raw.match(/\d+/g);
        return parts ? parseInt(parts[0]) : new Date().getFullYear();
    }
    const d = new Date(raw);
    if (!isNaN(d.getFullYear())) return d.getFullYear();
    return new Date().getFullYear();
}

function hitungPrediksi(data) {
    let jabatanRaw = data.jabatan.toLowerCase();
    let currentRuleKey = null;

    if(jabatanRaw.includes('terampil')) currentRuleKey = 'Terampil';
    else if(jabatanRaw.includes('mahir')) currentRuleKey = 'Mahir';
    else if(jabatanRaw.includes('penyelia')) currentRuleKey = 'Penyelia';
    else if(jabatanRaw.includes('pertama')) currentRuleKey = 'Ahli Pertama';
    else if(jabatanRaw.includes('muda')) currentRuleKey = 'Ahli Muda';
    else if(jabatanRaw.includes('madya')) currentRuleKey = 'Ahli Madya';
    else if(jabatanRaw.includes('utama')) currentRuleKey = 'Ahli Utama';

    if (!currentRuleKey) return { status: 'mentok', pesan: 'Jabatan tidak terdaftar.' };

    const rule = CAREER_RULES[currentRuleKey];
    if (rule.isMax) return { status: 'mentok', pesan: rule.message };

    const thisYear = new Date().getFullYear();
    const tmtJabYear = getYearFromRaw(data.tmtJabatanRaw);
    const tmtPangYear = getYearFromRaw(data.tmtPangkatRaw);
    
    // Syarat Min 2 Tahun
    const minYearJabatan = tmtJabYear + 2;
    const minYearPangkat = tmtPangYear + 2;

    // Syarat AK
    const deficit = rule.targetPoint - data.ak;
    let yearsToCollect = 0;
    if (deficit > 0) {
        yearsToCollect = Math.ceil(deficit / rule.coef);
    }
    const finishAKYear = thisYear + yearsToCollect;

    let predJab = Math.max(minYearJabatan, finishAKYear);
    let predPang = Math.max(minYearPangkat, finishAKYear);
    
    if (predJab <= thisYear) predJab = `${thisYear} (Siap)`;
    if (predPang <= thisYear) predPang = `${thisYear} (Siap)`;

    return {
        status: 'ok',
        tahunJabatan: predJab,
        tahunPangkat: predPang
    };
}

function resetView() {
    document.getElementById('resultView').classList.add('hidden');
    document.getElementById('loadingView').classList.add('hidden');
    document.getElementById('searchView').classList.remove('hidden');
    document.getElementById('searchInput').value = '';
    document.getElementById('searchInput').focus(); 
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.querySelector('.sidebar-overlay').classList.toggle('active');
}

// ================= MENU & SPLASH LOGIC (UPDATED) =================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}
const SPREADSHEET_ID = '15WY6r-LWkxmBn0agPJdM7oEgkOUHZghNHxfGWATGNHM';

const TABS = [
    "DN1", "DN2", "GK1", "GK2", "GM", "GT", "JT", "KG1", "KG2",
    "KT", "MJ", "MG", "NG", "PA", "UH1", "UH2", "TR", "WB",
    "Labkes", "DINKES", "RSUD", "RSP"
];

const CAREER_RULES = {
    "terampil": { target: 100, coef: 5, type: "calc" },
    "mahir": { type: "info", msg: "Silahkan cek kriteria Penyelia / Naik ke Ahli" },
    "penyelia": { type: "stop", msg: "Jabatan Puncak, silahkan cek kriteria untuk naik ke ahli" },
    "ahli pertama": { target: 200, coef: 12.5, type: "calc" },
    "ahli muda": { target: 450, coef: 25, type: "calc" },
    "ahli madya": { type: "stop", msg: "Sudah Mencapai Jabatan Puncak" },
    "ahli utama": { type: "stop", msg: "Sudah Mencapai Jabatan Puncak" }
};

let cachedData = [];
let isDataReady = false;
document.addEventListener('DOMContentLoaded', () => {
    handleWelcomeScreen();
    const localData = localStorage.getItem('pegawaiDataFinalV6');
    const localTime = localStorage.getItem('pegawaiDataTimeFinalV6');
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

        localStorage.setItem('pegawaiDataFinalV6', JSON.stringify(all));
        localStorage.setItem('pegawaiDataTimeFinalV6', Date.now());
        hideLoadingStatus();

    } catch (err) {
        console.error("Fetch error:", err);
        alert("Gagal mengambil data. Cek koneksi internet.");
    }
}

function hideLoadingStatus() {
    document.getElementById('loadingStatus')?.classList.add('hidden');
}

function cleanNumber(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    
    let str = String(val).trim();
    if (str === '-' || str === '') return 0;

    str = str.replace(',', '.');
    str = str.replace(/[^\d.-]/g, '');

    const n = parseFloat(str);
    return isNaN(n) ? 0 : n;
}

function formatGoogleDate(cell) {
    if (!cell) return '-';
    if (cell.v && String(cell.v).includes("Date")) {
        const p = String(cell.v).match(/\d+/g);
        if (p && p.length >= 3) {
            return new Date(p[0], p[1], p[2])
                .toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        }
    }
    if (cell.f) return cell.f;
    if (cell.v) return String(cell.v);
    return '-';
}

function getYearFromRaw(raw) {
    if (!raw) return new Date().getFullYear();
    if (String(raw).includes("Date")) {
        const p = String(raw).match(/\d+/g);
        return p ? parseInt(p[0]) : new Date().getFullYear();
    }
    const d = new Date(raw);
    if (!isNaN(d.getFullYear())) return d.getFullYear();
    return new Date().getFullYear();
}
function processSheetData(rows, cols, unitName) {
    const getColIndex = (keywords, defaultIndex) => {
        const idx = cols.findIndex(c => c?.label && keywords.every(k => c.label.toLowerCase().includes(k)));
        return idx > -1 ? idx : defaultIndex;
    };
    const idxNama = getColIndex(['nama'], 1); 
    const idxNip = getColIndex(['nip'], 2);  
    let idxJabatan = cols.findIndex(c => c?.label && (c.label.toLowerCase().includes('jabatan') || c.label.toLowerCase().includes('jenjang')));
    if (idxJabatan === -1) idxJabatan = 4; 

    const idxPangkat = getColIndex(['pangkat'], 5); 
    const idxTMTJabatan = getColIndex(['tmt', 'jab'], 8); 
    const idxTMTPangkat = getColIndex(['tmt', 'pang'], 9); 
    const akIndexes = [];
    cols.forEach((c, i) => {
        const label = c?.label?.toLowerCase() || '';
        const isAK = label.includes('ak') || label.includes('angka kredit');
        const isYear = label.includes('integrasi') || /\d{4}/.test(label);
        const isExcluded = label.includes('target') || label.includes('syarat') || label.includes('min') || label.includes('total') || label.includes('jumlah');

        if (isAK && isYear && !isExcluded) {
            akIndexes.push(i);
        }
    });

    return rows.map(row => {
        const c = row.c;
        if (!c || !c[idxNama]) return null;
        const nama = c[idxNama]?.v || '';
        if (!nama || nama.toLowerCase().includes('nama pegawai')) return null; 

        const nipVal = c[idxNip]?.v ? String(c[idxNip].v).replace(/'/g, '') : '-';
        let rawJabatan = c[idxJabatan]?.v || ''; 
        if (typeof rawJabatan !== 'string') rawJabatan = String(rawJabatan);
        
        const jabatan = rawJabatan.toLowerCase();
        const pangkat = c[idxPangkat]?.v || '-';

        let totalAK = 0;
        akIndexes.forEach(i => {
            const rawVal = c[i]?.v ?? c[i]?.f;
            totalAK += cleanNumber(rawVal);
        });

        const cellTMTJab = c[idxTMTJabatan] || null;
        const cellTMTPang = c[idxTMTPangkat] || null;

        return {
            nama: nama,
            nip: nipVal,
            jabatan: jabatan,
            pangkat: pangkat,
            ak: totalAK, 
            unit: unitName,
            tmtJabatanRaw: cellTMTJab?.v,
            tmtPangkatRaw: cellTMTPang?.v,
            tmtJabatanDisplay: formatGoogleDate(cellTMTJab),
            tmtPangkatDisplay: formatGoogleDate(cellTMTPang),

            searchKey: (nama + ' ' + nipVal).toLowerCase()
        };
    }).filter(item => item); 
}

function hitungPrediksiSistem(d) {
    const jabatanRaw = d.jabatan; 
    let rule = null;
    if (jabatanRaw.includes('terampil')) rule = CAREER_RULES['terampil'];
    else if (jabatanRaw.includes('mahir')) rule = CAREER_RULES['mahir'];
    else if (jabatanRaw.includes('penyelia')) rule = CAREER_RULES['penyelia'];
    else if (jabatanRaw.includes('pertama')) rule = CAREER_RULES['ahli pertama'];
    else if (jabatanRaw.includes('muda')) rule = CAREER_RULES['ahli muda'];
    else if (jabatanRaw.includes('madya')) rule = CAREER_RULES['ahli madya'];
    else if (jabatanRaw.includes('utama')) rule = CAREER_RULES['ahli utama'];
    if (!rule) {
        return { 
            status: 'info', 
            jabatanText: d.jabatan ? "Jabatan tidak terdaftar" : "Data Jabatan Kosong", 
            pangkatText: "-" 
        };
    }

    if (rule.type === 'stop' || rule.type === 'info') {
        return { status: rule.type, jabatanText: rule.msg, pangkatText: "-" };
    }

    const thisYear = new Date().getFullYear();
    const yearTMTJab = getYearFromRaw(d.tmtJabatanRaw);
    const yearTMTPang = getYearFromRaw(d.tmtPangkatRaw);

    const readyYearJabByTime = yearTMTJab + 2;
    const readyYearPangByTime = yearTMTPang + 2;

    const targetAK = rule.target;
    const currentAK = d.ak;
    const deficit = targetAK - currentAK;
    const coef = rule.coef;

    let yearsToCollectAK = 0;
    if (deficit > 0) {
        yearsToCollectAK = Math.ceil(deficit / coef);
    }
    const readyYearByAK = thisYear + yearsToCollectAK;

    let finalYearJabatan = Math.max(readyYearJabByTime, readyYearByAK);
    let finalYearPangkat = Math.max(readyYearPangByTime, readyYearByAK);

    const formatYear = (y) => y <= thisYear ? `${thisYear} (Siap)` : `Tahun ${y}`;

    return {
        status: 'calc',
        jabatanText: formatYear(finalYearJabatan),
        pangkatText: formatYear(finalYearPangkat)
    };
}

function searchEmployee() {
    if (!isDataReady) return alert("Data sedang dimuat... Tunggu sebentar.");

    const input = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!input) return alert("Masukkan Nama atau NIP");

    document.getElementById('searchView')?.classList.add('hidden');
    document.getElementById('loadingView')?.classList.remove('hidden');

    setTimeout(() => {
        const d = cachedData.find(e => e.searchKey.includes(input));
        document.getElementById('loadingView')?.classList.add('hidden');
        
        if (d) {
            tampilkanHasil(d);
        } else {
            alert("Pegawai tidak ditemukan.");
            resetView();
        }
    }, 800);
}

function tampilkanHasil(d) {
    document.getElementById('resNama').innerText = d.nama;
    document.getElementById('resNip').innerText = d.nip;
    document.getElementById('resUnit').innerText = d.unit;
    const displayJabatan = d.jabatan.length > 1 
        ? d.jabatan.replace(/\b\w/g, l => l.toUpperCase()) 
        : '-';
    document.getElementById('resJabatan').innerText = displayJabatan;
    
    document.getElementById('resPangkat').innerText = d.pangkat;
    document.getElementById('resAK').innerText = d.ak.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
    document.getElementById('resTMTJabatan').innerText = d.tmtJabatanDisplay;
    document.getElementById('resTMTPangkat').innerText = d.tmtPangkatDisplay;

    const prediksi = hitungPrediksiSistem(d);
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
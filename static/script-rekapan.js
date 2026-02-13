const SPREADSHEET_ID = '15WY6r-LWkxmBn0agPJdM7oEgkOUHZghNHxfGWATGNHM';
const SHEET_TABS = [
    "DN1", "DN2", "GK1", "GK2", "GM", "GT", "JT", "KG1", "KG2",
    "KT", "MJ", "MG", "NG", "PA", "UH1", "UH2", "TR", "WB",
    "Labkes", "DINKES", "RSUD", "RSP"
];

const PANGKAT_REF = [
    { code: "II/a", name: "Pengatur Muda", level: 5 },
    { code: "II/b", name: "Pengatur Muda Tk. I", level: 6 },
    { code: "II/c", name: "Pengatur", level: 7 },
    { code: "II/d", name: "Pengatur Tk. I", level: 8 },
    { code: "III/a", name: "Penata Muda", level: 9 },
    { code: "III/b", name: "Penata Muda Tk. I", level: 10 },
    { code: "III/c", name: "Penata", level: 11 },
    { code: "III/d", name: "Penata Tk. I", level: 12 },
    { code: "IV/a", name: "Pembina", level: 13 },
    { code: "IV/b", name: "Pembina Tk. I", level: 14 },
    { code: "IV/c", name: "Pembina Utama Muda", level: 15 },
    { code: "IV/d", name: "Pembina Utama Madya", level: 16 },
    { code: "IV/e", name: "Pembina Utama", level: 17 }
];

const JABATAN_RULES = {
    "pemula": { minPangkat: ["II/a"], targetAK: 15 },
    "terampil": { minPangkat: ["II/b", "II/c", "II/d"], targetAK: 20 },
    "mahir": { minPangkat: ["III/a", "III/b"], targetAK: 50 },
    "penyelia": { minPangkat: ["III/c", "III/d"], targetAK: 100 },
    "ahli pertama": { minPangkat: ["III/a", "III/b"], targetAK: 50 },
    "ahli muda": { minPangkat: ["III/c", "III/d"], targetAK: 100 },
    "ahli madya": { minPangkat: ["IV/a", "IV/b", "IV/c"], targetAK: 150 },
    "ahli utama": { minPangkat: ["IV/d", "IV/e"], targetAK: 200 }
};

let CURRENT_SHEET_DATA = [];
let DETECTED_YEARS = [];

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

document.addEventListener('click', function(event) {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.querySelector('.menu-toggle');
    if (!sidebar.contains(event.target) && !toggle.contains(event.target) && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const splash = document.getElementById('splash-screen');
    const loadingOverlay = document.getElementById('loading');
    loadingOverlay.classList.add('hidden');
    setTimeout(() => {
        splash.classList.add('hidden');
        generateTabs();
        setupFilters();
        loadSheetData(SHEET_TABS[0]);
    }, 2000);
});

async function loadSheetData(sheetName) {
    const loading = document.getElementById('loading');
    loading.classList.remove('hidden');
    document.querySelectorAll('.tabs button').forEach(b => {
        b.classList.remove('active');
        if (b.innerText === sheetName) b.classList.add('active');
    });

    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    try {
        const response = await fetch(url);
        const text = await response.text();
        const json = JSON.parse(text.substring(47).slice(0, -2));
        const normalized = normalizeData(json.table.rows, json.table.cols, sheetName);
        CURRENT_SHEET_DATA = normalized.data;
        DETECTED_YEARS = normalized.years;
        updateYearDropdown(DETECTED_YEARS);
        populatePangkatDropdown();
        populateUnitDropdown(CURRENT_SHEET_DATA);
        populateProfesiDropdown(CURRENT_SHEET_DATA);
        populatePensionDropdown(CURRENT_SHEET_DATA);
        applyLogicAndRender();
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('table-body').innerHTML = `<tr><td colspan="12" class="text-center">Gagal memuat data.</td></tr>`;
    } finally {
        setTimeout(() => loading.classList.add('hidden'), 500);
    }
}

function normalizeData(rows, cols, sheetName) {
    const getIdx = (key) => cols.findIndex(c => c && c.label && c.label.toLowerCase().includes(key));
    const idx = {
        nama: getIdx('nama'), jabatan: getIdx('jabatan'),
        nip: cols.findIndex(c => c && c.label && (c.label.toLowerCase().includes("nip") && !c.label.toLowerCase().includes("nik"))),
        nik: cols.findIndex(c => c && c.label && (c.label.toLowerCase().includes("nik"))),
        profesi: cols.findIndex(c => c && c.label && c.label.toLowerCase().includes("profesi")),
        unit: cols.findIndex(c => c && c.label && (c.label.toLowerCase().includes("unit") || c.label.toLowerCase().includes("tempat"))),
        pangkat: getIdx('pangkat'),
        tmtJab: cols.findIndex(c => c && c.label && (c.label.toLowerCase().includes("tmt jabatan") || c.label.toLowerCase().includes("tmt jafung"))),
        tmtPkt: cols.findIndex(c => c && c.label && (c.label.toLowerCase().includes("tmt pangkat") || c.label.toLowerCase().includes("tmt gol")))
    };

    if (idx.profesi === -1) idx.profesi = 5;
    if (idx.nip === -1) idx.nip = getIdx('nip');
    if (idx.unit === -1 && cols.length > 1) idx.unit = -99;

    let akColIndices = [], akYearMap = {}, foundYears = [];
    cols.forEach((col, i) => {
        if (col && col.label) {
            let label = col.label.toLowerCase(), yearMatch = label.match(/20\d{2}/);
            if (label.includes("ak") && !label.includes("total") && yearMatch) {
                let year = yearMatch[0];
                if (!foundYears.includes(year)) foundYears.push(year);
                akYearMap[year] = i; akColIndices.push(i);
            }
        }
    });
    foundYears.sort((a, b) => b - a);

    return {
        data: rows.map(row => {
            const c = row.c;
            if (!c) return null;
            const val = (i) => (i !== -1 && c[i]) ? (c[i].v !== null ? String(c[i].v) : '-') : '-';
            let totalAK = 0;
            akColIndices.forEach(colIndex => { let v = parseFloat(val(colIndex).replace(',', '.')); if (!isNaN(v)) totalAK += v; });
            let akPerYear = {}; foundYears.forEach(y => { akPerYear[y] = val(akYearMap[y]); });
            let stdJab = standardizeJabatan(val(idx.jabatan));
            let stdPkt = standardizePangkat(val(idx.pangkat));
            let unitName = (idx.unit === -99) ? sheetName : val(idx.unit);
            if (unitName === '-' || unitName === '') unitName = sheetName;

            return {
                nama: val(idx.nama), nip: val(idx.nip), nik: val(idx.nik),
                profesi: val(idx.profesi), jabatan: stdJab,
                unit: unitName, pangkat: stdPkt, rawPangkat: val(idx.pangkat),
                akData: akPerYear, totalAK: totalAK.toFixed(3),
                tmtJab: val(idx.tmtJab), tmtPkt: val(idx.tmtPkt),
                kesiapan: analyzeReadiness(stdJab, stdPkt, val(idx.tmtJab), val(idx.tmtPkt), totalAK),
                anomali: checkAnomaly(stdPkt, stdJab),
                pensiun: calculatePensionInfo(val(idx.nip), stdJab),
                _search: (val(idx.nama) + " " + unitName + " " + val(idx.profesi) + " " + stdJab).toLowerCase()
            };
        }).filter(i => i !== null && i.nama !== '-' && i.nama !== 'Nama'),
        years: foundYears
    };
}

function populatePangkatDropdown() {
    const select = document.getElementById('filterPangkat');
    select.innerHTML = '<option value="">Semua Pangkat</option>';
    PANGKAT_REF.forEach(p => select.add(new Option(`${p.code} - ${p.name}`, p.code)));
}

function populateUnitDropdown(data) {
    const s = document.getElementById('filterUnit'); s.innerHTML = '<option value="">Semua Unit</option>';
    [...new Set(data.map(d => d.unit))].sort().forEach(u => s.add(new Option(u, u)));
}

function populateProfesiDropdown(data) {
    const s = document.getElementById('filterProfesi'); s.innerHTML = '<option value="">Semua</option>';
    [...new Set(data.map(d => d.profesi))].sort().forEach(p => s.add(new Option(p, p)));
}

function populatePensionDropdown(data) {
    const select = document.getElementById('filterTahunPensiun');
    if (!select) return;
    select.innerHTML = '<option value="">Semua Tahun</option>';
    let years = [...new Set(data.map(d => d.pensiun.year).filter(y => y !== 9999))];
    years.sort((a, b) => a - b);
    years.forEach(y => select.add(new Option(y, y)));
}

function updateYearDropdown(years) {
    const s = document.getElementById('filterTahun'); s.innerHTML = '';
    if (years.length === 0) s.add(new Option("-", ""));
    else years.forEach(y => s.add(new Option(y, y)));
}

function standardizePangkat(raw) {
    if (!raw) return '-';
    let match = raw.match(/\b(I|II|III|IV)\s*\/\s*([a-e])\b/i);
    return match ? `${match[1].toUpperCase()}/${match[2].toLowerCase()}` : raw;
}

function standardizeJabatan(raw) {
    if (!raw) return '-';
    let r = raw.toLowerCase();
    if (r.includes("ahli pertama")) return "Ahli Pertama";
    if (r.includes("ahli muda")) return "Ahli Muda";
    if (r.includes("ahli madya")) return "Ahli Madya";
    if (r.includes("ahli utama")) return "Ahli Utama";
    if (r.includes("penyelia")) return "Penyelia";
    if (r.includes("mahir")) return "Mahir";
    if (r.includes("terampil")) return "Terampil";
    if (r.includes("pemula")) return "Pemula";
    return raw.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function getPangkatLevel(code) {
    const p = PANGKAT_REF.find(x => x.code === code);
    return p ? p.level : 0;
}

function checkAnomaly(pangkatCode, jabatanName) {
    return null;
}

function calculatePensionInfo(nip, jabatan) {
    if (!nip || nip.length < 8) return { text: '-', isNear: false, year: 9999 };
    const yLahir = parseInt(nip.substring(0, 4)), mLahir = parseInt(nip.substring(4, 6));
    if (isNaN(yLahir)) return { text: '-', isNear: false, year: 9999 };
    let limit = (jabatan.toLowerCase().includes('ahli madya') || jabatan.toLowerCase().includes('ahli utama')) ? 60 : 58;
    const pYear = yLahir + limit;
    const now = new Date();
    const monthsLeft = (pYear - now.getFullYear()) * 12 + ((mLahir - 1) - now.getMonth());
    const mName = new Date(pYear, mLahir - 1, 1).toLocaleDateString('id-ID', { month: 'long' });
    return { text: `${mName} ${pYear}`, year: pYear, isNear: monthsLeft <= 12 && monthsLeft > 0 };
}

function analyzeReadiness(jab, pkt, tmtJab, tmtPkt, ak) {
    let s = [], rule = JABATAN_RULES[jab.toLowerCase()];
    if (!rule) return ["-"];
    if (ak >= rule.targetAK) s.push("Siap Naik Pangkat");
    if (checkTimeDiff(tmtJab) && ak >= rule.targetAK) s.push("Siap Naik Jabatan");
    return s.length ? s : ["Belum Siap"];
}

function checkTimeDiff(tmtStr) {
    if (!tmtStr) return false;
    let match = tmtStr.match(/20\d{2}/);
    return match ? (new Date().getFullYear() - parseInt(match[0])) >= 2 : false;
}

function applyLogicAndRender() {
    const fUnit = document.getElementById('filterUnit').value.toLowerCase();
    const fProf = document.getElementById('filterProfesi').value.toLowerCase();
    const fJab = document.getElementById('filterJabatan').value.toLowerCase();
    const fPkt = document.getElementById('filterPangkat').value;
    const searchVal = document.getElementById('globalSearch').value.toLowerCase();
    const fKesiapan = document.getElementById('filterKesiapan').value;
    const fPensiun = document.getElementById('filterTahunPensiun') ? document.getElementById('filterTahunPensiun').value : "";

    const filtered = CURRENT_SHEET_DATA.filter(row => {
        const mSearch = searchVal === "" || row._search.includes(searchVal);
        const mUnit = fUnit === "" || row.unit.toLowerCase().includes(fUnit);
        const mProf = fProf === "" || row.profesi.toLowerCase().includes(fProf);
        const mJab = fJab === "" || row.jabatan.toLowerCase().includes(fJab);
        const mPkt = fPkt === "" || row.pangkat === fPkt;
        const mPensiun = fPensiun === "" || row.pensiun.year.toString() === fPensiun;
        let mSiap = true;
        if (fKesiapan) mSiap = row.kesiapan.some(s => s.toLowerCase().includes(fKesiapan.toLowerCase()));
        return mSearch && mUnit && mProf && mJab && mPkt && mSiap && mPensiun;
    });
    renderTable(filtered, document.getElementById('filterTahun').value);
}

function renderTable(data, selectedYear) {
    const tbody = document.getElementById('table-body');
    const footer = document.getElementById('footerInfo');
    tbody.innerHTML = '';
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" class="text-center" style="padding:20px;">Tidak ada data ditemukan.</td></tr>`;
        footer.innerText = "0 Data";
        return;
    }
    data.forEach(item => {
        const tr = document.createElement('tr');
        let akDisplay = (selectedYear && item.akData[selectedYear]) ? item.akData[selectedYear] : "-";
        let badges = item.kesiapan.map(k => {
            let color = "secondary";
            if (k.includes("Naik Pangkat")) color = "success";
            if (k.includes("Naik Jabatan")) color = "primary";
            if (k.includes("Mentok")) color = "warning";
            return `<span class="badge badge-${color}">${k}</span>`;
        }).join(" ");
        let pangkatLabel = item.pangkat;
        let pInfo = PANGKAT_REF.find(p => p.code === item.pangkat);
        if (pInfo) pangkatLabel = `${item.pangkat}<br><span style="font-size:10px; color:#666;">${pInfo.name}</span>`;
        
        let anomalyIcon = item.anomali ? `<span class="anomaly-btn" onclick="Swal.fire({icon:'warning', title:'Perhatian', text:'${item.anomali}'})"><i class="fas fa-exclamation"></i></span>` : '';
        let pensionAlert = item.pensiun.isNear ? `<span class="pension-alert-btn" title="Pensiun < 1 Tahun"><i class="fas fa-hourglass-half"></i></span>` : '';

        tr.innerHTML = `
            <td><div style="font-weight:600; display:flex; align-items:center;">${item.nama} ${anomalyIcon} ${pensionAlert}</div></td>
            <td>${item.nip}</td>
            <td>${item.nik}</td>
            <td>${item.profesi}</td> <td>${item.jabatan}</td>
            <td>${item.unit}</td>
            <td class="text-center">${pangkatLabel}</td>
            <td class="text-center" style="color:#4e73df; font-weight:bold;">${akDisplay}</td>
            <td class="text-center" style="background:#eaffea; color:#1cc88a; font-weight:800; font-size:1.1em;">${item.totalAK}</td>
            <td>${badges}</td>
            <td style="font-weight:500;">${item.pensiun.text}</td>
        `;
        tbody.appendChild(tr);
    });
    footer.innerText = `Menampilkan ${data.length} Pegawai`;
}

function setupFilters() {
    const jabs = ["Ahli Pertama", "Ahli Muda", "Ahli Madya", "Ahli Utama", "Pemula", "Terampil", "Mahir", "Penyelia"];
    jabs.forEach(j => document.getElementById('filterJabatan').add(new Option(j, j)));
    ['globalSearch', 'filterJabatan', 'filterPangkat', 'filterUnit', 'filterProfesi', 'filterTahun', 'filterKesiapan', 'filterTahunPensiun'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', applyLogicAndRender);
    });
}

function generateTabs() {
    const c = document.getElementById('tab-container'); c.innerHTML = '';
    SHEET_TABS.forEach(t => {
        let b = document.createElement('button'); b.innerText = t;
        b.onclick = () => loadSheetData(t);
        c.appendChild(b);
    });
}
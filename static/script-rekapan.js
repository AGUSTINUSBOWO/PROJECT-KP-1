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
    }, 3000); 
});

async function loadSheetData(sheetName) {
    const loading = document.getElementById('loading');
    loading.classList.remove('hidden');

    document.querySelectorAll('.tabs button').forEach(b => {
        b.classList.remove('active');
        if(b.innerText === sheetName) b.classList.add('active');
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

        applyLogicAndRender();
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('table-body').innerHTML = `<tr><td colspan="11" class="text-center">Gagal memuat data.</td></tr>`;
    } finally {
        setTimeout(() => loading.classList.add('hidden'), 500);
    }
}

function normalizeData(rows, cols, sheetName) {
    const getIdx = (key) => cols.findIndex(c => c && c.label && c.label.toLowerCase().includes(key));
    
    const idx = {
        nama: getIdx('nama'),
        jabatan: getIdx('jabatan'),
        nip: cols.findIndex(c => c && c.label && (c.label.toLowerCase().includes("nip") && !c.label.toLowerCase().includes("nik"))),
        nik: cols.findIndex(c => c && c.label && (c.label.toLowerCase().includes("nik"))),
        profesi: cols.findIndex(c => c && c.label && c.label.toLowerCase().includes("profesi")),
        unit: cols.findIndex(c => c && c.label && (
                c.label.toLowerCase().includes("unit") || 
                c.label.toLowerCase().includes("tempat") || 
                c.label.toLowerCase().includes("lokasi")
              )),
        pangkat: getIdx('pangkat'),
        tmtJab: cols.findIndex(c => c && c.label && (c.label.toLowerCase().includes("tmt jabatan") || c.label.toLowerCase().includes("tmt jafung"))),
        tmtPkt: cols.findIndex(c => c && c.label && (c.label.toLowerCase().includes("tmt pangkat") || c.label.toLowerCase().includes("tmt gol")))
    };

    if (idx.profesi === -1) idx.profesi = 5; 
    if (idx.nip === -1) idx.nip = getIdx('nip'); 
    
    if (idx.unit === -1 && cols.length > 1) {
        if (idx.nama !== 1 && idx.nip !== 1) idx.unit = 1; 
    }

    let akColIndices = []; 
    let akYearMap = {}; 
    let foundYears = [];

    cols.forEach((col, i) => {
        if (col && col.label) {
            let label = col.label.toLowerCase();
            let yearMatch = label.match(/20\d{2}/);
            let isIntegrasi = label.includes("integrasi");
            let isAK = label.includes("ak");
            let isExcluded = label.includes("total") || label.includes("jumlah") || label.includes("minimal");

            if (isAK && (yearMatch || isIntegrasi) && !isExcluded) {
                akColIndices.push(i);
                if (yearMatch) {
                    let year = yearMatch[0];
                    if (!foundYears.includes(year)) foundYears.push(year);
                    akYearMap[year] = i;
                }
            }
        }
    });
    foundYears.sort((a, b) => b - a);

    const data = rows.map(row => {
        const c = row.c;
        if (!c) return null;

        const val = (i) => (i !== -1 && c[i]) ? (c[i].v !== null ? String(c[i].v) : (c[i].f || '-')) : '-';

        let totalAK = 0;
        akColIndices.forEach(colIndex => {
            let rawVal = val(colIndex);
            if (rawVal !== '-') {
                let cleanVal = parseFloat(rawVal.replace(',', '.'));
                if (!isNaN(cleanVal)) totalAK += cleanVal;
            }
        });

        let akPerYear = {};
        foundYears.forEach(y => { akPerYear[y] = val(akYearMap[y]); });

        let stdJab = standardizeJabatan(val(idx.jabatan));
        let rawPangkatStr = val(idx.pangkat);
        let stdPkt = standardizePangkat(rawPangkatStr); 
        
        let realUnit = val(idx.unit); 
        if (realUnit === '-' || realUnit === '') realUnit = sheetName;

        let statusKesiapan = analyzeReadiness(stdJab, stdPkt, val(idx.tmtJab), val(idx.tmtPkt), totalAK);
        let anomaliMsg = checkAnomaly(stdPkt, stdJab);
        let pensionInfo = calculatePensionInfo(val(idx.nip), stdJab);

        return {
            nama: val(idx.nama),
            nip: val(idx.nip),
            nik: val(idx.nik),
            profesi: val(idx.profesi), 
            jabatan: stdJab,
            unit: realUnit, 
            pangkat: stdPkt, 
            rawPangkat: rawPangkatStr,
            akData: akPerYear,
            totalAK: totalAK.toFixed(3),
            kesiapan: statusKesiapan,
            anomali: anomaliMsg, 
            pensiun: pensionInfo, 
            _search: (val(idx.nama) + " " + val(idx.nip) + " " + realUnit + " " + rawPangkatStr + " " + val(idx.profesi)).toLowerCase()
        };
    }).filter(item => item !== null && item.nama !== '-');

    return { data, years: foundYears };
}

function populatePangkatDropdown() {
    const select = document.getElementById('filterPangkat');
    select.innerHTML = '<option value="">Semua Pangkat</option>';
    PANGKAT_REF.forEach(p => {
        let label = `${p.code} - ${p.name}`;
        let option = new Option(label, p.code);
        select.add(option);
    });
}

function populateUnitDropdown(data) {
    const select = document.getElementById('filterUnit');
    select.innerHTML = '<option value="">Semua Unit</option>';
    let units = [...new Set(data.map(d => d.unit).filter(u => u !== '-'))].sort();
    units.forEach(u => select.add(new Option(u, u)));
}

function populateProfesiDropdown(data) {
    const select = document.getElementById('filterProfesi');
    select.innerHTML = '<option value="">Semua</option>';
    let profesiList = [...new Set(data.map(d => d.profesi).filter(p => p !== '-' && p !== ''))].sort();
    profesiList.forEach(p => select.add(new Option(p, p)));
}

function updateYearDropdown(years) {
    const sel = document.getElementById('filterTahun');
    sel.innerHTML = '';
    if (years.length === 0) { sel.add(new Option("-", "")); return; }
    years.forEach(y => sel.add(new Option(y, y)));
}

function standardizePangkat(raw) {
    if (!raw || raw === '-') return '-';
    let r = raw.trim(); 
    let matchCode = r.match(/\b(I|II|III|IV)\s*\/\s*([a-e])\b/i);
    if (matchCode) {
        let romawi = matchCode[1].toUpperCase();
        let huruf = matchCode[2].toLowerCase();
        return `${romawi}/${huruf}`;
    }
    let rLower = r.toLowerCase();
    let found = PANGKAT_REF.find(p => rLower.includes(p.name.toLowerCase()));
    if (found) return found.code;
    return raw; 
}

function standardizeJabatan(raw) {
    if (!raw || raw === '-') return '-';
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
    const jabRule = JABATAN_RULES[jabatanName.toLowerCase()];
    if (!jabRule || !pangkatCode || pangkatCode === '-') return null;

    const currentLevel = getPangkatLevel(pangkatCode);
    if (currentLevel === 0) return null;

    const minPangkatCode = jabRule.minPangkat[0];
    const maxPangkatCode = jabRule.minPangkat[jabRule.minPangkat.length - 1];
    
    const minLevel = getPangkatLevel(minPangkatCode);
    const maxLevel = getPangkatLevel(maxPangkatCode);

    if (currentLevel > maxLevel) {
        return "Sudah naik pangkat namun jabatan tetap";
    } else if (currentLevel < minLevel) {
        return "Sudah naik jabatan namun pangkat tetap";
    }

    return null; 
}

function calculatePensionInfo(nip, jabatan) {
    if (!nip || nip.length < 8) return { text: '-', isNear: false };

    const yearLahir = parseInt(nip.substring(0, 4));
    const monthLahir = parseInt(nip.substring(4, 6));

    if (isNaN(yearLahir) || isNaN(monthLahir)) return { text: '-', isNear: false };

    let limitUsia = 58; 
    if (jabatan.toLowerCase().includes('ahli madya')) {
        limitUsia = 60;
    }

    const pensionYear = yearLahir + limitUsia;
    const pensionDate = new Date(pensionYear, monthLahir - 1, 1); 

    const now = new Date();
    const monthsLeft = (pensionYear - now.getFullYear()) * 12 + ((monthLahir - 1) - now.getMonth());

    const monthName = pensionDate.toLocaleDateString('id-ID', { month: 'long' });
    const text = `${monthName} ${pensionYear}`;

    return {
        text: text,
        isNear: monthsLeft <= 12 && monthsLeft > 0 
    };
}

function analyzeReadiness(jabatan, pangkat, tmtJab, tmtPkt, totalAK) {
    let status = [];
    let key = jabatan.toLowerCase();
    const rule = JABATAN_RULES[key];

    if (!rule) return ["-"];

    const isAKCukup = totalAK >= rule.targetAK;
    const isTMTJabOk = checkTimeDiff(tmtJab);
    const isTMTPktOk = checkTimeDiff(tmtPkt);

    if (isAKCukup && isTMTJabOk) {
        if(key !== 'penyelia' && key !== 'ahli utama') status.push("Siap Naik Jabatan");
        else status.push("Mentok Jenjang");
    }
    if (isAKCukup && isTMTPktOk) status.push("Siap Naik Pangkat");

    if (status.length === 0) return ["Belum Siap"];
    return status;
}

function checkTimeDiff(tmtStr) {
    if(!tmtStr || tmtStr === '-') return false;
    let match = tmtStr.match(/20\d{2}/);
    if(match) {
        let year = parseInt(match[0]);
        let currYear = new Date().getFullYear();
        return (currYear - year) >= 2;
    }
    return false;
}

function applyLogicAndRender() {
    const searchVal = document.getElementById('globalSearch').value.toLowerCase();
    const fJab = document.getElementById('filterJabatan').value.toLowerCase();
    const fPkt = document.getElementById('filterPangkat').value; 
    const fUnit = document.getElementById('filterUnit').value.toLowerCase();
    const fProf = document.getElementById('filterProfesi').value.toLowerCase(); 
    const fSiap = document.getElementById('filterKesiapan').value;
    const fTahun = document.getElementById('filterTahun').value;

    const filtered = CURRENT_SHEET_DATA.filter(row => {
        const mSearch = row._search.includes(searchVal);
        const mJab = fJab === "" || row.jabatan.toLowerCase().includes(fJab);
        const mPkt = fPkt === "" || row.pangkat === fPkt; 
        const mUnit = fUnit === "" || row.unit.toLowerCase().includes(fUnit);
        const mProf = fProf === "" || row.profesi.toLowerCase() === fProf; 
        
        let mSiap = true;
        if(fSiap) mSiap = row.kesiapan.some(s => s.toLowerCase().includes(fSiap.toLowerCase()));

        return mSearch && mJab && mPkt && mUnit && mProf && mSiap;
    });

    renderTable(filtered, fTahun);
}

function renderTable(data, selectedYear) {
    const tbody = document.getElementById('table-body');
    const footer = document.getElementById('footerInfo');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center" style="padding:20px;">Tidak ada data ditemukan.</td></tr>`;
        footer.innerText = "0 Data";
        return;
    }

    data.forEach(item => {
        const tr = document.createElement('tr');
        
        let akDisplay = (selectedYear && item.akData[selectedYear]) ? item.akData[selectedYear] : "-";

        let badges = item.kesiapan.map(k => {
            let color = "secondary";
            if(k.includes("Naik Pangkat")) color = "success";
            if(k.includes("Naik Jabatan")) color = "primary";
            if(k.includes("Mentok")) color = "warning";
            return `<span class="badge badge-${color}">${k}</span>`;
        }).join(" ");

        let pangkatLabel = item.pangkat; 
        let pangkatInfo = PANGKAT_REF.find(p => p.code === item.pangkat);
        if (pangkatInfo) {
            pangkatLabel = `${item.pangkat}<br><span style="font-size:10px; color:#666;">${pangkatInfo.name}</span>`;
        } else {
            pangkatLabel = `${item.pangkat}<br><span style="font-size:10px; color:#999;">${item.rawPangkat}</span>`;
        }
        
        let anomalyIcon = '';
        if (item.anomali) {
            const onClickAttr = `onclick="Swal.fire({
                icon: 'warning',
                title: 'Perhatian',
                text: '${item.anomali}',
                confirmButtonColor: '#4e73df'
            })"`;
            anomalyIcon = `<span class="anomaly-btn" ${onClickAttr} title="Klik untuk info"><i class="fas fa-exclamation"></i></span>`;
        }

        let pensionAlert = '';
        if (item.pensiun.isNear) {
            const onClickPension = `onclick="Swal.fire({
                icon: 'info',
                title: 'Persiapan Pensiun',
                text: '1 tahun lagi akan pensiun',
                confirmButtonColor: '#f6c23e'
            })"`;
            pensionAlert = `<span class="pension-alert-btn" ${onClickPension} title="Masa pensiun dekat"><i class="fas fa-hourglass-half"></i></span>`;
        }

        tr.innerHTML = `
            <td>
                <div style="font-weight:600; display:flex; align-items:center;">
                    ${item.nama} ${anomalyIcon} ${pensionAlert}
                </div>
            </td>
            <td>${item.nip}</td>
            <td>${item.nik}</td>
            <td>${item.profesi}</td> <td>${item.jabatan}</td>
            <td>${item.unit}</td>
            <td class="text-center">${pangkatLabel}</td>
            <td class="text-center" style="color:#4e73df; font-weight:bold;">${akDisplay}</td>
            <td class="text-center" style="background:#eaffea; color:#1cc88a; font-weight:800; font-size:1.1em;">${item.totalAK}</td>
            <td>${badges}</td>
            <td style="font-weight:500;">
                ${item.pensiun.text}
            </td>
        `;
        tbody.appendChild(tr);
    });

    footer.innerText = `Menampilkan ${data.length} Pegawai`;
}

function setupFilters() {
    const jabs = ["Ahli Pertama", "Ahli Muda", "Ahli Madya", "Ahli Utama", "Pemula", "Terampil", "Mahir", "Penyelia"];
    jabs.forEach(j => document.getElementById('filterJabatan').add(new Option(j, j)));

    ['globalSearch', 'filterJabatan', 'filterPangkat', 'filterUnit', 'filterProfesi', 'filterTahun', 'filterKesiapan'].forEach(id => {
        document.getElementById(id).addEventListener('input', applyLogicAndRender);
    });
}

function generateTabs() {
    const c = document.getElementById('tab-container');
    c.innerHTML = ''; 
    SHEET_TABS.forEach(t => {
        const btn = document.createElement('button');
        btn.innerText = t;
        btn.onclick = () => loadSheetData(t);
        c.appendChild(btn);
    });
}
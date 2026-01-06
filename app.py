from flask import Flask, render_template, request
import pandas as pd
import requests
import io
import numpy as np

app = Flask(__name__)

# ================= KONFIGURASI =================
SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRyCvFcDxZgI0E4oTeGjf3JUxb9UAAXrObd39qnU-CDhEMhVjkLfCvuz1nrAhtaiWjLNbA4ModnEEtp/pub?output=xlsx"
# ===============================================

def bersihkan_nama_kolom(daftar_kolom):
    """Membersihkan header kolom."""
    seen = {}
    new_columns = []
    for col in daftar_kolom:
        name = str(col).replace('\n', ' ').strip()
        name = " ".join(name.split())
        
        if name.lower() in ['nan', '', 'none', 'unnamed']:
            name = 'TanpaJudul'
            
        if name in seen:
            seen[name] += 1
            new_name = f"{name}.{seen[name]}"
        else:
            seen[name] = 0
            new_name = name
        new_columns.append(new_name)
    return new_columns

def cari_posisi_header(df):
    """Mencari baris header NIP dan Nama."""
    for i in range(min(20, len(df))):
        baris = df.iloc[i].astype(str).str.lower().tolist()
        teks_baris = " ".join(baris)
        # Baris header harus mengandung kata 'nip' atau 'nama'
        if 'nip' in teks_baris or 'nama' in teks_baris:
            if len(teks_baris) > 10: 
                return i
    return -1

def cari_nama_kolom_asli(daftar_kolom, kata_kunci):
    for col in daftar_kolom:
        if kata_kunci in str(col).lower():
            return col
    return None

def get_merged_data():
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(SHEET_URL, headers=headers, timeout=30)
        response.raise_for_status()
        
        xls_raw = pd.read_excel(io.BytesIO(response.content), sheet_name=None, header=None, engine='openpyxl')
        
        all_data = []
        
        for sheet_name, df_raw in xls_raw.items():
            # 1. Cari Posisi Header
            idx_header = cari_posisi_header(df_raw)
            if idx_header == -1: continue 

            raw_header = df_raw.iloc[idx_header].tolist()
            df = df_raw.iloc[idx_header+1:].copy()
            df.columns = bersihkan_nama_kolom(raw_header)

            # 2. Identifikasi Kolom Dasar
            col_nama = cari_nama_kolom_asli(df.columns, 'nama')
            col_nip = cari_nama_kolom_asli(df.columns, 'nip')
            col_tmt = cari_nama_kolom_asli(df.columns, 'tmt')
            col_pangkat = cari_nama_kolom_asli(df.columns, 'pangkat')

            # =========================================================
            # LOGIKA PENENTUAN UNIT KERJA (FIXED)
            # =========================================================
            sheet_lower = str(sheet_name).lower()
            
            # --- SKENARIO 1: INSTANSI KHUSUS (1 Sheet = 1 Instansi) ---
            if any(x in sheet_lower for x in ['dinkes', 'dinas']):
                df['FIX_UNIT'] = "Dinas Kesehatan"
                
            elif any(x in sheet_lower for x in ['lab', 'labkes', 'laboratorium']):
                df['FIX_UNIT'] = "Laboratorium Kesehatan Masyarakat"
                
            elif 'rsud' in sheet_lower:
                df['FIX_UNIT'] = "RSUD"
                
            elif any(x in sheet_lower for x in ['pratama', 'rsp']):
                df['FIX_UNIT'] = "RS Pratama"
                
            # --- SKENARIO 2: PUSKESMAS / LAINNYA ---
            else:
                try:
                    # Cek apakah ada kolom index ke-1 (Kolom B)
                    if len(df.columns) > 1:
                        # Ambil seluruh data kolom B
                        df['FIX_UNIT'] = df.iloc[:, 1].astype(str)
                        
                        # Bersihkan data sampah (nan, -, 0) agar bisa di-fill down
                        df['FIX_UNIT'] = df['FIX_UNIT'].replace(['nan', 'None', '', '-', '0', '.', 'NaN'], np.nan)
                        df['FIX_UNIT'] = df['FIX_UNIT'].replace(r'^\s*$', np.nan, regex=True)
                        
                        # FILL DOWN: Mengisi baris kosong dengan data di atasnya (untuk merge cell)
                        df['FIX_UNIT'] = df['FIX_UNIT'].ffill()
                        
                        # Jika kolom B kosong melompong, baru pakai nama sheet
                        df['FIX_UNIT'] = df['FIX_UNIT'].fillna(str(sheet_name))
                    else:
                        df['FIX_UNIT'] = str(sheet_name)
                except:
                    df['FIX_UNIT'] = str(sheet_name)

            # 3. Rename ke Standar Coding
            rename_map = {}
            if col_nama: rename_map[col_nama] = 'FIX_NAMA'
            if col_nip: rename_map[col_nip] = 'FIX_NIP'
            if col_tmt: rename_map[col_tmt] = 'FIX_TMT'
            if col_pangkat: rename_map[col_pangkat] = 'FIX_PANGKAT'
            
            df = df.rename(columns=rename_map)
            df = df.astype(str)
            
            # Bersihkan NIP
            if 'FIX_NIP' in df.columns:
                df['FIX_NIP'] = df['FIX_NIP'].str.replace(r'[^\d]', '', regex=True)
            
            all_data.append(df)
            
        if all_data:
            return pd.concat(all_data, ignore_index=True, sort=False), None
        else:
            return None, "Data Excel kosong."

    except Exception as e:
        return None, f"Error Load Data: {str(e)}"

def hitung_prediksi(tmt_string):
    try:
        tmt_string = str(tmt_string).strip().replace('nan', '')
        if not tmt_string or tmt_string in ['-', '0']: return "-"
        
        tmt_date = pd.to_datetime(tmt_string, dayfirst=True, errors='coerce')
        if pd.isna(tmt_date): return "-"
        
        prediksi_date = tmt_date + pd.DateOffset(years=4)
        
        bulan_indo = {
            'January': 'Januari', 'February': 'Februari', 'March': 'Maret',
            'April': 'April', 'May': 'Mei', 'June': 'Juni',
            'July': 'Juli', 'August': 'Agustus', 'September': 'September',
            'October': 'Oktober', 'November': 'November', 'December': 'Desember'
        }
        tanggal_hasil = prediksi_date.strftime('%d %B %Y')
        for eng, indo in bulan_indo.items():
            tanggal_hasil = tanggal_hasil.replace(eng, indo)
        return tanggal_hasil
    except:
        return "-"

@app.route('/', methods=['GET', 'POST'])
def index():
    pegawai = None
    prediksi = None
    error = None

    if request.method == 'POST':
        keyword = request.form.get('keyword', '').lower().strip()
        
        if not keyword:
            error = "Masukkan NIP atau Nama."
        else:
            df, msg_error = get_merged_data()

            if df is not None:
                if 'FIX_NAMA' not in df.columns:
                    error = "Kolom Nama tidak ditemukan."
                else:
                    mask = (
                        df['FIX_NAMA'].str.lower().str.contains(keyword, na=False) | 
                        df['FIX_NIP'].str.contains(keyword, na=False)
                    )
                    hasil = df[mask]

                    if not hasil.empty:
                        data_row = hasil.iloc[0].to_dict()
                        tmt_sekarang = data_row.get('FIX_TMT', '-')
                        prediksi = hitung_prediksi(tmt_sekarang)
                        
                        unit_final = str(data_row.get('FIX_UNIT', '-')).strip()
                        
                        if unit_final.lower() in ['nan', 'none', '', 'nat']:
                            unit_final = "Unit Kerja Tidak Terdeteksi"

                        pegawai = {
                            'nip': data_row.get('FIX_NIP', '-'),
                            'nama': data_row.get('FIX_NAMA', '-'),
                            'pangkat': data_row.get('FIX_PANGKAT', '-'),
                            'tmt': tmt_sekarang,
                            'unit': unit_final
                        }
                    else:
                        error = "Data pegawai tidak ditemukan."
            else:
                error = msg_error

    return render_template('index.html', pegawai=pegawai, prediksi=prediksi, error=error)

# ========================================================
# LANGKAH A: PENAMBAHAN ROUTE UNTUK HALAMAN REKAPAN
# ========================================================
@app.route('/rekapan')
def rekapan():
    # Hanya me-render HTML. Pengambilan data dilakukan oleh JS di frontend
    return render_template('rekapan.html')

if __name__ == '__main__':
    app.run(debug=True)
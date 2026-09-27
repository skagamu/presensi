# 📋 Sistem Presensi RFID – SMK Gajah Mungkur 1 Wuryantoro

Sistem presensi terintegrasi berbasis **RFID + Google Apps Script** untuk mencatat kehadiran guru dan siswa secara otomatis, dilengkapi panel admin dan fitur pengajuan izin.

---

## 🗂️ Struktur File

```
presensi/
├── Code.gs          # Backend utama Google Apps Script (v4.0 – aktif)
├── Code.js          # Versi lama backend (v3.1 – arsip/legacy)
├── index.html       # UI kiosk scanner RFID (layar presensi)
├── admin.html       # Panel admin (dashboard, rekap, kelola data)
├── appsscript.json  # Konfigurasi GAS (timezone, OAuth scopes, webapp)
├── manifest.json    # PWA manifest (agar bisa diinstall sebagai app)
├── .clasp.json      # Konfigurasi clasp CLI untuk push ke Google Apps Script
└── .gitignore
```

---

## 🏗️ Arsitektur Sistem

```
Scanner RFID (ESP/Arduino)
        │
        ▼
  index.html (Kiosk UI)
        │  POST /logPresensi
        ▼
  Code.gs (Google Apps Script Web App)
        │
        ▼
  Google Spreadsheet
  ├── Sheet: Database    → Master data guru & siswa
  ├── Sheet: Presensi    → Log scan RFID harian
  └── Sheet: Data Izin   → Log permohonan izin
```

**Spreadsheet ID:** `1vrpYndWiuHcKbomBQO5in2EzMn94zinzu1EM5xifoFU`

---

## 📄 Struktur Sheet Spreadsheet

| Sheet | Kolom |
|-------|-------|
| **Database** | RFID ID · Nama · Peran (GURU/SISWA) |
| **Presensi** | Timestamp · RFID ID · Nama · Peran · Status (DATANG/PULANG) |
| **Data Izin** | Timestamp Pengajuan · Nama · Peran · Jenis Izin · Tgl Izin · Alasan · Foto |

---

## 🔌 API Endpoint

Web App di-deploy sebagai **public anonymous** (`ANYONE_ANONYMOUS`).

### GET Requests

| Parameter | Deskripsi |
|-----------|-----------|
| `?action=getPresensi` | Gabungan log Presensi + Data Izin (untuk dashboard) |
| `?action=getDataIzin` | Data permohonan izin murni |
| *(tanpa action)* | Data master Database (daftar guru & siswa) |

### POST Requests

| `action` | Payload | Deskripsi |
|----------|---------|-----------|
| `logPresensi` | `rfid_id, name, peran, timestamp` | Catat scan RFID; otomatis toggle DATANG → PULANG per hari |
| `logIzin` | `nama, kedudukan, jenis_izin, hari_tgl, alasan, fileUrl` | Catat permohonan izin + embed foto dari Google Drive |
| `addStudent` | `rfid_id, nama, peran` | Tambah guru/siswa baru (cek duplikat RFID) |
| `deleteStudent` | `rfid_id` | Hapus data berdasarkan RFID ID |

---

## 🖥️ Fitur Frontend

### `index.html` – Kiosk Scanner
- Input RFID tersembunyi dengan auto-focus (siap scan kapan saja)
- Tampilkan nama, peran, dan status **DATANG / PULANG** dengan animasi
- Jam real-time + tanggal (format Indonesia)
- Jadwal sholat Wonogiri (kalkulasi offline + fallback Aladhan API)
- **Offline support**: antrian scan disimpan lokal, sync otomatis saat online
- PWA-ready (Service Worker terdaftar)

### `admin.html` – Panel Admin
- Sidebar navigasi multi-halaman
- Tabel log presensi dengan filter tanggal & pencarian
- Rekap statistik harian (hadir, tidak hadir, izin)
- Kelola database guru/siswa (tambah & hapus)
- Export data ke **CSV**
- Toast notifikasi & indikator status koneksi

---

## 🚀 Deploy & Development

### Prasyarat
- [Node.js](https://nodejs.org) & [clasp](https://github.com/google/clasp) terinstall
- Akun Google dengan akses ke Spreadsheet & Apps Script

### Setup clasp
```bash
# Install clasp global
npm install -g @google/clasp

# Login ke Google
clasp login

# Push kode ke Google Apps Script
clasp push
```

### Deploy Web App
1. Buka [script.google.com](https://script.google.com)
2. Pilih project → **Deploy** → **New deployment**
3. Tipe: **Web App**
4. Execute as: `Me (burhanyudhaprawira@gmail.com)`
5. Who has access: `Anyone`
6. Salin URL deployment → update `API_URL` di `index.html` dan `admin.html`

---

## ⚙️ Konfigurasi

| Setting | Nilai |
|---------|-------|
| Timezone | `Asia/Jakarta` |
| Runtime GAS | V8 |
| Akses Webapp | `ANYONE_ANONYMOUS` |
| OAuth Scopes | Spreadsheets, Drive, External Request |

---

## 📝 Changelog

| Versi | File | Perubahan |
|-------|------|-----------|
| **v4.0** | `Code.gs` | Izin dipisah ke sheet "Data Izin"; `getPresensi` menggabungkan keduanya; timestamp pakai prefix `'` agar tidak dikonversi Google Sheets |
| **v3.1** | `Code.js` | `logIzin` masih menulis langsung ke sheet Presensi; belum ada sheet Data Izin terpisah |

---

## 👤 Pengembang

**SMK Gajah Mungkur 1 Wuryantoro**  
Kontak: burhanyudhaprawira@gmail.com

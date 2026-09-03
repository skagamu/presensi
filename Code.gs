// ============================================================
//  Google Apps Script – Presensi RFID SMK GM 1 Wuryantoro
//  Versi 4.0 – Unified Presensi & Data Izin on doGet
// ============================================================

var SPREADSHEET_ID = "1vrpYndWiuHcKbomBQO5in2EzMn94zinzu1EM5xifoFU";

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getDatabase";
  var ss = getSpreadsheet();

  // 1. Ambil log Presensi RFID + Data Izin secara otomatis untuk dashboard
  if (action === "getPresensi") {
    // A. Ambil data scan RFID
    var logSheet = ss.getSheetByName("Presensi");
    var presensiData = logSheet ? logSheet.getDataRange().getValues() : [];
    if (presensiData.length > 0) presensiData.shift(); // Hapus header
    
    var formattedData = presensiData.map(function(row) {
      if (row[0] instanceof Date) {
        row[0] = Utilities.formatDate(row[0], "Asia/Jakarta", "dd/MM/yyyy, HH:mm:ss");
      }
      return row;
    });

    // B. Ambil data dari sheet Data Izin
    var izinSheet = ss.getSheetByName("Data Izin");
    if (izinSheet) {
      var dataIzin = izinSheet.getDataRange().getValues();
      if (dataIzin.length > 1) {
        dataIzin.shift(); // Hapus header

        // Buat map nama -> rfid & peran dari sheet Database
        var dbSheet = ss.getSheetByName("Database");
        var dbRows = dbSheet ? dbSheet.getDataRange().getValues() : [];
        var rfidMap = {};
        for (var i = 1; i < dbRows.length; i++) {
          var nameKey = (dbRows[i][1] || "").toString().trim().toLowerCase();
          if (nameKey) {
            rfidMap[nameKey] = {
              rfid: (dbRows[i][0] || "-").toString().trim().replace(/^'+/, ''),
              peran: dbRows[i][2] || "GURU"
            };
          }
        }

        // Mapping baris Data Izin ke format log presensi: [Timestamp, RFID, Nama, Peran, Status]
        dataIzin.forEach(function(r) {
          var ts = r[0]; // Timestamp pengajuan
          if (ts instanceof Date) {
            ts = Utilities.formatDate(ts, "Asia/Jakarta", "dd/MM/yyyy, HH:mm:ss");
          } else {
            ts = (ts || "").toString().trim().replace(/^'+/, '');
          }

          var nama = (r[1] || "").toString().trim();
          var targetKey = nama.toLowerCase();
          var rfid = (rfidMap[targetKey] && rfidMap[targetKey].rfid) ? rfidMap[targetKey].rfid : "-";
          var peran = (rfidMap[targetKey] && rfidMap[targetKey].peran) ? rfidMap[targetKey].peran : (r[2] || "GURU");

          var jenis = (r[3] || "").toString().toLowerCase();
          var statusIzin = "IZIN (TIDAK MASUK)";
          if (jenis.indexOf("terlambat") !== -1) {
            statusIzin = "IZIN (TERLAMBAT)";
          } else if (jenis.indexOf("pulang") !== -1 || jenis.indexOf("awal") !== -1) {
            statusIzin = "IZIN (PULANG AWAL)";
          }

          // Target tanggal izin (r[4]) jika ada
          var targetDate = r[4];
          if (targetDate) {
            var dateStr = "";
            if (targetDate instanceof Date) {
              dateStr = Utilities.formatDate(targetDate, "Asia/Jakarta", "dd/MM/yyyy");
            } else {
              dateStr = targetDate.toString().trim().replace(/^'+/, '');
            }
            if (dateStr && dateStr !== "-") {
              var timePart = "00:00:00";
              if (ts.includes(",")) timePart = ts.split(",")[1].trim();
              ts = dateStr + (dateStr.includes(",") ? "" : ", " + timePart);
            }
          }

          formattedData.push([
            ts,
            rfid,
            nama,
            peran,
            statusIzin
          ]);
        });
      }
    }

    return ContentService.createTextOutput(JSON.stringify(formattedData))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Ambil log Data Izin murni
  if (action === "getDataIzin") {
    var izinSheet = ss.getSheetByName("Data Izin");
    if (!izinSheet) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var dataIzin = izinSheet.getDataRange().getValues();
    if (dataIzin.length > 0) dataIzin.shift();
    
    var formattedIzin = dataIzin.map(function(row) {
      if (row[0] instanceof Date) {
        row[0] = Utilities.formatDate(row[0], "Asia/Jakarta", "dd/MM/yyyy, HH:mm:ss");
      }
      return row;
    });

    return ContentService.createTextOutput(JSON.stringify(formattedIzin))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 3. Default: getDatabase master guru/siswa
  var dbSheet = ss.getSheetByName("Database");
  var dataDb = dbSheet ? dbSheet.getDataRange().getValues() : [];
  if (dataDb.length > 0) dataDb.shift();
  return ContentService.createTextOutput(JSON.stringify(dataDb))
      .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var ss = getSpreadsheet();
  var data = {};
  
  if (e && e.postData && e.postData.contents) {
    try {
      data = JSON.parse(e.postData.contents);
    } catch(err) {
      data = e.parameter || {};
    }
  } else if (e && e.parameter) {
    data = e.parameter;
  }
  
  var action = data.action || "logPresensi";

  // ── 1. CATAT PRESENSI SCANNER RFID
  if (action === "logPresensi") {
    var logSheet = ss.getSheetByName("Presensi");
    var rows = logSheet.getDataRange().getValues();
    
    var todayStr = "";
    if (data.timestamp) {
      var parts = data.timestamp.toString().split(/\s+/);
      todayStr = parts[0].replace(/,/g, '').trim(); 
    }

    var foundDatang = false;
    var foundPulangRowIndex = -1;

    for (var i = 1; i < rows.length; i++) {
      var rowDate = "";
      if (rows[i][0]) {
        if (rows[i][0] instanceof Date) {
          rowDate = Utilities.formatDate(rows[i][0], "Asia/Jakarta", "dd/MM/yyyy");
        } else {
          var rowParts = rows[i][0].toString().split(/\s+/);
          rowDate = rowParts[0].replace(/,/g, '').trim();
        }
      }
      
      var rowRfid = rows[i][1] ? rows[i][1].toString().trim().replace(/^'+/, '') : "";
      var cleanInputRfid = data.rfid_id ? data.rfid_id.toString().trim().replace(/^'+/, '') : "";

      if ((rowDate === todayStr || (rows[i][0] instanceof Date && Utilities.formatDate(rows[i][0], "Asia/Jakarta", "d/M/yyyy") === todayStr)) && rowRfid === cleanInputRfid) {
        var rowStatus = rows[i][4] ? rows[i][4].toString().trim().toUpperCase() : "";
        if (rowStatus === "DATANG") {
          foundDatang = true;
        } else if (rowStatus === "PULANG") {
          foundPulangRowIndex = i + 1;
        }
      }
    }

    var status = "DATANG";
    if (foundDatang) {
      status = "PULANG";
    }

    var timestampText = "'" + (data.timestamp || Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy, HH:mm:ss"));

    if (status === "PULANG" && foundPulangRowIndex !== -1) {
      logSheet.getRange(foundPulangRowIndex, 1).setValue(timestampText);
    } else {
      logSheet.appendRow([
        timestampText,
        data.rfid_id,
        data.name,
        data.peran || "SISWA",
        status
      ]);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", presensiStatus: status }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── 2. CATAT PERMOHONAN IZIN KERJA (Hanya ke sheet Data Izin + Formula Gambar)
  if (action === "logIzin") {
    var izinSheet = ss.getSheetByName("Data Izin");
    if (!izinSheet) {
      izinSheet = ss.insertSheet("Data Izin");
      izinSheet.appendRow(["Timestamp Pengajuan", "Nama Lengkap", "Kedudukan / Peran", "Jenis Izin", "Hari / Tanggal Izin", "Alasan / Keterangan", "Bukti Foto / Dokumen"]);
    }

    var timestampKirim = "'" + Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy, HH:mm:ss");
    
    var hariTglIzin = data.hari_tgl || "-";
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(hariTglIzin)) {
        var p = hariTglIzin.split('-');
        hariTglIzin = "'" + p[2] + "/" + p[1] + "/" + p[0];
      }
    } catch(e) {}

    var imageFormula = "-";
    var fileUrl = data.fileUrl || "";
    if (fileUrl) {
      var fileId = "";
      if (fileUrl.indexOf("/d/") !== -1) {
        fileId = fileUrl.split("/d/")[1].split("/")[0];
      } else if (fileUrl.indexOf("id=") !== -1) {
        fileId = fileUrl.split("id=")[1].split("&")[0];
      }
      
      if (fileId) {
        imageFormula = '=IMAGE("https://drive.google.com/thumbnail?sz=w600&id=' + fileId + '")';
      } else {
        imageFormula = fileUrl;
      }
    }

    izinSheet.appendRow([
      timestampKirim,
      data.nama || "-",
      data.kedudukan || "GURU",
      data.jenis_izin || "-",
      hariTglIzin,
      data.alasan || "-",
      imageFormula
    ]);

    var lastRow = izinSheet.getLastRow();
    izinSheet.setRowHeight(lastRow, 80);

    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Tercatat di Data Izin" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── 3. TAMBAH GURU / SISWA BARU
  if (action === "addStudent") {
    var dbSheet = ss.getSheetByName("Database");
    var existing = dbSheet.getDataRange().getValues();
    for (var i = 1; i < existing.length; i++) {
      if (existing[i][0] && existing[i][0].toString().trim() === data.rfid_id.toString().trim()) {
        return ContentService.createTextOutput(JSON.stringify({ status: "duplicate", message: "RFID sudah terdaftar" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    dbSheet.appendRow([data.rfid_id, data.nama, data.peran || "SISWA"]);
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── 4. HAPUS GURU / SISWA
  if (action === "deleteStudent") {
    var dbSheet = ss.getSheetByName("Database");
    var rows = dbSheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].toString().trim() === data.rfid_id.toString().trim()) {
        dbSheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "not_found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "unknown_action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

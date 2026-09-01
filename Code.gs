// ============================================================
//  Google Apps Script – Presensi RFID SMK GM 1 Wuryantoro
//  Versi 3.2 – Standalone Script + Accurate Timestamp
// ============================================================

var SPREADSHEET_ID = "1vrpYndWiuHcKbomBQO5in2EzMn94zinzu1EM5xifoFU";

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getDatabase";
  var ss = getSpreadsheet();

  if (action === "getPresensi") {
    var logSheet = ss.getSheetByName("Presensi");
    var data = logSheet.getDataRange().getValues();
    data.shift(); // Hapus header
    
    // Normalisasi timestamp Date object ke string format id-ID
    var formattedData = data.map(function(row) {
      if (row[0] instanceof Date) {
        row[0] = Utilities.formatDate(row[0], "Asia/Jakarta", "dd/MM/yyyy, HH:mm:ss");
      }
      return row;
    });

    return ContentService.createTextOutput(JSON.stringify(formattedData))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Default: getDatabase
  var dbSheet = ss.getSheetByName("Database");
  var data = dbSheet.getDataRange().getValues();
  data.shift(); // Hapus header
  return ContentService.createTextOutput(JSON.stringify(data))
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

  // ── 1. CATAT PRESENSI SCANNER RFID (index.html)
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

  // ── 2. CATAT PERMOHONAN IZIN KERJA (dari repo izin-kerja)
  if (action === "logIzin") {
    var dbSheet = ss.getSheetByName("Database");
    var dbRows = dbSheet.getDataRange().getValues();
    var rfid = "-";
    var peran = "GURU";

    var targetNama = (data.nama || "").toString().trim().toLowerCase();
    for (var j = 1; j < dbRows.length; j++) {
      var rowName = (dbRows[j][1] || "").toString().trim().toLowerCase();
      if (rowName === targetNama) {
        rfid = dbRows[j][0] ? dbRows[j][0].toString().trim().replace(/^'+/, '') : "-";
        peran = dbRows[j][2] || "GURU";
        break;
      }
    }

    var statusIzin = "IZIN (TIDAK MASUK)";
    var jenis = (data.jenis_izin || "").toString().toLowerCase();
    if (jenis.indexOf("terlambat") !== -1) {
      statusIzin = "IZIN (TERLAMBAT)";
    } else if (jenis.indexOf("pulang") !== -1 || jenis.indexOf("awal") !== -1) {
      statusIzin = "IZIN (PULANG AWAL)";
    }

    // Ambil jam saat ini di timezone WIB
    var nowTime = Utilities.formatDate(new Date(), "Asia/Jakarta", "HH:mm:ss");
    var dateFormatted = "";
    
    if (data.hari_tgl) {
      try {
        var rawTgl = data.hari_tgl.toString().trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(rawTgl)) {
          var p = rawTgl.split('-');
          dateFormatted = p[2] + "/" + p[1] + "/" + p[0] + ", " + nowTime;
        } else {
          var parsedDate = new Date(rawTgl);
          dateFormatted = Utilities.formatDate(parsedDate, "Asia/Jakarta", "dd/MM/yyyy, ") + nowTime;
        }
      } catch(e) {
        dateFormatted = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy, HH:mm:ss");
      }
    } else {
      dateFormatted = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy, HH:mm:ss");
    }

    // Beri awalan ' agar Google Sheet menyimpannya murni sebagai teks presisi
    var logSheet = ss.getSheetByName("Presensi");
    logSheet.appendRow([
      "'" + dateFormatted,
      rfid,
      data.nama,
      peran,
      statusIzin
    ]);

    return ContentService.createTextOutput(JSON.stringify({ status: "success", presensiStatus: statusIzin }))
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

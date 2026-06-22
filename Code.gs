// ============================================================
//  Google Apps Script – Presensi RFID SMK GM 1 Wuryantoro
//  Versi 3.0 – Support Guru & Siswa + Status Datang/Pulang
// ============================================================

function doGet(e) {
  var action = e.parameter.action || "getDatabase";
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === "getPresensi") {
    // Ambil semua log dari sheet Presensi
    // Kolom Presensi: [Timestamp, RFID ID, Nama, Peran, Status]
    var logSheet = ss.getSheetByName("Presensi");
    var data = logSheet.getDataRange().getValues();
    data.shift(); // Hapus header
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Default: getDatabase – ambil data dari sheet Database
  // Kolom Database: [RFID ID, Nama, Peran]
  var dbSheet = ss.getSheetByName("Database");
  var data = dbSheet.getDataRange().getValues();
  data.shift(); // Hapus header
  return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = JSON.parse(e.postData.contents);
  var action = data.action || "logPresensi"; // default: catat presensi

  // ── 1. CATAT PRESENSI (dari scanner index.html)
  // Format data masuk: { rfid_id, name, peran, timestamp }
  if (action === "logPresensi" || !data.action) {
    var logSheet = ss.getSheetByName("Presensi");
    var rows = logSheet.getDataRange().getValues();
    
    var todayStr = "";
    if (data.timestamp) {
      // Ambil bagian tanggal saja dari timestamp, misal "22/06/2026"
      var parts = data.timestamp.split(/\s+/);
      todayStr = parts[0].replace(/,/g, '').trim(); 
    }

    var foundDatang = false;
    var foundPulangRowIndex = -1;

    // Cari entri presensi user hari ini untuk menentukan status (DATANG / PULANG)
    for (var i = 1; i < rows.length; i++) {
      var rowDate = "";
      if (rows[i][0]) {
        var rowParts = rows[i][0].toString().split(/\s+/);
        rowDate = rowParts[0].replace(/,/g, '').trim();
      }
      
      var rowRfid = rows[i][1] ? rows[i][1].toString().trim().replace(/^'+/, '') : "";
      var cleanInputRfid = data.rfid_id.toString().trim().replace(/^'+/, '');

      if (rowDate === todayStr && rowRfid === cleanInputRfid) {
        var rowStatus = rows[i][4] ? rows[i][4].toString().trim().toUpperCase() : "";
        if (rowStatus === "DATANG") {
          foundDatang = true;
        } else if (rowStatus === "PULANG") {
          foundPulangRowIndex = i + 1; // 1-based index untuk sheet
        }
      }
    }

    var status = "DATANG";
    if (foundDatang) {
      status = "PULANG";
    }

    if (status === "PULANG" && foundPulangRowIndex !== -1) {
      // Update baris PULANG yang sudah ada dengan timestamp terbaru (scan terakhir)
      logSheet.getCell(foundPulangRowIndex, 1).setValue(data.timestamp);
    } else {
      // Tulis baris baru
      logSheet.appendRow([
        data.timestamp,
        data.rfid_id,
        data.name,
        data.peran || "SISWA",
        status
      ]);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", presensiStatus: status }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── 2. TAMBAH GURU / SISWA BARU (dari admin panel)
  if (action === "addStudent") {
    var dbSheet = ss.getSheetByName("Database");
    // Cek duplikasi RFID
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

  // ── 3. HAPUS GURU / SISWA (dari admin panel)
  if (action === "deleteStudent") {
    var dbSheet = ss.getSheetByName("Database");
    var rows = dbSheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].toString().trim() === data.rfid_id.toString().trim()) {
        dbSheet.deleteRow(i + 1); // +1 karena index array mulai dari 0
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

// ==================================================================
// 1. CẤU HÌNH CHUNG
// ==================================================================
var SPREADSHEET_ID = '1caiOHG-2hx5Qkbj9NeipLr46RFZpUquDE9YawaF6Yx4';
// HÃY THAY ID THƯ MỤC DRIVE CỦA BẠN VÀO DÒNG DƯỚI ĐÂY
var UPLOAD_FOLDER_ID = '1x1o1rvccxoK-XXj3wmOqE0AJlPJkfgYuY';
// Thay email của bạn vào dòng dưới để nhận thông báo khi có người đăng ký
var ADMIN_EMAIL_NOTIFY = 'trung@slowforest.com';

// ==================================================================
// FIELD MAPPINGS: Google Sheet header -> PocketBase field name
// Chi map nhung truong co ten khac, con lai giu nguyen
// ==================================================================

var FIELD_MAP_FARMERS = {
  'Participation Year': 'Participation_Year',
  'ID card': 'ID_card',
  'Socioeconomic Status': 'Socioeconomic_Status',
  'Household Circumstances': 'Household_Circumstances',
  'Total_Area_Registered': 'Total_Area_registered',
  'Number_Plots_Registered': 'Number_of_coffee_farm_plots',
  'Supported by': 'Supported_by',
  'Manage by': 'Manage_by',
  'Supported Types': 'Supported_Types',
  'Staff input': 'Staff_input'
};

var FIELD_MAP_PLOTS = {
  'Area (ha)': 'Area_ha',
  'Land use rights certificate?': 'Land_use_rights_certificate',
  'Receive seedlings from': 'Receive_seedlings_from',
  'Place name': 'Place_name',
  'Farm registered for support from': 'Farm_registered_for_support_from',
  'Notes for details (Optional)': 'Notes_for_details',
  'Number of shade trees': 'Number_of_shade_trees',
  'Number of shade tree species': 'Number_of_shade_tree_species',
  'Map Sheet': 'Map_Sheet',
  'Sub-mapsheet': 'Sub_mapsheet'
};

var FIELD_MAP_YEARLY = {
  'Name of fertilizer': 'Name_of_fertilizer',
  'Fertilizer volume': 'Fertilizer_volume',
  'Fertilizer cost': 'Fertilizer_cost',
  'Name of Pesticides': 'Name_of_Pesticides',
  'Pesticides volume': 'Pesticides_volume',
  'Pesticides cost': 'Pesticides_cost',
  'Name of Herbicides': 'Name_of_Herbicides',
  'Herbicides volume': 'Herbicides_volume',
  'Herbicides cost': 'Herbicides_cost',
  'Shade_Trees_supported by': 'Shade_Trees_supported_by',
  'Year planted': 'Year_planted',
  'Fertiliser supported by WWF': 'Fertiliser_supported_by_WWF',
  'Lime supported by Slow': 'Lime_supported_by_Slow',
  'Cover crop supported by Slow (yes/no)': 'Cover_crop_supported_by_Slow',
  'Attending training capacity organized by PFFP': 'Attending_training_capacity_organized_by_PFFP',
  'Cherry sales registered to Slow': 'Cherry_sales_registered_to_Slow',
  'Cherry sales supplied to Slow': 'Cherry_sales_supplied_to_Slow',
  'Revenue from cherry sales to Slow (VND)': 'Revenue_from_cherry_sales_to_Slow',
  'Cherry bought by Slow via processor': 'Cherry_bought_by_Slow_thru_processor'
};

// Support sheet: ID -> Support_ID cho PocketBase
var FIELD_MAP_SUPPORT = {
  'ID': 'Support_ID'
};

// Survival_Check: ID -> Check_ID cho PocketBase
var FIELD_MAP_SURVIVAL = {
  'ID': 'Check_ID'
};

// Farmer_Year: khong can map (ten field giong nhau)
var FIELD_MAP_FARMER_YEAR = {};

// Training_Participation: khong can map (ten field giong nhau)
var FIELD_MAP_TRAINING_PARTICIPATION = {};

// Cac cot section separator can bo qua (I, II, III, IV)
var SKIP_COLUMNS = ['I', 'II', 'III', 'IV', 'TT'];

// ==================================================================
// 2. CONG API (XU LY YEU CAU TU WEB HOST RIENG)
// ==================================================================

// Xu ly yeu cau GET (Lay du lieu)
function doGet(e) {
  var action = e.parameter.action;

  if (action == 'getAllData') {
    var data = getAllData();
    return createJSONOutput(data);
  }

  // --- SYNC ACTIONS (cho PocketBase sync) ---
  if (action == 'getFarmers')       return createJSONOutput(getSyncData('Farmers', FIELD_MAP_FARMERS));
  if (action == 'getPlots')         return createJSONOutput(getSyncData('Plots', FIELD_MAP_PLOTS));
  if (action == 'getYearlyData')    return createJSONOutput(getSyncData('Yearly_Data', FIELD_MAP_YEARLY));
  if (action == 'getSupported')      return createJSONOutput(getSyncData('Support', FIELD_MAP_SUPPORT));
  if (action == 'getSurvivalCheck') return createJSONOutput(getSyncData('Survival_Check', FIELD_MAP_SURVIVAL));
  if (action == 'getFarmerYear')    return createJSONOutput(getSyncData('Farmer_Year', FIELD_MAP_FARMER_YEAR));
  if (action == 'getTrainingParticipation') return createJSONOutput(getSyncData('Training_Participation', FIELD_MAP_TRAINING_PARTICIPATION));

  return createJSONOutput({status: 'error', message: 'Invalid action. Available: getFarmers, getPlots, getYearlyData, getSupported, getSurvivalCheck, getFarmerYear, getTrainingParticipation, getAllData'});
}

// Xu ly yeu cau POST (Gui du lieu len: Luu, Xoa, Upload, Reset Pass)
function doPost(e) {
  try {
    var content = JSON.parse(e.postData.contents);
    var action = content.action;
    var result = {};

    if (action == 'saveData') {
      result = saveData(content.sheetName, content.formData);
    }
    else if (action == 'deleteData') {
      result = deleteData(content.sheetName, content.id);
    }
    else if (action == 'uploadFiles') {
      result = uploadFilesToDrive(content.files);
    }
    else if (action == 'resetUserPassword') {
      result = resetUserPassword(content.staffId, content.email);
    }
   else if (action == 'registerUser') {
      result = registerUser(content.formData);
    }
    // ------------------------
    else {
      result = {status: 'error', message: 'Unknown POST action: ' + action};
    }

    return createJSONOutput(result);

  } catch (err) {
    return createJSONOutput({status: 'error', message: err.toString()});
  }
}

// Ham ho tro tra ve JSON chuan
function createJSONOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================================================================
// 3. CAC HAM XU LY DU LIEU (LOGIC COT LOI)
// ==================================================================

// --- LAY TOAN BO DU LIEU ---
function getAllData() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    // Lay du lieu tu cac Sheet
    var farmersData = getSheetData(ss, 'Farmers');
    var plotsData = getSheetData(ss, 'Plots');
    var yearlyData = getSheetData(ss, 'Yearly_Data');
    var dropData = getSheetData(ss, 'Drop');
    var adminData = getSheetData(ss, 'Admin');
    var speciesData = getSheetData(ss, 'Species');
    var userData = getSheetData(ss, 'User');
    var trainingData = getSheetData(ss, 'Training_List');

    return {
      status: 'success',
      farmers: farmersData,
      plots: plotsData,
      yearly: yearlyData,
      drop: dropData,
      admin: adminData,
      species: speciesData,
      user: userData,
      trainingList: trainingData
    };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

// --- LUU DU LIEU (CO GUI MAIL KHI DUYET USER) ---
function saveData(sheetName, formData) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { status: 'error', message: 'Sheet not found: ' + sheetName };

    var idColumnName = getIdColumnName(sheetName);
    var data = sheet.getDataRange().getDisplayValues();
    var headers = data[0];

    var idColIndex = headers.indexOf(idColumnName);
    if (idColIndex === -1) return { status: 'error', message: 'ID Column not found: ' + idColumnName };

    var recordId = formData[idColumnName];
    var rowIndex = -1;

    // 1. Tim dong du lieu
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idColIndex]) === String(recordId)) {
        rowIndex = i + 1;
        break;
      }
    }

    // --- LOGIC GUI MAIL PHE DUYET (CHI CHO BANG USER) ---
    if (sheetName === 'User' && rowIndex > 0) {
      var statusIndex = headers.indexOf('Status');
      var emailIndex = headers.indexOf('Email');
      var nameIndex = headers.indexOf('Full name');

      if (statusIndex > -1 && emailIndex > -1) {
        var oldStatus = data[rowIndex-1][statusIndex];
        var newStatus = formData['Status'];

        // Neu chuyen tu Pending -> Act thi gui mail
        if (String(oldStatus).trim() === 'Pending' && String(newStatus).trim() === 'Act') {
          var userEmail = data[rowIndex-1][emailIndex];
          var userName = (nameIndex > -1) ? data[rowIndex-1][nameIndex] : "Ban";

          if (userEmail && userEmail.includes('@')) {
             MailApp.sendEmail({
              to: userEmail,
              subject: "✅ TÀI KHOẢN ĐÃ ĐƯỢC PHÊ DUYỆT / ACCOUNT APPROVED",
              htmlBody: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
                  <h3 style="color: #2E7D32;">Chào ${userName},</h3>
                  <p>Chúc mừng! Tài khoản PFFP Dashboard của bạn đã được Admin phê duyệt.</p>
                  <p>Bây giờ bạn có thể đăng nhập vào hệ thống bằng mật khẩu đã đăng ký.</p>
                  <hr>
                  <p><i>Congratulation! Your account has been approved by Admin.</i></p>
                  <p><i>You can now login to the system.</i></p>
                </div>
              `
            });
          }
        }
      }
    }
    // ----------------------------------------------------

    // 2. Luu du lieu
    var rowDataToSave = [];
    if (rowIndex > 0) {
      // UPDATE
      for (var c = 0; c < headers.length; c++) {
        var headerKey = headers[c].toString().trim();
        if (formData.hasOwnProperty(headerKey)) {
          rowDataToSave.push(formData[headerKey]);
        } else {
           rowDataToSave.push(data[rowIndex-1][c]);
        }
      }
      sheet.getRange(rowIndex, 1, 1, rowDataToSave.length).setValues([rowDataToSave]);
    } else {
      // CREATE
      for (var c = 0; c < headers.length; c++) {
        var headerKey = headers[c].toString().trim();
        rowDataToSave.push(formData.hasOwnProperty(headerKey) ? formData[headerKey] : "");
      }
      sheet.appendRow(rowDataToSave);
    }

    return { status: 'success', message: 'Saved successfully!' };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

// --- XOA DU LIEU ---
function deleteData(sheetName, id) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { status: 'error', message: 'Sheet not found' };

    var idColumnName = getIdColumnName(sheetName);
    var data = sheet.getDataRange().getDisplayValues();
    var headers = data[0];

    var idColIndex = headers.indexOf(idColumnName);
    if (idColIndex === -1) return { status: 'error', message: 'ID Column not found' };

    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][idColIndex]) === String(id)) {
        sheet.deleteRow(i + 1);
        return { status: 'success', message: 'Deleted successfully!' };
      }
    }

    return { status: 'error', message: 'ID not found to delete' };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

// --- QUEN MAT KHAU (RESET PASS) ---
function resetUserPassword(staffId, inputEmail) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('User');
    if (!sheet) return { status: 'error', message: 'System Error: User sheet not found.' };

    var data = sheet.getDataRange().getDisplayValues();
    var headers = data[0];

    var idIndex = headers.indexOf('Staff ID');
    var emailIndex = headers.indexOf('Email');
    var passIndex = headers.indexOf('Password');
    var nameIndex = headers.indexOf('Full name');

    if (idIndex === -1 || emailIndex === -1 || passIndex === -1)
      return { status: 'error', message: 'Config Error: Missing columns.' };

    var rowIndex = -1;
    var userEmail = '';
    var userName = '';

    // Tim user
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idIndex]).trim() === String(staffId).trim()) {
        rowIndex = i + 1;
        userEmail = String(data[i][emailIndex]).trim();
        userName = (nameIndex > -1) ? data[i][nameIndex] : staffId;
        break;
      }
    }

    // Kiem tra ton tai
    if (rowIndex === -1) return { status: 'error', message: 'Không tìm thấy ID nhân viên này / Staff ID not found.' };

    // Kiem tra Email khop
    if (userEmail.toLowerCase() !== String(inputEmail).trim().toLowerCase()) {
      return { status: 'error', message: 'Email nhập vào không khớp với dữ liệu đăng ký. / Email does not match our records.' };
    }

    // Tao pass moi (6 ky tu)
    var newPassword = Math.random().toString(36).slice(-6);
    sheet.getRange(rowIndex, passIndex + 1).setValue(newPassword);

    // --- NOI DUNG EMAIL CHUYEN NGHIEP (HTML) ---
    var emailSubject = "🔑 YÊU CẦU CẤP LẠI MẬT KHẨU / PASSWORD RESET REQUEST";

    var htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <div style="background-color: #2E7D32; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">YÊU CẦU CẤP LẠI MẬT KHẨU</h2>
          <p style="margin: 5px 0 0; font-size: 13px; opacity: 0.9;">PASSWORD RESET REQUEST</p>
        </div>

        <div style="padding: 30px; background-color: #ffffff; color: #333;">
          <p>Xin chào / Hello <b>${userName}</b>,</p>

          <p>Hệ thống đã nhận được yêu cầu khôi phục mật khẩu của bạn.<br>
          <span style="color: #666; font-size: 13px;">The system has received a request to reset your password.</span></p>

          <div style="background-color: #f9f9f9; border-left: 5px solid #d32f2f; padding: 15px; margin: 20px 0;">
            <div style="font-size: 16px; margin-bottom: 5px;">
              Mật khẩu mới của bạn là: <b style="color: red; font-size: 20px; letter-spacing: 1px;">${newPassword}</b>
            </div>
            <div style="font-size: 13px; color: #555;">
              Your new password is: <b style="color: red;">${newPassword}</b>
            </div>
          </div>

          <p>Vui lòng đăng nhập và đổi lại mật khẩu nếu cần thiết.<br>
          <span style="color: #666; font-size: 13px;">Please login and change your password if necessary.</span></p>
        </div>

        <div style="background-color: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #e0e0e0;">
          &copy; 2025 PFFP Dashboard System.<br>
          Đây là email tự động, vui lòng không trả lời. / This is an automated email.
        </div>
      </div>
    `;

    // Gui mail che do HTML
    MailApp.sendEmail({
      to: userEmail,
      subject: emailSubject,
      htmlBody: htmlBody
    });

    return { status: 'success', message: 'Mật khẩu mới đã được gửi về email của bạn.\nA new password has been sent to your email.' };

  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

// --- UPLOAD FILE LEN DRIVE ---
function uploadFilesToDrive(files) {
  try {
    if (!UPLOAD_FOLDER_ID || UPLOAD_FOLDER_ID === 'THAY_ID_THU_MUC_CUA_BAN_VAO_DAY') {
       return { status: 'error', message: 'Chưa cấu hình ID thư mục Drive trong Code.gs' };
    }

    var folder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
    var uploadedLinks = [];

    files.forEach(function(file) {
      // file.data la chuoi Base64
      var data = file.data.split(",")[1];
      var blob = Utilities.newBlob(Utilities.base64Decode(data), file.mimeType, file.name);

      var newFile = folder.createFile(blob);
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      uploadedLinks.push(newFile.getUrl());
    });

    return { status: 'success', links: uploadedLinks };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

// ==================================================================
// 4. HAM HO TRO (HELPER FUNCTIONS)
// ==================================================================

// Cau hinh ten cot Khoa chinh (ID) cho tung Sheet
function getIdColumnName(sheetName) {
  switch (sheetName) {
    case 'Farmers': return 'Farmer_ID';
    case 'Plots': return 'Plot_Id';
    case 'Yearly_Data': return 'Record_Id';
    case 'User': return 'Staff ID';
    case 'Support': return 'Support_ID';
    case 'Survival_Check': return 'Check_ID';
    case 'Farmer_Year': return 'Enrollment_ID';
    case 'Training_Participation': return 'Participation_ID';
    default: return 'ID';
  }
}

// Ham doc du lieu tu Sheet thanh Array Object
function getSheetData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getDisplayValues();
  if (data.length < 2) return [];

  var headers = data[0];
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var headerName = headers[j].toString().trim();
      obj[headerName] = row[j];
    }
    result.push(obj);
  }
  return result;
}

// ==================================================================
// 5. SYNC DATA - Doc sheet va map field names (cho PocketBase sync)
// ==================================================================

function getSyncData(sheetName, fieldMap) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return {status: 'error', message: 'Sheet not found: ' + sheetName};

    var data = sheet.getDataRange().getValues(); // getValues giu nguyen kieu du lieu (so, text)
    if (data.length < 2) return {status: 'success', data: [], count: 0};

    var headers = data[0];
    var result = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var obj = {};
      var hasId = false;

      for (var j = 0; j < headers.length; j++) {
        var header = String(headers[j]).trim();

        // Bo qua cot trong hoac section separator
        if (!header || SKIP_COLUMNS.indexOf(header) >= 0) continue;

        // Map ten field
        var pbField = fieldMap[header] || header;
        var val = row[j];

        // Xu ly gia tri
        if (val === null || val === undefined) {
          obj[pbField] = '';
        } else if (val instanceof Date) {
          obj[pbField] = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else if (typeof val === 'number') {
          obj[pbField] = val; // Giu nguyen so
        } else {
          obj[pbField] = String(val).trim();
        }

        // Kiem tra co ID khong (cot dau tien thuong la ID)
        if (j === 0 && val) hasId = true;
      }

      // Chi them row co ID
      if (hasId) {
        result.push(obj);
      }
    }

    return {status: 'success', data: result, count: result.length, sheet: sheetName};

  } catch (e) {
    return {status: 'error', message: e.toString()};
  }
}

// --- DANG KY TAI KHOAN MOI ---
function registerUser(data) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('User');
    var values = sheet.getDataRange().getDisplayValues();
    var headers = values[0];

    // 1. Kiem tra Email
    var emailIndex = headers.indexOf('Email');
    var idIndex = headers.indexOf('Staff ID');

    for (var i = 1; i < values.length; i++) {
      if (String(values[i][emailIndex]).toLowerCase() === String(data.Email).toLowerCase()) {
        return { status: 'error', message: 'Email này đã được đăng ký.' };
      }
    }

    // 2. Tao Staff ID
    var orgCode = data.Organization;
    var maxNum = 0;
    var regex = new RegExp('^' + orgCode + '-(\\d+)$', 'i');

    for (var i = 1; i < values.length; i++) {
      var sid = String(values[i][idIndex]).trim();
      var match = sid.match(regex);
      if (match) {
        var num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    var nextId = orgCode + "-" + String(maxNum + 1).padStart(2, '0');

    // 3. Luu vao Sheet
    var newRow = [];
    for (var c = 0; c < headers.length; c++) {
      var h = headers[c].toString().trim();
      if (h === 'Staff ID') newRow.push(nextId);
      else if (h === 'Full name') newRow.push(data.FullName);
      else if (h === 'Organization') newRow.push(data.Organization);
      else if (h === 'Password') newRow.push(data.Password);
      else if (h === 'Email') newRow.push(data.Email);
      else if (h === 'Phone') newRow.push(data.Phone);
      else if (h === 'Status') newRow.push('Pending');
      else if (h === 'Authority') newRow.push('Staff');
      else if (h === 'Position') newRow.push('Officer');
      else newRow.push("");
    }
    sheet.appendRow(newRow);

    // 4. Gui Email cho Admin (Bao cao)
    if (typeof ADMIN_EMAIL_NOTIFY !== 'undefined' && ADMIN_EMAIL_NOTIFY) {
      MailApp.sendEmail({
        to: ADMIN_EMAIL_NOTIFY,
        subject: "[PFFP App] 🔔 Đăng ký mới: " + data.FullName,
        htmlBody: `<h3>Có thành viên mới đăng ký</h3><p>Tên: ${data.FullName}</p><p>Email: ${data.Email}</p><p>ID: ${nextId}</p><p>Trạng thái: <b>Pending</b></p>`
      });
    }

    // 5. Gui Email cho Nguoi dang ky (Xac nhan)
    MailApp.sendEmail({
      to: data.Email,
      subject: "✅ ĐĂNG KÝ THÀNH CÔNG - CHỜ PHÊ DUYỆT",
      htmlBody: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
          <h3 style="color: #0d6efd;">Xin chào ${data.FullName},</h3>
          <p>Hệ thống đã ghi nhận thông tin đăng ký của bạn.</p>
          <hr>
          <p><b>Thông tin tài khoản:</b></p>
          <ul>
            <li><b>Staff ID (Tên đăng nhập):</b> ${nextId}</li>
            <li><b>Email:</b> ${data.Email}</li>
            <li><b>Tổ chức:</b> ${data.Organization}</li>
          </ul>
          <p style="background-color: #fff3cd; padding: 10px; border-radius: 5px;">
            ⚠️ <b>Lưu ý:</b> Tài khoản của bạn đang ở trạng thái <b>Chờ duyệt (Pending)</b>.<br>
            Bạn chưa thể đăng nhập ngay lúc này. Vui lòng chờ Admin phê duyệt.
          </p>
          <p>Trân trọng,<br>PFFP Admin Team</p>
        </div>
      `
    });

    return { status: 'success', message: 'Đăng ký thành công! Vui lòng kiểm tra email xác nhận.' };

  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

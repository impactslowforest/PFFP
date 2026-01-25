// --- CẤU HÌNH KẾT NỐI SERVER ---
const API_URL = "https://script.google.com/macros/s/AKfycbxKhAJq5IIqJx5zLV0aFEVy7tukiTZss85wGiPr7vsMf1wBsRRRZDkyMtDEU0y9P9ZthA/exec";
const CACHE_KEY = "PFFP_DATA_CACHE";
const CACHE_TTL = 60 * 60 * 1000; // 1 giờ (milliseconds)
// ==========================================================
// GLOBAL STATE
// ==========================================================
var isLoggedIn = false;
var currentUser = null;
var currentLang = 'vi';
var rawData = {};
var filteredData = { farmers: [], plots: [], yearly: [] };
var chartInstances = {};
var dtFarmers = null;
var dtPlots = null; var dtYearly = null; var dtUsers = null;
var currentFarmerId = null;
// Maps
var adminMap = {}; var dropMap = {}; var speciesMap = {};
var userMap = {}; var trainingListMap = {}; var farmersMap = {}; var plotsMap = {};
// Standard Green Palette for Charts
const APP_COLORS = ['#2E7D32', '#43A047', '#66BB6A', '#81C784', '#A5D6A7', '#C8E6C9', '#E8F5E9'];
// Global Permissions
var userPermissions = {
    canView: false, canAdd: false, canEdit: false, canDelete: false, canPrint: false, canExport: false, allowedViews: []
};
// DEFINITIONS
const MANAGER_ROLES = ['11', '1a', '2a'];
const ADMIN_ROLE = '11';

// --- LABEL STYLES ---
// 1. Label chung (mặc định)
const commonDataLabels = {
    color: '#000000',
    backgroundColor: 'rgba(232, 245, 233, 0.8)',
    borderRadius: 4,
    padding: 4,
    font: { weight: 'bold' }
};
// 2. Label cho số nguyên (Người, Cây, Lớp học) -> KHÔNG CÓ SỐ THẬP PHÂN
const integerDataLabels = {
    ...commonDataLabels,
    formatter: function (value) {
        return Math.round(value).toLocaleString('en-US');
    }
};

// 3. Label cho số thực (Tiền, Diện tích, %) -> 2 SỐ THẬP PHÂN
const floatDataLabels = {
    ...commonDataLabels,
    formatter: function (value) {
        return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
};

// ERROR HANDLING
window.onerror = function (message, source, lineno, colno, error) {
    var msg = "Script Error: " + message + " (Line: " + lineno + ")";
    console.error(msg);
    showError(msg);
    return false;
};

// CONFIG TRANSLATIONS
const translations = {
    vi: {
        appTitle: "SẢN XUẤT CÀ PHÊ SINH THÁI VÀ CẢI THIỆN RỪNG TỰ NHIÊN", loading: "Đang tải dữ liệu...",
        lblSelectOrg: "Vui lòng chọn tổ chức:", optSelectOrgFirst: "-- Chọn tổ chức trước --",
        lblUsername: "Chọn nhân viên:", lblPassword: "Mật khẩu:", btnLogin: "ĐĂNG NHẬP",

        loginErrorTitle: "Lỗi đăng nhập", loginErrorMsg: "Thông tin đăng nhập không đúng hoặc tài khoản chưa kích hoạt (Status != Act).",
        kpi1: "Tổng số hộ", kpi2: "Tổng số lô", kpi3: "Tổng DT (ha)", kpi4: "Cây che bóng", kpi5: "Cây HT đã trồng", kpi6: "Tổng số loài", kpi7: "Tổng nhóm hộ", kpi8: "Tỷ lệ hoàn thành", kpi9: "Tỷ lệ sống",


        kpi10: "Tổng SL Đại trà (Tấn)", kpi11: "Tổng SL CLC (Tấn)",

        // CẬP NHẬT FILTER VÀ CHART TITLE MỚI
        filterTitle: "Bộ lọc dữ liệu", filterYear: "Năm", filterYearSupport: "Năm hỗ trợ", filterVillage: "Nhóm hộ", filterStatus: "Trạng thái", filterSupported: "Hỗ trợ bởi", filterSupportedTypes: "Loại hỗ trợ", filterSpecies: "Loài cây", filterManageBy: "Quản lý bởi",
        btnReset: "Thiết lập lại", btnRefresh: "Tải lại dữ liệu", btnExport: "Xuất Báo Cáo", btnPrint: "In Trang", btnExit: "Thoát",

        chart1Title: "Tổng diện tích theo nhóm hộ", chart2Title: "Tỷ lệ thành phần dân tộc", chart3Title: "Tiến độ theo nhóm hộ", chart4Title: "Tỷ lệ Hoàn thành", chartManageByTitle: "Đơn vị quản lý",

        langBtn: '<img src="https://flagcdn.com/w40/gb.png" class="flag-icon" alt="English">',
        noDataToExport: "Không có dữ liệu để xuất!", drilldownTitle: "Chi tiết cho", allOption: "Tất cả", selected: "đã chọn",

        tabFarmers: "Hộ dân", tabPlots: "Lô đất", tabYearly: "Dữ liệu hàng năm", detailPrefix: "Chi tiết", editPrefix: "Sửa thông tin",
        confirmDelete: "Bạn có chắc chắn muốn xóa?", deleteSuccess: "Đã xóa thành công!", confirmSave: "Bạn có chắc chắn muốn lưu thay đổi?", updateSuccess: "Cập nhật thành công!", btnCancel: "Hủy", btnOk: "Đồng ý", btnSave: "Lưu thay đổi", btnSaveUser: "Lưu nhân viên", btnClose: "Đóng",
        thNo: "TT", thYear: "Năm TG", thFarmerID: "Mã Nông Hộ", thName: "Họ tên", thYOB: "Năm sinh", thGender: "Giới tính",
        thPhone: "Số điện thoại", thGroup: "Nhóm hộ", thCoop: "Tổ hợp tác", thVillage: "Nhóm hộ", thCommune: "Xã", thAddress: "Địa chỉ", thIDCard: "Số CCCD", thEthnicity: "Dân tộc", thEcoStatus: "Tình trạng KT", thHHCircum: "Hoàn cảnh GĐ", thMemCount: "Số TV GĐ", thWorkerCount: "Tổng LĐ", thTotalArea: "Tổng DT CP", thPlotCount: "Số lượng lô", thSupportedBy: "Được HT bởi", thSupportType: "Loại hỗ trợ", thRegFarms: "Số vườn ĐK", thRegArea: "Tổng DT ĐK", thStaff: "Cán bộ nhập", thStatus: "Trạng thái", thActivity: "Hoạt động", thDate: "Ngày", thUpdate: "Cập nhật",
        thPlotId: "Mã Lô", thPlotName: "Tên Lô", thPlotArea: "DT (ha)", thLURC: "Có GCNQSDĐ?", thBorderForest: "Giáp rừng TN", thSeedlingSource: "Nguồn giống", thPlaceName: "Địa danh", thLocation: "Tọa độ", thShadeTreesBefore: "SL cây CB trước", thNameTreesBefore: "Tên cây CB trước", thFarmRegSupport: "Nông trại ĐK HT", thCoffeeTrees: "SL cây CP", thPlantYear: "Năm trồng CP", thNotes: "Ghi chú", thShadeTreeCount: "SL cây CB", thSpeciesCount: "SL loài cây", thMapSheet: "Tờ bản đồ", thSubMap: "Thửa đất",
        thRecordID: "Mã Bản ghi", thYearVal: "Năm", thCherryVol: "SL quả tươi", thVolHQ: "SL CLC", thIncome: "Tổng thu nhập", thFertApplied: "Có bón phân?", thFertName: "Tên phân bón", thFertVol: "Lượng phân", thFertCost: "Chi phí phân", thPestApplied: "Dùng thuốc BVTV?", thPestName: "Tên thuốc BVTV", thPestVol: "Lượng thuốc", thPestCost: "Chi phí thuốc", thHerbApplied: "Dùng thuốc cỏ?", thHerbName: "Tên thuốc cỏ", thHerbVol: "Lượng thuốc cỏ", thHerbCost: "CP thuốc cỏ", thLaborCost: "Thuê nhân công", thOtherCost: "Chi phí khác", thTreeSupportBy: "HT cây CB bởi", thTreesPlanted: "Số cây đã trồng", thSpecies: "Loài cây", thYearPlanted: "Năm trồng", thTreesDead: "Số cây chết", thSurvivalRate: "Tỷ lệ sống", thFertWWF: "Phân từ WWF", thLimeSlow: "Vôi từ SLOW", thCoverCrop: "Cỏ che phủ", thSoilTest: "HT KT đất", thTraining: "Tập huấn", thOp6: "HĐ OP6", thRegSales: "ĐK bán SLOW", thRealSales: "Thực bán SLOW", thRevSales: "Thu từ bán", thBoughtVia: "Mua qua sơ chế",


        // Tab Names
        tabAnalytics: "Phân tích dữ liệu",
        tabConfig: "Cấu hình", tabUserMng: "Quản lý Nhân sự", headerUserList: "Danh sách nhân viên", btnAddUser: "Thêm nhân viên",

        // User Table Columns

        thStaffId: "Staff ID", thFullName: "Họ và Tên", thOrg: "Tổ chức", thPosition: "Chức vụ", thArea: "Phạm vi Quản lý", thEmail: "Email", thAuthority: "Quyền hạn", thAction: "Thao tác", thPermissions: "Quyền thao tác", thView: "View",
        lblStaffId: "Mã nhân viên (Staff ID)", lblFullName: "Họ và tên", lblOrg: "Tổ chức", lblPosition: "Chức vụ", lblGender: "Giới tính", lblPassword: "Mật khẩu", lblEmail: "Email", lblPhone: "Số điện thoại", lblAuthority: "Quyền hạn (Authority)",
        lblArea: "Phạm vi Quản lý (Manage Areas)", lblStatus: "Trạng thái", lblView: "Danh sách View (Phân quyền hiển thị)", lblPermissions: "Quyền thao tác (Operations - Rule)",

        // Analytic Charts
        chartQualityTitle: "Sản lượng CLC / Tổng sản lượng", chartFinanceTitle: "Tổng thu nhập / Chi phí",
        chartProductivityTitle: "Tổng sản lượng (Tấn) theo nhóm hộ", chartSurvivalTitle: "Tỷ lệ sống theo nhóm hộ",

        chartSlowSalesTitle: "Sản lượng bán cho SLOW", chartTrainingTitle: "Tham gia tập huấn & Op6",
        chartSupportStatusTitle: "Hộ tham gia theo nhóm hộ",
        chartShadeTreesTitle: "Cây che bóng (Hiện có & Trồng mới)",
        chartStatusTitle: "Tình trạng hoạt động (Status)", chartParticipationTitle: "Sự tham gia qua các năm",


        // Chart Labels & Options
        lblActive: "Hoạt động", lblInactive: "Ngưng HĐ",
        lblIncome: "Tổng thu", lblFert: "Phân bón", lblPest: "Thuốc BVTV", lblHerb: "Thuốc cỏ", lblLabor: "Nhân công", lblOther: "Khác",
        lblReg: "Đăng ký", lblReal: "Thực tế",
        lblTraining: "Tập huấn", lblOp6: "Op6",

        lblExisting: "Hiện có", lblNew: "Trồng mới",
        lblCLC: "CLC", lblNormal: "Đại trà",
        lblFarmers: "Số nông hộ",
        optAll: "Tất cả",

        greeting: "Xin chào,"
    },
    en: {
        appTitle: "PROSPEROUS FARMERS AND FORESTS PARTNERSHIP",
        loading: "Loading data...",
        lblSelectOrg: "Please select organization:", optSelectOrgFirst: "-- Select Organization First --",
        lblUsername: "Select Staff:", lblPassword: "Password:", btnLogin: "LOGIN",
        loginErrorTitle: "Login Error", loginErrorMsg: "Incorrect password or account inactive.",
        kpi1: "Total Farmers", kpi2: "Total Plots", kpi3: "Total Area (ha)", kpi4: "Shade Trees", kpi5: "Planted Trees", kpi6: "Total Species", kpi7: "Total Farmer Groups", kpi8: "Completion Rate", kpi9: "Survival Rate",
        kpi10: "Total Cherry (Ton)", kpi11: "Total HQ (Ton)",

        // NEW FILTERS & TITLES
        filterTitle: "Data Filters", filterYear: "Year", filterYearSupport: "Support Year", filterVillage: "Farmer Group", filterStatus: "Status", filterSupported: "Supported By", filterSupportedTypes: "Support Types", filterSpecies: "Species", filterManageBy: "Managed By",
        btnReset: "Reset", btnRefresh: "Reload Data", btnExport: "Export Excel", btnPrint: "Print", btnExit: "Exit",
        chart1Title: "Total Area by Farmer Group", chart2Title: "Ethnicity Distribution", chart3Title: "Progress by Farmer Group", chart4Title: "Completion Rate", chartManageByTitle: "Management Unit",

        langBtn: '<img src="https://flagcdn.com/w40/vn.png" class="flag-icon" alt="Tiếng Việt">',
        noDataToExport: "No data to export!", drilldownTitle: "Details for", allOption: "All", selected: "selected",
        tabFarmers: "Farmers", tabPlots: "Plots", tabYearly: "Yearly Data", detailPrefix: "Details", editPrefix: "Edit",
        confirmDelete: "Are you sure you want to delete?", deleteSuccess: "Deleted successfully!", confirmSave: "Are you sure you want to save changes?", updateSuccess: "Updated successfully!", btnCancel: "Cancel", btnOk: "OK", btnSave: "Save Changes", btnSaveUser: "Save User", btnClose: "Close",
        thNo: "No", thYear: "Year", thFarmerID: "Farmer ID", thName: "Full Name", thYOB: "YOB", thGender: "Gender", thPhone: "Phone", thGroup: "Group", thCoop: "Cooperative", thVillage: "Farmer Group", thCommune: "Commune", thAddress: "Address", thIDCard: "ID Card", thEthnicity: "Ethnicity", thEcoStatus: "Eco Status", thHHCircum: "HH Circumstances", thMemCount: "HH Members", thWorkerCount: "Workers", thTotalArea: "Total Coffee Area", thPlotCount: "Plot Count", thSupportedBy: "Supported By", thSupportType: "Support Type", thRegFarms: "Reg Farms", thRegArea: "Reg Area", thStaff: "Staff", thStatus: "Status", thActivity: "Activity", thDate: "Date", thUpdate: "Update",
        thPlotId: "Plot ID", thPlotName: "Plot Name", thPlotArea: "Area (ha)", thLURC: "LURC?", thBorderForest: "Border Forest", thSeedlingSource: "Seedling Source", thPlaceName: "Place Name", thLocation: "Location", thShadeTreesBefore: "Trees Before", thNameTreesBefore: "Tree Names Before", thFarmRegSupport: "Reg Support", thCoffeeTrees: "Coffee Trees", thPlantYear: "Plant Year", thNotes: "Notes", thShadeTreeCount: "Shade Trees", thSpeciesCount: "Species Count", thMapSheet: "Map Sheet", thSubMap: "Sub-map",
        thRecordID: "Record ID", thYearVal: "Year", thCherryVol: "Cherry Vol", thVolHQ: "HQ Vol", thIncome: "Total Income", thFertApplied: "Fert Applied?", thFertName: "Fert Name", thFertVol: "Fert Vol", thFertCost: "Fert Cost", thPestApplied: "Pest Applied?", thPestName: "Pest Name", thPestVol: "Pest Vol", thPestCost: "Pest Cost", thHerbApplied: "Herb Applied?", thHerbName: "Herb Name", thHerbVol: "Herb Vol", thHerbCost: "Herb Cost", thLaborCost: "Labor Cost", thOtherCost: "Other Cost", thTreeSupportBy: "Tree Support By", thTreesPlanted: "Trees Planted", thSpecies: "Species", thYearPlanted: "Year Planted", thTreesDead: "Trees Dead", thSurvivalRate: "Survival Rate", thFertWWF: "Fertiliser by WWF", thLimeSlow: "Lime from SLOW", thCoverCrop: "Cover Crop", thSoilTest: "Soil Test", thTraining: "Training", thOp6: "Op6 Activities", thRegSales: "Sales Registered", thRealSales: "Sales Supplied", thRevSales: "Sales Revenue", thBoughtVia: "Bought Via",

        tabAnalytics: "Data Analytics",

        tabConfig: "Configuration", tabUserMng: "HR Management", headerUserList: "Staff List", btnAddUser: "Add Staff",

        thStaffId: "Staff ID", thFullName: "Full Name", thOrg: "Organization", thPosition: "Position", thArea: "Area Manager", thEmail: "Email", thAuthority: "Authority", thAction: "Actions", thPermissions: "Perms", thView: "Views",
        lblStaffId: "Staff ID", lblFullName: "Full Name", lblOrg: "Organization", lblPosition: "Position", lblGender: "Gender", lblPassword: "Password", lblEmail: "Email", lblPhone: "Phone", lblAuthority: "Authority",

        lblArea: "Area Manager", lblStatus: "Status", lblView: "Allowed Views", lblPermissions: "Operations",

        // Analytic Charts
        chartQualityTitle: "Quality Vol / Total Vol", chartFinanceTitle: "Tổng thu nhập / Chi phí",
        chartProductivityTitle: "Total Production (Ton) by Farmer Group", chartSurvivalTitle: "Survival Rate by Farmer Group",
        chartSlowSalesTitle: "Sales to SLOW", chartTrainingTitle: "Training & Op6",
        chartSupportStatusTitle: "Farmers by Farmer Group",
        chartShadeTreesTitle: "Shade Trees (Existing & New)",
        chartStatusTitle: "Activity Status", chartParticipationTitle: "Participation by Year",

        lblActive: "Active", lblInactive: "Inactive",
        lblIncome: "Income", lblFert: "Fertilizer", lblPest: "Pesticides", lblHerb: "Herbicides", lblLabor: "Labor", lblOther: "Other",

        lblReg: "Reg", lblReal: "Real",
        lblTraining: "Training", lblOp6: "Op6",
        lblExisting: "Existing", lblNew: "New",
        lblCLC: "High Quality", lblNormal: "Normal",
        lblFarmers: "Farmers Count",
        optAll: "All",

        greeting: "Hello,"

    }
};
const EXPORT_HEADERS = translations;
const FIELD_LABELS = {
    Farmers: { 'Full_Name': 'thName', 'Farmer_ID': 'thFarmerID', 'Year_Of_Birth': 'thYOB', 'Gender': 'thGender', 'Phone_Number': 'thPhone', 'Farmer_Group_Name': 'thGroup', 'Cooperative_Name': 'thCoop', 'Village_Name': 'thVillage', 'Commune_Name': 'thCommune', 'Address': 'thAddress', 'ID card': 'thIDCard', 'Ethnicity': 'thEthnicity', 'Socioeconomic Status': 'thEcoStatus', 'Household Circumstances': 'thHHCircum', 'Num_Household_Members': 'thMemCount', 'Num_Working_Members': 'thWorkerCount', 'Total_Coffee_Area': 'thTotalArea', 'Number of coffee farm plots': 'thPlotCount', 'Supported by': 'thSupportedBy', 'Supported Types': 'thSupportType', 'Status': 'thStatus', 'Activity': 'thActivity' },
    Plots: { 'Plot_Id': 'thPlotId', 'Plot_Name': 'thPlotName', 'Area (ha)': 'thPlotArea', 'Location': 'thLocation', 'Land use rights certificate?': 'thLURC', 'Border_Natural_Forest': 'thBorderForest', 'Receive seedlings from': 'thSeedlingSource', 'Place name': 'thPlaceName', 'Num_Shade_Trees_Before': 'thShadeTreesBefore', 'Name_Shade_Trees_Before': 'thNameTreesBefore', 'Farm registered for support from': 'thFarmRegSupport', 'Num_Coffee_Trees': 'thCoffeeTrees', 'Coffee_Planted_Year': 'thPlantYear', 'Notes for details (Optional)': 'thNotes', 'Number of shade trees': 'thShadeTreeCount', 'Number of shade tree species': 'thSpeciesCount', 'Map Sheet': 'thMapSheet', 'Sub-mapsheet': 'thSubMap', 'Status': 'thStatus', 'Activity': 'thActivity' },
    Yearly_Data: { 'Record_Id': 'thRecordID', 'Year': 'thYearVal', 'Annual_Volume_Cherry': 'thCherryVol', 'Volume_High_Quality': 'thVolHQ', 'Total_Coffee_Income': 'thIncome', 'Fertilizers_Applied': 'thFertApplied', 'Name of fertilizer': 'thFertName', 'Fertilizer volume': 'thFertVol', 'Fertilizer cost': 'thFertCost', 'Pesticides_Applied': 'thPestApplied', 'Name of Pesticides': 'thPestName', 'Pesticides volume': 'thPestVol', 'Pesticides cost': 'thPestCost', 'Herbicides_Applied': 'thHerbApplied', 'Name of Herbicides': 'thHerbName', 'Herbicides volume': 'thHerbVol', 'Herbicides cost': 'thHerbCost', 'Hired_Labor_Costs': 'thLaborCost', 'Other_Costs': 'thOtherCost', 'Shade_Trees_supported by': 'thTreeSupportBy', 'Number_Shade_Trees_Planted': 'thTreesPlanted', 'Shade_Trees_Species': 'thSpecies', 'Year planted': 'thYearPlanted', 'Shade_Trees_Died': 'thTreesDead', 'Soil_Test_Support': 'thSoilTest', 'Attending training capacity organized by PFFP': 'thTraining', 'Op6_Activities': 'thOp6', 'Cherry sales registered to Slow': 'thRegSales', 'Cherry sales registered to Slow': 'thRegSales', 'Cherry sales supplied to Slow': 'thRealSales', 'Revenue from cherry sales to Slow (VND)': 'thRevSales', 'Cherry bought by Slow via processor': 'thBoughtVia', 'Status': 'thStatus', 'Activity': 'thActivity' }
};

// THÊM MAPPING CHO CÁC TRƯỜNG MỚI (YEAR OF SUPPORT, MANAGE BY)
const FIELD_MAPPING = {
    'Farmers': {
        'Participation Year': { map: 'drop', condition: 'Participation Year' },
        'Year of support': { map: 'drop', condition: 'Participation Year' }, // NEW
        'Farmer_Group_Name': { map: 'admin', condition: 'Farmer group' },
        'Village_Name': { map: 'farmers', sourceCol: 'Farmer_Group_Name' }, // Remap Village col to show Farmer Group 
        'Commune_Name': { map: 'admin', condition: 'XA' },
        'Gender': { map: 'drop', condition: 'Gender' },
        'Status': { map: 'drop', condition: 'Status' },
        'Activity': { map: 'drop', condition: 'Activity' },
        'Cooperative_Name': 'admin',
        'Ethnicity': { map: 'drop', condition: 'Dantoc' },
        'Socioeconomic Status': { map: 'drop', condition: 'Socioeconomic Status' },
        'Household Circumstances': { map: 'drop', condition: 'Household Circumstances' },
        'Supported by': { map: 'drop', condition: 'Organization', separator: ',' },
        'Manage by': { map: 'drop', condition: 'Organization', separator: ',' }, // NEW
        'Supported Types': { map: 'drop', condition: 'Support list', separator: ',' },
        'Staff input': 'user'
    },
    'Plots': { 'Land use rights certificate?': { map: 'drop', condition: 'Answer' }, 'Border_Natural_Forest': { map: 'drop', condition: 'Answer' }, 'Receive seedlings from': { map: 'drop', condition: 'Organization' }, 'Farm registered for support from': { map: 'drop', condition: 'Support list', separator: ',' }, 'Name_Shade_Trees_Before': { map: 'species', separator: ',' }, 'Coffee_Planted_Year': { map: 'drop', condition: 'Planted' }, 'Place name': 'admin', 'Status': { map: 'drop', condition: 'Status' }, 'Activity': { map: 'drop', condition: 'Activity' } },

    'Yearly_Data': { 'Year': { map: 'drop', condition: 'Participation Year' }, 'Status': { map: 'drop', condition: 'Status' }, 'Activity': { map: 'drop', condition: 'Activity' }, 'Fertilizers_Applied': { map: 'drop', condition: 'Answer' }, 'Name of fertilizer': { map: 'drop', condition: 'Fertilizer', separator: ',' }, 'Pesticides_Applied': { map: 'drop', condition: 'Answer' }, 'Herbicides_Applied': { map: 'drop', condition: 'Answer' }, 'Shade_Trees_supported by': { map: 'drop', condition: 'Organization', separator: ',' }, 'Year planted': { map: 'drop', condition: 'Planted' }, 'Soil_Test_Support': { map: 'drop', condition: 'Answer' }, 'Attending training capacity organized by PFFP': { map: 'trainingList', separator: ',' }, 'Shade_Trees_Species': { map: 'species', separator: ',' } }
};

function escapeHtml(str) {
    if (!str) return "";
    return str.toString().replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

// ==========================================================
// INIT
// ==========================================================
document.addEventListener("DOMContentLoaded", function () {
    var attempts = 0;
    var maxAttempts = 100;
    var checkInterval = setInterval(function () {
        if (typeof jQuery !== 'undefined' && typeof Chart !== 'undefined') {
            clearInterval(checkInterval);
            console.log("Libraries loaded. Starting app...");
            startApp();
        } else {
            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                var msg = "Lỗi kết nối: Không thể tải thư viện hệ thống (jQuery/ChartJS). Vui lòng nhấn F5.";
                console.error(msg);
                showError(msg);
            }
        }
    }, 100);
});
function startApp() {
    if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
        Chart.defaults.font.family = "'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif";
        Chart.defaults.font.size = 12;
        // Default global formatter
        Chart.defaults.plugins.datalabels.formatter = function (value, context) {
            if (typeof value === 'number') {
                // Mặc định là số nguyên nếu không có config khác
                return Math.round(value).toLocaleString('en-US');
            }
            return value;
        };
    }
    loadData();
    $(document).on('change', '.check-all', function () { let group = $(this).data('group'); $(`.check-item[data-group="${group}"]`).prop('checked', $(this).is(':checked')); updateDropdownLabel(group); applyFilter(); });
    $(document).on('change', '.check-item', function () { let group = $(this).data('group'); let total = $(`.check-item[data-group="${group}"]`).length; let checked = $(`.check-item[data-group="${group}"]:checked`).length; $(`.check-all[data-group="${group}"]`).prop('checked', total > 0 && total === checked); updateDropdownLabel(group); applyFilter(); });
    $('#mainTable tbody').on('click', 'tr', function () { var dt = $('#mainTable').DataTable(); var tr = $(this).closest('tr'); if (dt.row(tr).any()) { var r = dt.row(tr).data(); if (r && r[2]) showFarmerDetails(r[2]); } });
    $('#plotsTable tbody').on('click', 'tr', function () { var dt = $('#plotsTable').DataTable(); var tr = $(this).closest('tr'); if (dt.row(tr).any()) { var r = dt.row(tr).data(); if (r && r[1]) showSingleItemDetails('Plots', r[1]); } });
    $('#yearlyTable tbody').on('click', 'tr', function () { var dt = $('#yearlyTable').DataTable(); var tr = $(this).closest('tr'); if (dt.row(tr).any()) { var r = dt.row(tr).data(); if (r && r[3]) showSingleItemDetails('Yearly_Data', r[3]); } });
    $(document).on('change', '#userEditModal select[name="Organization"]', function () {
        const isEditMode = $('#userForm input[name="Staff ID"]').prop('readonly');
        if (!isEditMode) {
            const orgCode = $(this).val();
            if (orgCode) {
                const nextId = generateNextStaffId(orgCode);
                $('#userForm input[name="Staff ID"]').val(nextId);
            }
        }
    });
    $('#userGreeting').click(function () { if (currentUser) { showUserDetails(currentUser['Staff ID'] || currentUser['ID']); } });
}

// 1. LOAD DATA
function loadData(forceRefresh = false) {
    var loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'flex';

    // KIỂM TRA CACHE
    if (!forceRefresh) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const cacheObj = JSON.parse(cached);
                const now = Date.now();
                if (now - cacheObj.timestamp < CACHE_TTL) {
                    console.log("Loading from cache...");
                    onDataLoaded(cacheObj.data, true); // true = fromCache
                    return;
                }
            } catch (e) {
                console.error("Cache Parse Error:", e);
                localStorage.removeItem(CACHE_KEY);
            }
        }
    }

    console.log("Fetching from server...");
    // GỌI API QUA FETCH
    fetch(API_URL + "?action=getAllData")
        .then(response => response.json())
        .then(data => {
            onDataLoaded(data, false);
        })
        .catch(error => {
            showError(error);
        });
}

function refreshData() {
    loadData(true); // Bắt buộc tải mới từ server
}

function onDataLoaded(data, fromCache = false) {
    if (!data || data.status === 'error') {
        showError(data ? data.message : 'Unknown error from server');
        return;
    }
    try {
        if (!fromCache) {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));
        }
        rawData = data;
        preProcessData(rawData);
        processReferenceData(rawData);
        filteredData = { farmers: rawData.farmers || [], plots: rawData.plots || [], yearly: rawData.yearly || [] };
        initFilters();
        if (isLoggedIn) {
            $('#loading').fadeOut();
            $('#loginSection').hide();
            $('#dashboardSection').show();
            checkUserPermissions();
            applyFilter();
        } else {
            initLoginScreen(data.user);
            $('#loading').fadeOut();
            $('#loginSection').fadeIn();
        }
    } catch (e) {
        console.error("Data Processing Error:", e);
        showError("Lỗi xử lý dữ liệu: " + e.message);
    }
}

function initLoginScreen(users) {
    const select = $('#loginUserSelect');
    select.empty(); select.append(`<option value="" disabled selected>${translations[currentLang].optSelectOrgFirst}</option>`); select.prop('disabled', true);
}

function filterUserByOrg(orgCode, btnElement) {
    $('.btn-org').removeClass('active');
    $(btnElement).addClass('active');
    const users = rawData.user || []; const filteredUsers = users.filter(u => String(u['Organization']).trim() === orgCode && String(u['Status']) === 'Act');
    const select = $('#loginUserSelect'); select.empty();
    if (filteredUsers.length > 0) {
        select.prop('disabled', false);
        select.append('<option value="" disabled selected>-- Chọn nhân viên --</option>');
        filteredUsers.sort((a, b) => (a['Full name'] || '').localeCompare(b['Full name'] || ''));
        filteredUsers.forEach(u => { let id = u['Staff ID'] || u['ID']; let name = u['Full name'] || u['Name']; if (id && name) { select.append(`<option value="${id}">${name}</option>`); } });
    } else {
        select.append('<option value="" disabled selected>-- Không có nhân viên --</option>'); select.prop('disabled', true);
    }
}

function handleLogin() {
    const selectedId = $('#loginUserSelect').val();
    const password = $('#loginPassword').val(); const errorDiv = $('#loginError');
    if (!selectedId) {
        alert("Vui lòng chọn tên nhân viên!"); return;
    }
    const user = (rawData.user || []).find(u => (u['Staff ID'] == selectedId || u['ID'] == selectedId));
    if (user && String(user['Password']).trim() === String(password).trim() && String(user['Status']) === 'Act') {
        currentUser = user;
        isLoggedIn = true; errorDiv.hide();
        let userName = user['Full name'] || user['Name'] || '';
        $('#userGreeting').css({ 'color': '#0A65C7', 'font-weight': 'bold' }).html(`<i class="fas fa-user-circle"></i> ${translations[currentLang].greeting} ${userName}`).show();
        checkUserPermissions();
        $('#loginSection').fadeOut(300, function () { $('#dashboardSection').fadeIn(300); applyFilter(); });
    } else {
        errorDiv.text(translations[currentLang].loginErrorMsg).show();
    }
}

function checkUserPermissions() {
    const auth = (currentUser && currentUser['Authority']) ? String(currentUser['Authority']).trim() : '';
    const isAdmin = (auth === ADMIN_ROLE);
    const isManager = MANAGER_ROLES.includes(auth);
    const allowedViews = (currentUser['View'] || '').split(',').map(s => s.trim().toLowerCase());

    // Hiển thị các Tab chính
    $('.main-tabs').show();
    $('#dashboard-main-tab').parent().show();
    $('#analytics-main-tab').parent().show();

    // --- PHẦN QUAN TRỌNG: TAB CẤU HÌNH & SỐ PENDING ---
    if (isManager) {
        // 1. Hiện Tab cấu hình
        $('#config-main-tab-li').show();

        // 2. Gọi hàm đếm số lượng Pending (QUAN TRỌNG)
        if (typeof updatePendingCount === 'function') {
            updatePendingCount();
        }
    } else {
        // Nếu không phải Admin/Manager thì ẩn Tab cấu hình
        $('#config-main-tab-li').hide();

        // Nếu đang đứng ở tab đó thì đá về Dashboard
        if ($('#config-main-tab').hasClass('active')) {
            $('#dashboard-main-tab').tab('show');
        }
    }
    // --------------------------------------------------

    // Xử lý các Tab dữ liệu (Hộ dân, Lô đất, Yearly)
    if (isAdmin) {
        $('#farmers-tab').parent().show();
        $('#plots-tab').parent().show();
        $('#yearly-tab').parent().show();
        if (!$('#dataTabs .nav-link.active').is(':visible')) $('#farmers-tab').click();
    } else {
        $('#farmers-tab').parent().hide();
        $('#plots-tab').parent().hide();
        $('#yearly-tab').parent().hide();
        let hasActive = false;
        if (allowedViews.includes('farmers')) {
            $('#farmers-tab').parent().show();
            if (!hasActive) { $('#farmers-tab').click(); hasActive = true; }
        }
        if (allowedViews.includes('plots')) {
            $('#plots-tab').parent().show();
            if (!hasActive) { $('#plots-tab').click(); hasActive = true; }
        }
        if (allowedViews.includes('yearly_data') || allowedViews.includes('yearly')) {
            $('#yearly-tab').parent().show();
            if (!hasActive) { $('#yearly-tab').click(); hasActive = true; }
        }
    }

    // Thiết lập quyền thao tác (Nút bấm Sửa/Xóa/Xuất)
    const ruleStr = (currentUser['Rule'] || '').toLowerCase();
    userPermissions.canView = ruleStr.includes('view') || isAdmin;
    userPermissions.canAdd = ruleStr.includes('add') || isAdmin;
    userPermissions.canEdit = ruleStr.includes('edit') || ruleStr.includes('update') || isAdmin;
    userPermissions.canDelete = ruleStr.includes('delete') || ruleStr.includes('del') || isAdmin;
    userPermissions.canPrint = ruleStr.includes('print') || isAdmin;
    userPermissions.canExport = ruleStr.includes('export') || isAdmin;
    userPermissions.allowedViews = allowedViews;

    if (userPermissions.canExport) {
        $('.filter-actions button[onclick="exportTable()"]').show();
    } else {
        $('.filter-actions button[onclick="exportTable()"]').hide();
    }

    // Hiển thị nút Thêm User và Bảng User (Nếu là Manager)
    if (isManager) {
        $('#btnAddUser').show();
        renderUserTable();
    } else {
        $('#btnAddUser').hide();
    }
}
function logout() {
    isLoggedIn = false;
    currentUser = null; $('#userGreeting').hide();
    $('#dashboardSection').fadeOut(300, function () { $('#loginSection').fadeIn(300); $('#loginPassword').val(''); $('#loginUserSelect').val(''); $('.btn-org').removeClass('active'); initLoginScreen(rawData.user); });
}

function showError(e) {
    var msg = "Lỗi: " + ((typeof e === 'object' && e.message) ? e.message : e);
    console.error(msg);
    var spinner = document.querySelector('.hourglass-loader'); if (spinner) spinner.style.display = 'none';
    var loadingText = document.querySelector('.loading-text'); if (loadingText) loadingText.style.display = 'none';
    var errorEl = document.getElementById('errorMessage'); if (errorEl) {
        errorEl.textContent = msg; errorEl.style.display = 'block';
    }
    var loadingContainer = document.getElementById('loading'); if (loadingContainer) loadingContainer.style.display = 'flex';
}

// --- HELPER FUNCTIONS ---
const getManageByGroup = (value) => {
    let s = String(value || "").trim().toUpperCase();
    if (s === "SLO1") return "Non-PFFP";
    if (s === "SLO") return "Slow forest";
    return "PFFP/WWF-Việt Nam";
};

function processReferenceData(data) {
    var adminList = data.admin ||
        []; adminList.forEach(r => { let id = String(r.Admin_ID || r.Adm_ID || r.ID || r.Code || '').trim(); if (id) adminMap[id] = { en: r.Label_EN || r['Label EN'] || r.English || r.Name_EN || r.Name || id, vi: r.Label_VN || r['Label VN'] || r.Vietnam || r.Name_VN || r.Name || id, condition: r.Condition || r.Type || '' }; });
    var dropList = data.drop || []; dropList.forEach(r => { let id = String(r.ID || r.Code || r.Value || '').trim(); if (id) dropMap[id] = { en: r.Label || r.Label_EN || r.Name_EN || id, vi: r.Label_VN || r.Name_VN || r.Label || id, condition: r.Condition || '' }; });
    var speciesList = data.species || []; speciesList.forEach(r => { let id = String(r.Species_ID || r.ID || r.Code || '').trim(); if (id) speciesMap[id] = { en: r.Species_name || r.Name_EN || r.Name || id, vi: r.Species_name || r.Name_VN || r.Name || id }; });
    var userList = data.user || []; userList.forEach(r => { let id = String(r['Staff ID'] || r.ID || r.Code || '').trim(); if (id) userMap[id] = { en: r['Full name'] || r.Name || id, vi: r['Full name'] || r.Name || id }; });
    var trainingList = data.trainingList || []; trainingList.forEach(r => { let id = String(r.Train_ID || r.ID || r.Code || '').trim(); if (id) trainingListMap[id] = { en: r.Name_EN || r.Name || id, vi: r.Name_VI || r.Name || id }; });
    var farmerList = data.farmers || []; farmerList.forEach(f => { if (f.Farmer_ID) farmersMap[f.Farmer_ID] = { en: f.Full_Name || f.Farmer_ID, vi: f.Full_Name || f.Farmer_ID }; });
    var plotList = data.plots || []; plotList.forEach(p => { if (p.Plot_Id) plotsMap[p.Plot_Id] = { en: p.Plot_Name || p.Plot_Id, vi: p.Plot_Name || p.Plot_Id }; });
}

function preProcessData(data) {
    if (data.farmers) {
        data.farmers.forEach(f => {
            f._supportedByArr = f['Supported by'] ? String(f['Supported by']).split(',').map(s => s.trim()).filter(Boolean) : [];
            f._supportedTypesArr = f['Supported Types'] ? String(f['Supported Types']).split(',').map(s => s.trim()).filter(Boolean) : [];
        });
    }
    if (data.plots) {
        data.plots.forEach(p => {
            p._shadeTreesBeforeArr = p['Name_Shade_Trees_Before'] ? String(p['Name_Shade_Trees_Before']).split(',').map(s => s.trim()).filter(Boolean) : [];
            p._farmRegSupportArr = p['Farm registered for support from'] ? String(p['Farm registered for support from']).split(',').map(s => s.trim()).filter(Boolean) : [];
        });
    }
    if (data.yearly) {
        data.yearly.forEach(y => {
            y._fertNameArr = y['Name of fertilizer'] ? String(y['Name of fertilizer']).split(',').map(s => s.trim()).filter(Boolean) : [];
            y._treeSupportByArr = y['Shade_Trees_supported by'] ? String(y['Shade_Trees_supported by']).split(',').map(s => s.trim()).filter(Boolean) : [];
            y._trainingArr = y['Attending training capacity organized by PFFP'] ? String(y['Attending training capacity organized by PFFP']).split(',').map(s => s.trim()).filter(Boolean) : [];
            y._speciesArr = y['Shade_Trees_Species'] ? String(y['Shade_Trees_Species']).split(',').map(s => s.trim()).filter(Boolean) : [];
        });
    }
}

function getLabel(id, map) { if (!id) return ""; let lId = String(id).trim(); if (map && map[lId]) return currentLang === 'vi' ? map[lId].vi : map[lId].en; return id; }
function resolveValue(key, value, tName) { if (!value) return ""; const c = FIELD_MAPPING[tName]; if (!c || !c[key]) return value; const mT = c[key]; let mO = null; if (typeof mT === 'string') { if (mT === 'admin') mO = adminMap; else if (mT === 'drop') mO = dropMap; else if (mT === 'species') mO = speciesMap; else if (mT === 'user') mO = userMap; else if (mT === 'trainingList') mO = trainingListMap; else if (mT === 'farmers') mO = farmersMap; else if (mT === 'plots') mO = plotsMap; } else if (typeof mT === 'object' && mT.map) { let mK = mT.map; if (mK === 'admin') mO = adminMap; else if (mK === 'drop') mO = dropMap; else if (mK === 'species') mO = speciesMap; else if (mK === 'user') mO = userMap; else if (mK === 'trainingList') mO = trainingListMap; } if (!mO) return value; if (typeof mT === 'object' && mT.separator) { return String(value).split(mT.separator).map(p => getLabel(p.trim(), mO)).join(', '); } else { return getLabel(value, mO); } }

function toggleLanguage() {
    currentLang = (currentLang === 'vi') ? 'en' : 'vi';
    $('[data-i18n]').each(function () { let k = $(this).data('i18n'); if (translations[currentLang][k]) $(this).text(translations[currentLang][k]); });
    let iH = translations[currentLang].langBtn; $('#langBtn').html(iH); $('#loginLangIcon').html(iH);

    if (currentUser) {
        let userName = currentUser['Full name'] ||
            currentUser['Name'] || '';
        $('#userGreeting').css({ 'color': '#0A65C7', 'font-weight': 'bold' }).html(`<i class="fas fa-user-circle"></i> ${translations[currentLang].greeting} ${userName}`);
    }

    // Cập nhật label cho cả các filter mới
    ['year', 'yearSupport', 'village', 'status', 'ethnicity', 'manageBy', 'supported', 'supportedTypes', 'species'].forEach(g => updateDropdownLabel(g));
    if (filteredData && filteredData.farmers) {
        drawCharts(filteredData.farmers, filteredData.plots, filteredData.yearly);
        drawAnalyticsCharts(filteredData.farmers, filteredData.plots, filteredData.yearly);
        drawSurvivalRateChart(filteredData.farmers, filteredData.yearly);
    }

    if ($('#users-pane').is(':visible')) renderUserTable();
    if ($('#userEditModal').is(':visible')) {
        const currentUserAuth = (currentUser && currentUser['Authority']) ?
            String(currentUser['Authority']).trim() : '';
        populateRoleDropdown();
        populatePositionDropdown();
        populateAuthorityDropdown('', currentUserAuth);
    }
    if ($('#dashboardSection').is(':visible')) applyFilter();
}

function initFilters() {
    if (!rawData.farmers) return;

    // 1. Year
    let uY = [...new Set(rawData.farmers.map(d => d['Participation Year']))].filter(Boolean).sort();
    let yO = uY.map(y => { let lK = String(y).trim(); let m = dropMap[lK]; if (m && m.condition === 'Participation Year') return { value: y, label_vi: m.vi, label_en: m.en }; return { value: y, label_vi: y, label_en: y }; });
    populateMultiSelect('year', yO, true);

    // 2. Year Support (NEW) - Condition 'Participation Year' from Drop
    let uYS = [...new Set(rawData.farmers.map(d => d['Year of support']))].filter(Boolean).sort();
    let ysO = uYS.map(y => { let lK = String(y).trim(); let m = dropMap[lK]; if (m && m.condition === 'Participation Year') return { value: y, label_vi: m.vi, label_en: m.en }; return { value: y, label_vi: y, label_en: y }; });
    populateMultiSelect('yearSupport', ysO, true);

    // 3. Village (Now Farmer Group)
    let vS = new Set(rawData.farmers.map(f => String(f['Farmer_Group_Name']).trim()).filter(Boolean));
    let vO = Array.from(vS).map(v => ({ value: v, label_vi: getLabel(v, adminMap) || v, label_en: getLabel(v, adminMap) || v })).sort((a, b) => (a.label_vi).localeCompare(b.label_vi));
    populateMultiSelect('village', vO, true);

    // 4. Status
    let sS = [...new Set(rawData.farmers.map(d => d['Status']))].filter(Boolean).sort();
    populateMultiSelect('status', sS.map(s => ({ value: s, label_vi: getLabel(s, dropMap) || s, label_en: getLabel(s, dropMap) || s })), true);

    // 5. Ethnicity
    let eS = new Set(rawData.farmers.map(f => String(f['Ethnicity']).trim()).filter(Boolean));
    let eO = Array.from(eS).map(e => ({ value: e, label_vi: getLabel(e, dropMap) || e, label_en: getLabel(e, dropMap) || e })).sort((a, b) => (a.label_vi).localeCompare(b.label_vi));
    populateMultiSelect('ethnicity', eO, true);

    // 6. Manage By (NEW) - Specialized 3-Category Logic
    let mS = new Set(rawData.farmers.map(d => getManageByGroup(d['Manage by'])));
    // Sort logic: PFFP/WWF-Việt Nam first (or alphabetic) - let's keep alphabetic or specific order
    // Specific order: PFFP/WWF-Việt Nam, PFFP/WWF-Việt Nam, Non-PFFP (mixed?), actually just 3 distinct values
    let mO = Array.from(mS).sort().map(m => ({ value: m, label_vi: m, label_en: m }));
    populateMultiSelect('manageBy', mO, true);

    // 7. Supported By
    let supS = new Set(); rawData.farmers.forEach(f => { if (f['Supported by']) f['Supported by'].toString().split(',').forEach(p => supS.add(p.trim())); });
    populateMultiSelect('supported', Array.from(supS).sort().map(s => ({ value: s, label_vi: getLabel(s, dropMap) || s, label_en: getLabel(s, dropMap) || s })), true);

    // 8. Supported Types
    let supTS = new Set(); rawData.farmers.forEach(f => { if (f['Supported Types']) f['Supported Types'].toString().split(',').forEach(p => supTS.add(p.trim())); });
    populateMultiSelect('supportedTypes', Array.from(supTS).sort().map(s => ({ value: s, label_vi: getLabel(s, dropMap) || s, label_en: getLabel(s, dropMap) || s })), true);

    // 9. Species
    let spS = new Set(); (rawData.yearly || []).forEach(y => { if (y['Shade_Trees_Species']) y['Shade_Trees_Species'].toString().split(',').forEach(p => spS.add(p.trim())); });
    populateMultiSelect('species', Array.from(spS).sort().map(s => ({ value: s, label_vi: speciesMap[s]?.vi || s, label_en: speciesMap[s]?.en || s })), true);
}

function populateMultiSelect(g, d, c = false) { const cn = $(`#${g}ListContainer`).empty(); d.forEach(i => { let v = c ? i.value : i; let lv = c ? (i.label_vi || v) : v; let le = c ? (i.label_en || v) : v; cn.append(`<li><div class="form-check"><input class="form-check-input check-item" type="checkbox" value="${v}" data-group="${g}" id="${g}_${v.toString().replace(/[^a-zA-Z0-9]/g, '_')}" checked><label class="form-check-label" for="${g}_${v.toString().replace(/[^a-zA-Z0-9]/g, '_')}" data-vi="${lv}" data-en="${le}">${(currentLang === 'vi') ? lv : le}</label></div></li>`); }); updateDropdownLabel(g); }
function getSelectedValues(g) { if ($(`.check-all[data-group="${g}"]`).is(':checked')) return 'All'; let s = []; $(`.check-item[data-group="${g}"]:checked`).each(function () { s.push($(this).val()); }); return s; }
function updateDropdownLabel(g) { $(`.check-item[data-group="${g}"]`).next('label').each(function () { $(this).text(currentLang === 'vi' ? $(this).data('vi') : $(this).data('en')); }); const t = $(`#btnFilter${g.charAt(0).toUpperCase() + g.slice(1)}Text`); if ($(`.check-all[data-group="${g}"]`).is(':checked')) { t.text(translations[currentLang].allOption); } else { let s = getSelectedValues(g); if (s.length === 0) t.text("---"); else if (s.length <= 2) { let ts = []; $(`.check-item[data-group="${g}"]:checked`).each(function () { ts.push($(this).next('label').text()); }); t.text(ts.join(", ")); } else t.text(`${s.length} ${translations[currentLang].selected}`); } }

function resetFilters() {
    // Reset Checkboxes
    $('.check-all, .check-item').prop('checked', true);
    ['year', 'yearSupport', 'village', 'status', 'ethnicity', 'manageBy', 'supported', 'supportedTypes', 'species'].forEach(g => updateDropdownLabel(g));

    // Reset Top X Dropdowns
    $('.chart-select').val('All');
    // Apply
    applyFilter();
}

function setFilterFromChart(group, value) {
    $(`.check-all[data-group="${group}"]`).prop('checked', false);
    $(`.check-item[data-group="${group}"]`).prop('checked', false);
    let found = false;
    $(`.check-item[data-group="${group}"]`).each(function () {
        let val = $(this).val();
        let lblVi = $(this).next('label').data('vi');
        let lblEn = $(this).next('label').data('en');
        if (String(val) === String(value) || String(lblVi) === String(value) || String(lblEn) === String(value)) {
            $(this).prop('checked', true);
            found = true;
        }
    });
    if (found) { updateDropdownLabel(group); applyFilter(); }
}

function applyFilter() {
    requestAnimationFrame(() => {
        let fY = getSelectedValues('year');
        let fYSup = getSelectedValues('yearSupport'); // NEW
        let fV = getSelectedValues('village');
        let fS = getSelectedValues('status');
        let fE = getSelectedValues('ethnicity');
        let fMan = getSelectedValues('manageBy'); // NEW
        let fSp = getSelectedValues('supported');
        let fST = getSelectedValues('supportedTypes');
        let fSpec = getSelectedValues('species');

        let restrictedGroups = []; if (currentUser && ['3a', '4a'].includes(String(currentUser['Authority']).trim())) { restrictedGroups = (currentUser['Role'] || '').split(',').map(s => s.trim()); }

        let filtF = (rawData.farmers || []).filter(f => {
            if (restrictedGroups.length > 0) { let fGroup = String(f['Farmer_Group_Name'] || '').trim(); if (!restrictedGroups.includes(fGroup)) return false; }

            if (fY !== 'All' && !fY.includes(f['Participation Year'])) return false;
            if (fYSup !== 'All' && !fYSup.includes(f['Year of support'])) return false; // NEW LOGIC
            if (fV !== 'All' && !fV.includes(f['Farmer_Group_Name'])) return false;
            if (fS !== 'All' && !fS.includes(f['Status'])) return false;
            if (fE !== 'All' && !fE.includes(f['Ethnicity'])) return false;
            let fManVal = getManageByGroup(f['Manage by']);
            if (fMan !== 'All' && !fMan.includes(fManVal)) return false;

            if (fSp !== 'All') { let s = f._supportedByArr; if (!(s.length === 0 && fSp.length === 0) && !s.some(i => fSp.includes(i))) return false; }
            if (fST !== 'All') { let s = f._supportedTypesArr; if (!(s.length === 0 && fST.length === 0) && !s.some(i => fST.includes(i))) return false; }
            return true;
        });

        let fIDs = new Set(filtF.map(f => f['Farmer_ID']));
        let filtY = (rawData.yearly || []).filter(y => { if (fSpec !== 'All') { let s = y._speciesArr; if (fSpec.length === 0 || !s.some(z => fSpec.includes(z))) return false; } return fIDs.has(y['Farmer_ID']); });

        if (fSpec !== 'All') { let fIDSpec = new Set(filtY.map(y => y['Farmer_ID'])); filtF = filtF.filter(f => fIDSpec.has(f['Farmer_ID'])); fIDs = fIDSpec; }
        let filtP = (rawData.plots || []).filter(p => fIDs.has(p['Farmer_ID']));
        filteredData = { farmers: filtF, plots: filtP, yearly: filtY };
        updateUI(filtF, filtP, filtY);
    });
}

function updateUI(f, p, y) {
    $('#kpi1').text(f.length.toLocaleString());
    $('#kpi2').text(p.length.toLocaleString());
    let totalArea = p.reduce((s, i) => s + (parseFloat(i['Area (ha)']) || 0), 0);
    $('#kpi3').text(totalArea.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    $('#kpi4').text(p.reduce((s, i) => s + (parseFloat(i['Num_Shade_Trees_Before']) || 0), 0).toLocaleString());
    let pl = y.reduce((s, i) => s + (parseFloat(i['Number_Shade_Trees_Planted']) || 0), 0);
    $('#kpi5').text(pl.toLocaleString());
    let spS = new Set(); let selS = getSelectedValues('species'); y.forEach(i => { if (i['Shade_Trees_Species']) i['Shade_Trees_Species'].toString().split(',').map(s => s.trim()).filter(Boolean).forEach(x => { if (selS === 'All' || selS.includes(x)) spS.add(x); }); }); $('#kpi6').text(spS.size); let vS = new Set(); f.forEach(i => { if (i['Farmer_Group_Name']) vS.add(i['Farmer_Group_Name']); }); $('#kpi7').text(vS.size); let dC = f.filter(i => (i['Activity'] || '').trim() === 'Done').length; $('#kpi8').text(f.length > 0 ? (dC / f.length * 100).toFixed(2) + '%' : '0.00%'); let dd = y.reduce((s, i) => s + (parseFloat(i['Shade_Trees_Died']) || 0), 0); $('#kpi9').text(pl > 0 ? ((pl - dd) / pl * 100).toFixed(2) + '%' : '0.00%');

    let sumCherryVol = 0; let sumHQVol = 0;
    y.forEach(item => { let cherry = parseFloat(item['Annual_Volume_Cherry']) || 0; let hq = parseFloat(item['Volume_High_Quality']) || 0; sumCherryVol += cherry; sumHQVol += hq; });
    $('#kpi10').text(sumCherryVol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    $('#kpi11').text(sumHQVol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

    drawCharts(f, p, y);
    // Updated to accept Yearly for Participation/Training
    drawAnalyticsCharts(f, p, y);
    drawSurvivalRateChart(f, y);
    drawTables(f, p, y);
}

function processBarChartData(dataArray, filterId) {
    dataArray.sort((a, b) => b.value - a.value);
    if (!filterId) return dataArray;
    let filterVal = $(filterId).val();
    if (!filterVal || filterVal === 'All') return dataArray;
    return dataArray.slice(0, parseInt(filterVal));
}

function reDrawDashboardCharts() {
    if (filteredData.farmers) drawCharts(filteredData.farmers, filteredData.plots, filteredData.yearly);
}
function reDrawAnalyticsCharts() {
    if (filteredData.farmers) drawAnalyticsCharts(filteredData.farmers, filteredData.plots, filteredData.yearly);
}

// --- DRAW DASHBOARD CHARTS ---
function drawCharts(farmers, plots, yearly) {

    // 1. Participation by Year (Số hộ - Integer)
    let yearCounts = {};
    farmers.forEach(item => {
        let yVal = item['Participation Year'];
        if (yVal) {
            let label = resolveValue('Participation Year', yVal, 'Farmers');
            if (!yearCounts[label]) yearCounts[label] = 0;
            yearCounts[label]++;
        }
    });
    let partData = Object.keys(yearCounts).map(k => ({ label: k, value: yearCounts[k], code: k }));

    if (chartInstances['chartParticipation']) chartInstances['chartParticipation'].destroy();
    let ctxPart = document.getElementById('chartParticipation').getContext('2d');
    chartInstances['chartParticipation'] = new Chart(ctxPart, {
        type: 'bar',
        data: { labels: partData.map(d => d.label), datasets: [{ label: translations[currentLang].lblFarmers, data: partData.map(d => d.value), backgroundColor: APP_COLORS[0], borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: integerDataLabels }, onClick: (e, els) => { if (els.length > 0) setFilterFromChart('year', partData[els[0].index].code); } }
    });

    // 2. Activity Status (Pie - Người - Count is Integer, % is Float)
    let statusCounts = { 'Act': 0, 'InA': 0 };
    farmers.forEach(item => { let s = String(item['Status']).trim(); if (s === 'Act') statusCounts['Act']++; else statusCounts['InA']++; });
    if (chartInstances['chartStatus']) chartInstances['chartStatus'].destroy();
    let ctxStatus = document.getElementById('chartStatus').getContext('2d');
    chartInstances['chartStatus'] = new Chart(ctxStatus, {
        type: 'pie',
        data: { labels: [translations[currentLang].lblActive, translations[currentLang].lblInactive], datasets: [{ data: [statusCounts['Act'], statusCounts['InA']], backgroundColor: [APP_COLORS[0], '#BDBDBD'] }] },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: {
                datalabels: {
                    color: '#000',
                    backgroundColor: 'rgba(232, 245, 233, 0.8)',
                    borderRadius: 4,
                    font: { weight: 'bold' },
                    formatter: (val, ctx) => { let sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0); return (val * 100 / sum).toFixed(2) + "%"; }
                }
            }, onClick: (e, els) => { if (els.length > 0) { let code = (els[0].index === 0) ? 'Act' : 'InA'; setFilterFromChart('status', code); } }
        }
    });

    // 3. Completion (Pie - Count) - REPLACED or NEW CHART POSITION
    // Ban đầu là chartCompletion, chart3, chart4, v.v.
    // Ta sẽ vẽ chartCompletion vào chartCompletion (vị trí 3 cũ, nay ở giữa)
    let doneC = 0, nyC = 0;
    farmers.forEach(f => { if ((f['Activity'] || 'NY').trim() === 'Done') doneC++; else nyC++; });
    renderChart('chartCompletion', 'pie', ['Done', 'NY'], [{ data: [doneC, nyC], backgroundColor: [APP_COLORS[0], '#FFC107'] }],
        {
            plugins: {
                datalabels: {
                    color: '#000', backgroundColor: 'rgba(232, 245, 233, 0.8)', borderRadius: 4, font: { weight: 'bold' },
                    formatter: (val, ctx) => { let sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0); return (val * 100 / sum).toFixed(1) + "%"; }
                }
            }
        });

    // 4. Manage By (NEW CHART)
    // Dữ liệu: Non-PFFP, Slow Forest, PFFP/WWF-Việt Nam
    let manCounts = {};
    farmers.forEach(f => {
        let label = getManageByGroup(f['Manage by']);
        if (!manCounts[label]) manCounts[label] = 0;
        manCounts[label]++;
    });
    let manData = Object.keys(manCounts).map(k => {
        return { label: k, value: manCounts[k] };
    });
    // Sort desc by value
    manData.sort((a, b) => b.value - a.value);

    if (chartInstances['chartManageBy']) chartInstances['chartManageBy'].destroy();
    // Kiểm tra xem canvas có tồn tại không (do người dùng thêm HTML)
    let ctxManEl = document.getElementById('chartManageBy');
    if (ctxManEl) {
        let ctxMan = ctxManEl.getContext('2d');
        chartInstances['chartManageBy'] = new Chart(ctxMan, {
            type: 'bar',
            data: { labels: manData.map(d => d.label), datasets: [{ label: translations[currentLang].lblFarmers, data: manData.map(d => d.value), backgroundColor: APP_COLORS[3], borderRadius: 4 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, datalabels: integerDataLabels },
                onClick: (e, els) => {
                    if (els.length > 0) {
                        // Với logic mới, label chính là value (Non-PFFP, Slow Forest...)
                        let lbl = manData[els[0].index].label;
                        // Với logic mới, label chính là value (Non-PFFP, Slow Forest...)
                        setFilterFromChart('manageBy', lbl);
                    }
                }
            }
        });
    }

    // 5. Training & Op6 (Counts - Integer)
    let trCount = yearly.filter(i => (i['Attending training capacity organized by PFFP'] || '').length > 0).length;
    let opCount = yearly.filter(i => (i['Op6_Activities'] || '').length > 0).length;
    renderChart('chartTraining', 'bar', [translations[currentLang].lblTraining, translations[currentLang].lblOp6], [{ data: [trCount, opCount], backgroundColor: [APP_COLORS[2], APP_COLORS[4]], label: 'Count' }], { plugins: { datalabels: integerDataLabels } });

    // 6. Progress by Village (Counts - Integer)
    let activityData = {};
    let labelToCodeMap = {};
    farmers.forEach(f => {
        let vCode = f['Farmer_Group_Name'] || 'Unknown';
        let vLabel = getLabel(vCode, adminMap) || vCode;
        labelToCodeMap[vLabel] = vCode;
        if (!activityData[vLabel]) activityData[vLabel] = { Done: 0, NY: 0 };
        let isDone = (f['Activity'] || 'NY').trim() === 'Done'; if (isDone) activityData[vLabel].Done++; else activityData[vLabel].NY++;
    });
    let progressArray = Object.keys(activityData).map(v => ({ label: v, done: activityData[v].Done, ny: activityData[v].NY, value: activityData[v].Done + activityData[v].NY, code: labelToCodeMap[v] }));
    let displayProgress = processBarChartData(progressArray, '#filterTopProgress');

    if (chartInstances['chartActivity']) chartInstances['chartActivity'].destroy();
    let ctxActivity = document.getElementById('chartActivity').getContext('2d');
    chartInstances['chartActivity'] = new Chart(ctxActivity, {
        type: 'bar',
        data: { labels: displayProgress.map(d => d.label), datasets: [{ label: 'Done', data: displayProgress.map(d => d.done), backgroundColor: APP_COLORS[0], stack: 'Stack 0' }, { label: 'NY', data: displayProgress.map(d => d.ny), backgroundColor: '#FFC107', stack: 'Stack 0' }] },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { datalabels: integerDataLabels }, scales: { x: { stacked: true }, y: { stacked: true } },
            onClick: (e, els) => { if (els.length > 0) setFilterFromChart('village', displayProgress[els[0].index].code); }
        }
    });

    // 7. Support Status (Counts - Integer)
    let groupStats = {};
    farmers.forEach(item => {
        let grpCode = item['Farmer_Group_Name'] || 'Unknown';
        let grpLabel = getLabel(grpCode, adminMap) || grpCode;
        if (!groupStats[grpLabel]) groupStats[grpLabel] = { Act: 0, InA: 0 };
        if (item['Status'] === 'Act') groupStats[grpLabel].Act++; else groupStats[grpLabel].InA++;
    });
    let supportArray = Object.keys(groupStats).map(v => ({ label: v, act: groupStats[v].Act, ina: groupStats[v].InA, value: groupStats[v].Act + groupStats[v].InA, code: labelToCodeMap[v] }));
    let displaySupport = processBarChartData(supportArray, '#filterTopSupport');

    if (chartInstances['chartSupportStatus']) chartInstances['chartSupportStatus'].destroy();
    let ctxSupport = document.getElementById('chartSupportStatus').getContext('2d');
    chartInstances['chartSupportStatus'] = new Chart(ctxSupport, {
        type: 'bar',
        data: { labels: displaySupport.map(d => d.label), datasets: [{ label: translations[currentLang].lblActive, data: displaySupport.map(d => d.act), backgroundColor: APP_COLORS[0], stack: 'Stack 0' }, { label: translations[currentLang].lblInactive, data: displaySupport.map(d => d.ina), backgroundColor: '#BDBDBD', stack: 'Stack 0' }] },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { datalabels: integerDataLabels }, scales: { x: { stacked: true }, y: { stacked: true } },
            onClick: (e, els) => { if (els.length > 0) setFilterFromChart('village', displaySupport[els[0].index].code); }
        }
    });

    // 8. Ethnicity (Pie - %)
    let ethCounts = {};
    farmers.forEach(f => { let e = getLabel(f['Ethnicity'], dropMap) || 'N/A'; ethCounts[e] = (ethCounts[e] || 0) + 1; });
    renderChart('chartEthnicity', 'pie', Object.keys(ethCounts), [{ data: Object.values(ethCounts), backgroundColor: APP_COLORS }],
        {
            plugins: {
                datalabels: {
                    color: '#000', backgroundColor: 'rgba(232, 245, 233, 0.8)', borderRadius: 4, font: { weight: 'bold' },
                    formatter: (val, ctx) => { let sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0); return (val * 100 / sum).toFixed(1) + "%"; }
                }
            }
        },
        (idx, lbl) => { let code = Object.keys(dropMap).find(key => dropMap[key].vi === lbl || dropMap[key].en === lbl) || lbl; setFilterFromChart('ethnicity', code); });
}

// --- DRAW ANALYTICS CHARTS (Đã cập nhật: 4 Pie Charts hàng ngang) ---
function drawAnalyticsCharts(f, p, y) {
    // Cấu hình chung cho Pie Chart (Hiển thị Giá trị + %)
    const pieOptions = {
        plugins: {
            datalabels: {
                color: '#000', backgroundColor: 'rgba(232, 245, 233, 0.9)', borderRadius: 4, font: { weight: 'bold', size: 10 },
                formatter: (val, ctx) => {
                    let sum = 0;
                    ctx.chart.data.datasets[0].data.map(d => sum += d);
                    let pct = sum > 0 ? (val * 100 / sum).toFixed(1) + "%" : "0%";
                    // Nếu giá trị quá nhỏ thì chỉ hiện %, ngược lại hiện cả số + %
                    return val > 0 ? `${Math.round(val).toLocaleString('en-US')}\n(${pct})` : '';
                }
            },
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } }
        }
    };

    // 1. Total Area (Bar Chart - Giữ nguyên)
    let villageStats = {};
    let labelToCodeMap = {};
    f.forEach(item => {
        let vCode = item['Farmer_Group_Name'] || 'Unknown';
        let vLabel = getLabel(vCode, adminMap) || vCode;
        labelToCodeMap[vLabel] = vCode;
        if (!villageStats[vLabel]) villageStats[vLabel] = { totalOwned: 0, registered: 0 };
        let owned = parseFloat(item['Total_Coffee_Area']) || 0;
        let reg = parseFloat(item['Total Area registered']) || 0;
        villageStats[vLabel].totalOwned += owned;
        villageStats[vLabel].registered += reg;
    });
    let areaArray = Object.keys(villageStats).map(v => ({ label: v, reg: villageStats[v].registered, nonReg: (villageStats[v].totalOwned - villageStats[v].registered > 0) ? (villageStats[v].totalOwned - villageStats[v].registered) : 0, value: villageStats[v].totalOwned, code: labelToCodeMap[v] }));
    let displayArea = processBarChartData(areaArray, '#filterTopArea');

    if (chartInstances['chartAreaByVillage']) chartInstances['chartAreaByVillage'].destroy();
    let ctxArea = document.getElementById('chartAreaByVillage').getContext('2d');
    chartInstances['chartAreaByVillage'] = new Chart(ctxArea, {
        type: 'bar',
        data: { labels: displayArea.map(d => d.label), datasets: [{ label: 'Diện tích đăng ký (ha)', data: displayArea.map(d => d.reg), backgroundColor: APP_COLORS[0], stack: 'Stack 0' }, { label: 'Diện tích còn lại (ha)', data: displayArea.map(d => d.nonReg), backgroundColor: APP_COLORS[3], stack: 'Stack 0' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { datalabels: floatDataLabels }, scales: { x: { stacked: true }, y: { stacked: true } }, onClick: (e, els) => { if (els.length > 0) setFilterFromChart('village', displayArea[els[0].index].code); } }
    });

    // 2. Productivity (Bar Chart - Giữ nguyên)
    let prodStats = {};
    let farmerInfoMap = {};
    f.forEach(item => {
        let vCode = item['Farmer_Group_Name'] || 'Unknown';
        let vLabel = getLabel(vCode, adminMap) || vCode;
        farmerInfoMap[item['Farmer_ID']] = { village: vLabel, code: vCode };
    });
    y.forEach(item => { let fid = String(item['Farmer_ID']).trim(); let vol = parseFloat(item['Annual_Volume_Cherry']) || 0; if (farmerInfoMap[fid]) { let v = farmerInfoMap[fid].village; if (!prodStats[v]) prodStats[v] = 0; prodStats[v] += vol; } });
    let prodArray = Object.keys(prodStats).map(v => ({ label: v, value: prodStats[v], code: Object.values(farmerInfoMap).find(i => i.village === v)?.code }));
    let displayProd = processBarChartData(prodArray, '#filterTopProd');

    if (chartInstances['chartProductivity']) chartInstances['chartProductivity'].destroy();
    let ctxProd = document.getElementById('chartProductivity').getContext('2d');
    chartInstances['chartProductivity'] = new Chart(ctxProd, { type: 'bar', data: { labels: displayProd.map(d => d.label), datasets: [{ label: 'Tấn (Ton)', data: displayProd.map(d => d.value), backgroundColor: APP_COLORS[1] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { datalabels: floatDataLabels }, onClick: (e, els) => { if (els.length > 0) setFilterFromChart('village', displayProd[els[0].index].code); } } });

    // --- 4 BIỂU ĐỒ TRÒN (PIE) HÀNG DƯỚI ---

    // 3. Finance (Pie)
    let sumIncome = 0, sumFert = 0, sumPest = 0, sumHerb = 0, sumLabor = 0, sumOther = 0;
    y.forEach(item => { sumIncome += parseFloat(item['Total_Coffee_Income']) || 0; sumFert += parseFloat(item['Fertilizer cost']) || 0; sumPest += parseFloat(item['Pesticides cost']) || 0; sumHerb += parseFloat(item['Herbicides cost']) || 0; sumLabor += parseFloat(item['Hired_Labor_Costs']) || 0; sumOther += parseFloat(item['Other_Costs']) || 0; });

    // Chú ý: Pie Chart so sánh Thu nhập vs Chi phí sẽ hiển thị tỉ trọng
    renderChart('chartFinance', 'pie',
        [translations[currentLang].lblIncome, translations[currentLang].lblFert, translations[currentLang].lblPest, translations[currentLang].lblHerb, translations[currentLang].lblLabor, translations[currentLang].lblOther],
        [{ data: [sumIncome, sumFert, sumPest, sumHerb, sumLabor, sumOther], backgroundColor: [APP_COLORS[0], '#E53935', '#FB8C00', '#FDD835', '#8E24AA', '#546E7A'] }],
        pieOptions
    );

    // 4. Shade Trees (Pie)
    let exTrees = p.reduce((a, b) => a + (parseFloat(b['Num_Shade_Trees_Before']) || 0), 0);
    let newTrees = 0;
    y.forEach(r => { let pl = parseFloat(r['Number_Shade_Trees_Planted']) || 0; let di = parseFloat(r['Shade_Trees_Died']) || 0; let s = pl - di; if (s < 0) s = 0; newTrees += s; });
    renderChart('chartShadeTrees', 'pie',
        [translations[currentLang].lblExisting, translations[currentLang].lblNew],
        [{ data: [exTrees, newTrees], backgroundColor: ['#795548', APP_COLORS[2]] }],
        pieOptions
    );

    // 5. Sales to SLOW (Pie)
    let regSale = y.reduce((a, b) => a + (parseFloat(b['Cherry sales registered to Slow']) || 0), 0);
    let realSale = y.reduce((a, b) => a + (parseFloat(b['Cherry sales supplied to Slow']) || 0), 0);
    renderChart('chartSlowSales', 'pie',
        [translations[currentLang].lblReg, translations[currentLang].lblReal],
        [{ data: [regSale, realSale], backgroundColor: ['#FFA000', APP_COLORS[0]] }],
        pieOptions
    );

    // 6. Quality (Pie)
    let hqVol = y.reduce((a, b) => a + (parseFloat(b['Volume_High_Quality']) || 0), 0);
    let totalVol = y.reduce((a, b) => a + (parseFloat(b['Annual_Volume_Cherry']) || 0), 0);
    let normalVol = totalVol - hqVol; if (normalVol < 0) normalVol = 0;
    renderChart('chartQuality', 'pie',
        [translations[currentLang].lblCLC, translations[currentLang].lblNormal],
        [{ data: [hqVol, normalVol], backgroundColor: [APP_COLORS[0], '#FFC107'] }],
        pieOptions
    );

    // 7. Survival Rate (Bar - Giữ nguyên)
    drawSurvivalRateChart(f, y);
}

function drawSurvivalRateChart(farmers, yearly) {
    if (!document.getElementById('chartSurvivalRate')) return;
    let farmerVillageMap = {}; let labelToCodeMap = {};
    farmers.forEach(f => {
        let vCode = f['Farmer_Group_Name'];
        let vLabel = getLabel(vCode, adminMap) || vCode || 'Unknown';
        farmerVillageMap[f['Farmer_ID']] = vLabel;
        labelToCodeMap[vLabel] = vCode;
    });
    let villageData = {};
    yearly.forEach(y => { let fid = String(y['Farmer_ID']).trim(); let vLabel = farmerVillageMap[fid]; if (vLabel) { if (!villageData[vLabel]) villageData[vLabel] = { planted: 0, died: 0 }; villageData[vLabel].planted += parseFloat(y['Number_Shade_Trees_Planted']) || 0; villageData[vLabel].died += parseFloat(y['Shade_Trees_Died']) || 0; } });
    let survArray = [];
    for (const [vLabel, stats] of Object.entries(villageData)) {
        let rate = 0;
        if (stats.planted > 0) {
            rate = ((stats.planted - stats.died) / stats.planted) * 100;
            if (rate < 0) rate = 0;
        } survArray.push({ label: vLabel, value: rate, code: labelToCodeMap[vLabel] });
    }
    let displaySurv = processBarChartData(survArray, '#filterTopSurvival');

    if (chartInstances['chartSurvivalRate']) chartInstances['chartSurvivalRate'].destroy();
    let ctx = document.getElementById('chartSurvivalRate').getContext('2d');
    chartInstances['chartSurvivalRate'] = new Chart(ctx, {
        type: 'bar',
        data: { labels: displaySurv.map(d => d.label), datasets: [{ label: '%', data: displaySurv.map(d => d.value), backgroundColor: APP_COLORS[1], borderRadius: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { color: '#000', backgroundColor: 'rgba(232, 245, 233, 0.8)', borderRadius: 4, font: { weight: 'bold' }, anchor: 'end', align: 'top', formatter: (val) => val.toFixed(2) + '%' } }, scales: {
                y: { beginAtZero: true, max: 100 }
            }, onClick: (e, els) => { if (els.length > 0) { setFilterFromChart('village', displaySurv[els[0].index].code); } }
        }
    });
}

function renderChart(id, type, labels, datasets, optionsOverride = {}, onClickCallback = null) {
    if (chartInstances[id]) chartInstances[id].destroy();
    let ctx = document.getElementById(id).getContext('2d');
    let defaultOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', display: true }, datalabels: commonDataLabels },
        onClick: (e, elements) => {
            if (onClickCallback && elements.length > 0) {
                let index = elements[0].index;
                let label = labels[index]; onClickCallback(index, label);
            }
        }
    };
    if (optionsOverride.scales) defaultOptions.scales = optionsOverride.scales;
    if (optionsOverride.plugins) {
        Object.assign(defaultOptions.plugins, optionsOverride.plugins);
    }
    chartInstances[id] = new Chart(ctx, { type: type, data: { labels: labels, datasets: datasets }, options: defaultOptions });
}

// --- SHOW DETAILED FARMER INFO (Code thay thế mới) ---
function showFarmerDetails(farmerId) {
    if (!rawData.farmers) return;

    // 1. Tìm thông tin Hộ dân
    let farmer = rawData.farmers.find(f => String(f.Farmer_ID) === String(farmerId));
    if (!farmer) return;

    // 2. Tìm danh sách Lô đất (Plots) liên quan
    let relatedPlots = (rawData.plots || []).filter(p => String(p.Farmer_ID) === String(farmerId));

    // 3. Tìm danh sách Dữ liệu hàng năm (Yearly) liên quan
    let relatedYearly = (rawData.yearly || []).filter(y => String(y.Farmer_ID) === String(farmerId));
    // Sắp xếp năm giảm dần
    relatedYearly.sort((a, b) => b.Year - a.Year);

    // --- XÂY DỰNG HTML CHI TIẾT ---
    let html = `
            <div class="print-main-title">
                HỒ SƠ NÔNG HỘ: ${farmer.Full_Name || ''} (${farmer.Farmer_ID})
            </div>
        `;

    // === PHẦN 1: THÔNG TIN HỘ DÂN (Bố cục 3 cột) ===
    html += `<div class="section-title"><i class="fas fa-user-circle"></i> I. THÔNG TIN HỘ DÂN (FARMER INFO)</div>`;
    html += `<div class="detail-grid-container">`;

    // Danh sách các trường cần hiển thị theo thứ tự
    const farmerFields = [
        'Full_Name', 'Farmer_ID', 'Year_Of_Birth',
        'Gender', 'Ethnicity', 'ID card',
        'Phone_Number', 'Village_Name', 'Commune_Name',
        'Farmer_Group_Name', 'Cooperative_Name', 'Address',
        'Num_Household_Members', 'Num_Working_Members', 'Socioeconomic Status',
        'Household Circumstances', 'Total_Coffee_Area', 'Number of coffee farm plots',
        'Supported by', 'Supported Types', 'Status',
        'Activity', 'Participation Year', 'Staff input'
    ];

    farmerFields.forEach(key => {
        let labelKey = FIELD_LABELS['Farmers'][key] || key;
        let label = translations[currentLang][labelKey] || labelKey;
        let val = resolveValue(key, farmer[key], 'Farmers'); // Chuyển mã sang chữ hiển thị

        html += `
                <div class="detail-item">
                    <div class="field-label">${label}</div>
                    <div class="field-value">${val || '-'}</div>
                </div>`;
    });
    html += `</div>`; // Kết thúc grid

    // === PHẦN 2: DANH SÁCH LÔ ĐẤT (GRID) ===
    html += `<div class="section-title"><i class="fas fa-map"></i> II. DANH SÁCH LÔ ĐẤT (PLOTS) - [Tổng: ${relatedPlots.length} lô]</div>`;

    if (relatedPlots.length > 0) {
        html += renderChildGrid(relatedPlots, 'Plots');
    } else {
        html += `<div class="text-muted fst-italic p-2">Không có dữ liệu lô đất.</div>`;
    }

    // === PHẦN 3: DỮ LIỆU HÀNG NĂM (GRID) ===
    html += `<div class="section-title"><i class="fas fa-history"></i> III. DỮ LIỆU HÀNG NĂM (YEARLY DATA)</div>`;

    if (relatedYearly.length > 0) {
        html += renderChildGrid(relatedYearly, 'Yearly_Data');
    } else {
        html += `<div class="text-muted fst-italic p-2">Không có dữ liệu hàng năm.</div>`;
    }

    // --- Đẩy nội dung vào Modal ---
    $('#detailContent').html(html);
    $('#farmerDetailTitle').text(`${translations[currentLang].detailPrefix}: ${farmer.Full_Name}`);

    // --- TẠO NÚT CHỨC NĂNG (FOOTER) ---
    let buttonsHtml = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-times"></i> ${translations[currentLang].btnClose}</button>
            <button type="button" class="btn btn-primary ms-2" onclick="printFarmerDetail()">
                <i class="fas fa-print"></i> In (PDF)
            </button>
        `;

    // Quyền Sửa/Xóa
    if (userPermissions.canEdit) {
        buttonsHtml += `
                <button type="button" class="btn btn-warning ms-2" onclick="editFarmer('${farmerId}')">
                    <i class="fas fa-edit"></i> Sửa
                </button>`;
    }
    if (userPermissions.canDelete) {
        buttonsHtml += `
                <button type="button" class="btn btn-danger ms-2" onclick="deleteFarmer('${farmerId}')">
                    <i class="fas fa-trash"></i> Xóa
                </button>`;
    }

    $('#modalActions').html(buttonsHtml);
    $('#modalActions').removeClass('no-print');

    // --- CHÂN TRANG IN ẤN (FOOTER IN) ---
    let printFooter = `
            <div style="margin-top: 30px; display: flex; justify-content: space-between; width: 100%;">
                <div style="text-align: center; width: 40%;">
                    <div><b>Người lập biểu</b></div>
                    <div style="margin-top: 40px;">(Ký, họ tên)</div>
                </div>
                <div style="text-align: center; width: 40%;">
                    <div><i>Ngày ..... tháng ..... năm 20...</i></div>
                    <div><b>Xác nhận của Hộ dân</b></div>
                    <div style="margin-top: 40px;">(Ký, họ tên)</div>
                </div>
            </div>
        `;
    $('#printFooterContent').html(printFooter);

    // Hiển thị Modal
    const modal = new bootstrap.Modal(document.getElementById('farmerDetailModal'));
    modal.show();
}

// --- HÀM VẼ LƯỚI BẢN GHI CON (Chi tiết cho Plot/Yearly) ---
function renderChildGrid(data, type) {
    let html = '';
    const labels = FIELD_LABELS[type] || {};
    const idKey = (type === 'Plots') ? 'Plot_Id' : 'Record_Id';

    data.forEach((item, idx) => {
        html += `
            <div class="child-card-wrapper mb-4 p-3 border rounded bg-white shadow-sm position-relative">
                <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                    <div class="fw-bold text-success"><i class="fas fa-tag"></i> ${idx + 1}. ${item[idKey] || ''}</div>
                    <div class="no-print d-flex gap-2">
                        <button class="btn btn-sm btn-warning" onclick="openEditForm('${type}', '${item[idKey]}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deleteItem('${type}', '${item[idKey]}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="detail-grid-container">`;

        Object.keys(labels).forEach(key => {
            let labelKey = labels[key];
            let label = translations[currentLang][labelKey] || labelKey;
            let val = resolveValue(key, item[key], type);

            html += `
                    <div class="detail-item">
                        <div class="field-label">${label}</div>
                        <div class="field-value">${val || '-'}</div>
                    </div>`;
        });

        html += `</div></div>`;
    });
    return html;
}

// Giữ lại hàm cũ nếu có chỗ khác gọi (nhưng trong code hiện tại chỉ thấy dùng ở showFarmerDetails)
function renderSubTable(data, columns, type) { return renderChildGrid(data, type); }

// --- CHỨC NĂNG: IN PDF ---
function printFarmerDetail() {
    window.print();
}

// --- CHỨC NĂNG: XÓA CHUNG ---
async function deleteItem(type, id) {
    const c = await showCustomConfirm(`${translations[currentLang].confirmDelete} (${id})?`, 'delete');
    if (!c) return;

    // Đóng modal chi tiết nếu đang mở
    const modalEl = document.getElementById('farmerDetailModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    $('#loading').show();

    // GỌI API XÓA
    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'deleteData',
            sheetName: type,
            id: id
        })
    })
        .then(res => res.json())
        .then(res => {
            $('#loading').fadeOut();
            if (res.status === 'success') {
                refreshData();
                alert(translations[currentLang].deleteSuccess);
            } else {
                showError(res.message);
            }
        })
        .catch(err => showError(err));
}

// Giữ lại tên cũ để đảm bảo tương thích nếu có chỗ gọi trực tiếp
async function deleteFarmer(id) { deleteItem('Farmers', id); }

// --- CHỨC NĂNG: SỬA CHUNG (Full Fields) ---
function openEditForm(type, id) {
    // Đóng modal chi tiết
    const detailModal = bootstrap.Modal.getInstance(document.getElementById('farmerDetailModal'));
    if (detailModal) detailModal.hide();

    let dataList = (type === 'Farmers') ? rawData.farmers : (type === 'Plots' ? rawData.plots : rawData.yearly);
    let idKey = (type === 'Farmers') ? 'Farmer_ID' : (type === 'Plots' ? 'Plot_Id' : 'Record_Id');
    let item = dataList.find(i => String(i[idKey]) === String(id));
    if (!item) return;

    // Reset form sửa chung
    let titlePrefix = translations[currentLang].editPrefix || "Sửa";
    $('#editFormTitle').text(`${titlePrefix}: ${item.Full_Name || item.Plot_Name || item.Record_Id || id}`);
    $('#genericForm').trigger("reset");
    $('#formFields').empty();
    $('#formType').val(type);
    $('#formId').val(id);

    // Tự động tạo các trường input từ FIELD_LABELS
    let fieldsHtml = '';
    const labels = FIELD_LABELS[type] || {};

    Object.keys(labels).forEach(key => {
        let labelKey = labels[key];
        let label = translations[currentLang][labelKey] || labelKey;
        let val = item[key] || '';

        // Xác định loại input (sơ bộ)
        let inputType = 'text';
        if (!isNaN(parseFloat(val)) && isFinite(val) && String(val).indexOf('.') === -1) {
            // Có vẻ là số? Nhưng nhiều khi là ID card nên cứ để text cho an toàn hoặc number nếu cần
            // Ở đây mình ưu tiên text để tránh lỗi định dạng appsheet
        }

        fieldsHtml += `
            <div class="col-md-6 col-lg-4">
                <label class="form-label-custom">${label}</label>
                <input type="${inputType}" class="form-control form-control-sm" name="${key}" value="${escapeHtml(val)}">
            </div>`;
    });

    // Thêm cảnh báo
    fieldsHtml += `<div class="col-12 text-danger small fst-italic mt-2">* Lưu ý: Chế độ chỉnh sửa toàn bộ. Hãy kiểm tra kỹ tất cả các trường trước khi Lưu.</div>`;

    $('#formFields').html(fieldsHtml);

    const editModal = new bootstrap.Modal(document.getElementById('editFormModal'));
    editModal.show();
}

function editFarmer(id) { openEditForm('Farmers', id); }
function editPlot(id) { openEditForm('Plots', id); }
function editYearly(id) { openEditForm('Yearly_Data', id); }

// --- HÀM LƯU DỮ LIỆU (Đảm bảo hàm này có trong code) ---
function saveData() {
    const formType = $('#formType').val();
    const formId = $('#formId').val();

    let formData = {};
    if (formType === 'Farmers') formData['Farmer_ID'] = formId;
    if (formType === 'Plots') formData['Plot_Id'] = formId;
    if (formType === 'Yearly_Data') formData['Record_Id'] = formId;

    // Lấy dữ liệu từ các ô input
    $('#genericForm input').each(function () {
        let name = $(this).attr('name');
        if (name) formData[name] = $(this).val();
    });

    $('#loading').show();

    // GỌI API LƯU
    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'saveData',
            sheetName: formType,
            formData: formData
        })
    })
        .then(res => res.json())
        .then(res => {
            $('#loading').fadeOut();
            if (res.status === 'success') {
                const modalInstance = bootstrap.Modal.getInstance(document.getElementById('editFormModal'));
                if (modalInstance) modalInstance.hide();
                refreshData();
                alert("Cập nhật thành công!");
            } else {
                showError(res.message);
            }
        })
        .catch(err => showError(err));
}


function showSingleItemDetails(type, id) {
    let dataList = (type === 'Plots') ?
        rawData.plots : rawData.yearly;
    let idKey = (type === 'Plots') ? 'Plot_Id' : 'Record_Id';
    let item = dataList.find(i => String(i[idKey]) === String(id));
    if (!item) return;
    let html = `<div class="detail-group-title"><i class="fas fa-list"></i> ${translations[currentLang].drilldownTitle} (${type})</div><div class="row g-0 mb-3">`;
    Object.keys(item).forEach(key => {
        // Bỏ qua các trường ID hoặc quá dài nếu muốn
        let label = (FIELD_LABELS[type] && FIELD_LABELS[type][key]) ? (translations[currentLang][FIELD_LABELS[type][key]] || key) : key;
        let val = resolveValue(key, item[key], type);
        html += `<div class="col-12 col-md-6 detail-col-wrapper"><div class="detail-item"><div class="field-label">${label}:</div><div class="field-value">${val || '-'}</div></div></div>`;
    });
    html += `</div>`;

    $('#detailContent').html(html);
    $('#farmerDetailTitle').text(translations[currentLang].detailPrefix + ": " + id);
    $('#modalActions').empty();
    const modal = new bootstrap.Modal(document.getElementById('farmerDetailModal'));
    modal.show();
}

function formatStatus(statusVal) {
    return `<span class="${String(statusVal).trim().toLowerCase() === 'done' ? 'status-active' : 'status-inactive'}">${resolveValue('Status', statusVal, 'Farmers')}</span>`;
}
function formatActivity(actVal) {
    return `<span class="${String(actVal).trim().toLowerCase() === 'done' ? 'activity-done' : 'activity-ny'}">${actVal || 'NY'}</span>`;
}
function formatDate(dateVal) {
    if (!dateVal) return ""; let d = new Date(dateVal); if (isNaN(d.getTime())) return dateVal;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; return `${d.getFullYear()}-${months[d.getMonth()]}-${String(d.getDate()).padStart(2, '0')}`;
}

function drawTables(farmers, plots, yearly) {
    let farmerNameMap = {};
    (rawData.farmers || []).forEach(f => farmerNameMap[f.Farmer_ID] = f.Full_Name);
    let farmersData = farmers.map((f, i) => [i + 1, resolveValue('Participation Year', f['Participation Year'], 'Farmers'), f['Farmer_ID'] || '', f['Full_Name'] || '', f['Year_Of_Birth'] || '', resolveValue('Gender', f['Gender'], 'Farmers'), f['Phone_Number'] || '', resolveValue('Farmer_Group_Name', f['Farmer_Group_Name'], 'Farmers'), resolveValue('Cooperative_Name', f['Cooperative_Name'], 'Farmers'), resolveValue('Village_Name', f['Village_Name'], 'Farmers'), resolveValue('Commune_Name', f['Commune_Name'], 'Farmers'), f['Address'] || '', f['ID card'] || '', resolveValue('Ethnicity', f['Ethnicity'], 'Farmers'), resolveValue('Socioeconomic Status', f['Socioeconomic Status'], 'Farmers'), resolveValue('Household Circumstances', f['Household Circumstances'], 'Farmers'), f['Num_Household_Members'] || '', f['Num_Working_Members'] || '', f['Total_Coffee_Area'] || '', f['Number of coffee farm plots'] || '', resolveValue('Supported by', f['Supported by'], 'Farmers'), resolveValue('Supported Types', f['Supported Types'], 'Farmers'), f['Number Farm registered for support from'] ||
        '', f['Total Area registered'] || '', resolveValue('Staff input', f['Staff input'], 'Farmers')]);
    updateDataTable('mainTable', dtFarmers, farmersData, (instance) => { dtFarmers = instance; });
    let plotsData = plots.map((p, i) => [i + 1, p['Plot_Id'] || '', p['Farmer_ID'] || '', farmerNameMap[p['Farmer_ID']] || '', p['Plot_Name'] || '', p['Area (ha)'] || 0, resolveValue('Land use rights certificate?', p['Land use rights certificate?'], 'Plots'), resolveValue('Border_Natural_Forest', p['Border_Natural_Forest'], 'Plots'), resolveValue('Receive seedlings from', p['Receive seedlings from'], 'Plots'), resolveValue('Place name', p['Place name'], 'Plots'), p['Location'] || '', p['Num_Shade_Trees_Before'] || 0, resolveValue('Name_Shade_Trees_Before', p['Name_Shade_Trees_Before'], 'Plots'), resolveValue('Farm registered for support from', p['Farm registered for support from'], 'Plots'), p['Num_Coffee_Trees'] || 0, resolveValue('Coffee_Planted_Year', p['Coffee_Planted_Year'], 'Plots'), p['Notes for details (Optional)'] || '', p['Number of shade trees'] || 0, p['Number of shade tree species'] || 0, p['Map Sheet'] || '', p['Sub-mapsheet']
        || '']);
    updateDataTable('plotsTable', dtPlots, plotsData, (instance) => { dtPlots = instance; });
    let yearlyData = yearly.map((y, i) => {
        let planted = parseFloat(y['Number_Shade_Trees_Planted']) || 0; let died = parseFloat(y['Shade_Trees_Died']) || 0; let survival = planted > 0 ? ((planted - died) / planted * 100).toFixed(1) + '%' : '0.0%'; return [i + 1, y['Farmer_ID'] || '', farmerNameMap[y['Farmer_ID']] || '', y['Record_Id'] || '', resolveValue('Year', y['Year'], 'Yearly_Data'), y['Annual_Volume_Cherry'] || 0, y['Volume_High_Quality'] || 0, y['Total_Coffee_Income'] || 0, resolveValue('Fertilizers_Applied', y['Fertilizers_Applied'], 'Yearly_Data'), resolveValue('Name of fertilizer', y['Name of fertilizer'], 'Yearly_Data'), y['Fertilizer volume'] || '', y['Fertilizer cost'] || '', resolveValue('Pesticides_Applied', y['Pesticides_Applied'], 'Yearly_Data'), resolveValue('Name of Pesticides', y['Name of Pesticides'], 'Yearly_Data'), y['Pesticides volume'] || '', y['Pesticides cost'] || '', resolveValue('Herbicides_Applied',
            y['Herbicides_Applied'], 'Yearly_Data'), resolveValue('Name of Herbicides', y['Name of Herbicides'], 'Yearly_Data'), y['Herbicides volume'] ||
        '', y['Herbicides cost'] || '', y['Hired_Labor_Costs'] ||
        '', y['Other_Costs'] || '', resolveValue('Shade_Trees_supported by', y['Shade_Trees_supported by'], 'Yearly_Data'), y['Number_Shade_Trees_Planted'] ||
        0, resolveValue('Shade_Trees_Species', y['Shade_Trees_Species'], 'Yearly_Data'), resolveValue('Year planted', y['Year planted'], 'Yearly_Data'), y['Shade_Trees_Died'] || 0, survival, y['Fertiliser supported by WWF'] ||
        '', y['Lime supported by Slow'] || '', y['Cover crop supported by Slow (yes/no)'] ||
        '', resolveValue('Soil_Test_Support', y['Soil_Test_Support'], 'Yearly_Data'), resolveValue('Attending training capacity organized by PFFP', y['Attending training capacity organized by PFFP'], 'Yearly_Data'), y['Op6_Activities'] ||
        '', y['Cherry sales registered to Slow'] || '', y['Cherry sales supplied to Slow'] ||
        '', y['Revenue from cherry sales to Slow (VND)'] || '', y['Cherry bought by Slow via processor'] ||
        ''];
    }); updateDataTable('yearlyTable', dtYearly, yearlyData, (instance) => { dtYearly = instance; });
}
function updateDataTable(t, i, d, c) { if (i) { i.clear().rows.add(d).draw(); } else { let n = $('#' + t).DataTable({ data: d, pageLength: 10, language: { search: "Tìm kiếm:", paginate: { next: ">>", previous: "<<" }, info: "_START_ - _END_ / _TOTAL_" }, deferRender: true, autoWidth: false }); c(n); } }


// --- USER FUNCTIONS (CẬP NHẬT: SẮP XẾP PENDING LÊN ĐẦU) ---
function renderUserTable() {
    const users = rawData.user || [];
    const auth = (currentUser && currentUser['Authority']) ? String(currentUser['Authority']).trim() : '';
    const isAdmin = (auth === ADMIN_ROLE);
    const isManager = MANAGER_ROLES.includes(auth);

    let displayUsers = users;

    // 1. Lọc theo tổ chức (nếu không phải Admin tổng)
    if (!isAdmin && isManager) {
        displayUsers = users.filter(u => String(u['Organization']).trim() === String(currentUser['Organization']).trim());
    }

    // 2. SẮP XẾP: Đưa 'Pending' lên đầu danh sách
    displayUsers.sort((a, b) => {
        const statusA = String(a['Status'] || '').trim().toLowerCase();
        const statusB = String(b['Status'] || '').trim().toLowerCase();

        // Nếu A là pending mà B không phải -> A lên trước (-1)
        if (statusA === 'pending' && statusB !== 'pending') return -1;
        // Nếu B là pending mà A không phải -> B lên trước (1)
        if (statusA !== 'pending' && statusB === 'pending') return 1;
        // Nếu cùng trạng thái thì giữ nguyên (hoặc sort theo tên nếu muốn)
        return 0;
    });

    // 3. Vẽ bảng (Giữ nguyên logic cũ)
    const userData = displayUsers.map((u, i) => {
        let actions = '';
        const isSelf = (String(u['Staff ID']).trim() === String(currentUser['Staff ID']).trim());
        const canEdit = isManager || isSelf;
        const canDelete = (auth === ADMIN_ROLE);

        if (canEdit) { actions += `<button class="btn btn-sm btn-edit-custom me-1" onclick="editUser('${u['Staff ID']}')"><i class="fas fa-edit"></i></button>`; }
        if (canDelete) { actions += `<button class="btn btn-sm btn-danger" onclick="deleteUser('${u['Staff ID']}')"><i class="fas fa-trash"></i></button>`; }

        let authId = String(u['Authority'] || '').trim();
        let authLabel = authId;
        if (dropMap[authId]) { authLabel = (currentLang === 'vi') ? dropMap[authId].vi : dropMap[authId].en; }

        let roleId = String(u['Role'] || u['Area Manager'] || '').trim();
        let roleLabel = roleId;
        if (roleId) {
            roleLabel = roleId.split(',').map(id => {
                let tid = id.trim();
                if (adminMap[tid]) { return (currentLang === 'vi' ? adminMap[tid].vi : adminMap[tid].en); }
                return tid;
            }).join(', ');
        }

        let statusVal = String(u['Status'] || '').trim();
        let statusLabel = '';
        // Tô màu đỏ cho Pending để dễ thấy
        if (statusVal === 'Act') statusLabel = '<span class="badge bg-success">Active</span>';
        else if (statusVal === 'InA') statusLabel = '<span class="badge bg-secondary">Inactive</span>';
        else if (statusVal === 'Pending') statusLabel = '<span class="badge bg-danger animate__animated animate__pulse animate__infinite">Pending</span>';
        else statusLabel = statusVal;

        let orgId = String(u['Organization'] || '').trim();
        let orgLabel = orgId;
        if (dropMap[orgId]) { orgLabel = (currentLang === 'vi') ? dropMap[orgId].vi : dropMap[orgId].en; }

        let posId = String(u['Position'] || '').trim();
        let posLabel = posId;
        if (dropMap[posId]) { posLabel = (currentLang === 'vi') ? dropMap[posId].vi : dropMap[posId].en; }

        let clickableName = `<span class="text-primary fw-bold" onclick="showUserDetails('${u['Staff ID']}')" style="cursor: pointer;">${u['Full name'] || ''}</span>`;

        return [i + 1, u['Staff ID'] || '', clickableName, orgLabel, posLabel, roleLabel, u['Email'] || '', u['Phone'] || '', authLabel, statusLabel, actions];
    });

    updateDataTable('userTable', dtUsers, userData, (instance) => { dtUsers = instance; });
}


function showUserDetails(userId) {
    let user = rawData.user.find(u => String(u['Staff ID']) === String(userId)); if (!user) return;
    let safeId = escapeHtml(userId); let editBtn = '', deleteBtn = ''; const auth = (currentUser && currentUser['Authority']) ?
        String(currentUser['Authority']).trim() : ''; const isAdmin = (auth === ADMIN_ROLE); const isManager = MANAGER_ROLES.includes(auth); const isSelf = (String(currentUser['Staff ID']) === String(userId));
    if (isManager || isSelf) {
        editBtn = `<button type="button" class="btn btn-edit-custom btn-sm ms-2" onclick="editUser('${safeId}')"><i class="fas fa-edit"></i> ${translations[currentLang].editPrefix}</button>`;
    } if (isAdmin) { deleteBtn = `<button type="button" class="btn btn-danger btn-sm ms-2" onclick="deleteUser('${safeId}')"><i class="fas fa-trash-alt"></i> Xóa</button>`; } $('#modalActions').html(`${editBtn}${deleteBtn}`); $('#printFooterContent').html('');
    let html = `<div class="print-main-title"><i class="fas fa-user-tie"></i> ${user['Full name']} (${userId})</div>`; html += `<div class="detail-group-title"><i class="fas fa-info-circle"></i> ${translations[currentLang].drilldownTitle}</div><div class="row g-0 mb-3">`;
    const renderField = (label, value) => { return `<div class="col-12 col-md-6 detail-col-wrapper"><div class="detail-item"><div class="field-label">${label}:</div><div class="field-value">${value || '-'}</div></div></div>`; };
    let orgId = user['Organization']; let orgLabel = dropMap[orgId] ? (currentLang === 'vi' ? dropMap[orgId].vi : dropMap[orgId].en) : orgId;
    let posId = user['Position']; let posLabel = dropMap[posId] ? (currentLang === 'vi' ? dropMap[posId].vi : dropMap[posId].en) : posId;
    let authId = user['Authority']; let authLabel = dropMap[authId] ? (currentLang === 'vi' ? dropMap[authId].vi : dropMap[authId].en) : authId;
    html += renderField(translations[currentLang].lblStaffId, user['Staff ID']); html += renderField(translations[currentLang].lblFullName, user['Full name']); html += renderField(translations[currentLang].lblOrg, orgLabel); html += renderField(translations[currentLang].lblPosition, posLabel);
    html += renderField(translations[currentLang].lblEmail, user['Email']); html += renderField(translations[currentLang].lblPhone, user['Phone']); html += renderField(translations[currentLang].lblGender, user['Gender']); html += renderField(translations[currentLang].lblAuthority, authLabel); html += renderField(translations[currentLang].lblStatus, user['Status']);
    html += `</div>`; let roleId = user['Role'] || user['Area Manager'];
    if (roleId) {
        let roleLabel = String(roleId).split(',').map(id => { let tid = id.trim(); return adminMap[tid] ? (currentLang === 'vi' ? adminMap[tid].vi : adminMap[tid].en) : tid; }).join(', ');
        html += `<div class="detail-group-title"><i class="fas fa-map"></i> ${translations[currentLang].lblArea}</div><div class="p-2 border rounded bg-light">${roleLabel}</div>`;
    } $('#detailContent').html(html); $('#farmerDetailTitle').text(translations[currentLang].detailPrefix + ": " + user['Full name']);
    const modalEl = document.getElementById('farmerDetailModal'); const modal = bootstrap.Modal.getOrCreateInstance(modalEl); modal.show();
}
function populateRoleDropdown(selectedVal = '') {
    const roleSelect = $('#userRoleSelect');
    roleSelect.empty(); let groups = (rawData.admin || []).filter(a => String(a['Condition']).trim() === 'Farmer group');
    groups.sort((a, b) => { let labelA = (currentLang === 'vi' ? (a['Label VN'] || a.Label_VN) : (a['Label EN'] || a.Label_EN)) || ''; let labelB = (currentLang === 'vi' ? (b['Label VN'] || b.Label_VN) : (b['Label EN'] || b.Label_EN)) || ''; return labelA.localeCompare(labelB); });
    let selectedArray = []; if (selectedVal) {
        selectedArray = String(selectedVal).split(',').map(s => s.trim());
    } groups.forEach(g => { let id = g['Adm_ID'] || g.Admin_ID || g.ID; let label = (currentLang === 'vi' ? (g['Label VN'] || g.Label_VN) : (g['Label EN'] || g.Label_EN)) || id; let isSel = selectedArray.includes(String(id)) ? 'selected' : ''; roleSelect.append(`<option value="${id}" ${isSel}>${label}</option>`); });
}
function populatePositionDropdown(selectedVal = '') {
    const select = $('#userPositionSelect'); select.empty(); select.append('<option value="">-- Chọn chức vụ --</option>');
    let list = (rawData.drop || []).filter(d => String(d['Condition']).trim() === 'Position');
    list.sort((a, b) => { let labelA = (currentLang === 'vi' ? (a['Label VN'] || a.Label_VN) : (a['Label'] || a.Label_EN)) || ''; let labelB = (currentLang === 'vi' ? (b['Label VN'] || b.Label_VN) : (b['Label'] || b.Label_EN)) || ''; return labelA.localeCompare(labelB); });
    list.forEach(d => { let id = d.ID || d.Code; let lbl = (currentLang === 'vi') ? (d['Label VN'] || d.Label_VN) : (d['Label'] || d.Label_EN); let isSel = (String(id) === String(selectedVal)) ? 'selected' : ''; select.append(`<option value="${id}" ${isSel}>${lbl}</option>`); });
}
function populateAuthorityDropdown(selectedVal = '', currentUserAuth = '') {
    const authSelect = $('#userAuthoritySelect'); authSelect.empty();
    authSelect.append(`<option value="" disabled selected>-- Chọn quyền hạn --</option>`); let authList = [];
    if (rawData.drop) {
        authList = rawData.drop.filter(d => { let cond = (d.Condition || '').trim(); return cond.toLowerCase() === 'authority'; });
    } if (currentUserAuth !== ADMIN_ROLE) {
        authList = authList.filter(a => String(a.ID || a.Code) !== ADMIN_ROLE);
    } authList.forEach(a => { let id = a.ID || a.Code || a.Value; let labelVi = a.Label_VN || a['Label VN'] || a.Name_VN || a.Label; let labelEn = a.Label || a.Label_EN || a['Label EN'] || a.Name_EN; let label = (currentLang === 'vi') ? labelVi : labelEn; let isSel = String(id) === String(selectedVal) ? 'selected' : ''; authSelect.append(`<option value="${id}" ${isSel}>${label}</option>`); });
}
function generateNextStaffId(orgCode) {
    if (!rawData.user) return orgCode + "-01"; const regex = new RegExp(`^${orgCode}-(\\d+)$`, 'i');
    let maxNum = 0; rawData.user.forEach(u => { let sid = String(u['Staff ID'] || '').trim(); let match = sid.match(regex); if (match) { let num = parseInt(match[1], 10); if (!isNaN(num) && num > maxNum) { maxNum = num; } } });
    let nextNum = maxNum + 1; let padded = String(nextNum).padStart(2, '0'); return orgCode + "-" + padded;
}
function updateUserModalStructure() {
    const viewInput = $('#userForm input[name="View"]');
    if ($('#viewCheckboxContainer').length === 0 && viewInput.length > 0) {
        const viewContainerHTML = ` <label class="form-label-custom mb-1" data-i18n="lblView">Danh sách View</label> <div id="viewCheckboxContainer" class="border p-2 rounded bg-light" style="max-height: 100px; overflow-y: auto;"> <div class="form-check form-check-inline"> <input class="form-check-input chk-view" type="checkbox" value="Farmers" id="viewFarmers"> <label class="form-check-label" for="viewFarmers">Hộ dân (Farmers)</label> </div> <div class="form-check form-check-inline"> <input class="form-check-input chk-view" type="checkbox" value="Plots" id="viewPlots"> <label class="form-check-label" for="viewPlots">Lô đất (Plots)</label> </div> <div class="form-check form-check-inline"> <input class="form-check-input chk-view" type="checkbox" value="Yearly_Data" id="viewYearly"> <label class="form-check-label" for="viewYearly">Dữ liệu năm (Yearly)</label> </div> </div> <input type="hidden" name="View" id="userViewHidden"> `;
        viewInput.parent().html(viewContainerHTML);
    } if ($('#permCheckboxContainer').length === 0) {
        const permHTML = ` <div class="col-12 mt-3"> <label class="form-label-custom mb-1" data-i18n="lblPermissions">Quyền thao tác (Operations - Rule)</label> <div id="permCheckboxContainer" class="d-flex gap-3 border p-2 rounded bg-light flex-wrap"> <div class="form-check"> <input class="form-check-input chk-perm" type="checkbox" value="View" id="permView"> <label class="form-check-label" for="permView">Xem (View)</label> </div> <div class="form-check"> <input class="form-check-input chk-perm" type="checkbox" value="Add" id="permAdd"> <label class="form-check-label" for="permAdd">Thêm (Add)</label> </div> <div class="form-check"> <input class="form-check-input chk-perm" type="checkbox" value="Edit" id="permEdit"> <label class="form-check-label" for="permEdit">Sửa (Edit)</label> </div> <div class="form-check"> <input class="form-check-input chk-perm" type="checkbox" value="Delete" id="permDelete"> <label class="form-check-label" for="permDelete">Xóa (Delete)</label> </div> <div class="form-check"> <input class="form-check-input chk-perm" type="checkbox" value="Print" id="permPrint"> <label class="form-check-label" for="permPrint">In (Print)</label> </div> <div class="form-check"> <input 
    class="form-check-input chk-perm" type="checkbox" value="Export" id="permExport"> <label class="form-check-label" for="permExport">Xuất Excel (Export)</label> </div> </div> <input type="hidden" name="Rule" id="userRuleHidden"> </div> `;
        $('#userForm .row').append(permHTML);
    }
}
function showAddUserModal() {
    const currentAuth = (currentUser && currentUser['Authority']) ? String(currentUser['Authority']).trim() : '';
    if (!MANAGER_ROLES.includes(currentAuth)) { alert("Bạn không có quyền thêm nhân viên."); return; } updateUserModalStructure(); $('#userModalTitle').text(translations[currentLang].btnAddUser); $('#userForm')[0].reset();
    const userOrg = (currentUser['Organization'] || '').trim(); const orgSelect = $('select[name="Organization"]'); $('#userForm input, #userForm select').prop('disabled', false); orgSelect.val(userOrg); orgSelect.prop('disabled', true);
    const nextId = generateNextStaffId(userOrg); $('#userForm input[name="Staff ID"]').val(nextId).prop('readonly', true); populateRoleDropdown(); populatePositionDropdown(); populateAuthorityDropdown('', currentAuth); $('#userStatusSelect').val('Act'); $('.chk-perm').prop('checked', false); $('.chk-view').prop('checked', false);
    const modal = new bootstrap.Modal(document.getElementById('userEditModal')); modal.show();
}
function editUser(id) {
    updateUserModalStructure();
    const user = rawData.user.find(u => String(u['Staff ID']) === String(id)); if (!user) return; $('#userModalTitle').text(translations[currentLang].editPrefix + ': ' + user['Full name']); $('#userForm')[0].reset();
    const currentAuth = (currentUser && currentUser['Authority']) ? String(currentUser['Authority']).trim() : ''; const isManager = MANAGER_ROLES.includes(currentAuth); const form = document.getElementById('userForm');
    Object.keys(user).forEach(key => { const input = form.querySelector(`[name="${key}"]`); if (input && input.type !== 'checkbox' && input.type !== 'hidden') { input.value = user[key]; } });
    populateRoleDropdown(user['Role']); populatePositionDropdown(user['Position']); populateAuthorityDropdown(user['Authority'], currentAuth); if (user['Status']) $('#userStatusSelect').val(String(user['Status']).trim()); let views = (user['View'] || '').split(',').map(s => s.trim()); $('.chk-view').each(function () { $(this).prop('checked', views.includes($(this).val())); });
    let rule = (user['Rule'] || '').split(',').map(s => s.trim()); $('.chk-perm').each(function () { let val = $(this).val(); let isChecked = rule.includes(val); if (val === 'Edit' && (rule.includes('Update'))) isChecked = true; if (val === 'Delete' && (rule.includes('Del'))) isChecked = true; $(this).prop('checked', isChecked); });
    $('#userForm input[name="Staff ID"]').prop('readonly', true); if (!isManager) {
        $('#userAuthoritySelect').prop('disabled', true); $('#userRoleSelect').prop('disabled', true); $('#userPositionSelect').prop('disabled', true); $('#userStatusSelect').prop('disabled', true); $('select[name="Organization"]').prop('disabled', true); $('.chk-view').prop('disabled', true);
        $('.chk-perm').prop('disabled', true);
    } else {
        $('#userAuthoritySelect').prop('disabled', false); $('#userRoleSelect').prop('disabled', false); $('#userPositionSelect').prop('disabled', false); $('#userStatusSelect').prop('disabled', false); $('select[name="Organization"]').prop('disabled', false); $('.chk-view').prop('disabled', false); $('.chk-perm').prop('disabled', false);
    } const modal = new bootstrap.Modal(document.getElementById('userEditModal')); modal.show();
}


async function saveUser() {
    const form = document.getElementById('userForm');
    const formData = {};
    const inputs = form.querySelectorAll('input:not([type=checkbox]):not([type=hidden]), select');

    inputs.forEach(input => {
        if (input.name) {
            if (input.tagName === 'SELECT' && input.multiple) {
                const val = $(input).val();
                formData[input.name] = val ? val.join(',') : '';
            } else {
                formData[input.name] = input.value;
            }
        }
    });

    let viewList = [];
    $('.chk-view:checked').each(function () { viewList.push($(this).val()); });
    formData['View'] = viewList.join(',');

    let permList = [];
    $('.chk-perm:checked').each(function () { permList.push($(this).val()); });
    formData['Rule'] = permList.join(',');

    if (!formData['Password']) { delete formData['Password']; }

    $('#loading').show();

    // GỌI API LƯU USER
    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'saveData',
            sheetName: 'User',
            formData: formData
        })
    })
        .then(res => res.json())
        .then(res => {
            $('#loading').fadeOut();

            // --- ĐÂY LÀ ĐOẠN XỬ LÝ KẾT QUẢ ---
            if (res.status === 'success') {
                // 1. Ẩn Modal
                bootstrap.Modal.getInstance(document.getElementById('userEditModal')).hide();

                // 2. Tải lại dữ liệu (Dòng này sẽ kích hoạt việc cập nhật số Pending)
                refreshData();

                // 3. Thông báo thành công
                alert("Lưu nhân viên thành công!");
            } else {
                showError(res.message);
            }
            // ---------------------------------
        })
        .catch(err => showError(err));
}



async function deleteUser(id) {
    const c = await showCustomConfirm(`${translations[currentLang].confirmDelete} ${id}?`, 'delete');
    if (!c) return;

    $('#loading').show();

    // GỌI API XÓA USER
    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'deleteData',
            sheetName: 'User',
            id: id
        })
    })
        .then(res => res.json())
        .then(res => {
            $('#loading').fadeOut();
            if (res.status === 'success') {
                refreshData();
                alert("Đã xóa nhân viên!");
            } else {
                showError(res.message);
            }
        })
        .catch(err => showError(err));
}
function showCustomConfirm(m, t) { return new Promise((r) => { const e = document.getElementById('confirmModal'); const b = bootstrap.Modal.getOrCreateInstance(e); const h = e.querySelector('.modal-header'); const i = document.getElementById('confirmIcon'); const o = document.getElementById('btnConfirmOk'); const c = document.getElementById('btnConfirmCancel'); document.getElementById('confirmMessage').innerText = m; c.innerText = translations[currentLang].btnCancel; o.innerText = translations[currentLang].btnOk; if (t === 'delete') { h.className = 'modal-header delete'; i.innerHTML = '<i class="fas fa-exclamation-triangle text-danger"></i>'; o.className = 'btn btn-danger px-4'; } else { h.className = 'modal-header save'; i.innerHTML = '<i class="fas fa-question-circle text-primary"></i>'; o.className = 'btn btn-primary px-4'; } const cl = () => { o.removeEventListener('click', ok); e.removeEventListener('hidden.bs.modal', ca); }; const ok = () => { r(true); b.hide(); cl(); }; const ca = () => { r(false); cl(); }; o.addEventListener('click', ok); e.addEventListener('hidden.bs.modal', ca); b.show(); }); }
function stripHtml(h) { var t = document.createElement("DIV"); t.innerHTML = h; return t.textContent || t.innerText || ""; }
function exportTable() {
    try {
        if (!userPermissions.canExport) {
            alert("Bạn không có quyền xuất dữ liệu.");
            return;
        } if (!filteredData.farmers || filteredData.farmers.length === 0) { alert(translations[currentLang].noDataToExport); return; } var wb = XLSX.utils.book_new(); const cs = (sn, tid, hk) => { const dt = $('#' + tid).DataTable(); if (!dt) return; const dd = dt.rows({ search: 'applied' }).data().toArray(); if (dd.length === 0) return; const h = hk.map(k => translations[currentLang][k] || k); const ed = dd.map(ra => { let ro = {}; h.forEach((hd, idx) => { let cd = ra[idx]; if (typeof cd === 'string' && cd.includes('<')) { cd = stripHtml(cd); } ro[hd] = cd; }); return ro; }); var ws = XLSX.utils.json_to_sheet(ed); XLSX.utils.book_append_sheet(wb, ws, sn); };
        const fH = ['thNo', 'thYear', 'thFarmerID', 'thName', 'thYOB', 'thGender', 'thPhone', 'thGroup', 'thCoop', 'thVillage', 'thCommune', 'thAddress', 'thIDCard', 'thEthnicity', 'thEcoStatus', 'thHHCircum', 'thMemCount', 'thWorkerCount', 'thTotalArea', 'thPlotCount', 'thSupportedBy', 'thSupportType', 'thRegFarms', 'thRegArea', 'thStaff', 'thStatus', 'thActivity', 'thDate', 'thUpdate']; const pH = ['thNo', 'thPlotId', 'thFarmerID', 'thName', 'thPlotName', 'thPlotArea', 'thLURC', 'thBorderForest', 'thSeedlingSource', 'thPlaceName', 'thLocation', 'thShadeTreesBefore', 'thNameTreesBefore', 'thFarmRegSupport', 'thCoffeeTrees', 'thPlantYear', 'thNotes', 'thShadeTreeCount', 'thSpeciesCount', 'thMapSheet', 'thSubMap', 'thStatus', 'thActivity', 'thUpdate']; const yH = ['thNo', 'thFarmerID', 'thName', 'thRecordID', 'thYearVal', 'thCherryVol', 'thVolHQ', 'thIncome', 'thFertApplied', 'thFertName', 'thFertVol', 'thFertCost', 'thPestApplied', 'thPestName', 'thPestVol', 'thPestCost', 'thHerbApplied', 'thHerbName', 'thHerbVol', 'thHerbCost', 'thLaborCost', 'thOtherCost', 'thTreeSupportBy', 'thTreesPlanted', 'thSpecies', 'thYearPlanted', 'thTreesDead', 'thSurvivalRate', 'thFertWWF', 'thLimeSlow', 'thCoverCrop', 'thSoilTest', 'thTraining', 'thOp6', 'thRegSales', 'thRealSales', 'thRevSales', 'thBoughtVia', 'thStatus', 'thActivity', 'thUpdate']; cs("Farmers", 'mainTable', fH); cs("Plots", 'plotsTable', pH); cs("Yearly_Data", 'yearlyTable', yH); const n = new Date(); const p = (num) => num.toString().padStart(2, '0'); const dateStr = `${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}_${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`; let fY = getSelectedValues('year');
        let fV = getSelectedValues('village'); let yearPart = (fY === 'All' || fY.length > 1) ? n.getFullYear() : fY[0];
        let villagePart = (fV === 'All' || fV.length > 1) ? "" : `_${fV[0].replace(/[^a-zA-Z0-9]/g, '')}`; let fn = "";
        if (villagePart !== "") { fn = `PFFP${villagePart}_${yearPart}_${dateStr}.xlsx`; } else { fn = `PFFP_Raw_data_${yearPart}_${dateStr}.xlsx`; } XLSX.writeFile(wb, fn);
    } catch (e) {
        console.error(e);
        alert("Lỗi xuất Excel.");
    }
}
// ==========================================================
// ==========================================================
// CHỨC NĂNG QUÊN MẬT KHẨU (FIX LỖI DEFINED)
// ==========================================================

// Gắn trực tiếp vào window để tránh lỗi scope
window.showForgotPasswordModal = function () {
    const selectedId = $('#loginUserSelect').val();

    if (!selectedId) {
        alert("Vui lòng chọn Tên nhân viên từ danh sách trước khi bấm Quên mật khẩu.");
        return;
    }

    const selectedOptionText = $('#loginUserSelect option:selected').text();

    $('#fpStaffId').val(selectedId);
    $('#fpStaffName').val(selectedOptionText);
    $('#fpEmailInput').val('');
    $('#fpMessage').text('');

    const modal = new bootstrap.Modal(document.getElementById('forgotPasswordModal'));
    modal.show();
};

window.submitForgotPassword = function () {
    const staffId = $('#fpStaffId').val();
    const email = $('#fpEmailInput').val();
    const msgDiv = $('#fpMessage');

    if (!email) {
        msgDiv.text("Vui lòng nhập Email.");
        return;
    }

    const btn = document.querySelector('#forgotPasswordModal .btn-success');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
    btn.disabled = true;
    msgDiv.text('');

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "resetUserPassword",
            staffId: staffId,
            email: email
        })
    })
        .then(response => response.json())
        .then(res => {
            btn.innerHTML = originalText;
            btn.disabled = false;

            if (res.status === 'success') {
                bootstrap.Modal.getInstance(document.getElementById('forgotPasswordModal')).hide();
                alert("THÀNH CÔNG!\n\n" + res.message);
                // Tải lại dữ liệu mới nhất từ server để cập nhật mật khẩu mới
                refreshData();
            } else {
                msgDiv.text(res.message);
            }
        })
        .catch(err => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            msgDiv.text("Lỗi kết nối: " + err);
        });
};

// ==========================================================
// LOGIC ĐĂNG KÝ TÀI KHOẢN (New)
// ==========================================================

window.showRegisterModal = function () {
    // Reset form
    $('#registerForm')[0].reset();
    $('#regMessage').text('');

    // Mở modal
    const modal = new bootstrap.Modal(document.getElementById('registerModal'));
    modal.show();
};

window.submitRegistration = function () {
    const org = $('#regOrg').val();
    const name = $('#regName').val().trim();
    const email = $('#regEmail').val().trim();
    const phone = $('#regPhone').val().trim();
    const pass = $('#regPass').val();
    const passConfirm = $('#regPassConfirm').val();
    const msgDiv = $('#regMessage');

    // Validate cơ bản
    if (!name || !email || !pass) {
        msgDiv.text("Vui lòng điền đầy đủ thông tin.");
        return;
    }
    if (pass !== passConfirm) {
        msgDiv.text("Mật khẩu nhập lại không khớp.");
        return;
    }

    // Hiệu ứng loading
    const btn = document.querySelector('#registerModal .btn-primary');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
    btn.disabled = true;
    msgDiv.text('');

    // Dữ liệu gửi đi
    const formData = {
        Organization: org,
        FullName: name,
        Email: email,
        Phone: phone,
        Password: pass
    };

    // Gọi API (Dùng lại biến API_URL đã khai báo ở đầu file)
    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "registerUser",
            formData: formData
        })
    })
        .then(response => response.json())
        .then(res => {
            btn.innerHTML = originalText;
            btn.disabled = false;

            if (res.status === 'success') {
                // Thành công
                bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
                alert("ĐĂNG KÝ THÀNH CÔNG!\n\nThông tin của bạn đã được gửi.\nVui lòng đợi Admin phê duyệt trước khi đăng nhập.");
            } else {
                // Lỗi từ server (ví dụ trùng email)
                msgDiv.text(res.message);
            }
        })
        .catch(err => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            msgDiv.text("Lỗi kết nối: " + err);
        });
};

// --- HÀM ĐẾM SỐ LƯỢNG PENDING (PHIÊN BẢN FIX LỖI) ---
function updatePendingCount() {
    console.log("--- Bắt đầu đếm số lượng Pending ---");

    if (!rawData.user || rawData.user.length === 0) {
        console.warn("Chưa có dữ liệu User để đếm.");
        return;
    }

    // 1. Tìm chính xác tên cột chứa trạng thái (Status, Trạng thái, Tình trạng...)
    // Lấy dòng đầu tiên để dò key
    const sampleUser = rawData.user[0];
    let statusKey = Object.keys(sampleUser).find(k =>
        k.toLowerCase().includes("status") ||
        k.toLowerCase().includes("trạng thái")
    );

    if (!statusKey) {
        console.error("LỖI: Không tìm thấy cột Status trong dữ liệu User. Hãy kiểm tra lại Google Sheet.");
        statusKey = 'Status'; // Fallback về mặc định
    }

    console.log("Đang đếm dựa trên cột: " + statusKey);

    // 2. Đếm số lượng
    var count = rawData.user.filter(function (u) {
        let val = String(u[statusKey] || '').trim().toLowerCase();
        return val === 'pending';
    }).length;

    console.log("Tổng số Pending tìm thấy: " + count);

    // 3. Hiển thị lên giao diện
    var badge = $('#pendingCountBadge');

    if (badge.length > 0) {
        if (count > 0) {
            badge.text(count);
            // Dùng css để ép hiển thị, tránh bị bootstrap ghi đè
            badge.css('display', 'inline-block');
            badge.show();
            // Thêm hiệu ứng rung lắc để gây chú ý
            badge.addClass('animate__animated animate__pulse animate__infinite');
        } else {
            badge.hide();
        }
    } else {
        console.error("LỖI: Không tìm thấy thẻ HTML có id='pendingCountBadge'. Kiểm tra lại file index.html");
    }
}
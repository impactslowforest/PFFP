// --- CẤU HÌNH KẾT NỐI POCKETBASE ---
// supabaseClient is provided by pb.js (Supabase-compatible wrapper over PocketBase)
const TABLE_MAP = {
    'Farmers':              { table: 'farmers',              idCol: 'Farmer_ID' },
    'Plots':                { table: 'plots',                idCol: 'Plot_Id' },
    'Yearly_Data':          { table: 'yearly_data',          idCol: 'Record_Id' },
    'Supported':            { table: 'supported',             idCol: 'Support_ID' },
    'User':                 { table: 'users',                idCol: 'Staff ID' },
    'Op6':                  { table: 'op6_activities_list',  idCol: 'OP6 ID' },
    'Species':              { table: 'species',              idCol: 'Species_ID' },
    'Admin':                { table: 'admin',                idCol: 'Adm_ID' },
    'Training':             { table: 'training_list',        idCol: 'Train_ID' }
};
const CACHE_KEY = "PFFP_DATA_CACHE_v2";
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
var _pendingLibraryReopen = null;
var dtFarmers = null;
var dtPlots = null; var dtYearly = null; var dtUsers = null;
var currentFarmerId = null;
var activePrintName = "";
// Maps
var adminMap = {}; var dropMap = {}; var dropCondMap = {}; var speciesMap = {};
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

// Toast notification (replaces alert for success messages)
function showToast(msg, duration) {
    duration = duration || 2000;
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var el = document.createElement('div');
    el.className = 'toast-msg';
    el.textContent = msg;
    container.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
        el.classList.remove('show');
        setTimeout(function () { el.remove(); }, 300);
    }, duration);
}

// Organization helpers (multi-org support)
function userBelongsToOrg(user, orgCode) {
    if (!user || !orgCode) return false;
    return String(user['Organization'] || '').split(',').map(function (s) { return s.trim(); }).indexOf(orgCode) !== -1;
}
function getUserOrgs(user) {
    if (!user) return [];
    return String(user['Organization'] || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

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

// ERROR HANDLING - chỉ log console, không hiện lên màn hình
window.onerror = function (message, source, lineno, colno, error) {
    console.error("Script Error:", message, "(Line:", lineno + ")");
    return true;
};
window.addEventListener('unhandledrejection', function (event) {
    console.warn("Unhandled promise rejection:", event.reason);
    event.preventDefault();
});

// CONFIG TRANSLATIONS
const translations = {
    vi: {
        appTitle: "Sản xuất cà phê sinh thái và cải thiện rừng tự nhiên", loading: "Đang tải dữ liệu...",
        lblSelectOrg: "Vui lòng chọn tổ chức:", optSelectOrgFirst: "-- Chọn tổ chức trước --",
        lblUsername: "Chọn nhân viên:", lblPassword: "Mật khẩu:", btnLogin: "ĐĂNG NHẬP",

        loginErrorTitle: "Lỗi đăng nhập", loginErrorMsg: "Thông tin đăng nhập không đúng hoặc tài khoản chưa kích hoạt (Status != Act).",
        kpi1: "Tổng số hộ", kpiFemale: "Nữ / Tổng", kpi2: "Tổng số lô", kpi3: "Tổng diện tích (ha)", kpi4: "Cây bóng có sẵn", kpi5: "Cây bóng đã trồng", kpi6: "Tổng số loài", kpi7: "Tổng nhóm hộ", kpi8: "Tỷ lệ hoàn thành", kpi9: "Tỷ lệ sống",
        kpi10: "Sản lượng đại trà (T)", kpi11: "Sản lượng chất lượng cao (T)",
        searchPlaceholder: "Tìm kiếm nông hộ, lô, mã ID...",

        // CẬP NHẬT FILTER VÀ CHART TITLE MỚI
        filterTitle: "Bộ lọc dữ liệu", filterYear: "Năm", filterYearSupport: "Năm hỗ trợ", filterVillage: "Nhóm hộ", filterStatus: "Trạng thái", filterSupported: "Hỗ trợ bởi", filterSupportedTypes: "Loại hỗ trợ", filterSpecies: "Loài cây", filterManageBy: "Quản lý bởi",
        btnReset: "Thiết lập lại", btnRefresh: "Tải lại dữ liệu", btnExport: "Xuất Báo Cáo", btnPrint: "In Trang", btnExit: "Thoát", btnAddFarmer: "Thêm hộ dân", btnAddYearly: "Thêm năm mới", btnAddPlot: "Thêm lô đất",
        homeGroupActivity: "Quản lý dữ liệu", homeGroupLibrary: "Thư viện", homeGroupSystem: "Hệ thống",
        homeCardSurvival: "Tỷ lệ sống",
        homeCardFarmers: "Hộ dân", homeCardPlots: "Lô đất", homeCardYearly: "Đánh giá hàng năm", homeCardReport: "Báo cáo",
        homeCardSupported: "Hỗ trợ",
        homeCardOP6: "OP6 Activities", homeCardSpecies: "Loài cây", homeCardAdmin: "Danh mục", homeCardTraining: "Tập huấn",
        homeCardUsers: "Nhân sự & Phân quyền", homeCardProjectDoc: "Tài liệu dự án",
        homeDescFarmers: "Quản lý thông tin hộ dân", homeDescPlots: "Dữ liệu lô đất canh tác", homeDescYearly: "Dữ liệu theo dõi hàng năm",
        homeDescReport: "Biểu đồ & thống kê", homeDescOP6: "Hoạt động OP6", homeDescSpecies: "Tra cứu loài cây trồng",
        homeDescAdmin: "Danh mục dùng chung", homeDescTraining: "Danh sách tập huấn", homeDescProjectDoc: "Tài liệu & báo cáo dự án",
        homeDescUsers: "Quản lý tài khoản & quyền",

        chart1Title: "Tổng diện tích theo nhóm hộ", chart2Title: "Tỷ lệ thành phần dân tộc", chart3Title: "Tiến độ theo nhóm hộ", chart4Title: "Tỷ lệ Hoàn thành", chartManageByTitle: "Đơn vị quản lý",

        langBtn: '<img src="https://flagcdn.com/w40/gb.png" class="flag-icon" alt="English">',
        noDataToExport: "Không có dữ liệu để xuất!", drilldownTitle: "Chi tiết cho", allOption: "Tất cả", selected: "đã chọn",

        tabFarmers: "Hộ dân", tabPlots: "Lô đất", tabYearly: "Dữ liệu hàng năm", detailPrefix: "Chi tiết", editPrefix: "Sửa thông tin",
        confirmDelete: "Bạn có chắc chắn muốn xóa?", deleteSuccess: "Đã xóa thành công!", confirmSave: "Bạn có chắc chắn muốn lưu thay đổi?", updateSuccess: "Cập nhật thành công!", btnCancel: "Hủy", btnOk: "Đồng ý", btnSave: "Lưu thay đổi", btnSaveUser: "Lưu nhân viên", btnClose: "Đóng",
        thNo: "Thứ tự", thYear: "Năm tham gia", thFarmerID: "Mã Nông Hộ", thName: "Họ tên", thYOB: "Năm sinh", thGender: "Giới tính",
        thPhone: "Số điện thoại", thGroup: "Nhóm hộ", thCoop: "Tổ hợp tác", thVillage: "Thôn", thCommune: "Xã", thAddress: "Địa chỉ", thIDCard: "Số CCCD", thEthnicity: "Dân tộc", thEcoStatus: "Tình trạng kinh tế", thHHCircum: "Hoàn cảnh gia đình", thMemCount: "Số thành viên gia đình", thWorkerCount: "Tổng lao động", thTotalArea: "Tổng diện tích cà phê", thPlotCount: "Số lượng lô", thSupportedBy: "Được hỗ trợ bởi", thSupportType: "Loại hỗ trợ", thRegFarms: "Số vườn đăng ký", thRegArea: "Tổng diện tích đăng ký", thStaff: "Cán bộ nhập", thStatus: "Trạng thái", thActivity: "Hoạt động", thDate: "Ngày", thUpdate: "Cập nhật",
        thPlotId: "Mã Lô", thPlotName: "Tên Lô", thPlotArea: "Diện tích (ha)", thLURC: "Giấy chứng nhận QSDĐ?", thBorderForest: "Giáp rừng tự nhiên", thSeedlingSource: "Nguồn giống", thPlaceName: "Địa danh (Thôn)", thLocation: "Tọa độ (Lat, Long)", thShadeTreesBefore: "Số cây che bóng trước", thNameTreesBefore: "Tên cây che bóng trước", thFarmRegSupport: "Nông trại đăng ký hỗ trợ", thCoffeeTrees: "Mật độ cà phê (cây/ha)", thPlantYear: "Năm trồng cà phê", thNotes: "Ghi chú", thShadeTreeCount: "Số cây che bóng", thSpeciesCount: "Số loài cây", thMapSheet: "Tờ bản đồ", thSubMap: "Thửa đất",
        thRecordID: "Mã Bản ghi", thYearVal: "Năm", thCherryVol: "Sản lượng quả tươi", thVolHQ: "Sản lượng chất lượng cao", thIncome: "Tổng thu nhập", thFertApplied: "Có bón phân?", thFertName: "Tên phân bón", thFertVol: "Lượng phân bón", thFertCost: "Chi phí phân bón", thPestApplied: "Dùng thuốc bảo vệ thực vật?", thPestName: "Tên thuốc bảo vệ thực vật", thPestVol: "Lượng thuốc bảo vệ thực vật", thPestCost: "Chi phí thuốc bảo vệ thực vật", thHerbApplied: "Dùng thuốc cỏ?", thHerbName: "Tên thuốc cỏ", thHerbVol: "Lượng thuốc cỏ", thHerbCost: "Chi phí thuốc cỏ", thLaborCost: "Thuê nhân công", thOtherCost: "Chi phí khác", thTreeSupportBy: "Hỗ trợ cây che bóng bởi", thTreesPlanted: "Số cây đã trồng", thSpecies: "Loài cây", thYearPlanted: "Năm trồng", thTreesDead: "Số cây chết", thSurvivalRate: "Tỷ lệ sống", thFertWWF: "Phân bón từ WWF", thLimeSlow: "Vôi từ SLOW", thCoverCrop: "Cây phủ đất", thSoilTest: "Hỗ trợ kiểm tra đất", thTraining: "Tập huấn", thOp6: "Hoạt động OP6", thRegSales: "Đăng ký bán cho SLOW", thRealSales: "Thực bán cho SLOW", thRevSales: "Doanh thu bán hàng", thBoughtVia: "Mua qua sơ chế",
        thYearSupport: "Năm hỗ trợ", thSupportID: "Mã hỗ trợ", thSupportCode: "Mã hỗ trợ con", thItemDetail: "Chi tiết hỗ trợ", thQuantity: "Số lượng", thUnit: "Đơn vị", thAlive: "Số cây còn sống", thSupportedYear: "Năm hỗ trợ", thReceiveSeedlings: "Nhận giống từ", thNumShadeTrees: "Số cây che bóng", thNumFarmRegSupport: "Số vườn đăng ký hỗ trợ", thSurvival: "Tỷ lệ sống",
        thTreesReceived: "Số cây nhận", thTreesSurvived: "Số cây sống", thNumShadeSpecies: "Số loài cây", thRegSupport: "Đăng ký hỗ trợ từ", btnAddTreeSupport: "Thêm hỗ trợ",
        thWeight: "Khối lượng (kg)", thFertType: "Loại phân bón", thNumSamples: "Số lượng mẫu", thSampleDate: "Ngày xét nghiệm", thTrainingName: "Tên lớp tập huấn", thTrainingTime: "Thời gian", thNumParticipants: "Số người tham gia", thSpeciesName: "Tên loài cây", thTreeCount: "Số cây",
        // Library fields
        thOp6Id: "Mã OP6", thNameEN: "Tên (EN)", thNameVI: "Tên (VI)", thType: "Loại", thFromDate: "Ngày bắt đầu", thToDate: "Ngày kết thúc",
        thSpeciesId: "Mã loài", thSpeciesName: "Tên loài", thSpeciesType: "Loại cây", thSpeciesInfo: "Thông tin",
        thAdmId: "Mã DM", thCondition: "Phân loại", thLabelEN: "Nhãn EN", thLabelVN: "Nhãn VN",
        thTrainId: "Mã tập huấn", btnAddLibrary: "Thêm mới",

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
        lblActive: "Hoạt động", lblInactive: "Ngưng hoạt động",
        lblIncome: "Tổng thu nhập", lblFert: "Phân bón", lblPest: "Thuốc bảo vệ thực vật", lblHerb: "Thuốc cỏ", lblLabor: "Nhân công", lblOther: "Khác",
        lblReg: "Đăng ký", lblReal: "Thực tế",
        lblTraining: "Tập huấn", lblOp6: "Op6",

        lblExisting: "Hiện có", lblNew: "Trồng mới",
        lblCLC: "CLC", lblNormal: "Đại trà",
        lblFarmers: "Số nông hộ",
        optAll: "Tất cả",

        greeting: "Xin chào,",
        homeCardProjectDoc: "Tài liệu dự án",
        thPermSummary: "Phân quyền",
        lblOrgHint: "(Giữ Ctrl để chọn nhiều tổ chức)",
        lblEffectivePerms: "Quyền hiệu lực (Preview)",
        lblGroupScope: "Phạm vi nhóm hộ",
        lblAllGroups: "Tất cả nhóm",
        lblNoGroups: "Chưa gán nhóm",
        lblNGroups: "nhóm",
        lblPermDetail: "Phân quyền chi tiết",
        lblTabAccess: "Tab truy cập",
        lblOperations: "Thao tác",
        btnInstallApp: "Cài đặt ứng dụng",
        installBannerTitle: "Cài đặt PFFP Dashboard",
        installBannerMsg: "Thêm vào màn hình chính để truy cập nhanh hơn",
        btnInstall: "Cài đặt",
        btnDismiss: "Để sau",
        btnBackup: "Sao lưu dữ liệu",
        backupTitle: "Sao lưu dữ liệu",
        backupSuccess: "Đã xuất file sao lưu thành công!",
        backupEmpty: "Không có dữ liệu để sao lưu",
        swipeBackupHint: "Vuốt sang trái để sao lưu dữ liệu"
    },
    en: {
        appTitle: "Prosperous Farmers and Forests Partnership",
        loading: "Loading data...",
        lblSelectOrg: "Please select organization:", optSelectOrgFirst: "-- Select Organization First --",
        lblUsername: "Select Staff:", lblPassword: "Password:", btnLogin: "LOGIN",
        loginErrorTitle: "Login Error", loginErrorMsg: "Incorrect password or account inactive.",
        kpi1: "Total Farmers", kpiFemale: "Female / Total", kpi2: "Total Plots", kpi3: "Total Area (ha)", kpi4: "Available Shade Trees", kpi5: "Planted Shade Trees", kpi6: "Total Species", kpi7: "Total Farmer Groups", kpi8: "Completion Rate", kpi9: "Survival Rate",
        kpi10: "Cherry Vol (T)", kpi11: "HQ Vol (T)",
        searchPlaceholder: "Search farmers, plots, ID...",

        // NEW FILTERS & TITLES
        filterTitle: "Data Filters", filterYear: "Year", filterYearSupport: "Support Year", filterVillage: "Farmer Group", filterStatus: "Status", filterSupported: "Supported By", filterSupportedTypes: "Support Types", filterSpecies: "Species", filterManageBy: "Managed By",
        btnReset: "Reset", btnRefresh: "Reload Data", btnExport: "Export Excel", btnPrint: "Print", btnExit: "Exit", btnAddFarmer: "Add Farmer", btnAddYearly: "Add New Year", btnAddPlot: "Add Plot",
        homeGroupActivity: "Data Management", homeGroupLibrary: "Library", homeGroupSystem: "System",
        homeCardSurvival: "Survival Rate",
        homeCardFarmers: "Farmers", homeCardPlots: "Farm Plots", homeCardYearly: "Yearly Assessment", homeCardReport: "Report",
        homeCardSupported: "Support",
        homeCardOP6: "OP6 Activities", homeCardSpecies: "Species", homeCardAdmin: "Admin List", homeCardTraining: "Training",
        homeCardUsers: "User & Permission", homeCardProjectDoc: "Project Docs",
        homeDescFarmers: "Manage farmer profiles", homeDescPlots: "Farm plot data", homeDescYearly: "Annual monitoring data",
        homeDescReport: "Charts & statistics", homeDescOP6: "OP6 Activities", homeDescSpecies: "Species reference",
        homeDescAdmin: "Shared reference lists", homeDescTraining: "Training records", homeDescProjectDoc: "Project documents & reports",
        homeDescUsers: "Accounts & permissions",
        chart1Title: "Total Area by Farmer Group", chart2Title: "Ethnicity Distribution", chart3Title: "Progress by Farmer Group", chart4Title: "Completion Rate", chartManageByTitle: "Management Unit",

        langBtn: '<img src="https://flagcdn.com/w40/vn.png" class="flag-icon" alt="Tiếng Việt">',
        noDataToExport: "No data to export!", drilldownTitle: "Details for", allOption: "All", selected: "selected",
        tabFarmers: "Farmers", tabPlots: "Plots", tabYearly: "Yearly Data", detailPrefix: "Details", editPrefix: "Edit",
        confirmDelete: "Are you sure you want to delete?", deleteSuccess: "Deleted successfully!", confirmSave: "Are you sure you want to save changes?", updateSuccess: "Updated successfully!", btnCancel: "Cancel", btnOk: "OK", btnSave: "Save Changes", btnSaveUser: "Save User", btnClose: "Close",
        thNo: "No", thYear: "Year", thFarmerID: "Farmer ID", thName: "Full Name", thYOB: "YOB", thGender: "Gender", thPhone: "Phone", thGroup: "Group", thCoop: "Cooperative", thVillage: "Village", thCommune: "Commune", thAddress: "Address", thIDCard: "ID Card", thEthnicity: "Ethnicity", thEcoStatus: "Eco Status", thHHCircum: "HH Circumstances", thMemCount: "HH Members", thWorkerCount: "Workers", thTotalArea: "Total Coffee Area", thPlotCount: "Plot Count", thSupportedBy: "Supported By", thSupportType: "Support Type", thRegFarms: "Reg Farms", thRegArea: "Reg Area", thStaff: "Staff", thStatus: "Status", thActivity: "Activity", thDate: "Date", thUpdate: "Update",
        thPlotId: "Plot ID", thPlotName: "Plot Name", thPlotArea: "Area (ha)", thLURC: "LURC?", thBorderForest: "Border Forest", thSeedlingSource: "Seedling Source", thPlaceName: "Place (Village)", thLocation: "Coordinates (Lat, Long)", thShadeTreesBefore: "Trees Before", thNameTreesBefore: "Tree Names Before", thFarmRegSupport: "Reg Support", thCoffeeTrees: "Coffee Density (trees/ha)", thPlantYear: "Plant Year", thNotes: "Notes", thShadeTreeCount: "Shade Trees", thSpeciesCount: "Species Count", thMapSheet: "Map Sheet", thSubMap: "Sub-map",
        thRecordID: "Record ID", thYearVal: "Year", thCherryVol: "Cherry Vol", thVolHQ: "HQ Vol", thIncome: "Total Income", thFertApplied: "Fert Applied?", thFertName: "Fert Name", thFertVol: "Fert Vol", thFertCost: "Fert Cost", thPestApplied: "Pest Applied?", thPestName: "Pest Name", thPestVol: "Pest Vol", thPestCost: "Pest Cost", thHerbApplied: "Herb Applied?", thHerbName: "Herb Name", thHerbVol: "Herb Vol", thHerbCost: "Herb Cost", thLaborCost: "Labor Cost", thOtherCost: "Other Cost", thTreeSupportBy: "Tree Support By", thTreesPlanted: "Trees Planted", thSpecies: "Species", thYearPlanted: "Year Planted", thTreesDead: "Trees Dead", thSurvivalRate: "Survival Rate", thFertWWF: "Fertiliser by WWF", thLimeSlow: "Lime from SLOW", thCoverCrop: "Cover Crop", thSoilTest: "Soil Test", thTraining: "Training", thOp6: "Op6 Activities", thRegSales: "Sales Registered", thRealSales: "Sales Supplied", thRevSales: "Sales Revenue", thBoughtVia: "Bought Via",
        thYearSupport: "Support Year", thSupportID: "Support ID", thSupportCode: "Support Code", thItemDetail: "Item Detail", thQuantity: "Quantity", thUnit: "Unit", thAlive: "Alive", thSupportedYear: "Supported Year", thReceiveSeedlings: "Seedlings From", thNumShadeTrees: "Shade Trees", thNumFarmRegSupport: "Farms Reg Support", thSurvival: "Survival",
        thTreesReceived: "Trees Received", thTreesSurvived: "Trees Survived", thNumShadeSpecies: "Species Count", thRegSupport: "Reg Support", btnAddTreeSupport: "Add Support",
        thWeight: "Weight (kg)", thFertType: "Fertilizer Type", thNumSamples: "Number of Samples", thSampleDate: "Test Date", thTrainingName: "Training Name", thTrainingTime: "Time", thNumParticipants: "Participants", thSpeciesName: "Species Name", thTreeCount: "Number of Trees",
        // Library fields
        thOp6Id: "OP6 ID", thNameEN: "Name (EN)", thNameVI: "Name (VI)", thType: "Type", thFromDate: "From Date", thToDate: "To Date",
        thSpeciesId: "Species ID", thSpeciesName: "Species Name", thSpeciesType: "Species Type", thSpeciesInfo: "Info",
        thAdmId: "Admin ID", thCondition: "Condition", thLabelEN: "Label EN", thLabelVN: "Label VN",
        thTrainId: "Train ID", btnAddLibrary: "Add New",

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

        greeting: "Hello,",
        homeCardProjectDoc: "Project Document",
        thPermSummary: "Permissions",
        lblOrgHint: "(Hold Ctrl to select multiple)",
        lblEffectivePerms: "Effective Permissions (Preview)",
        lblGroupScope: "Group Scope",
        lblAllGroups: "All Groups",
        lblNoGroups: "No Groups Assigned",
        lblNGroups: "groups",
        lblPermDetail: "Permission Details",
        lblTabAccess: "Tab Access",
        lblOperations: "Operations",
        btnInstallApp: "Install App",
        installBannerTitle: "Install PFFP Dashboard",
        installBannerMsg: "Add to home screen for quick access",
        btnInstall: "Install",
        btnDismiss: "Later",
        btnBackup: "Backup Data",
        backupTitle: "Data Backup",
        backupSuccess: "Backup file exported successfully!",
        backupEmpty: "No data to backup",
        swipeBackupHint: "Swipe left to backup data"

    }
};
const EXPORT_HEADERS = translations;
const FIELD_LABELS = {
    Farmers: { 'Full_Name': 'thName', 'Farmer_ID': 'thFarmerID', 'Year_Of_Birth': 'thYOB', 'Gender': 'thGender', 'Phone_Number': 'thPhone', 'Farmer_Group_Name': 'thGroup', 'Village_Name': 'thVillage', 'Commune_Name': 'thCommune', 'Address': 'thAddress', 'ID card': 'thIDCard', 'Ethnicity': 'thEthnicity', 'Socioeconomic Status': 'thEcoStatus', 'Household Circumstances': 'thHHCircum', 'Num_Household_Members': 'thMemCount', 'Num_Working_Members': 'thWorkerCount', 'Total_Coffee_Area': 'thTotalArea', 'Number of coffee farm plots': 'thPlotCount', 'Supported by': 'thSupportedBy', 'Manage by': 'filterManageBy', 'Number Farm registered for support from': 'thNumFarmRegSupport', 'Participation Year': 'thYear', 'Staff input': 'thStaff', 'Status': 'thStatus', 'Activity': 'thActivity' }, /* Cooperative_Name removed; Supported Types & Year of support moved to Yearly_Data */
    Plots: { 'Plot_Id': 'thPlotId', 'Plot_Name': 'thPlotName', 'Area (ha)': 'thPlotArea', 'Location': 'thLocation', 'Land use rights certificate?': 'thLURC', 'Border_Natural_Forest': 'thBorderForest', 'Place name': 'thPlaceName', 'Num_Shade_Trees_Before': 'thShadeTreesBefore', 'Name_Shade_Trees_Before': 'thNameTreesBefore', 'Num_Coffee_Trees': 'thCoffeeTrees', 'Coffee_Planted_Year': 'thPlantYear', 'Receive seedlings from': 'thReceiveSeedlings', 'Farm registered for support from': 'thFarmRegSupport', 'Notes for details (Optional)': 'thNotes', 'Map Sheet': 'thMapSheet', 'Sub-mapsheet': 'thSubMap', 'Number of shade trees': 'thNumShadeTrees', 'Number of shade tree species': 'thNumShadeSpecies' },
    Yearly_Data: { 'Record_Id': 'thRecordID', 'Year': 'thYearVal', 'Date': 'thDate', 'Supported_Types': 'thSupportType', 'Year_of_support': 'thYearSupport', 'Annual_Volume_Cherry': 'thCherryVol', 'Volume_High_Quality': 'thVolHQ', 'Total_Coffee_Income': 'thIncome', 'Fertilizers_Applied': 'thFertApplied', 'Name of fertilizer': 'thFertName', 'Fertilizer volume': 'thFertVol', 'Fertilizer cost': 'thFertCost', 'Pesticides_Applied': 'thPestApplied', 'Name of Pesticides': 'thPestName', 'Pesticides volume': 'thPestVol', 'Pesticides cost': 'thPestCost', 'Herbicides_Applied': 'thHerbApplied', 'Name of Herbicides': 'thHerbName', 'Herbicides volume': 'thHerbVol', 'Herbicides cost': 'thHerbCost', 'Hired_Labor_Costs': 'thLaborCost', 'Other_Costs': 'thOtherCost', 'Shade_Trees_supported by': 'thTreeSupportBy', 'Number_Shade_Trees_Planted': 'thTreesPlanted', 'Shade_Trees_Species': 'thSpecies', 'Year planted': 'thYearPlanted', 'Shade_Trees_Died': 'thTreesDead', 'Survival': 'thSurvival', 'Fertiliser supported by WWF': 'thFertWWF', 'Lime supported by Slow': 'thLimeSlow', 'Cover crop supported by Slow': 'thCoverCrop', 'Soil Test Support': 'thSoilTest', 'Attending training capacity organized by PFFP': 'thTraining', 'Op6_Activities': 'thOp6', 'Cherry sales registered to Slow': 'thRegSales', 'Cherry sales supplied to Slow': 'thRealSales', 'Revenue from cherry sales to Slow (VND)': 'thRevSales', 'Cherry bought by Slow via processor': 'thBoughtVia' },
    Supported: { 'Support_ID': 'thSupportID', 'Support code': 'thSupportCode', 'Date': 'thDate', 'Item_Detail': 'thItemDetail', 'Quantity': 'thQuantity', 'Unit': 'thUnit', 'Note': 'thNotes', 'Staff_Input': 'thStaff', 'A live': 'thAlive', 'Supported by': 'thSupportedBy', 'Supported year': 'thSupportedYear' },
    Op6: { 'OP6 ID': 'thOp6Id', 'Name_EN': 'thNameEN', 'Name_VI': 'thNameVI', 'Type': 'thType', 'From date': 'thFromDate', 'To date': 'thToDate' },
    Species: { 'Species_ID': 'thSpeciesId', 'Species_name': 'thSpeciesName', 'Species type': 'thSpeciesType', 'Species Info': 'thSpeciesInfo' },
    Admin: { 'Adm_ID': 'thAdmId', 'Condition': 'thCondition', 'Label EN': 'thLabelEN', 'Label VN': 'thLabelVN', 'Notes': 'thNotes' },
    Training: { 'Train_ID': 'thTrainId', 'Name_EN': 'thNameEN', 'Name_VI': 'thNameVI' }
};

// THÊM MAPPING CHO CÁC TRƯỜNG MỚI (YEAR OF SUPPORT, MANAGE BY)
const FIELD_MAPPING = {
    'Farmers': {
        'Participation Year': { map: 'drop', condition: 'Participation Year' },
        'Farmer_Group_Name': { map: 'admin', condition: 'Farmer group' },
        'Village_Name': { map: 'admin', condition: 'HP' },
        'Gender': { map: 'drop', condition: 'Gender' },
        'Status': { map: 'drop', condition: 'Status' },
        'Activity': { map: 'drop', condition: 'Activity' },
        'Ethnicity': { map: 'drop', condition: 'Dantoc' },
        'Socioeconomic Status': { map: 'drop', condition: 'Socioeconomic Status' },
        'Household Circumstances': { map: 'drop', condition: 'Household Circumstances' },
        'Supported by': { map: 'drop', condition: 'Organization', separator: ',' },
        'Manage by': { map: 'drop', condition: 'Organization', separator: ',' },
        'Staff input': 'user'
    },
    'Plots': {
        'Land use rights certificate?': { map: 'drop', condition: 'Answer' },
        'Border_Natural_Forest': { map: 'drop', condition: 'Answer' },
        'Name_Shade_Trees_Before': { map: 'species', separator: ',' },
        'Coffee_Planted_Year': { map: 'drop', condition: 'Planted' },
        'Receive seedlings from': { map: 'drop', condition: 'Organization', separator: ',' },
        'Farm registered for support from': { map: 'drop', condition: 'Organization', separator: ',' },
        'Place name': { map: 'admin', condition: 'HP' },
        'Status': { map: 'drop', condition: 'Status' },
        'Activity': { map: 'drop', condition: 'Activity' }
    },

    'Yearly_Data': {
        'Year': { map: 'drop', condition: 'Participation Year' },
        'Supported_Types': { map: 'drop', condition: 'Support list', separator: ',' },
        'Year_of_support': { map: 'drop', condition: 'Participation Year' },
        'Status': { map: 'drop', condition: 'Status' },
        'Activity': { map: 'drop', condition: 'Activity' },
        'Fertilizers_Applied': { map: 'drop', condition: 'Answer' },
        'Name of fertilizer': { map: 'drop', condition: 'Fertilizer', separator: ',' },
        'Pesticides_Applied': { map: 'drop', condition: 'Answer' },
        'Name of Pesticides': { map: 'drop', condition: 'Pesticide', separator: ',' },
        'Herbicides_Applied': { map: 'drop', condition: 'Answer' },
        'Name of Herbicides': { map: 'drop', condition: 'Herbicide', separator: ',' },
        'Shade_Trees_supported by': { map: 'drop', condition: 'Organization', separator: ',' },
        'Year planted': { map: 'drop', condition: 'Planted' },
        'Soil_Test_Support': { map: 'drop', condition: 'Answer' },
        'Attending training capacity organized by PFFP': { map: 'trainingList', separator: ',' },
        'Shade_Trees_Species': { map: 'species', separator: ',' },
        'Cherry sales registered to Slow': { map: 'drop', condition: 'Answer' },
        'Cherry bought by Slow via processor': { map: 'drop', condition: 'Answer' }
    },
    'Supported': {
        'Support code': { map: 'drop', condition: 'Support list' },
        'Item_Detail': 'species',
        'Unit': { map: 'drop', condition: 'Unit' },
        'Supported by': { map: 'drop', condition: 'Organization', separator: ',' },
        'Supported year': { map: 'drop', condition: 'Participation Year' },
        'Staff_Input': 'user'
    },
    'Op6': {
        'Type': { map: 'drop', condition: 'OP6' }
    }
};

function escapeHtml(text) {
    if (!text) return "";
    var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, function (m) { return map[m]; });
}

// ==========================================================
// INIT
// ==========================================================
document.addEventListener("DOMContentLoaded", function () {
    var attempts = 0;
    var maxAttempts = 300; // 30 seconds (was 10s) - for slow CDN in incognito mode
    var checkInterval = setInterval(function () {
        if (typeof jQuery !== 'undefined' && typeof Chart !== 'undefined') {
            clearInterval(checkInterval);
            console.log("Libraries loaded. Starting app...");
            startApp();
        } else {
            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                var msg = "Lỗi kết nối: Không thể tải thư viện hệ thống (jQuery/ChartJS). Vui lòng kiểm tra kết nối mạng và nhấn F5.";
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
    // Clear validation errors on input/change
    $(document).on('input change', '#genericForm input, #genericForm select, #userForm input, #userForm select', function () {
        var el = $(this);
        if (el.hasClass('is-invalid')) {
            el.removeClass('is-invalid');
            el.siblings('.field-error-msg').remove();
            el.next('.field-error-msg').remove();
        }
    });

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
    $('#headerUserName').css('cursor', 'pointer').click(function () { if (currentUser) { showUserDetails(currentUser['Staff ID'] || currentUser['ID']); } });

    // Set initial body class for Home tab
    document.body.classList.add('tab-home');

    // Responsive: toggle show-filters class when switching main tabs
    document.querySelectorAll('#mainTab button[data-bs-toggle="tab"]').forEach(function (tabBtn) {
        tabBtn.addEventListener('shown.bs.tab', function (e) {
            // Deactivate data-browser-pane (manually activated, Bootstrap doesn't know about it)
            var dbPane = document.getElementById('data-browser-pane');
            if (dbPane && dbPane.classList.contains('active')) {
                dbPane.classList.remove('show', 'active');
            }
            document.body.classList.remove('show-filters', 'tab-charts', 'mobile-filters-open', 'tab-home');
            if (e.target.id === 'dashboard-main-tab' || e.target.id === 'analytics-main-tab') {
                document.body.classList.add('show-filters', 'tab-charts');
            } else if (e.target.id === 'home-main-tab') {
                document.body.classList.add('tab-home');
            } else {
                document.body.classList.add('show-filters');
            }
            // Show AI widget only on Home tab
            var aiW = document.getElementById('aiChatWidget');
            if (aiW) aiW.style.display = (e.target.id === 'home-main-tab') ? '' : 'none';
            // Close search overlay when switching to any tab
            closeSearchOverlay();
            // Sync bottom bar active state
            $('#mobileBottomBar .bottom-bar-btn').removeClass('active');
            $('#mobileBottomBar .bottom-bar-btn[data-target="' + e.target.id + '"]').addClass('active');
        });
    });

    // Init settings pane when settings tab is shown
    var settingsTab = document.getElementById('settings-tab');
    if (settingsTab) {
        settingsTab.addEventListener('shown.bs.tab', function () { initSettingsPane(); });
    }

    // Safety: clean up stale modal backdrops when any modal closes
    document.addEventListener('hidden.bs.modal', function () {
        // If no modals are currently open, remove all leftover backdrops
        var openModals = document.querySelectorAll('.modal.show');
        if (openModals.length === 0) {
            document.querySelectorAll('.modal-backdrop').forEach(function (el) { el.remove(); });
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('padding-right');
        }
    });
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

    console.log("Fetching from PocketBase...");
    // Core tables (required)
    var coreQueries = [
        supabaseClient.from('farmers').select('*').limit(10000),
        supabaseClient.from('plots').select('*').limit(10000),
        supabaseClient.from('yearly_data').select('*').limit(10000),
        supabaseClient.from('users').select('*').limit(10000),
        supabaseClient.from('admin').select('*').limit(10000),
        supabaseClient.from('drop_values').select('*').limit(10000),
        supabaseClient.from('species').select('*').limit(10000),
        supabaseClient.from('training_list').select('*').limit(10000),
        supabaseClient.from('supported').select('*').limit(10000)
    ];
    // Optional tables (may not exist yet)
    var optionalQueries = [
        supabaseClient.from('op6_activities_list').select('*').limit(10000).then(function (r) { return r; }).catch(function () { return { data: [], error: null }; })
    ];
    Promise.all(coreQueries.concat(optionalQueries)).then(function (results) {
        // Only check core tables (index 0-8) for critical errors
        var coreResults = results.slice(0, 9);
        var hasCoreError = coreResults.some(function (r) { return r.error; });
        if (hasCoreError) {
            var errMsg = coreResults.filter(function (r) { return r.error; }).map(function (r) { return r.error.message; }).join('; ');
            console.error('PocketBase errors:', errMsg);
            // Try offline fallback
            if (typeof PFFP_DB !== 'undefined') {
                return PFFP_DB.loadAllFromLocal().then(function (localData) {
                    if (localData && localData.farmers && localData.farmers.length > 0) {
                        console.log('Loaded from IndexedDB (offline fallback)');
                        onDataLoaded(localData, true);
                        showOfflineBadge();
                    } else {
                        showError('PocketBase error:' + errMsg);
                    }
                });
            }
            showError('PocketBase error:' + errMsg);
            return;
        }
        // Log optional table warnings (non-blocking)
        if (results[9] && results[9].error) console.warn('op6_activities_list not available:', results[9].error.message);
        var op6Data = (results[9] && !results[9].error) ? (results[9].data || []) : [];
        console.log('OP6 data loaded:', op6Data.length, 'records', op6Data.length > 0 ? 'keys=' + Object.keys(op6Data[0]).join(',') : '(empty)');
        var data = {
            farmers: results[0].data || [],
            plots: results[1].data || [],
            yearly: results[2].data || [],
            user: results[3].data || [],
            admin: results[4].data || [],
            drop: results[5].data || [],
            species: results[6].data || [],
            trainingList: results[7].data || [],
            supported: results[8].data || [],
            op6: op6Data
        };
        onDataLoaded(data, false);
        // Save to IndexedDB for offline use
        if (typeof PFFP_DB !== 'undefined') {
            PFFP_DB.saveAllToLocal(data).catch(function (e) { console.warn('IndexedDB save failed:', e); });
        }
    }).catch(function (error) {
        console.error('Network error:', error);
        // Try offline fallback
        if (typeof PFFP_DB !== 'undefined') {
            PFFP_DB.loadAllFromLocal().then(function (localData) {
                if (localData && localData.farmers && localData.farmers.length > 0) {
                    console.log('Loaded from IndexedDB (offline)');
                    onDataLoaded(localData, true);
                    showOfflineBadge();
                } else {
                    showError(error);
                }
            }).catch(function () { showError(error); });
        } else {
            showError(error);
        }
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
        // Strip sensitive fields from user data (defense-in-depth)
        if (rawData.user) {
            rawData.user = rawData.user.map(function (u) {
                var clean = Object.assign({}, u);
                delete clean['Password']; delete clean['PasswordHash']; delete clean['PasswordSalt'];
                return clean;
            });
        }
        preProcessData(rawData);
        processReferenceData(rawData);
        autoFillYearlyFromSupported();
        filteredData = { farmers: rawData.farmers || [], plots: rawData.plots || [], yearly: rawData.yearly || [], supported: rawData.supported || [] };
        initFilters();
        // Restore session from sessionStorage (browser refresh)
        if (!isLoggedIn) {
            try {
                var savedSession = sessionStorage.getItem('PFFP_SESSION');
                if (savedSession) {
                    var restored = JSON.parse(savedSession);
                    if (restored && restored['Staff ID']) {
                        currentUser = restored;
                        isLoggedIn = true;
                        var userName = escapeHtml(restored['Full name'] || restored['Name'] || '');
                        $('#userGreeting').css({ 'color': '#0A65C7', 'font-weight': 'bold' }).html('<i class="fas fa-user-circle"></i> ' + translations[currentLang].greeting + ' ' + userName).show();
                        $('#headerUserName').html('<i class="fas fa-user-circle"></i> ' + userName);
                    }
                }
            } catch (e) { console.warn('Session restore failed:', e); }
        }
        if (isLoggedIn) {
            $('#loading').fadeOut();
            $('#loginSection').hide();
            $('#dashboardSection').show();
            checkUserPermissions();
            applyFilter();
            dbRefreshCurrentView();
            showProjectIntro();
            $('#aiChatWidget').show();
            // Re-open library list after save+refresh
            if (_pendingLibraryReopen) {
                var libT = _pendingLibraryReopen; _pendingLibraryReopen = null;
                setTimeout(function () { showLibraryList(libT); }, 300);
            }
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
    const users = rawData.user || []; const filteredUsers = users.filter(u => userBelongsToOrg(u, orgCode) && String(u['Status']) === 'Act');
    const select = $('#loginUserSelect'); select.empty();
    if (filteredUsers.length > 0) {
        select.prop('disabled', false);
        select.append('<option value="" disabled selected>-- Chọn nhân viên --</option>');
        filteredUsers.sort((a, b) => (a['Full name'] || '').localeCompare(b['Full name'] || ''));
        filteredUsers.forEach(u => { let id = u['Staff ID'] || u['ID']; let name = u['Full name'] || u['Name']; if (id && name) { select.append(`<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`); } });
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
    errorDiv.hide();
    $('#loginBtn').prop('disabled', true);

    fetch(PB_URL + '/api/custom/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: selectedId, password: password })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
        $('#loginBtn').prop('disabled', false);
        if (data.success && data.user) {
            // Convert PB field names back to Supabase-style names for compatibility
            var rmap = PB_REVERSE_MAP && PB_REVERSE_MAP['users'] ? PB_REVERSE_MAP['users'] : {};
            var userData = {};
            Object.keys(data.user).forEach(function (k) {
                var supaKey = rmap[k] || k;
                userData[supaKey] = data.user[k];
            });
            currentUser = userData;
            isLoggedIn = true; errorDiv.hide();
            // Persist session for browser refresh
            try { sessionStorage.setItem('PFFP_SESSION', JSON.stringify(userData)); } catch (e) { }
            let userName = escapeHtml(userData['Full name'] || userData['Name'] || '');
            $('#userGreeting').css({ 'color': '#0A65C7', 'font-weight': 'bold' }).html('<i class="fas fa-user-circle"></i> ' + translations[currentLang].greeting + ' ' + userName).show();
            $('#headerUserName').html('<i class="fas fa-user-circle"></i> ' + userName);
            checkUserPermissions();
            $('#loginSection').fadeOut(300, function () { $('#dashboardSection').fadeIn(300); applyFilter(); showProjectIntro(); $('#aiChatWidget').show(); });
        } else {
            var msg = translations[currentLang].loginErrorMsg;
            if (data.error === 'Account not active') msg = translations[currentLang].loginErrorMsg + ' (Tài khoản không hoạt động)';
            errorDiv.text(msg).show();
        }
    })
    .catch(function (err) {
        $('#loginBtn').prop('disabled', false);
        errorDiv.text('Lỗi kết nối: ' + err.message).show();
    });
}

function checkUserPermissions() {
    const auth = (currentUser && currentUser['Authority']) ? String(currentUser['Authority']).trim() : '';
    const isAdmin = (auth === ADMIN_ROLE);
    const isManager = MANAGER_ROLES.includes(auth);
    const allowedViews = (currentUser['View'] || '').split(',').map(s => s.trim().toLowerCase());

    // Hiển thị các Tab chính
    $('.main-tabs').show();
    $('#home-main-tab').parent().show();
    $('#dashboard-main-tab').parent().show();
    $('#analytics-main-tab').parent().show();

    // --- PHẦN QUAN TRỌNG: TAB CẤU HÌNH & SỐ PENDING ---
    // Config tab: visible for all managers (11, 1a, 2a)
    if (isManager) {
        $('#config-main-tab-li').show();
        if (typeof updatePendingCount === 'function') {
            updatePendingCount();
        }
    } else {
        $('#config-main-tab-li').hide();
        if ($('#config-main-tab').hasClass('active')) {
            $('#home-main-tab').tab('show');
        }
    }
    // Home "Nhân sự & Phân quyền" card: only 2a and admin
    if (isAdmin || auth === '2a') {
        $('.home-system-group').show();
    } else {
        $('.home-system-group').hide();
    }
    // Home "Tài liệu dự án" card: only managers (11, 1a, 2a)
    if (isManager) {
        $('.home-doc-group').show();
    } else {
        $('.home-doc-group').hide();
    }
    // Show/hide the System group wrapper based on whether any child cards are visible
    var hasSystemCards = (isAdmin || auth === '2a' || isManager);
    if (hasSystemCards) {
        $('.home-group-system').addClass('has-visible-cards');
    } else {
        $('.home-group-system').removeClass('has-visible-cards');
    }
    // --------------------------------------------------

    // Xử lý các Tab dữ liệu (Hộ dân, Lô đất, Yearly)
    // 1a/2a: see all tabs like admin
    if (isAdmin || isManager) {
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
    // 2a: full permissions like admin. 1a: follows Rule settings.
    var isFullAccess = isAdmin || auth === '2a';
    const ruleStr = (currentUser['Rule'] || '').toLowerCase();
    userPermissions.canView = ruleStr.includes('view') || isFullAccess;
    userPermissions.canAdd = ruleStr.includes('add') || isFullAccess;
    userPermissions.canEdit = ruleStr.includes('edit') || ruleStr.includes('update') || isFullAccess;
    userPermissions.canDelete = ruleStr.includes('delete') || ruleStr.includes('del') || isFullAccess;
    userPermissions.canPrint = ruleStr.includes('print') || isFullAccess;
    userPermissions.canExport = ruleStr.includes('export') || isFullAccess;
    userPermissions.allowedViews = allowedViews;

    // Store restricted groups for reference
    // 11/1a/2a: no group restriction. 3a/4a: restricted by Role.
    if (isManager) {
        userPermissions.restrictedGroups = [];
    } else {
        var permRoleStr = (currentUser['Role'] || '').trim();
        userPermissions.restrictedGroups = permRoleStr
            ? permRoleStr.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
            : [];
    }

    if (userPermissions.canExport) {
        $('.filter-actions button[onclick="exportTable()"]').show();
    } else {
        $('.filter-actions button[onclick="exportTable()"]').hide();
    }

    // Hiển thị nút Thêm Hộ Dân (Nếu có quyền Add)
    if (userPermissions.canAdd) {
        $('#btnAddFarmer').show();
    } else {
        $('#btnAddFarmer').hide();
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
    currentUser = null; $('#userGreeting').hide(); $('#headerUserName').html('');
    try { sessionStorage.removeItem('PFFP_SESSION'); } catch (e) { }
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
    var dropList = data.drop || []; dropCondMap = {};
    dropList.forEach(r => {
        let id = String(r.ID || r.Code || r.Value || '').trim();
        if (!id) return;
        var entry = { en: r.Label_EN || r['Label EN'] || r.Label || r.Name_EN || id, vi: r.Label_VN || r['Label VN'] || r.Name_VN || r.Label || id, condition: r.Condition || '' };
        dropMap[id] = entry;
        // Build condition-aware map: dropCondMap[condition][code]
        var cond = String(r.Condition || '').trim();
        if (cond) { if (!dropCondMap[cond]) dropCondMap[cond] = {}; dropCondMap[cond][id] = entry; }
    });
    var speciesList = data.species || []; speciesList.forEach(r => {
        let id = String(r.Species_ID || r.ID || r.Code || '').trim();
        if (id) {
            var fullName = r.Species_name || r.Name || id;
            var parts = String(fullName).split('/');
            var viName = parts[0] ? parts[0].trim() : id;
            var enName = parts.length > 1 ? parts.slice(1).join('/').trim() : viName;
            speciesMap[id] = { en: enName, vi: viName, full: fullName };
        }
    });
    var userList = data.user || []; userList.forEach(r => { let id = String(r['Staff ID'] || r.ID || r.Code || '').trim(); if (id) userMap[id] = { en: r['Full name'] || r.Name || id, vi: r['Full name'] || r.Name || id }; });
    var trainingList = data.trainingList || []; trainingList.forEach(r => { let id = String(r.Train_ID || r.ID || r.Code || '').trim(); if (id) trainingListMap[id] = { en: r.Name_EN || r.Name || id, vi: r.Name_VI || r.Name || id }; });
    var farmerList = data.farmers || []; farmerList.forEach(f => { if (f.Farmer_ID) farmersMap[f.Farmer_ID] = { en: f.Full_Name || f.Farmer_ID, vi: f.Full_Name || f.Farmer_ID }; });
    var plotList = data.plots || []; plotList.forEach(p => { if (p.Plot_Id) plotsMap[p.Plot_Id] = { en: p.Plot_Name || p.Plot_Id, vi: p.Plot_Name || p.Plot_Id }; });
}

function preProcessData(data) {
    if (data.farmers) {
        data.farmers.forEach(f => {
            f._supportedByArr = f['Supported by'] ? String(f['Supported by']).split(',').map(s => s.trim()).filter(Boolean) : [];
            // Supported Types moved to Yearly_Data (auto-calculated from Supported table)
        });
    }
    if (data.plots) {
        data.plots.forEach(p => {
            p._shadeTreesBeforeArr = p['Name_Shade_Trees_Before'] ? String(p['Name_Shade_Trees_Before']).split(',').map(s => s.trim()).filter(Boolean) : [];
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

function getLabel(id, map) {
    if (!id) return "";
    let lId = String(id).trim();
    if (map && map[lId]) return currentLang === 'vi' ? map[lId].vi : map[lId].en;

    // Tìm kiếm thông minh: Thử tìm theo mã số (ví dụ '3' trong '3. Trung bình')
    let match = lId.match(/^([^\.\)\s]+)[\.\)\s]/);
    if (match) {
        let prefix = match[1].trim();
        if (map && map[prefix]) return currentLang === 'vi' ? map[prefix].vi : map[prefix].en;
    }
    return id;
}

function getSpeciesName(code) {
    if (!code) return '';
    var sp = speciesMap[String(code).trim()];
    if (sp) return currentLang === 'vi' ? sp.vi : sp.en;
    return code;
}

function resolveValue(key, value, tName) {
    if (!value) return "";
    const c = FIELD_MAPPING[tName];
    if (!c || !c[key]) return value;

    const mT = c[key];
    let mO = null;
    let separator = (typeof mT === 'object') ? mT.separator : null;

    let mK = (typeof mT === 'string') ? mT : mT.map;
    var mCond = (typeof mT === 'object') ? mT.condition : null;
    if (mK === 'admin') mO = adminMap;
    else if (mK === 'drop') { mO = (mCond && dropCondMap[mCond]) ? dropCondMap[mCond] : dropMap; }
    else if (mK === 'species') mO = speciesMap;
    else if (mK === 'user') mO = userMap;
    else if (mK === 'trainingList') mO = trainingListMap;
    else if (mK === 'farmers') mO = farmersMap;
    else if (mK === 'plots') mO = plotsMap;

    if (!mO) return value;

    // For Supported Item_Detail: try speciesMap first, then trainingListMap
    if (tName === 'Supported' && key === 'Item_Detail' && mK === 'species') {
        var resolved = getLabel(value, speciesMap);
        if (resolved === value && trainingListMap[String(value).trim()]) {
            resolved = getLabel(value, trainingListMap);
        }
        return resolved;
    }

    if (separator) {
        return String(value).split(separator).map(p => getLabel(p.trim(), mO)).join(', ');
    } else {
        return getLabel(value, mO);
    }
}

function toggleLanguage() {
    currentLang = (currentLang === 'vi') ? 'en' : 'vi';
    document.body.setAttribute('data-lang', currentLang);
    $('[data-i18n]').each(function () { let k = $(this).data('i18n'); if (translations[currentLang][k]) $(this).text(translations[currentLang][k]); });
    let iH = translations[currentLang].langBtn; $('#langBtn').html(iH); $('#loginLangIcon').html(iH);

    if (currentUser) {
        let userName = escapeHtml(currentUser['Full name'] ||
            currentUser['Name'] || '');
        $('#userGreeting').css({ 'color': '#0A65C7', 'font-weight': 'bold' }).html('<i class="fas fa-user-circle"></i> ' + translations[currentLang].greeting + ' ' + userName);
        $('#headerUserName').html('<i class="fas fa-user-circle"></i> ' + userName);
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

    // 2. Year Support - from Supported table (Supported year field)
    let uYS = [...new Set((rawData.supported || []).map(d => d['Supported year'] || d.Supported_year))].filter(Boolean).sort();
    let ysO = uYS.map(y => { let lK = String(y).trim(); let m = dropMap[lK]; if (m && m.condition === 'Participation Year') return { value: y, label_vi: m.vi, label_en: m.en }; return { value: y, label_vi: y, label_en: y }; });
    populateMultiSelect('yearSupport', ysO, true);

    // 3. Village (Now Farmer Group) - only 3a/4a restricted by Role. 11/1a/2a see all groups.
    let vS = new Set(rawData.farmers.map(f => String(f['Farmer_Group_Name']).trim()).filter(Boolean));
    var filterAuth = String((currentUser && currentUser['Authority']) || '').trim();
    if (!MANAGER_ROLES.includes(filterAuth) && currentUser) {
        var filterRoleStr = (currentUser['Role'] || '').trim();
        if (filterRoleStr) {
            var allowedGroups = filterRoleStr.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
            vS = new Set([...vS].filter(function (v) { return allowedGroups.includes(v); }));
        } else {
            vS = new Set();
        }
    }
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

    // 8. Supported Types - from Supported table (Support code field)
    let supTS = new Set(); (rawData.supported || []).forEach(s => { var code = s['Support code'] || s.Support_code; if (code) supTS.add(code.trim()); });
    populateMultiSelect('supportedTypes', Array.from(supTS).sort().map(s => ({ value: s, label_vi: getLabel(s, dropMap) || s, label_en: getLabel(s, dropMap) || s })), true);

    // 9. Species
    let spS = new Set(); (rawData.yearly || []).forEach(y => { if (y['Shade_Trees_Species']) y['Shade_Trees_Species'].toString().split(',').forEach(p => spS.add(p.trim())); });
    populateMultiSelect('species', Array.from(spS).sort().map(s => ({ value: s, label_vi: speciesMap[s]?.vi || s, label_en: speciesMap[s]?.en || s })), true);
}

function populateMultiSelect(g, d, c = false) { const cn = $(`#${g}ListContainer`).empty(); d.forEach(i => { let v = c ? i.value : i; let lv = c ? (i.label_vi || v) : v; let le = c ? (i.label_en || v) : v; cn.append(`<li><div class="form-check"><input class="form-check-input check-item" type="checkbox" value="${v}" data-group="${g}" id="${g}_${v.toString().replace(/[^a-zA-Z0-9]/g, '_')}" checked><label class="form-check-label" for="${g}_${v.toString().replace(/[^a-zA-Z0-9]/g, '_')}" data-vi="${lv}" data-en="${le}">${(currentLang === 'vi') ? lv : le}</label></div></li>`); }); updateDropdownLabel(g); }
function getSelectedValues(g) { if ($(`.check-all[data-group="${g}"]`).is(':checked')) return 'All'; let s = []; $(`.check-item[data-group="${g}"]:checked`).each(function () { s.push($(this).val()); }); return s; }
function updateDropdownLabel(g) { $(`.check-item[data-group="${g}"]`).next('label').each(function () { $(this).text(currentLang === 'vi' ? $(this).data('vi') : $(this).data('en')); }); const t = $(`#btnFilter${g.charAt(0).toUpperCase() + g.slice(1)}Text`); if ($(`.check-all[data-group="${g}"]`).is(':checked')) { t.text(translations[currentLang].allOption); } else { let s = getSelectedValues(g); if (s.length === 0) t.text("---"); else if (s.length <= 2) { let ts = []; $(`.check-item[data-group="${g}"]:checked`).each(function () { ts.push($(this).next('label').text()); }); t.text(ts.join(", ")); } else t.text(`${s.length} ${translations[currentLang].selected}`); } }

function toggleMobileFilters() {
    document.body.classList.toggle('mobile-filters-open');
}

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

        // Group restriction: only 3a/4a restricted by Role groups. 11/1a/2a see ALL data.
        let restrictedGroups = [];
        if (currentUser) {
            var authVal = String(currentUser['Authority'] || '').trim();
            if (!MANAGER_ROLES.includes(authVal)) {
                var roleStr = (currentUser['Role'] || '').trim();
                if (roleStr) {
                    restrictedGroups = roleStr.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
                } else {
                    restrictedGroups = ['__NONE__']; // No groups assigned → see nothing
                }
            }
        }

        // Pre-filter: if yearSupport or supportedTypes are set, find matching farmer IDs from Supported table
        let suppFilterFIDs = null;
        if (fYSup !== 'All' || fST !== 'All') {
            let matchedSupp = (rawData.supported || []).filter(s => {
                if (fYSup !== 'All') {
                    var sy = String(s['Supported year'] || s.Supported_year || '');
                    if (!fYSup.includes(sy)) return false;
                }
                if (fST !== 'All') {
                    var sc = String(s['Support code'] || s.Support_code || '');
                    if (!fST.includes(sc)) return false;
                }
                return true;
            });
            suppFilterFIDs = new Set(matchedSupp.map(s => s['Farmer ID'] || s.Farmer_ID));
        }

        let filtF = (rawData.farmers || []).filter(f => {
            if (restrictedGroups.length > 0) { let fGroup = String(f['Farmer_Group_Name'] || '').trim(); if (!restrictedGroups.includes(fGroup)) return false; }

            if (fY !== 'All' && !fY.includes(f['Participation Year'])) return false;
            // Year Support & Supported Types now filter via Supported table
            if (suppFilterFIDs && !suppFilterFIDs.has(f.Farmer_ID)) return false;
            if (fV !== 'All' && !fV.includes(f['Farmer_Group_Name'])) return false;
            if (fS !== 'All' && !fS.includes(f['Status'])) return false;
            if (fE !== 'All' && !fE.includes(f['Ethnicity'])) return false;
            let fManVal = getManageByGroup(f['Manage by']);
            if (fMan !== 'All' && !fMan.includes(fManVal)) return false;

            if (fSp !== 'All') { let s = f._supportedByArr; if (!(s.length === 0 && fSp.length === 0) && !s.some(i => fSp.includes(i))) return false; }
            return true;
        });

        let fIDs = new Set(filtF.map(f => f['Farmer_ID']));
        let filtY = (rawData.yearly || []).filter(y => { if (fSpec !== 'All') { let s = y._speciesArr; if (fSpec.length === 0 || !s.some(z => fSpec.includes(z))) return false; } return fIDs.has(y['Farmer_ID']); });

        if (fSpec !== 'All') { let fIDSpec = new Set(filtY.map(y => y['Farmer_ID'])); filtF = filtF.filter(f => fIDSpec.has(f['Farmer_ID'])); fIDs = fIDSpec; }
        let filtP = (rawData.plots || []).filter(p => fIDs.has(p['Farmer_ID']));
        let filtS = (rawData.supported || []).filter(s => fIDs.has(s['Farmer ID'] || s.Farmer_ID));
        filteredData = { farmers: filtF, plots: filtP, yearly: filtY, supported: filtS };
        updateUI(filtF, filtP, filtY, filtS);
    });
}

function updateUI(f, p, y, s) {
    $('#kpi1').text(f.length.toLocaleString());
    let femaleCount = f.filter(i => { var g = (i['Gender'] || '').trim().toLowerCase(); return g === '0' || g === 'nữ' || g === 'female' || g === 'f'; }).length;
    $('#kpiFemale').text(femaleCount + '/' + f.length);
    $('#kpi2').text(p.length.toLocaleString());
    let totalArea = p.reduce((ss, i) => ss + (parseFloat(i['Area (ha)']) || 0), 0);
    $('#kpi3').text(totalArea.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    // KPI4: Existing shade trees from Plots
    $('#kpi4').text(p.reduce((ss, i) => ss + (parseFloat(i['Num_Shade_Trees_Before']) || 0), 0).toLocaleString());
    // KPI5,6,9: Calculate from Supported data (tree records only)
    var suppData = s || (rawData.supported || []).filter(x => { var fids = new Set(f.map(ff => ff.Farmer_ID)); return fids.has(x['Farmer ID']); });
    var treeRecs = suppData.filter(x => (x.Unit || '').toLowerCase().indexOf('tree') >= 0);
    var plantedFromSupp = treeRecs.reduce((ss, x) => ss + (parseFloat(x.Quantity) || 0), 0);
    $('#kpi5').text(plantedFromSupp.toLocaleString());
    // KPI6: Species count from Supported tree records
    var suppSpecies = new Set();
    var selS = getSelectedValues('species');
    treeRecs.forEach(x => { if (x.Item_Detail) { if (selS === 'All' || selS.includes(x.Item_Detail)) suppSpecies.add(x.Item_Detail); } });
    $('#kpi6').text(suppSpecies.size);
    // KPI7: Farmer groups
    let vS = new Set(); f.forEach(i => { if (i['Farmer_Group_Name']) vS.add(i['Farmer_Group_Name']); }); $('#kpi7').text(vS.size);
    // KPI8: Completion rate
    let dC = f.filter(i => (i['Activity'] || '').trim() === 'Done').length; $('#kpi8').text(f.length > 0 ? (dC / f.length * 100).toFixed(2) + '%' : '0.00%');
    // KPI9: Survival rate from Supported (ONLY evaluated records - A_live has value, including 0)
    var evaluatedRecs = treeRecs.filter(x => { var a = (x['A live'] !== undefined ? x['A live'] : x.A_live); return a !== null && a !== '' && a !== undefined && String(a).trim() !== ''; });
    var evalQty = evaluatedRecs.reduce((ss, x) => ss + (parseFloat(x.Quantity) || 0), 0);
    var evalAlive = evaluatedRecs.reduce((ss, x) => ss + (parseFloat(x['A live'] !== undefined ? x['A live'] : x.A_live) || 0), 0);
    var survRate = evalQty > 0 ? ((evalAlive / evalQty) * 100).toFixed(2) + '%' : '0.00%';
    $('#kpi9').text(survRate);
    // Store for chart use
    window._suppTreeRecs = treeRecs;
    window._suppEvaluatedRecs = evaluatedRecs;

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

    // 4. Shade Trees (Pie) - from Supported data
    let exTrees = p.reduce((a, b) => a + (parseFloat(b['Num_Shade_Trees_Before']) || 0), 0);
    var suppTreeRecs = window._suppTreeRecs || [];
    var suppEvalRecs = window._suppEvaluatedRecs || [];
    // New trees = total planted from Supported, minus died (only from evaluated records)
    var suppPlanted = suppTreeRecs.reduce((a, b) => a + (parseFloat(b.Quantity) || 0), 0);
    var suppAlive = suppEvalRecs.reduce((a, b) => a + (parseFloat(b['A live'] !== undefined ? b['A live'] : b.A_live) || 0), 0);
    var suppEvalQty = suppEvalRecs.reduce((a, b) => a + (parseFloat(b.Quantity) || 0), 0);
    var suppUnevalQty = suppPlanted - suppEvalQty;
    // Surviving new trees = alive (evaluated) + unevaluated (assume still alive)
    var newTrees = suppAlive + suppUnevalQty;
    if (newTrees < 0) newTrees = 0;
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
    // Use Supported data directly (only evaluated tree records)
    var supported = rawData.supported || [];
    var fIDs = new Set(farmers.map(f => f.Farmer_ID));
    var treeRecs = supported.filter(s => fIDs.has(s['Farmer ID']) && (s.Unit || '').toLowerCase().indexOf('tree') >= 0);
    var evaluated = treeRecs.filter(s => { var a = (s['A live'] !== undefined ? s['A live'] : s.A_live); return a !== null && a !== '' && a !== undefined && String(a).trim() !== ''; });

    var farmerGroupMap = {};
    farmers.forEach(f => {
        var vCode = f.Farmer_Group_Name;
        var vLabel = getLabel(vCode, adminMap) || vCode || 'Unknown';
        farmerGroupMap[f.Farmer_ID] = { label: vLabel, code: vCode };
    });

    var villageData = {};
    evaluated.forEach(s => {
        var fid = s['Farmer ID'];
        var info = farmerGroupMap[fid];
        if (info) {
            if (!villageData[info.label]) villageData[info.label] = { qty: 0, alive: 0, code: info.code, count: 0 };
            villageData[info.label].qty += parseFloat(s.Quantity) || 0;
            villageData[info.label].alive += parseFloat(s['A live'] !== undefined ? s['A live'] : s.A_live) || 0;
            villageData[info.label].count++;
        }
    });

    var survArray = [];
    for (var vLabel in villageData) {
        var stats = villageData[vLabel];
        var rate = stats.qty > 0 ? (stats.alive / stats.qty * 100) : 0;
        if (rate < 0) rate = 0;
        survArray.push({ label: vLabel, value: rate, code: stats.code });
    }
    var displaySurv = processBarChartData(survArray, '#filterTopSurvival');

    if (chartInstances['chartSurvivalRate']) chartInstances['chartSurvivalRate'].destroy();
    var ctx = document.getElementById('chartSurvivalRate').getContext('2d');
    chartInstances['chartSurvivalRate'] = new Chart(ctx, {
        type: 'bar',
        data: { labels: displaySurv.map(d => d.label), datasets: [{ label: '%', data: displaySurv.map(d => d.value), backgroundColor: APP_COLORS[1], borderRadius: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { color: '#000', backgroundColor: 'rgba(232, 245, 233, 0.8)', borderRadius: 4, font: { weight: 'bold' }, anchor: 'end', align: 'top', formatter: (val) => val.toFixed(2) + '%' } }, scales: {
                y: { beginAtZero: true, max: 100 }
            }, onClick: (e, els) => { if (els.length > 0) { setFilterFromChart('village', displaySurv[els[0].index].code); } }
        }
    });
    // Update explanatory note
    var noteEl = document.getElementById('chartSurvivalNote');
    if (noteEl) {
        var totalEval = evaluated.length;
        var totalTree = treeRecs.length;
        var isVi = currentLang === 'vi';
        noteEl.innerHTML = isVi
            ? '<i class="fas fa-info-circle text-info"></i> Chỉ tính trên <b>' + totalEval + '/' + totalTree + '</b> lượt đã đánh giá tỷ lệ sống (cột Survival). Năm 2025 chưa thực hiện đánh giá.'
            : '<i class="fas fa-info-circle text-info"></i> Based on <b>' + totalEval + '/' + totalTree + '</b> evaluated records (Survival column). 2025 not yet evaluated.';
    }
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
                ${currentLang === 'vi' ? 'HỒ SƠ NÔNG HỘ' : 'FARMER PROFILE'}: ${farmer.Full_Name || ''} (${farmer.Farmer_ID})
            </div>
        `;

    // === PHẦN 1: THÔNG TIN HỘ DÂN (Bố cục 3 cột) ===
    let section1Title = currentLang === 'vi' ? 'I. THÔNG TIN HỘ DÂN' : 'I. FARMER INFO';
    html += `<div class="section-title"><i class="fas fa-user-circle"></i> ${section1Title}</div>`;
    html += `<div class="detail-grid-container">`;

    // Danh sách các trường cần hiển thị theo thứ tự
    const farmerFields = [
        'Full_Name', 'Farmer_ID', 'Year_Of_Birth',
        'Gender', 'Ethnicity', 'ID card',
        'Phone_Number', 'Village_Name', 'Commune_Name',
        'Farmer_Group_Name', 'Address',
        'Num_Household_Members', 'Num_Working_Members', 'Socioeconomic Status',
        'Household Circumstances', 'Total_Coffee_Area', 'Number of coffee farm plots',
        'Supported by', 'Manage by',
        'Number Farm registered for support from',
        'Participation Year', 'Staff input'
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
    let section2Title = currentLang === 'vi' ? `II. DANH SÁCH LÔ ĐẤT - [Tổng: ${relatedPlots.length} lô]` : `II. PLOTS LIST - [Total: ${relatedPlots.length} plots]`;
    let addPlotBtn = userPermissions.canAdd
        ? ` <button class="btn btn-sm btn-success no-print ms-2" onclick="showAddPlotModal('${farmerId}')"><i class="fas fa-plus"></i> ${currentLang === 'vi' ? 'Thêm lô đất' : 'Add plot'}</button>`
        : '';
    html += `<div class="section-title d-flex align-items-center"><i class="fas fa-map"></i> ${section2Title}${addPlotBtn}</div>`;

    if (relatedPlots.length > 0) {
        html += renderPlotGridWithSupport(relatedPlots, farmerId);
    } else {
        html += `<div class="text-muted fst-italic p-2">Không có dữ liệu lô đất.</div>`;
    }

    // === PHẦN 3: DỮ LIỆU HÀNG NĂM (GRID) ===
    let section3Title = currentLang === 'vi' ? 'III. DỮ LIỆU HÀNG NĂM' : 'III. YEARLY DATA';
    let addYearlyBtn = userPermissions.canAdd
        ? ` <button class="btn btn-sm btn-success no-print ms-2" onclick="showAddYearlyModal('${farmerId}')"><i class="fas fa-plus"></i> ${currentLang === 'vi' ? 'Thêm năm mới' : 'Add new year'}</button>`
        : '';
    html += `<div class="section-title d-flex align-items-center"><i class="fas fa-history"></i> ${section3Title}${addYearlyBtn}</div>`;

    if (relatedYearly.length > 0) {
        html += renderChildGrid(relatedYearly, 'Yearly_Data');
    } else {
        html += `<div class="text-muted fst-italic p-2">Không có dữ liệu hàng năm.</div>`;
    }

    // === PHẦN 4: HỖ TRỢ (SUPPORTED) ===
    let relatedSupported = (rawData.supported || []).filter(s => String(s['Farmer ID'] || s.Farmer_ID) === String(farmerId));
    relatedSupported.sort((a, b) => (b['Supported year'] || '').localeCompare(a['Supported year'] || ''));

    let section4Title = currentLang === 'vi' ? `IV. HỖ TRỢ - [Tổng: ${relatedSupported.length}]` : `IV. SUPPORTED - [Total: ${relatedSupported.length}]`;
    let addSupportedBtn = userPermissions.canAdd
        ? ` <button class="btn btn-sm btn-success no-print ms-2" onclick="showAddSupportedModal('${farmerId}')"><i class="fas fa-plus"></i> ${currentLang === 'vi' ? 'Thêm hỗ trợ' : 'Add support'}</button>`
        : '';
    html += `<div class="section-title d-flex align-items-center"><i class="fas fa-hands-helping"></i> ${section4Title}${addSupportedBtn}</div>`;

    if (relatedSupported.length > 0) {
        html += renderChildGrid(relatedSupported, 'Supported');
    } else {
        html += `<div class="text-muted fst-italic p-2">${currentLang === 'vi' ? 'Chưa có dữ liệu hỗ trợ.' : 'No support data yet.'}</div>`;
    }

    // --- Đẩy nội dung vào Modal ---
    $('#detailContent').html(html);
    let displayTitle = farmer.Full_Name + ' (' + farmer.Farmer_ID + ')';
    $('#farmerDetailTitle').html('<span style="font-size:0.75rem;opacity:0.85;display:block;">' + (translations[currentLang].detailPrefix || 'Chi tiết') + '</span>' + escapeHtml(displayTitle));

    // Lưu tên hộ để dùng làm tên file khi in PDF
    activePrintName = `${farmer.Full_Name}_(${farmer.Farmer_ID})`;

    // --- TẠO NÚT CHỨC NĂNG (ACTION BAR - compact) ---
    let buttonsHtml = '';
    buttonsHtml += `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-times"></i> ${translations[currentLang].btnClose}</button>`;
    buttonsHtml += `<button type="button" class="btn btn-primary" onclick="printFarmerDetail()"><i class="fas fa-print"></i> ${currentLang === 'vi' ? 'In' : 'Print'}</button>`;
    buttonsHtml += `<button type="button" class="btn btn-info" onclick="downloadPDF()"><i class="fas fa-file-pdf"></i> PDF</button>`;
    if (userPermissions.canExport) {
        buttonsHtml += `<button type="button" class="btn btn-success" onclick="exportDetailToExcel('${farmerId}')"><i class="fas fa-file-excel"></i> Excel</button>`;
    }
    if (userPermissions.canEdit) {
        buttonsHtml += `<button type="button" class="btn btn-warning" onclick="editFarmer('${farmerId}')"><i class="fas fa-edit"></i> ${currentLang === 'vi' ? 'Sửa' : 'Edit'}</button>`;
    }
    if (userPermissions.canDelete) {
        buttonsHtml += `<button type="button" class="btn btn-danger" onclick="deleteFarmer('${farmerId}')"><i class="fas fa-trash"></i> ${currentLang === 'vi' ? 'Xóa' : 'Del'}</button>`;
    }
    $('#modalActions').html(buttonsHtml);

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
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('farmerDetailModal'));
    modal.show();
}

// --- HÀM VẼ LÔ ĐẤT ---
function renderPlotGridWithSupport(plots, farmerId) {
    var html = '';
    var plotLabels = FIELD_LABELS['Plots'] || {};

    plots.forEach(function (plot, idx) {
        var plotId = plot.Plot_Id || '';

        html += '<div class="child-card-wrapper mb-4 p-3 border rounded bg-white shadow-sm position-relative">';
        html += '<div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">';
        html += '<div class="fw-bold text-success"><i class="fas fa-map"></i> ' + (idx + 1) + '. ' + plotId + '</div>';
        html += '<div class="no-print d-flex gap-2">';
        html += '<button class="btn btn-sm btn-warning no-print" onclick="openEditForm(\'Plots\', \'' + plotId + '\')"><i class="fas fa-edit"></i></button>';
        html += '<button class="btn btn-sm btn-danger no-print" onclick="deleteItem(\'Plots\', \'' + plotId + '\')"><i class="fas fa-trash"></i></button>';
        html += '</div></div>';

        // Thông tin lô đất
        html += '<div class="detail-grid-container">';
        Object.keys(plotLabels).forEach(function (key) {
            if (key.startsWith('_') || key === 'Status' || key === 'Activity') return;
            var labelKey = plotLabels[key];
            if (!labelKey) return;
            var label = translations[currentLang][labelKey] || labelKey;
            var val = resolveValue(key, plot[key], 'Plots');
            html += '<div class="detail-item"><div class="field-label">' + label + '</div><div class="field-value">' + (val || '-') + '</div></div>';
        });
        html += '</div>';

        html += '</div>'; // end child-card-wrapper
    });
    return html;
}

// --- GENERIC ADD MODAL (shared by all 4 "Add" modals) ---
function showAddModal(config) {
    if (!userPermissions.canAdd) {
        alert(currentLang === 'vi' ? 'Bạn không có quyền thêm mới.' : 'You do not have permission to add.');
        return;
    }
    var detailModal = bootstrap.Modal.getInstance(document.getElementById('farmerDetailModal'));
    if (detailModal) detailModal.hide();

    $('#editFormTitle').text(config.title);
    $('#genericForm').trigger('reset');
    $('#formFields').empty();
    $('#formType').val(config.type);
    $('#formId').val('');

    var fieldsHtml = '';

    // Render readonly parent fields
    (config.parentFields || []).forEach(function (pf) {
        fieldsHtml += '<div class="col-md-6 col-lg-4 mb-3">';
        fieldsHtml += '<label class="form-label-custom">' + escapeHtml(pf.label) + '</label>';
        fieldsHtml += '<input type="text" class="form-control form-control-sm bg-light" name="' + escapeHtml(pf.name) + '" value="' + escapeHtml(pf.value) + '" readonly>';
        fieldsHtml += '</div>';
    });

    // Render fields from FIELD_LABELS
    var labels = FIELD_LABELS[config.type] || {};
    var defaults = config.defaults || {};
    Object.keys(labels).forEach(function (key) {
        if (config.autoGenId && key === config.autoGenId.fieldName) {
            var ag = config.autoGenId;
            fieldsHtml += '<div class="col-md-6 col-lg-4 mb-3">';
            fieldsHtml += '<label class="form-label-custom">' + (translations[currentLang][labels[key]] || key) + '</label>';
            fieldsHtml += '<input type="text" class="form-control form-control-sm' + (ag.value ? ' bg-light' : '') + '" name="' + key + '" id="' + ag.inputId + '" value="' + escapeHtml(ag.value || '') + '" readonly placeholder="' + escapeHtml(ag.placeholder || '') + '">';
            fieldsHtml += '</div>';
        } else {
            var defVal = defaults[key] !== undefined ? defaults[key] : '';
            fieldsHtml += generateInputField(key, defVal, config.type);
        }
    });

    if (config.helperText) {
        fieldsHtml += '<div class="col-12 text-info small fst-italic mt-2">* ' + config.helperText + '</div>';
    }
    $('#formFields').html(fieldsHtml);

    if (config.afterRender) setTimeout(config.afterRender, 200);

    var editModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('editFormModal'));
    editModal.show();
}

// --- THÊM HỖ TRỢ CHO NÔNG HỘ ---
function generateNextSupportId(farmerId, yearCode) {
    // yearCode e.g. '2024' or '2025' → year2 = '24' or '25'
    var year2 = String(yearCode).slice(-2);
    var prefix = farmerId + '.' + year2 + '.';
    var maxSeq = 0;
    (rawData.supported || []).forEach(function (s) {
        var sid = String(s.Support_ID || '');
        if (sid.startsWith(prefix)) {
            var seq = parseInt(sid.substring(prefix.length), 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
    });
    return prefix + (maxSeq + 1);
}

// --- SUPPORT TYPE DYNAMIC FIELD CONFIG ---
// Maps Support code (SP1-SP7) to which dynamic fields to show
var SUPPORT_TYPE_FIELDS = {
    'SP1': { group: 'trees', unit: 'tree', label: { vi: 'Cây giống cà phê Arabica', en: 'Arabica coffee seedlings' } },
    'SP2': { group: 'trees', unit: 'tree', label: { vi: 'Hỗ trợ cây phủ đất', en: 'Cover crop support' } },
    'SP3': { group: 'fertilizer', unit: 'kg', label: { vi: 'Hỗ trợ phân bón', en: 'Fertilizer support' } },
    'SP4': { group: 'lime', unit: 'kg', label: { vi: 'Hỗ trợ vôi', en: 'Lime support' } },
    'SP5': { group: 'trees', unit: 'tree', label: { vi: 'Cây giống che bóng', en: 'Shade tree seedlings' } },
    'SP6': { group: 'soiltest', unit: '', label: { vi: 'Hỗ trợ kiểm tra đất', en: 'Soil test support' } },
    'SP7': { group: 'training', unit: '', label: { vi: 'Tập huấn nâng cao năng lực', en: 'Training capacity' } }
};

// Unit auto-set map: group → Unit code to auto-select
var SUPPORT_UNIT_MAP = { 'tree': 'tree', 'kg': 'kg' };

function showAddSupportedModal(farmerId) {
    if (!userPermissions.canAdd) {
        alert(currentLang === 'vi' ? 'Bạn không có quyền thêm mới.' : 'You do not have permission to add.');
        return;
    }
    var farmer = (rawData.farmers || []).find(function (f) { return String(f.Farmer_ID) === String(farmerId); });
    var farmerName = farmer ? farmer.Full_Name : farmerId;
    var defaultYear = String(new Date().getFullYear());
    var nextId = generateNextSupportId(farmerId, defaultYear);
    var t = translations[currentLang];

    var detailModal = bootstrap.Modal.getInstance(document.getElementById('farmerDetailModal'));
    if (detailModal) detailModal.hide();

    $('#editFormTitle').text((currentLang === 'vi' ? 'Thêm Hỗ Trợ - ' : 'Add Support - ') + farmerName);
    $('#genericForm').trigger('reset');
    $('#formFields').empty();
    $('#formType').val('Supported');
    $('#formId').val('');

    var html = '';

    // 1. Farmer ID (readonly)
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thFarmerID || 'Farmer ID') + '</label>';
    html += '<input type="text" class="form-control form-control-sm bg-light" name="Farmer ID" value="' + escapeHtml(farmerId) + '" readonly>';
    html += '</div>';

    // 2. Support_ID (auto-generated, readonly)
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thSupportID || 'Support ID') + '</label>';
    html += '<input type="text" class="form-control form-control-sm bg-light" name="Support_ID" id="addSupportIdField" value="' + escapeHtml(nextId) + '" readonly>';
    html += '</div>';

    // 3. Supported year (dropdown)
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thSupportedYear || 'Supported Year') + '</label>';
    html += '<select class="form-select form-select-sm" name="Supported year" id="supportYear">';
    html += '<option value="">-- ' + (currentLang === 'vi' ? 'Chọn' : 'Select') + ' --</option>';
    var yearKeys = Object.keys(dropMap).filter(function (id) { return dropMap[id].condition === 'Participation Year'; });
    yearKeys.forEach(function (id) {
        var lbl = (currentLang === 'vi' ? dropMap[id].vi : dropMap[id].en) || id;
        var sel = (id === defaultYear) ? ' selected' : '';
        html += '<option value="' + id + '"' + sel + '>' + lbl + '</option>';
    });
    html += '</select></div>';

    // 4. Support code (dropdown - triggers dynamic fields)
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thSupportCode || 'Support Code') + '</label>';
    html += '<select class="form-select form-select-sm" name="Support code" id="supportCodeSelect" onchange="onSupportCodeChange(this.value)">';
    html += '<option value="">-- ' + (currentLang === 'vi' ? 'Chọn loại hỗ trợ' : 'Select support type') + ' --</option>';
    var spKeys = Object.keys(dropMap).filter(function (id) { return dropMap[id].condition === 'Support list'; });
    spKeys.forEach(function (id) {
        var lbl = (currentLang === 'vi' ? dropMap[id].vi : dropMap[id].en) || id;
        html += '<option value="' + id + '">' + lbl + '</option>';
    });
    html += '</select></div>';

    // 5. Date
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thDate || 'Date') + '</label>';
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    html += '<input type="date" class="form-control form-control-sm" name="Date" value="' + todayStr + '">';
    html += '</div>';

    // 6. Supported by (dropdown)
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thSupportedBy || 'Supported By') + '</label>';
    html += '<select class="form-select form-select-sm select2-generic" name="Supported by" multiple>';
    var orgKeys = Object.keys(dropMap).filter(function (id) { return dropMap[id].condition === 'Organization'; });
    orgKeys.forEach(function (id) {
        var lbl = (currentLang === 'vi' ? dropMap[id].vi : dropMap[id].en) || id;
        html += '<option value="' + id + '">' + lbl + '</option>';
    });
    html += '</select></div>';

    // 7. Staff_Input (dropdown)
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thStaff || 'Staff') + '</label>';
    html += '<select class="form-select form-select-sm" name="Staff_Input">';
    html += '<option value="">-- ' + (currentLang === 'vi' ? 'Chọn' : 'Select') + ' --</option>';
    Object.keys(userMap).forEach(function (id) {
        var lbl = (currentLang === 'vi' ? userMap[id].vi : userMap[id].en) || id;
        html += '<option value="' + id + '">' + lbl + '</option>';
    });
    html += '</select></div>';

    // === DYNAMIC FIELD GROUPS (hidden by default, shown based on Support code) ===

    // GROUP: trees (SP1, SP2, SP5) — Tree count + Species
    html += '<div id="supportGroup_trees" class="col-12 support-dynamic-group" style="display:none;">';
    html += '<div class="row">';
    // Tree count (Quantity)
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thTreeCount || 'Số cây') + '</label>';
    html += '<div class="input-group input-group-sm">';
    html += '<input type="number" class="form-control form-control-sm" name="Quantity" step="1" min="0" inputmode="numeric">';
    html += '<span class="input-group-text" style="font-size:0.72rem;background:#f8f9fa;">' + (currentLang === 'vi' ? 'cây' : 'trees') + '</span>';
    html += '</div></div>';
    // Species name (dropdown from speciesMap)
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thSpeciesName || 'Tên loài cây') + '</label>';
    html += '<select class="form-select form-select-sm select2-generic" name="Item_Detail" multiple>';
    Object.keys(speciesMap).forEach(function (id) {
        var lbl = (currentLang === 'vi' ? speciesMap[id].vi : speciesMap[id].en) || id;
        html += '<option value="' + id + '">' + lbl + '</option>';
    });
    html += '</select></div>';
    html += '</div></div>';

    // GROUP: fertilizer (SP3) — Weight kg + Fertilizer type
    html += '<div id="supportGroup_fertilizer" class="col-12 support-dynamic-group" style="display:none;">';
    html += '<div class="row">';
    // Weight (kg)
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thWeight || 'Khối lượng (kg)') + '</label>';
    html += '<div class="input-group input-group-sm">';
    html += '<input type="number" class="form-control form-control-sm" name="Quantity" step="0.1" min="0" inputmode="decimal">';
    html += '<span class="input-group-text" style="font-size:0.72rem;background:#f8f9fa;">kg</span>';
    html += '</div></div>';
    // Fertilizer type (free text / datalist from drop_values condition=Fertilizer)
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thFertType || 'Loại phân bón') + '</label>';
    html += '<input type="text" class="form-control form-control-sm" name="Item_Detail" list="dl_fertType" placeholder="' + (currentLang === 'vi' ? 'Nhập hoặc chọn...' : 'Type or select...') + '">';
    html += '<datalist id="dl_fertType">';
    Object.keys(dropMap).forEach(function (id) {
        if (dropMap[id].condition === 'Fertilizer') {
            var lbl = (currentLang === 'vi' ? dropMap[id].vi : dropMap[id].en) || id;
            html += '<option value="' + escapeHtml(lbl) + '">';
        }
    });
    html += '</datalist></div>';
    html += '</div></div>';

    // GROUP: lime (SP4) — Weight kg only
    html += '<div id="supportGroup_lime" class="col-12 support-dynamic-group" style="display:none;">';
    html += '<div class="row">';
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thWeight || 'Khối lượng (kg)') + '</label>';
    html += '<div class="input-group input-group-sm">';
    html += '<input type="number" class="form-control form-control-sm" name="Quantity" step="0.1" min="0" inputmode="decimal">';
    html += '<span class="input-group-text" style="font-size:0.72rem;background:#f8f9fa;">kg</span>';
    html += '</div></div>';
    html += '</div></div>';

    // GROUP: soiltest (SP6) — Number of samples + Date
    html += '<div id="supportGroup_soiltest" class="col-12 support-dynamic-group" style="display:none;">';
    html += '<div class="row">';
    // Number of samples
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thNumSamples || 'Số lượng mẫu') + '</label>';
    html += '<input type="number" class="form-control form-control-sm" name="Quantity" step="1" min="0" inputmode="numeric">';
    html += '</div>';
    // Test date (use Item_Detail to store the test date info)
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thSampleDate || 'Ngày xét nghiệm') + '</label>';
    html += '<input type="date" class="form-control form-control-sm" name="Item_Detail" value="' + todayStr + '">';
    html += '</div>';
    html += '</div></div>';

    // GROUP: training (SP7) — Training name (dropdown) + Time + Participants
    html += '<div id="supportGroup_training" class="col-12 support-dynamic-group" style="display:none;">';
    html += '<div class="row">';
    // Training name (dropdown from trainingListMap)
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thTrainingName || 'Tên lớp tập huấn') + '</label>';
    html += '<select class="form-select form-select-sm" name="Item_Detail">';
    html += '<option value="">-- ' + (currentLang === 'vi' ? 'Chọn lớp' : 'Select class') + ' --</option>';
    Object.keys(trainingListMap).forEach(function (id) {
        var lbl = (currentLang === 'vi' ? trainingListMap[id].vi : trainingListMap[id].en) || id;
        html += '<option value="' + id + '">' + lbl + '</option>';
    });
    html += '</select></div>';
    // Time
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thTrainingTime || 'Thời gian') + '</label>';
    html += '<input type="date" class="form-control form-control-sm" name="_training_time" value="' + todayStr + '">';
    html += '</div>';
    // Number of participants
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thNumParticipants || 'Số người tham gia') + '</label>';
    html += '<input type="number" class="form-control form-control-sm" name="Quantity" step="1" min="0" inputmode="numeric">';
    html += '</div>';
    html += '</div></div>';

    // === Hidden fields ===
    // Unit (auto-set by support type)
    html += '<input type="hidden" name="Unit" id="supportUnitHidden" value="">';
    // Note
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thNotes || 'Ghi chú') + '</label>';
    html += '<input type="text" class="form-control form-control-sm" name="Note" value="">';
    html += '</div>';

    // Helper text
    html += '<div class="col-12 text-info small fst-italic mt-2">* ' + (currentLang === 'vi' ? 'Support ID tự động: ' + nextId : 'Support ID auto-generated: ' + nextId) + '</div>';

    $('#formFields').html(html);

    // AfterRender: year change → regenerate Support_ID
    setTimeout(function () {
        $('#supportYear').on('change', function () {
            var selYear = $(this).val();
            if (selYear) {
                var newId = generateNextSupportId(farmerId, selYear);
                $('#addSupportIdField').val(newId);
            }
        });
    }, 200);

    var editModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('editFormModal'));
    editModal.show();
}

// --- Dynamic field toggle based on Support code ---
function onSupportCodeChange(code) {
    var cfg = SUPPORT_TYPE_FIELDS[code];
    var targetGroup = cfg ? cfg.group : '';

    // Hide all groups and clear their values
    $('.support-dynamic-group').each(function () {
        var groupId = $(this).attr('id') || '';
        var isTarget = groupId === 'supportGroup_' + targetGroup;
        if (!isTarget) {
            $(this).hide();
            // Clear values in non-target groups
            $(this).find('input, select').each(function () {
                if ($(this).is('select[multiple]')) $(this).val([]);
                else if ($(this).is('select')) $(this).val('');
                else $(this).val('');
            });
        }
    });

    if (!cfg) {
        $('#supportUnitHidden').val('');
        return;
    }

    // Show the target group
    $('#supportGroup_' + targetGroup).show();

    // Auto-set Unit
    $('#supportUnitHidden').val(cfg.unit || '');
}

// --- Edit existing Supported record with dynamic fields ---
function openEditSupportedForm(item) {
    var detailModal = bootstrap.Modal.getInstance(document.getElementById('farmerDetailModal'));
    if (detailModal) detailModal.hide();

    var t = translations[currentLang];
    var titlePrefix = t.editPrefix || 'Sửa';
    $('#editFormTitle').text(titlePrefix + ': ' + (item.Support_ID || ''));
    $('#genericForm').trigger('reset');
    $('#formFields').empty();
    $('#formType').val('Supported');
    $('#formId').val(item.Support_ID);

    var html = '';
    var supportCode = item['Support code'] || '';

    // 1. Support_ID (readonly)
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thSupportID || 'Support ID') + '</label>';
    html += '<input type="text" class="form-control form-control-sm bg-light text-muted" name="Support_ID" value="' + escapeHtml(item.Support_ID || '') + '" readonly tabindex="-1" style="pointer-events:none;">';
    html += '</div>';

    // 2. Supported year
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thSupportedYear || 'Supported Year') + '</label>';
    html += '<select class="form-select form-select-sm" name="Supported year">';
    html += '<option value="">-- ' + (currentLang === 'vi' ? 'Chọn' : 'Select') + ' --</option>';
    var yearKeys = Object.keys(dropMap).filter(function (id) { return dropMap[id].condition === 'Participation Year'; });
    yearKeys.forEach(function (id) {
        var lbl = (currentLang === 'vi' ? dropMap[id].vi : dropMap[id].en) || id;
        var sel = (id === String(item['Supported year'] || '')) ? ' selected' : '';
        html += '<option value="' + id + '"' + sel + '>' + lbl + '</option>';
    });
    html += '</select></div>';

    // 3. Support code (dropdown - triggers dynamic fields)
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thSupportCode || 'Support Code') + '</label>';
    html += '<select class="form-select form-select-sm" name="Support code" id="supportCodeSelect" onchange="onSupportCodeChange(this.value)">';
    html += '<option value="">-- ' + (currentLang === 'vi' ? 'Chọn loại hỗ trợ' : 'Select support type') + ' --</option>';
    var spKeys = Object.keys(dropMap).filter(function (id) { return dropMap[id].condition === 'Support list'; });
    spKeys.forEach(function (id) {
        var lbl = (currentLang === 'vi' ? dropMap[id].vi : dropMap[id].en) || id;
        var sel = (id === supportCode) ? ' selected' : '';
        html += '<option value="' + id + '"' + sel + '>' + lbl + '</option>';
    });
    html += '</select></div>';

    // 4. Date
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thDate || 'Date') + '</label>';
    html += '<input type="date" class="form-control form-control-sm" name="Date" value="' + escapeHtml(item.Date || '') + '">';
    html += '</div>';

    // 5. Supported by
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thSupportedBy || 'Supported By') + '</label>';
    var existOrgs = String(item['Supported by'] || '').split(',').map(function (s) { return s.trim(); });
    html += '<select class="form-select form-select-sm select2-generic" name="Supported by" multiple>';
    var orgKeys = Object.keys(dropMap).filter(function (id) { return dropMap[id].condition === 'Organization'; });
    orgKeys.forEach(function (id) {
        var lbl = (currentLang === 'vi' ? dropMap[id].vi : dropMap[id].en) || id;
        var sel = existOrgs.indexOf(id) !== -1 ? ' selected' : '';
        html += '<option value="' + id + '"' + sel + '>' + lbl + '</option>';
    });
    html += '</select></div>';

    // 6. Staff_Input
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thStaff || 'Staff') + '</label>';
    html += '<select class="form-select form-select-sm" name="Staff_Input">';
    html += '<option value="">-- ' + (currentLang === 'vi' ? 'Chọn' : 'Select') + ' --</option>';
    Object.keys(userMap).forEach(function (id) {
        var lbl = (currentLang === 'vi' ? userMap[id].vi : userMap[id].en) || id;
        var sel = (id === String(item.Staff_Input || '')) ? ' selected' : '';
        html += '<option value="' + id + '"' + sel + '>' + lbl + '</option>';
    });
    html += '</select></div>';

    // 7. A live (for tree types)
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thAlive || 'A live') + '</label>';
    html += '<input type="number" class="form-control form-control-sm" name="A live" value="' + escapeHtml(item['A live'] || '') + '" step="1" min="0">';
    html += '</div>';

    // === DYNAMIC FIELD GROUPS ===
    var cfg = SUPPORT_TYPE_FIELDS[supportCode];
    var activeGroup = cfg ? cfg.group : '';

    // Trees group
    var treesDisplay = activeGroup === 'trees' ? '' : 'display:none;';
    var existSpecies = String(item.Item_Detail || '').split(',').map(function (s) { return s.trim(); });
    html += '<div id="supportGroup_trees" class="col-12 support-dynamic-group" style="' + treesDisplay + '">';
    html += '<div class="row">';
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thTreeCount || 'Số cây') + '</label>';
    html += '<div class="input-group input-group-sm">';
    html += '<input type="number" class="form-control form-control-sm" name="Quantity" step="1" min="0" value="' + escapeHtml(activeGroup === 'trees' ? (item.Quantity || '') : '') + '">';
    html += '<span class="input-group-text" style="font-size:0.72rem;background:#f8f9fa;">' + (currentLang === 'vi' ? 'cây' : 'trees') + '</span>';
    html += '</div></div>';
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thSpeciesName || 'Tên loài cây') + '</label>';
    html += '<select class="form-select form-select-sm select2-generic" name="Item_Detail" multiple>';
    Object.keys(speciesMap).forEach(function (id) {
        var lbl = (currentLang === 'vi' ? speciesMap[id].vi : speciesMap[id].en) || id;
        var sel = (activeGroup === 'trees' && existSpecies.indexOf(id) !== -1) ? ' selected' : '';
        html += '<option value="' + id + '"' + sel + '>' + lbl + '</option>';
    });
    html += '</select></div>';
    html += '</div></div>';

    // Fertilizer group
    var fertDisplay = activeGroup === 'fertilizer' ? '' : 'display:none;';
    html += '<div id="supportGroup_fertilizer" class="col-12 support-dynamic-group" style="' + fertDisplay + '">';
    html += '<div class="row">';
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thWeight || 'Khối lượng (kg)') + '</label>';
    html += '<div class="input-group input-group-sm">';
    html += '<input type="number" class="form-control form-control-sm" name="Quantity" step="0.1" min="0" value="' + escapeHtml(activeGroup === 'fertilizer' ? (item.Quantity || '') : '') + '">';
    html += '<span class="input-group-text" style="font-size:0.72rem;background:#f8f9fa;">kg</span>';
    html += '</div></div>';
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thFertType || 'Loại phân bón') + '</label>';
    html += '<input type="text" class="form-control form-control-sm" name="Item_Detail" list="dl_fertType" value="' + escapeHtml(activeGroup === 'fertilizer' ? (item.Item_Detail || '') : '') + '">';
    html += '<datalist id="dl_fertType">';
    Object.keys(dropMap).forEach(function (id) {
        if (dropMap[id].condition === 'Fertilizer') {
            var lbl = (currentLang === 'vi' ? dropMap[id].vi : dropMap[id].en) || id;
            html += '<option value="' + escapeHtml(lbl) + '">';
        }
    });
    html += '</datalist></div>';
    html += '</div></div>';

    // Lime group
    var limeDisplay = activeGroup === 'lime' ? '' : 'display:none;';
    html += '<div id="supportGroup_lime" class="col-12 support-dynamic-group" style="' + limeDisplay + '">';
    html += '<div class="row">';
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thWeight || 'Khối lượng (kg)') + '</label>';
    html += '<div class="input-group input-group-sm">';
    html += '<input type="number" class="form-control form-control-sm" name="Quantity" step="0.1" min="0" value="' + escapeHtml(activeGroup === 'lime' ? (item.Quantity || '') : '') + '">';
    html += '<span class="input-group-text" style="font-size:0.72rem;background:#f8f9fa;">kg</span>';
    html += '</div></div>';
    html += '</div></div>';

    // Soil test group
    var soilDisplay = activeGroup === 'soiltest' ? '' : 'display:none;';
    html += '<div id="supportGroup_soiltest" class="col-12 support-dynamic-group" style="' + soilDisplay + '">';
    html += '<div class="row">';
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thNumSamples || 'Số lượng mẫu') + '</label>';
    html += '<input type="number" class="form-control form-control-sm" name="Quantity" step="1" min="0" value="' + escapeHtml(activeGroup === 'soiltest' ? (item.Quantity || '') : '') + '">';
    html += '</div>';
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thSampleDate || 'Ngày xét nghiệm') + '</label>';
    html += '<input type="date" class="form-control form-control-sm" name="Item_Detail" value="' + escapeHtml(activeGroup === 'soiltest' ? (item.Item_Detail || '') : '') + '">';
    html += '</div>';
    html += '</div></div>';

    // Training group
    var trainDisplay = activeGroup === 'training' ? '' : 'display:none;';
    html += '<div id="supportGroup_training" class="col-12 support-dynamic-group" style="' + trainDisplay + '">';
    html += '<div class="row">';
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thTrainingName || 'Tên lớp tập huấn') + '</label>';
    html += '<select class="form-select form-select-sm" name="Item_Detail">';
    html += '<option value="">-- ' + (currentLang === 'vi' ? 'Chọn lớp' : 'Select class') + ' --</option>';
    Object.keys(trainingListMap).forEach(function (id) {
        var lbl = (currentLang === 'vi' ? trainingListMap[id].vi : trainingListMap[id].en) || id;
        var sel = (activeGroup === 'training' && id === String(item.Item_Detail || '')) ? ' selected' : '';
        html += '<option value="' + id + '"' + sel + '>' + lbl + '</option>';
    });
    html += '</select></div>';
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thTrainingTime || 'Thời gian') + '</label>';
    html += '<input type="date" class="form-control form-control-sm" name="_training_time" value="">';
    html += '</div>';
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thNumParticipants || 'Số người tham gia') + '</label>';
    html += '<input type="number" class="form-control form-control-sm" name="Quantity" step="1" min="0" value="' + escapeHtml(activeGroup === 'training' ? (item.Quantity || '') : '') + '">';
    html += '</div>';
    html += '</div></div>';

    // Hidden Unit field
    html += '<input type="hidden" name="Unit" id="supportUnitHidden" value="' + escapeHtml(item.Unit || (cfg ? cfg.unit : '') || '') + '">';

    // Note
    html += '<div class="col-md-6 col-lg-4 mb-3">';
    html += '<label class="form-label-custom">' + (t.thNotes || 'Ghi chú') + '</label>';
    html += '<input type="text" class="form-control form-control-sm" name="Note" value="' + escapeHtml(item.Note || '') + '">';
    html += '</div>';

    // Warning
    html += '<div class="col-12 text-danger small fst-italic mt-2">* ' + (currentLang === 'vi' ? 'Lưu ý: Chế độ chỉnh sửa. Hãy kiểm tra kỹ trước khi Lưu.' : 'Note: Edit mode. Please verify all fields before saving.') + '</div>';

    $('#formFields').html(html);

    var editModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('editFormModal'));
    editModal.show();
}

// --- HÀM VẼ LƯỚI BẢN GHI CON (Chi tiết cho Plot/Yearly) ---
function renderChildGrid(data, type) {
    let html = '';
    const labels = FIELD_LABELS[type] || {};
    const idKey = (type === 'Plots') ? 'Plot_Id' : (type === 'Supported') ? 'Support_ID' : 'Record_Id';

    data.forEach((item, idx) => {
        html += `
            <div class="child-card-wrapper mb-4 p-3 border rounded bg-white shadow-sm position-relative">
                <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                    <div class="fw-bold text-success"><i class="fas fa-tag"></i> ${idx + 1}. ${item[idKey] || ''}</div>
                    <div class="no-print d-flex gap-2">
                        <button class="btn btn-sm btn-warning no-print" onclick="openEditForm('${type}', '${item[idKey]}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger no-print" onclick="deleteItem('${type}', '${item[idKey]}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="detail-grid-container">`;

        Object.keys(item).forEach(key => {
            if (key.startsWith('_') || key === 'Status' || key === 'Activity') return; // Skip internal/excluded
            let labelKey = labels[key];
            if (!labelKey) return; // Skip if not explicitly mapped for this view

            let label = translations[currentLang][labelKey] || labelKey;
            let val = resolveValue(key, item[key], type);

            html += `
                    <div class="detail-item">
                        <div class="field-label">${escapeHtml(label)}</div>
                        <div class="field-value">${escapeHtml(val) || '-'}</div>
                    </div>`;
        });

        html += `</div></div>`;
    });
    return html;
}

// Giữ lại hàm cũ nếu có chỗ khác gọi (nhưng trong code hiện tại chỉ thấy dùng ở showFarmerDetails)
function renderSubTable(data, columns, type) { return renderChildGrid(data, type); }

// --- CHỨC NĂNG: IN PDF (Sửa lại cho ổn định) ---
function printFarmerDetail() {
    const detailContent = document.getElementById('detailContent').innerHTML;
    const printArea = document.getElementById('printArea');

    if (printArea) {
        // Đổi tiêu đề trình duyệt tạm thời để đặt tên file PDF khi in
        const originalTitle = document.title;
        if (activePrintName) document.title = activePrintName;

        // Copy nội dung vào khu vực in riêng
        printArea.innerHTML = `
            <div class="print-header-layout">
                <div class="print-logo-col">
                    <img src="https://raw.githubusercontent.com/impactslowforest/Logo/refs/heads/main/logo.png" class="print-logo-img">
                </div>
                <div class="print-text-col">
                    <div class="print-project-name-vi">SẢN XUẤT CÀ PHÊ SINH THÁI VÀ CẢI THIỆN RỪNG TỰ NHIÊN</div>
                    <div class="print-project-name-en">PROSPEROUS FARMERS AND FORESTS PARTNERSHIP</div>
                </div>
            </div>
            <div class="print-content-body">
                ${detailContent}
            </div>
            <div id="printFooterContentInArea" class="mt-4">
                ${document.getElementById('printFooterContent').innerHTML}
            </div>
        `;

        // Gọi lệnh in
        window.print();

        // Trả lại tiêu đề cũ sau một khoảng chờ ngắn (để trình duyệt kịp nhận lệnh in)
        setTimeout(() => { document.title = originalTitle; }, 1000);
    } else {
        window.print();
    }
}

// --- PDF DOWNLOAD (using html2pdf.js) ---
function downloadPDF() {
    var detailContent = document.getElementById('detailContent');
    if (!detailContent) return;

    // Build a temporary container with print header + content + footer
    var container = document.createElement('div');
    container.style.padding = '10px';
    container.style.background = 'white';
    container.innerHTML = '<div style="text-align:center;border-bottom:2px solid #2E7D32;padding-bottom:15px;margin-bottom:15px;">' +
        '<img src="https://raw.githubusercontent.com/impactslowforest/Logo/refs/heads/main/logo.png" style="max-height:50px;margin-bottom:8px;"><br>' +
        '<div style="font-size:14pt;font-weight:bold;color:#2E7D32;">SẢN XUẤT CÀ PHÊ SINH THÁI VÀ CẢI THIỆN RỪNG TỰ NHIÊN</div>' +
        '<div style="font-size:9pt;font-style:italic;color:#444;">PROSPEROUS FARMERS AND FORESTS PARTNERSHIP</div>' +
        '</div>' +
        detailContent.innerHTML +
        '<div style="margin-top:30px;display:flex;justify-content:space-between;">' +
        '<div style="text-align:center;width:40%;"><b>Người lập biểu</b><div style="margin-top:40px;">(Ký, họ tên)</div></div>' +
        '<div style="text-align:center;width:40%;"><i>Ngày ..... tháng ..... năm 20...</i><b><br>Xác nhận của Hộ dân</b><div style="margin-top:40px;">(Ký, họ tên)</div></div>' +
        '</div>';

    // Remove no-print elements from the clone
    container.querySelectorAll('.no-print').forEach(function (el) { el.remove(); });

    var fileName = (activePrintName || 'farmer_detail') + '.pdf';

    var opt = {
        margin: [10, 8, 10, 8],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(container).save();
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

    var mapping = TABLE_MAP[type];
    if (!mapping) { showError('Unknown type: ' + type); return; }

    // Capture farmer ID for auto-recalc before deletion removes the record
    var recalcFarmerId = null;
    var recalcYear = null;
    if (type === 'Plots') {
        var delPlot = (rawData.plots || []).find(function (p) { return p.Plot_Id === id; });
        if (delPlot) recalcFarmerId = delPlot.Farmer_ID;
    } else if (type === 'Supported') {
        var delSup = (rawData.supported || []).find(function (s) { return s.Support_ID === id; });
        if (delSup) { recalcFarmerId = delSup['Farmer ID'] || delSup.Farmer_ID; recalcYear = delSup['Supported year']; }
    }

    if (navigator.onLine) {
        supabaseClient.from(mapping.table).delete().eq(mapping.idCol, id)
            .then(function (res) {
                $('#loading').fadeOut();
                if (res.error) {
                    showError(res.error.message);
                } else {
                    if (typeof PFFP_DB !== 'undefined') {
                        PFFP_DB.deleteFromLocal(mapping.table, id).catch(function () {});
                    }
                    // Auto-recalc triggers
                    if (type === 'Plots' && recalcFarmerId) recalcFarmerTotalArea(recalcFarmerId);
                    if (type === 'Supported' && recalcFarmerId && recalcYear) recalcYearlyForFarmer(recalcFarmerId, recalcYear);
                    // Navigate back in Data Browser if deleting viewed item
                    if (dbState.type && dbState.farmerId && type === 'Farmers') {
                        dbState.farmerId = null;
                    }
                    refreshData();
                    showToast(translations[currentLang].deleteSuccess);
                }
            })
            .catch(function (err) { $('#loading').fadeOut(); showError(err); });
    } else {
        // Offline: delete locally and queue for sync
        if (typeof PFFP_DB !== 'undefined') {
            PFFP_DB.deleteFromLocal(mapping.table, id).then(function () {
                return PFFP_DB.addToSyncQueue({ table: mapping.table, action: 'delete', idCol: mapping.idCol, id: id });
            }).then(function () {
                $('#loading').fadeOut();
                if (dbState.type && dbState.farmerId && type === 'Farmers') {
                    dbState.farmerId = null;
                }
                showToast(translations[currentLang].deleteSuccess);
                updateSyncPendingCount();
                refreshData();
            }).catch(function (err) { $('#loading').fadeOut(); showError(err); });
        }
    }
}

// Giữ lại tên cũ để đảm bảo tương thích nếu có chỗ gọi trực tiếp
async function deleteFarmer(id) { deleteItem('Farmers', id); }

// --- HELPER: TẠO Ô NHẬP LIỆU THÔNG MINH (CHO EDIT FORM) ---
// PK/FK fields - NEVER editable
var READONLY_KEYS = ['Farmer_ID', 'Plot_Id', 'Record_Id', 'Support_ID', 'OP6 ID', 'Species_ID', 'Adm_ID', 'Train_ID'];

// Yearly_Data field type configurations
var YEARLY_NUMERIC_FIELDS = {
    'Annual_Volume_Cherry': 'Tấn',
    'Volume_High_Quality': 'Tấn',
    'Fertilizer volume': 'Tấn/ha',
    'Pesticides volume': 'Lít/Kg/ha',
    'Herbicides volume': 'Lít/Kg/ha',
    'Cherry sales supplied to Slow': 'Tấn'
};

var YEARLY_MONEY_FIELDS = {
    'Total_Coffee_Income': true,
    'Fertilizer cost': true,
    'Pesticides cost': true,
    'Herbicides cost': true,
    'Hired_Labor_Costs': true,
    'Other_Costs': true,
    'Revenue from cherry sales to Slow (VND)': true
};

// Combobox fields: allow both dropdown selection and free text
var YEARLY_COMBOBOX_FIELDS = ['Name of Pesticides', 'Name of Herbicides'];

function formatVndText(val) {
    var num = parseFloat(val);
    if (isNaN(num) || num === 0) return '';
    // num is in triệu đồng, convert to full VND
    var fullVnd = Math.round(num * 1000000);
    var formatted = fullVnd.toLocaleString('vi-VN');
    return formatted + ' đồng';
}

function updateVndText(inputEl) {
    var targetId = inputEl.getAttribute('data-vnd-target');
    var target = document.getElementById(targetId);
    if (target) {
        target.textContent = formatVndText(inputEl.value);
    }
}

// --- LOCATION HELPERS (Plots) ---
function updateLocationField() {
    var lat = $('input[name="_lat"]').val() || '';
    var lng = $('input[name="_lng"]').val() || '';
    var combined = '';
    if (lat && lng) combined = lat + ', ' + lng;
    else if (lat) combined = lat;
    $('input[name="Location"]').val(combined);
}

// --- COFFEE DENSITY TOTAL CALCULATION ---
function calcCoffeeTotal() {
    var el = document.getElementById('coffeeTotalCalc');
    if (!el) return;
    var density = parseFloat($('input[name="Num_Coffee_Trees"]').val()) || 0;
    var area = parseFloat($('input[name="Area (ha)"]').val()) || 0;
    if (density > 0 && area > 0) {
        var total = Math.round(density * area);
        el.textContent = (currentLang === 'vi' ? '= ' + total.toLocaleString() + ' cây trên lô này' : '= ' + total.toLocaleString() + ' trees on this plot');
    } else {
        el.textContent = '';
    }
}

function openMapPicker() {
    var lat = parseFloat($('input[name="_lat"]').val()) || 16.3;
    var lng = parseFloat($('input[name="_lng"]').val()) || 106.9;

    // Create map modal
    var mapHtml = '<div id="mapPickerOverlay" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">';
    mapHtml += '<div style="background:#fff;border-radius:12px;width:90%;max-width:600px;max-height:90vh;overflow:hidden;">';
    mapHtml += '<div class="d-flex justify-content-between align-items-center p-2 border-bottom">';
    mapHtml += '<span class="fw-bold" style="font-size:0.85rem;"><i class="fas fa-map-marker-alt text-success me-1"></i>' + (currentLang === 'vi' ? 'Chọn vị trí trên bản đồ' : 'Pick location on map') + '</span>';
    mapHtml += '<button class="btn btn-sm btn-outline-secondary" onclick="closeMapPicker()"><i class="fas fa-times"></i></button>';
    mapHtml += '</div>';
    mapHtml += '<div id="mapPickerContainer" style="height:400px;"></div>';
    mapHtml += '<div class="p-2 border-top d-flex justify-content-between align-items-center">';
    mapHtml += '<small id="mapPickerCoords" class="text-muted">' + lat.toFixed(7) + ', ' + lng.toFixed(7) + '</small>';
    mapHtml += '<button class="btn btn-sm btn-success" onclick="confirmMapPicker()"><i class="fas fa-check me-1"></i>' + (currentLang === 'vi' ? 'Xác nhận' : 'Confirm') + '</button>';
    mapHtml += '</div></div></div>';

    $('body').append(mapHtml);

    // Load Leaflet if not loaded
    if (typeof L === 'undefined') {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        var script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = function () { initMapPicker(lat, lng); };
        document.head.appendChild(script);
    } else {
        setTimeout(function () { initMapPicker(lat, lng); }, 100);
    }
}

var _mapPickerInstance = null;
var _mapPickerMarker = null;
var _mapPickerLatLng = null;

function initMapPicker(lat, lng) {
    _mapPickerLatLng = { lat: lat, lng: lng };
    _mapPickerInstance = L.map('mapPickerContainer').setView([lat, lng], 15);

    // Base layers
    var osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
    });
    var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri',
        maxZoom: 19
    });

    // Default to satellite
    satelliteLayer.addTo(_mapPickerInstance);

    // Layer control
    L.control.layers({
        'Vệ tinh / Satellite': satelliteLayer,
        'Bản đồ / Map': osmLayer
    }, null, { position: 'topright', collapsed: false }).addTo(_mapPickerInstance);

    _mapPickerMarker = L.marker([lat, lng], { draggable: true }).addTo(_mapPickerInstance);

    // Click on map to move marker
    _mapPickerInstance.on('click', function (e) {
        _mapPickerMarker.setLatLng(e.latlng);
        _mapPickerLatLng = { lat: e.latlng.lat, lng: e.latlng.lng };
        document.getElementById('mapPickerCoords').textContent = e.latlng.lat.toFixed(7) + ', ' + e.latlng.lng.toFixed(7);
    });

    // Drag marker
    _mapPickerMarker.on('dragend', function (e) {
        var pos = _mapPickerMarker.getLatLng();
        _mapPickerLatLng = { lat: pos.lat, lng: pos.lng };
        document.getElementById('mapPickerCoords').textContent = pos.lat.toFixed(7) + ', ' + pos.lng.toFixed(7);
    });
}

function confirmMapPicker() {
    if (_mapPickerLatLng) {
        $('input[name="_lat"]').val(_mapPickerLatLng.lat.toFixed(7));
        $('input[name="_lng"]').val(_mapPickerLatLng.lng.toFixed(7));
        updateLocationField();
    }
    closeMapPicker();
}

function closeMapPicker() {
    if (_mapPickerInstance) {
        _mapPickerInstance.remove();
        _mapPickerInstance = null;
    }
    $('#mapPickerOverlay').remove();
}

function generateInputField(key, value, type) {
    const mapping = FIELD_MAPPING[type] ? FIELD_MAPPING[type][key] : null;
    let labelKey = FIELD_LABELS[type][key] || key;
    let label = translations[currentLang][labelKey] || labelKey;
    let html = `<div class="col-md-6 col-lg-4 mb-3">
                    <label class="form-label-custom">${label}</label>`;

    // PK/FK fields: always readonly (use readonly, not disabled, so value is submitted)
    if (READONLY_KEYS.indexOf(key) !== -1) {
        html += `<input type="text" class="form-control form-control-sm bg-light text-muted" name="${key}" value="${escapeHtml(value || '')}" readonly tabindex="-1" style="pointer-events:none;">`;
        html += `</div>`;
        return html;
    }

    // Species type: FRU, TIM, OTH dropdown with onchange to regenerate Species_ID
    if (type === 'Species' && key === 'Species type') {
        var speciesTypes = [
            { code: 'FRU', vi: 'Cây ăn quả', en: 'Fruit tree' },
            { code: 'TIM', vi: 'Cây che bóng lấy gỗ', en: 'Timber shade tree' },
            { code: 'OTH', vi: 'Loài cây khác', en: 'Other tree' }
        ];
        html += '<select class="form-select form-select-sm" name="' + key + '" onchange="onSpeciesTypeChange(this)">';
        html += '<option value="">-- ' + (currentLang === 'vi' ? 'Chọn loại' : 'Select type') + ' --</option>';
        speciesTypes.forEach(function (st) {
            var lbl = (currentLang === 'vi' ? st.vi : st.en) + ' (' + st.code + ')';
            var sel = (String(value || '').toUpperCase() === st.code) ? ' selected' : '';
            html += '<option value="' + st.code + '"' + sel + '>' + lbl + '</option>';
        });
        html += '</select></div>';
        return html;
    }

    // OP6 date fields
    if (type === 'Op6' && (key === 'From date' || key === 'To date')) {
        html += '<input type="date" class="form-control form-control-sm" name="' + key + '" value="' + escapeHtml(value || '') + '">';
        html += '</div>';
        return html;
    }

    // Commune_Name: always "Hướng Phùng" (readonly)
    if (key === 'Commune_Name') {
        html += `<input type="text" class="form-control form-control-sm bg-light" name="${key}" value="Hướng Phùng" readonly tabindex="-1" style="pointer-events:none;">`;
        html += `</div>`;
        return html;
    }

    // Auto-calculated fields for Yearly_Data (from Supported table) - readonly
    if (type === 'Yearly_Data' && YEARLY_SUPPORT_FIELDS.indexOf(key) !== -1) {
        var autoLabel = currentLang === 'vi' ? '(Tự động)' : '(Auto)';
        html += `<input type="text" class="form-control form-control-sm db-auto-field" name="${key}" value="${escapeHtml(value || '')}" readonly tabindex="-1">`;
        html += `<small class="db-auto-label">${autoLabel}</small>`;
        html += `</div>`;
        return html;
    }

    // Yearly_Data: Date field → type="date" with default today
    if (type === 'Yearly_Data' && key === 'Date') {
        var dateVal = value || '';
        if (!dateVal) {
            var d = new Date();
            dateVal = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }
        html += `<input type="date" class="form-control form-control-sm" name="${key}" value="${escapeHtml(dateVal)}">`;
        html += `</div>`;
        return html;
    }

    // Yearly_Data: Numeric fields with unit label
    if (type === 'Yearly_Data' && YEARLY_NUMERIC_FIELDS[key]) {
        var unit = YEARLY_NUMERIC_FIELDS[key];
        html += `<div class="input-group input-group-sm">`;
        html += `<input type="number" class="form-control form-control-sm" name="${key}" value="${escapeHtml(value || '')}" step="0.01" min="0">`;
        html += `<span class="input-group-text" style="font-size:0.72rem;background:#f8f9fa;">${unit}</span>`;
        html += `</div></div>`;
        return html;
    }

    // Yearly_Data: Money fields (triệu đồng) with auto text conversion
    if (type === 'Yearly_Data' && YEARLY_MONEY_FIELDS[key]) {
        var safeKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
        var textVal = formatVndText(value);
        html += `<div class="input-group input-group-sm">`;
        html += `<input type="number" class="form-control form-control-sm yearly-money-input" name="${key}" value="${escapeHtml(value || '')}" step="0.01" min="0" data-vnd-target="vnd_${safeKey}" oninput="updateVndText(this)">`;
        html += `<span class="input-group-text" style="font-size:0.72rem;background:#f8f9fa;">Tr.đ</span>`;
        html += `</div>`;
        html += `<small id="vnd_${safeKey}" class="vnd-text-display">${textVal}</small>`;
        html += `</div>`;
        return html;
    }

    // Yearly_Data: Combobox fields (dropdown + free text via datalist)
    if (type === 'Yearly_Data' && YEARLY_COMBOBOX_FIELDS.indexOf(key) !== -1) {
        var comboMapping = FIELD_MAPPING['Yearly_Data'] ? FIELD_MAPPING['Yearly_Data'][key] : null;
        var listId = 'dl_' + key.replace(/[^a-zA-Z0-9]/g, '_');
        html += `<input type="text" class="form-control form-control-sm" name="${key}" value="${escapeHtml(value || '')}" list="${listId}" placeholder="${currentLang === 'vi' ? 'Chọn hoặc nhập tên...' : 'Select or type name...'}">`;
        html += `<datalist id="${listId}">`;
        if (comboMapping && dropMap) {
            var condition = comboMapping.condition;
            Object.keys(dropMap).forEach(function (id) {
                if (dropMap[id].condition === condition) {
                    var lbl = (currentLang === 'vi' ? dropMap[id].vi : dropMap[id].en) || id;
                    html += `<option value="${escapeHtml(lbl)}">`;
                }
            });
        }
        html += `</datalist>`;
        html += `</div>`;
        return html;
    }

    // 1. Kiểm tra Mapping (Enum / EnumList)
    if (mapping) {
        let mapName = (typeof mapping === 'string') ? mapping : mapping.map;
        let isMulti = (typeof mapping === 'object' && mapping.separator);
        let mapObj = null;

        if (mapName === 'admin') mapObj = adminMap;
        else if (mapName === 'drop') mapObj = dropMap;
        else if (mapName === 'species') mapObj = speciesMap;
        else if (mapName === 'user') mapObj = userMap;
        else if (mapName === 'trainingList') mapObj = trainingListMap;
        else if (mapName === 'farmers') mapObj = farmersMap;
        else if (mapName === 'plots') mapObj = plotsMap;

        if (mapObj) {
            // Render Dropdown / Multiselect
            html += `<select class="form-select form-select-sm select2-generic" name="${key}" ${isMulti ? 'multiple' : ''}>`;
            if (!isMulti) html += `<option value="">-- Chọn --</option>`;

            let selectedVals = isMulti ? String(value || '').split(mapping.separator).map(s => s.trim()) : [String(value || '').trim()];

            // --- LỌC THEO CONDITION (NẾU CÓ) ---
            let keys = Object.keys(mapObj);
            if (mapping.condition) {
                keys = keys.filter(id => {
                    const item = mapObj[id];
                    // Kiểm tra condition trong object của map (adminMap, dropMap thường có condition)
                    return item && item.condition === mapping.condition;
                });
            }

            keys.forEach(id => {
                let lbl = (currentLang === 'vi' ? mapObj[id].vi : mapObj[id].en) || id;
                let isSelected = selectedVals.includes(id) ? 'selected' : '';
                html += `<option value="${id}" ${isSelected}>${lbl}</option>`;
            });

            html += `</select>`;
            html += `</div>`;
            return html;
        }
    }

    // 2. Special field handling for Farmers
    if (type === 'Farmers') {
        // Number Farm registered for support from - numeric input
        if (key === 'Number Farm registered for support from') {
            html += `<input type="number" class="form-control form-control-sm" name="${key}" value="${escapeHtml(value || '')}" min="0" step="1">`;
            html += `</div>`;
            return html;
        }
        // ID card (CCCD): exactly 12 digits
        if (key === 'ID card') {
            html += `<input type="text" class="form-control form-control-sm" name="${key}" value="${escapeHtml(value || '')}" pattern="[0-9]{12}" maxlength="12" inputmode="numeric" title="CCCD phải là 12 chữ số / ID card must be 12 digits">`;
            html += `</div>`;
            return html;
        }
        // Phone: 10 digits, starts with 0
        if (key === 'Phone_Number') {
            html += `<input type="text" class="form-control form-control-sm" name="${key}" value="${escapeHtml(value || '')}" pattern="0[0-9]{9}" maxlength="10" inputmode="numeric" title="SĐT phải là 10 số, bắt đầu bằng 0 / Phone must be 10 digits starting with 0">`;
            html += `</div>`;
            return html;
        }
        // Year of Birth: number between 1940 and 2015
        if (key === 'Year_Of_Birth') {
            html += `<input type="number" class="form-control form-control-sm" name="${key}" value="${escapeHtml(value || '')}" min="1940" max="2015" inputmode="numeric" title="Năm sinh từ 1940 đến 2015 / Year of birth between 1940 and 2015">`;
            html += `</div>`;
            return html;
        }
    }

    // 2b. Special field handling for Plots
    if (type === 'Plots') {
        // Area (ha): number only
        if (key === 'Area (ha)') {
            html += `<div class="input-group input-group-sm">`;
            html += `<input type="number" class="form-control form-control-sm" name="${key}" value="${escapeHtml(value || '')}" step="0.01" min="0" inputmode="decimal" oninput="calcCoffeeTotal()">`;
            html += `<span class="input-group-text" style="font-size:0.72rem;background:#f8f9fa;">ha</span>`;
            html += `</div></div>`;
            return html;
        }
        // Location: Lat, Long inputs + map button
        if (key === 'Location') {
            var latVal = '', lngVal = '';
            if (value) {
                var parts = String(value).split(',').map(function (s) { return s.trim(); });
                if (parts.length >= 2) { latVal = parts[0]; lngVal = parts[1]; }
                else { latVal = value; }
            }
            html += `<div class="d-flex gap-1 align-items-center">`;
            html += `<input type="number" class="form-control form-control-sm" name="_lat" value="${escapeHtml(latVal)}" step="0.0000001" placeholder="Lat" style="width:45%;" inputmode="decimal" onchange="updateLocationField()">`;
            html += `<input type="number" class="form-control form-control-sm" name="_lng" value="${escapeHtml(lngVal)}" step="0.0000001" placeholder="Long" style="width:45%;" inputmode="decimal" onchange="updateLocationField()">`;
            html += `<button type="button" class="btn btn-sm btn-outline-success" onclick="openMapPicker()" title="${currentLang === 'vi' ? 'Chọn trên bản đồ' : 'Pick on map'}"><i class="fas fa-map-marker-alt"></i></button>`;
            html += `</div>`;
            html += `<input type="hidden" name="${key}" value="${escapeHtml(value || '')}">`;
            html += `</div>`;
            return html;
        }
        // Num_Shade_Trees_Before: integer, unit = cây/trees
        if (key === 'Num_Shade_Trees_Before') {
            html += `<div class="input-group input-group-sm">`;
            html += `<input type="number" class="form-control form-control-sm" name="${key}" value="${escapeHtml(value || '')}" step="1" min="0" inputmode="numeric">`;
            html += `<span class="input-group-text" style="font-size:0.72rem;background:#f8f9fa;">${currentLang === 'vi' ? 'cây' : 'trees'}</span>`;
            html += `</div></div>`;
            return html;
        }
        // Num_Coffee_Trees: density, unit = cây/ha + total calculation
        if (key === 'Num_Coffee_Trees') {
            html += `<div class="input-group input-group-sm">`;
            html += `<input type="number" class="form-control form-control-sm" name="${key}" value="${escapeHtml(value || '')}" step="1" min="0" inputmode="numeric" oninput="calcCoffeeTotal()">`;
            html += `<span class="input-group-text" style="font-size:0.72rem;background:#f8f9fa;">${currentLang === 'vi' ? 'cây/ha' : 'trees/ha'}</span>`;
            html += `</div>`;
            html += `<small id="coffeeTotalCalc" class="text-danger fw-bold" style="font-size:0.75rem;"></small>`;
            html += `</div>`;
            return html;
        }
        // Number of shade trees: integer
        if (key === 'Number of shade trees') {
            html += `<div class="input-group input-group-sm">`;
            html += `<input type="number" class="form-control form-control-sm" name="${key}" value="${escapeHtml(value || '')}" step="1" min="0" inputmode="numeric">`;
            html += `<span class="input-group-text" style="font-size:0.72rem;background:#f8f9fa;">${currentLang === 'vi' ? 'cây' : 'trees'}</span>`;
            html += `</div></div>`;
            return html;
        }
        // Number of shade tree species: integer
        if (key === 'Number of shade tree species') {
            html += `<input type="number" class="form-control form-control-sm" name="${key}" value="${escapeHtml(value || '')}" step="1" min="0" inputmode="numeric">`;
            html += `</div>`;
            return html;
        }
    }

    // 3. Mặc định là Text input
    html += `<input type="text" class="form-control form-control-sm" name="${key}" value="${escapeHtml(value || '')}">`;
    html += `</div>`;
    return html;
}

// --- CHỨC NĂNG: SỬA CHUNG (Full Fields) ---
function openEditForm(type, id) {
    // Đóng modal chi tiết
    const detailModal = bootstrap.Modal.getInstance(document.getElementById('farmerDetailModal'));
    if (detailModal) detailModal.hide();

    let dataList, idKey;
    if (type === 'Farmers') { dataList = rawData.farmers; idKey = 'Farmer_ID'; }
    else if (type === 'Plots') { dataList = rawData.plots; idKey = 'Plot_Id'; }
    else if (type === 'Supported') { dataList = rawData.supported || []; idKey = 'Support_ID'; }
    else if (type === 'Op6') { dataList = rawData.op6 || []; idKey = 'OP6 ID'; }
    else if (type === 'Species') { dataList = rawData.species || []; idKey = 'Species_ID'; }
    else if (type === 'Admin') { dataList = rawData.admin || []; idKey = 'Adm_ID'; }
    else if (type === 'Training') { dataList = rawData.trainingList || []; idKey = 'Train_ID'; }
    else { dataList = rawData.yearly; idKey = 'Record_Id'; }
    let item = dataList.find(i => String(i[idKey]) === String(id));
    if (!item) return;

    // For Supported: use specialized edit form with dynamic fields
    if (type === 'Supported') {
        openEditSupportedForm(item);
        return;
    }

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
        fieldsHtml += generateInputField(key, item[key], type);
    });

    // Thêm cảnh báo
    fieldsHtml += `<div class="col-12 text-danger small fst-italic mt-2">* Lưu ý: Chế độ chỉnh sửa toàn bộ. Hãy kiểm tra kỹ tất cả các trường trước khi Lưu.</div>`;

    $('#formFields').html(fieldsHtml);

    // For Yearly_Data: recalculate auto-fields from Supported and update form
    if (type === 'Yearly_Data' && item.Farmer_ID && item.Year) {
        var calcData = calcYearlyFromSupported(item.Farmer_ID, item.Year);
        if (calcData) {
            YEARLY_SUPPORT_FIELDS.forEach(function (fk) {
                var input = $('[name="' + fk + '"]');
                if (input.length && calcData[fk] !== undefined) {
                    input.val(String(calcData[fk]));
                }
            });
        }
    }

    // Store library type for re-open after save
    var libTypeMap = { 'Op6': 'op6', 'Species': 'species', 'Admin': 'admin', 'Training': 'training' };
    if (libTypeMap[type]) $('#formFields').data('libraryListType', libTypeMap[type]);

    const editModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('editFormModal'));
    editModal.show();
}

function editFarmer(id) { openEditForm('Farmers', id); }
function editPlot(id) { openEditForm('Plots', id); }
function editYearly(id) { openEditForm('Yearly_Data', id); }

// --- THÊM HỘ DÂN MỚI ---
function showAddFarmerModal() {
    showAddModal({
        type: 'Farmers',
        title: currentLang === 'vi' ? 'Thêm Hộ Dân Mới' : 'Add New Farmer',
        autoGenId: { fieldName: 'Farmer_ID', inputId: 'addFarmerIdField', placeholder: currentLang === 'vi' ? 'Tự động sinh khi chọn Thôn và Năm' : 'Auto-generated from Village & Year' },
        helperText: currentLang === 'vi' ? 'Mã Nông Hộ = Mã thôn + Năm + STT. VD: DDO5005' : 'Farmer ID = Village code + Year digit + Seq. E.g.: DDO5005',
        afterRender: function () {
            function tryGenFarmerId() {
                var villageCode = $('select[name="Village_Name"]').val();
                var year = $('select[name="Participation Year"]').val();
                if (villageCode && year) {
                    $('#addFarmerIdField').val(generateNextFarmerId(villageCode, year));
                } else {
                    $('#addFarmerIdField').val('');
                }
            }
            $('select[name="Village_Name"]').off('change.autoid').on('change.autoid', tryGenFarmerId);
            $('select[name="Participation Year"]').off('change.autoid').on('change.autoid', tryGenFarmerId);
            // Defaults: Status = Active, Activity = Not yet
            $('select[name="Status"]').val('Act');
            $('select[name="Activity"]').val('NY');
            // Default: Staff input = current logged-in user
            if (currentUser) {
                var staffId = currentUser['Staff ID'] || '';
                $('select[name="Staff input"]').val(staffId);
            }
        }
    });
}

// --- THÊM DỮ LIỆU HÀNG NĂM MỚI ---
function showAddYearlyModal(farmerId) {
    var farmer = (rawData.farmers || []).find(function (f) { return String(f.Farmer_ID) === String(farmerId); });
    var farmerName = farmer ? farmer.Full_Name : farmerId;
    showAddModal({
        type: 'Yearly_Data',
        title: (currentLang === 'vi' ? 'Thêm Dữ Liệu Năm Mới - ' : 'Add New Yearly Data - ') + farmerName,
        parentFields: [{ name: 'Farmer_ID', label: translations[currentLang]['thFarmerID'] || 'Mã Nông Hộ', value: farmerId }],
        autoGenId: { fieldName: 'Record_Id', inputId: 'addRecordIdField', placeholder: currentLang === 'vi' ? 'Tự động sinh khi chọn Năm' : 'Auto-generated when selecting Year' },
        helperText: currentLang === 'vi' ? 'Record ID sẽ tự động sinh khi bạn chọn Năm. Format: ' + farmerId + '-{Năm}' : 'Record ID will be auto-generated when you select a Year. Format: ' + farmerId + '-{Year}',
        afterRender: function () {
            // Default Year to 2025 (find matching option code)
            var yearSelect = $('select[name="Year"]');
            if (yearSelect.length) {
                var defaultYear = '2025';
                // Try to find option with value '2025' or containing '2025'
                var found = yearSelect.find('option[value="2025"]');
                if (found.length) {
                    yearSelect.val('2025');
                } else {
                    // Try matching any option that starts with 25 or contains 2025
                    yearSelect.find('option').each(function () {
                        var v = $(this).val();
                        if (v === '25Y' || v === '2025') {
                            yearSelect.val(v);
                            defaultYear = v;
                            return false;
                        }
                    });
                }
                // Trigger auto-gen if year was set
                if (yearSelect.val()) {
                    setTimeout(function () { yearSelect.trigger('change.autoid'); }, 100);
                }
            }

            // Default Date to today
            var dateInput = $('input[name="Date"]');
            if (dateInput.length && !dateInput.val()) {
                var d = new Date();
                var today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                dateInput.val(today);
            }

            $('select[name="Year"]').off('change.autoid').on('change.autoid', function () {
                var year = $(this).val();
                if (year) {
                    if (checkDuplicateYearlyRecord(farmerId, year)) {
                        alert(currentLang === 'vi' ? 'Đã có dữ liệu năm ' + year + ' cho hộ ' + farmerId + '. Vui lòng chọn năm khác hoặc sửa bản ghi hiện có.' : 'Yearly data for ' + year + ' already exists for ' + farmerId + '. Please select another year or edit the existing record.');
                        $(this).val(''); $('#addRecordIdField').val(''); return;
                    }
                    $('#addRecordIdField').val(generateRecordId(farmerId, year));
                    // Auto-fill support fields from Supported table
                    var calcData = calcYearlyFromSupported(farmerId, year);
                    if (calcData) {
                        YEARLY_SUPPORT_FIELDS.forEach(function (fk) {
                            var input = $('[name="' + fk + '"]');
                            if (input.length && calcData[fk] !== undefined) {
                                input.val(String(calcData[fk]));
                            }
                        });
                    }
                } else { $('#addRecordIdField').val(''); }
            });
        }
    });
}

// --- THÊM LÔ ĐẤT MỚI ---
function generateNextPlotId(farmerId) {
    if (!farmerId || !rawData.plots) return farmerId + '-01';
    var escapedFid = farmerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match both old format (FID-P01) and new format (FID-01)
    var regex = new RegExp('^' + escapedFid + '-P?(\\d+)$', 'i');
    var maxNum = 0;
    rawData.plots.forEach(function (p) {
        var pid = String(p.Plot_Id || '').trim();
        var match = pid.match(regex);
        if (match) {
            var num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
        }
    });
    var nextNum = maxNum + 1;
    return farmerId + '-' + String(nextNum).padStart(2, '0');
}

function showAddPlotModal(farmerId) {
    var farmer = (rawData.farmers || []).find(function (f) { return String(f.Farmer_ID) === String(farmerId); });
    var farmerName = farmer ? farmer.Full_Name : farmerId;
    var nextPlotId = generateNextPlotId(farmerId);
    // Default village from farmer's Village_Name
    var villageCode = farmer ? (farmer.Village_Name || '') : '';
    showAddModal({
        type: 'Plots',
        title: (currentLang === 'vi' ? 'Thêm Lô Đất Mới - ' : 'Add New Plot - ') + farmerName,
        parentFields: [{ name: 'Farmer_ID', label: translations[currentLang]['thFarmerID'] || 'Mã Nông Hộ', value: farmerId }],
        autoGenId: { fieldName: 'Plot_Id', inputId: 'addPlotIdField', value: nextPlotId },
        defaults: {
            'Land use rights certificate?': 'Y',
            'Border_Natural_Forest': 'N',
            'Place name': villageCode
        },
        helperText: currentLang === 'vi' ? 'Mã lô đất tự động sinh: ' + nextPlotId : 'Plot ID auto-generated: ' + nextPlotId
    });
}

// --- HÀM LƯU DỮ LIỆU (Hỗ trợ cả Add + Edit) ---
function saveData() {
    var formType = $('#formType').val();
    var formId = $('#formId').val(); // Rỗng = Add, có giá trị = Edit
    var isAddMode = !formId;

    var formData = {};

    // Lấy dữ liệu từ các ô input và select
    $('#genericForm input, #genericForm select').each(function () {
        var name = $(this).attr('name');
        if (name && name.charAt(0) !== '_') {  // Skip temp fields like _lat, _lng
            // For Supported: skip fields inside hidden dynamic groups
            if (formType === 'Supported' && $(this).closest('.support-dynamic-group').length && $(this).closest('.support-dynamic-group').css('display') === 'none') return;
            if ($(this).is('select') && $(this).prop('multiple')) {
                var vals = $(this).val() || [];
                formData[name] = vals.join(', ');
            } else {
                formData[name] = $(this).val();
            }
        }
    });

    // --- Validate: ALL visible fields must not be empty ---
    var hasEmptyFields = false;
    // Clear previous validation errors
    $('#genericForm .field-error-msg').remove();
    $('#genericForm .is-invalid').removeClass('is-invalid');

    $('#genericForm input[name], #genericForm select[name]').each(function () {
        var el = $(this);
        // Skip hidden inputs (formType, formId, parent readonly fields)
        if (el.attr('type') === 'hidden') return;
        if (el.prop('readonly') || el.prop('disabled')) return;
        // Skip temp fields (e.g., _lat, _lng)
        var fieldName = el.attr('name') || '';
        if (fieldName.charAt(0) === '_') return;
        // For Plots: numeric and optional fields are not required
        if (formType === 'Plots') {
            var plotOptional = ['Notes for details (Optional)', 'Map Sheet', 'Sub-mapsheet', 'Location',
                'Num_Shade_Trees_Before', 'Number of shade trees', 'Number of shade tree species', 'Num_Coffee_Trees'];
            if (plotOptional.indexOf(fieldName) !== -1) return;
        }
        // For Yearly_Data: numeric and money fields are optional (may not apply to all farmers)
        if (formType === 'Yearly_Data') {
            var fname = el.attr('name') || '';
            if (YEARLY_NUMERIC_FIELDS[fname] || YEARLY_MONEY_FIELDS[fname] || YEARLY_COMBOBOX_FIELDS.indexOf(fname) !== -1) return;
        }
        // For Supported: skip fields inside hidden dynamic groups + optional Note
        if (formType === 'Supported') {
            if (fieldName === 'Note') return;
            // Skip fields in hidden dynamic groups
            if (el.closest('.support-dynamic-group').length && el.closest('.support-dynamic-group').css('display') === 'none') return;
        }
        // Check for empty value
        var val = '';
        if (el.is('select') && el.prop('multiple')) {
            val = (el.val() || []).join('');
        } else {
            val = (el.val() || '').trim();
        }
        if (val === '') {
            hasEmptyFields = true;
            el.addClass('is-invalid');
            var fieldName = el.attr('name') || '';
            var errMsg = currentLang === 'vi' ? 'Không được để trống' : 'This field is required';
            el.after('<div class="field-error-msg text-danger" style="font-size:0.72rem;margin-top:2px;"><i class="fas fa-exclamation-circle"></i> ' + errMsg + '</div>');
        }
    });

    if (hasEmptyFields) {
        // Scroll to first error
        var firstError = $('#genericForm .is-invalid').first();
        if (firstError.length) {
            firstError[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstError.focus();
        }
        return;
    }

    // Đảm bảo ID field có giá trị đúng
    if (formType === 'Farmers') {
        formData['Commune_Name'] = 'Hướng Phùng'; // Always fixed
        if (isAddMode) {
            // Add mode: lấy Farmer_ID từ form field auto-gen
            if (!formData['Farmer_ID']) {
                alert(currentLang === 'vi' ? 'Vui lòng chọn Nhóm hộ để sinh Mã Nông Hộ.' : 'Please select a Farmer Group to generate Farmer ID.');
                return;
            }
        } else {
            formData['Farmer_ID'] = formId;
        }
        // Validate ID card (CCCD): exactly 12 digits
        var idCard = (formData['ID card'] || '').trim();
        if (idCard && !/^\d{12}$/.test(idCard)) {
            alert(currentLang === 'vi' ? 'CCCD phải là 12 chữ số.' : 'ID card must be exactly 12 digits.');
            return;
        }
        // Validate Phone: 10 digits, starts with 0
        var phone = (formData['Phone_Number'] || '').trim();
        if (phone && !/^0\d{9}$/.test(phone)) {
            alert(currentLang === 'vi' ? 'Số điện thoại phải là 10 chữ số, bắt đầu bằng 0.' : 'Phone must be 10 digits starting with 0.');
            return;
        }
        // Validate Year of Birth: between 1940 and 2015
        var yob = formData['Year_Of_Birth'];
        if (yob && yob !== '') {
            var yobNum = parseInt(yob, 10);
            if (isNaN(yobNum) || yobNum < 1940 || yobNum > 2015) {
                alert(currentLang === 'vi' ? 'Năm sinh phải từ 1940 đến 2015.' : 'Year of birth must be between 1940 and 2015.');
                return;
            }
        }
    } else if (formType === 'Plots') {
        if (isAddMode) {
            if (!formData['Plot_Id']) {
                alert(currentLang === 'vi' ? 'Thiếu Mã Lô Đất.' : 'Missing Plot ID.');
                return;
            }
            if (!formData['Farmer_ID']) {
                alert(currentLang === 'vi' ? 'Thiếu Mã Nông Hộ.' : 'Missing Farmer ID.');
                return;
            }
        } else {
            formData['Plot_Id'] = formId;
        }
    } else if (formType === 'Yearly_Data') {
        if (isAddMode) {
            // Add mode: Record_Id từ auto-gen field
            if (!formData['Record_Id']) {
                alert(currentLang === 'vi' ? 'Vui lòng chọn Năm để sinh Record ID.' : 'Please select a Year to generate Record ID.');
                return;
            }
            // Đảm bảo Farmer_ID được set
            if (!formData['Farmer_ID']) {
                alert(currentLang === 'vi' ? 'Thiếu Mã Nông Hộ.' : 'Missing Farmer ID.');
                return;
            }
        } else {
            formData['Record_Id'] = formId;
        }
        // Merge auto-calculated support fields
        if (formData['Farmer_ID'] && formData['Year']) {
            var calcData = calcYearlyFromSupported(formData['Farmer_ID'], formData['Year']);
            if (calcData) {
                YEARLY_SUPPORT_FIELDS.forEach(function (fk) { if (calcData[fk] !== undefined) formData[fk] = calcData[fk]; });
            }
        }
    } else if (formType === 'Supported') {
        if (isAddMode) {
            if (!formData['Support_ID']) {
                alert(currentLang === 'vi' ? 'Thiếu Support ID.' : 'Missing Support ID.');
                return;
            }
        } else {
            formData['Support_ID'] = formId;
        }
        // For training (SP7): append _training_time to Note
        var trainingTime = $('[name="_training_time"]').val();
        if (trainingTime && formData['Support code'] === 'SP7') {
            var existingNote = formData['Note'] || '';
            formData['Note'] = (existingNote ? existingNote + ' | ' : '') + 'Time: ' + trainingTime;
        }
        // Ensure optional fields not shown in current group have empty defaults
        if (!formData['Quantity']) formData['Quantity'] = '';
        if (!formData['Item_Detail']) formData['Item_Detail'] = '';
        if (!formData['Unit']) formData['Unit'] = '';
        if (!formData['A live']) formData['A live'] = '';
    } else if (formType === 'Op6') {
        if (!isAddMode) formData['OP6 ID'] = formId;
        else if (!formData['OP6 ID']) { alert(currentLang === 'vi' ? 'Thiếu mã OP6.' : 'Missing OP6 ID'); return; }
    } else if (formType === 'Species') {
        if (!isAddMode) formData['Species_ID'] = formId;
        else if (!formData['Species_ID']) { alert(currentLang === 'vi' ? 'Vui lòng chọn loại cây để sinh mã tự động.' : 'Please select species type to auto-generate ID.'); return; }
    } else if (formType === 'Admin') {
        if (!isAddMode) formData['Adm_ID'] = formId;
        else if (!formData['Adm_ID']) { alert(currentLang === 'vi' ? 'Thiếu mã Admin.' : 'Missing Admin ID'); return; }
    } else if (formType === 'Training') {
        if (!isAddMode) formData['Train_ID'] = formId;
        else if (!formData['Train_ID']) { alert(currentLang === 'vi' ? 'Thiếu mã Tập huấn.' : 'Missing Training ID'); return; }
    }

    $('#loading').show();

    var mapping = TABLE_MAP[formType];
    if (!mapping) { showError('Unknown type: ' + formType); return; }

    var successMsg = isAddMode
        ? (currentLang === 'vi' ? 'Thêm mới thành công!' : 'Added successfully!')
        : translations[currentLang].updateSuccess;

    if (navigator.onLine) {
        supabaseClient.from(mapping.table).upsert(formData, { onConflict: mapping.idCol })
            .then(function (res) {
                $('#loading').fadeOut();
                if (res.error) {
                    showError(res.error.message);
                } else {
                    if (typeof PFFP_DB !== 'undefined') {
                        PFFP_DB.saveToLocal(mapping.table, formData).catch(function () {});
                    }
                    // Auto-recalc triggers
                    if (formType === 'Plots' && formData.Farmer_ID) {
                        recalcFarmerTotalArea(formData.Farmer_ID);
                    }
                    if (formType === 'Supported') {
                        var sFarmerId = formData['Farmer ID'] || formData.Farmer_ID;
                        var sYear = formData['Supported year'];
                        if (sFarmerId && sYear) recalcYearlyForFarmer(sFarmerId, sYear);
                    }
                    var modalInstance = bootstrap.Modal.getInstance(document.getElementById('editFormModal'));
                    if (modalInstance) modalInstance.hide();
                    _pendingLibraryReopen = $('#formFields').data('libraryListType') || null;
                    refreshData();
                    showToast(successMsg);
                }
            })
            .catch(function (err) { $('#loading').fadeOut(); showError(err); });
    } else {
        // Offline: save locally and queue for sync
        if (typeof PFFP_DB !== 'undefined') {
            PFFP_DB.saveToLocal(mapping.table, formData).then(function () {
                return PFFP_DB.addToSyncQueue({ table: mapping.table, action: 'upsert', idCol: mapping.idCol, data: formData });
            }).then(function () {
                $('#loading').fadeOut();
                var modalInstance = bootstrap.Modal.getInstance(document.getElementById('editFormModal'));
                if (modalInstance) modalInstance.hide();
                updateSyncPendingCount();
                _pendingLibraryReopen = $('#formFields').data('libraryListType') || null;
                refreshData();
                showToast(successMsg);
            }).catch(function (err) { $('#loading').fadeOut(); showError(err); });
        }
    }
}


// --- AUTO-CALCULATION: Farmer totals from Plots ---
function recalcFarmerTotalArea(farmerId) {
    var farmerPlots = (rawData.plots || []).filter(function (p) {
        return String(p.Farmer_ID) === String(farmerId);
    });
    var totalArea = farmerPlots.reduce(function (sum, p) {
        return sum + (parseFloat(p['Area (ha)']) || 0);
    }, 0);
    totalArea = Math.round(totalArea * 100) / 100;
    var plotCount = farmerPlots.length;
    supabaseClient.from('farmers').update({ 'Total_Coffee_Area': totalArea, 'Number of coffee farm plots': plotCount })
        .eq('Farmer_ID', farmerId)
        .then(function () {
            var farmer = (rawData.farmers || []).find(function (f) { return f.Farmer_ID === farmerId; });
            if (farmer) { farmer.Total_Coffee_Area = totalArea; farmer['Number of coffee farm plots'] = plotCount; }
        }).catch(function () {});
}

// --- AUTO-CALCULATION: Yearly_Data fields from Supported ---
var YEARLY_SUPPORT_FIELDS = [
    'Supported_Types', 'Year_of_support',
    'Shade_Trees_supported by', 'Number_Shade_Trees_Planted',
    'Shade_Trees_Species', 'Year planted', 'Shade_Trees_Died', 'Survival',
    'Fertiliser supported by WWF', 'Lime supported by Slow',
    'Cover crop supported by Slow', 'Soil Test Support'
];

function calcYearlyFromSupported(farmerId, yearCode) {
    // yearCode from yearly_data: '24Y' → '2024'; or '2024' stays '2024'
    var year4;
    if (/^\d{2}Y$/.test(yearCode)) { year4 = '20' + yearCode.replace('Y', ''); }
    else if (/^\d{4}$/.test(yearCode)) { year4 = yearCode; }
    else { year4 = yearCode; }

    var supports = (rawData.supported || []).filter(function (s) {
        return String(s['Farmer ID'] || s.Farmer_ID) === String(farmerId)
            && String(s['Supported year'] || s.Supported_year || '') === String(year4);
    });

    if (supports.length === 0) return null;

    // --- Trees (SP5, SP2): Unit contains 'tree' ---
    var trees = supports.filter(function (s) {
        return (s.Unit || '').toLowerCase().indexOf('tree') >= 0;
    });

    var planted = trees.reduce(function (sum, s) { return sum + (parseFloat(s.Quantity) || 0); }, 0);

    // Evaluated = A_live has a value (including 0 = all died)
    var evaluatedTrees = trees.filter(function (s) {
        var a = s['A live'] !== undefined ? s['A live'] : s.A_live;
        return a !== null && a !== '' && a !== undefined && String(a).trim() !== '';
    });
    var evaluatedQty = evaluatedTrees.reduce(function (sum, s) { return sum + (parseFloat(s.Quantity) || 0); }, 0);
    var alive = evaluatedTrees.reduce(function (sum, s) {
        var a = s['A live'] !== undefined ? s['A live'] : s.A_live;
        return sum + (parseFloat(a) || 0);
    }, 0);
    var died = evaluatedQty > 0 ? Math.max(0, evaluatedQty - alive) : 0;
    var survival = evaluatedQty > 0 ? ((alive / evaluatedQty) * 100).toFixed(1) : '';

    // Species names (resolve codes to readable names via speciesMap)
    var speciesNames = [];
    var speciesSeen = {};
    trees.forEach(function (s) {
        var code = s.Item_Detail;
        if (code && !speciesSeen[code]) {
            speciesSeen[code] = true;
            var name = (typeof getSpeciesName === 'function') ? getSpeciesName(code) : code;
            speciesNames.push(name);
        }
    });
    var speciesList = speciesNames.join(', ');

    // Supported by (unique organizations, resolve codes)
    var orgSet = new Set();
    trees.forEach(function (s) {
        var by = s['Supported by'] || s.Supported_by;
        if (by) orgSet.add(by);
    });
    var supportedBy = Array.from(orgSet).map(function (code) {
        return resolveValue('Supported by', code, 'Supported') || code;
    }).join(', ');

    // --- Supported Types: collect unique support codes ---
    var supportTypeSet = new Set();
    supports.forEach(function (s) {
        var code = s['Support code'] || s.Support_code;
        if (code) supportTypeSet.add(code);
    });
    var supportedTypes = Array.from(supportTypeSet).join(',');

    // --- Year of support ---
    var yearOfSupport = year4;

    // --- Fertiliser (SP3): Item_Detail = 'Fertilizer' ---
    var fertRecords = supports.filter(function (s) {
        var item = (s.Item_Detail || '').toLowerCase();
        return item.indexOf('fertilizer') >= 0 || item.indexOf('phân bón') >= 0;
    });
    var fertQty = fertRecords.reduce(function (sum, s) { return sum + (parseFloat(s.Quantity) || 0); }, 0);

    // Fertiliser specifically from WWF
    var fertWWFRecords = fertRecords.filter(function (s) {
        var by = (s['Supported by'] || s.Supported_by || '').toUpperCase();
        return by.indexOf('WWF') >= 0;
    });
    var fertWWFQty = fertWWFRecords.reduce(function (sum, s) { return sum + (parseFloat(s.Quantity) || 0); }, 0);
    var fertWWFUnit = fertWWFRecords.length > 0 ? (fertWWFRecords[0].Unit || '') : '';

    // --- Lime (SP4): Item_Detail = 'Lime' ---
    var limeRecords = supports.filter(function (s) {
        var item = (s.Item_Detail || '').toLowerCase();
        return item.indexOf('lime') >= 0 || item.indexOf('vôi') >= 0;
    });
    var limeQty = limeRecords.reduce(function (sum, s) { return sum + (parseFloat(s.Quantity) || 0); }, 0);
    var limeUnit = limeRecords.length > 0 ? (limeRecords[0].Unit || '') : '';
    var limeSlowRecords = limeRecords.filter(function (s) {
        var by = (s['Supported by'] || s.Supported_by || '').toUpperCase();
        return by.indexOf('SLOW') >= 0;
    });
    var limeSlowQty = limeSlowRecords.reduce(function (sum, s) { return sum + (parseFloat(s.Quantity) || 0); }, 0);

    // --- Cover crop ---
    var coverRecords = supports.filter(function (s) {
        var item = (s.Item_Detail || '').toLowerCase();
        return item.indexOf('cover') >= 0 || item.indexOf('lạc dại') >= 0 || item.indexOf('phủ đất') >= 0;
    });
    var coverQty = coverRecords.reduce(function (sum, s) { return sum + (parseFloat(s.Quantity) || 0); }, 0);
    var coverUnit = coverRecords.length > 0 ? (coverRecords[0].Unit || '') : '';

    // --- Soil test (SP6): Item_Detail = 'Soil test' ---
    var hasSoilTest = supports.some(function (s) {
        var item = (s.Item_Detail || '').toLowerCase();
        return item.indexOf('soil') >= 0 || item === 'sp6';
    });

    // Build fertiliser display: qty + unit if available
    var fertWWFDisplay = fertWWFQty > 0 ? (fertWWFQty + (fertWWFUnit ? ' ' + fertWWFUnit : '')) : (fertQty > 0 ? fertQty + ' (PFFP)' : 'No');
    var limeSlowDisplay = limeSlowQty > 0 ? (limeSlowQty + (limeUnit ? ' ' + limeUnit : '')) : (limeQty > 0 ? limeQty + ' (other)' : 'No');
    var coverDisplay = coverQty > 0 ? (coverQty + (coverUnit ? ' ' + coverUnit : '')) : 'No';

    return {
        'Supported_Types': supportedTypes,
        'Year_of_support': yearOfSupport,
        'Shade_Trees_supported by': supportedBy,
        'Number_Shade_Trees_Planted': planted,
        'Shade_Trees_Species': speciesList,
        'Year planted': yearCode,
        'Shade_Trees_Died': died,
        'Survival': survival,
        'Fertiliser supported by WWF': fertWWFDisplay,
        'Lime supported by Slow': limeSlowDisplay,
        'Cover crop supported by Slow': coverDisplay,
        'Soil Test Support': hasSoilTest ? 'Yes' : 'No'
    };
}

function recalcYearlyForFarmer(farmerId, supportedYear) {
    // supportedYear from Supported is '2024' → yearCode for yearly_data is '24Y'
    var yearCode;
    if (/^\d{4}$/.test(supportedYear)) { yearCode = supportedYear.slice(-2) + 'Y'; }
    else { yearCode = supportedYear; }

    var calcData = calcYearlyFromSupported(farmerId, yearCode);
    if (!calcData) return;

    var yearlyRecords = (rawData.yearly || []).filter(function (y) {
        return y.Farmer_ID === farmerId && y.Year === yearCode;
    });

    if (yearlyRecords.length === 0) {
        // No Yearly_Data record exists → create one automatically
        var newRecordId = farmerId + '-Y' + yearCode.replace('Y', '');
        var newRecord = { Record_Id: newRecordId, Farmer_ID: farmerId, Year: yearCode };
        YEARLY_SUPPORT_FIELDS.forEach(function (fk) {
            if (calcData[fk] !== undefined) newRecord[fk] = calcData[fk];
        });
        console.log('Auto-creating Yearly_Data record: ' + newRecordId);
        supabaseClient.from('yearly_data').insert([newRecord])
            .then(function (res) {
                if (!res.error) {
                    if (!rawData.yearly) rawData.yearly = [];
                    rawData.yearly.push(newRecord);
                    console.log('Created Yearly_Data: ' + newRecordId);
                } else {
                    console.warn('Failed to create Yearly_Data: ' + newRecordId, res.error);
                }
            })
            .catch(function (e) { console.warn('Error creating Yearly_Data: ' + newRecordId, e); });
        return;
    }

    // Update existing Yearly_Data records
    yearlyRecords.forEach(function (yr) {
        var updatePayload = {};
        YEARLY_SUPPORT_FIELDS.forEach(function (fk) {
            if (calcData[fk] !== undefined) updatePayload[fk] = calcData[fk];
        });
        supabaseClient.from('yearly_data').update(updatePayload).eq('Record_Id', yr.Record_Id)
            .then(function (res) {
                if (!res.error) {
                    Object.assign(yr, calcData);
                    console.log('Updated Yearly_Data: ' + yr.Record_Id);
                }
            })
            .catch(function (e) { console.warn('Failed to update Yearly_Data: ' + yr.Record_Id, e); });
    });
}

// Auto-fill all Yearly_Data records from Supported data on initial load
function autoFillYearlyFromSupported() {
    var yearly = rawData.yearly || [];
    var supported = rawData.supported || [];
    if (yearly.length === 0 || supported.length === 0) {
        console.log('autoFillYearly: yearly=' + yearly.length + ', supported=' + supported.length);
        return;
    }

    var updated = 0;
    var errors = 0;
    yearly.forEach(function (yr) {
        try {
            var farmerId = yr.Farmer_ID;
            var yearCode = yr.Year;
            if (!farmerId || !yearCode) return;

            var calcData = calcYearlyFromSupported(farmerId, yearCode);
            if (!calcData) return;

            // Check if any support field needs updating
            var needsUpdate = false;
            YEARLY_SUPPORT_FIELDS.forEach(function (fk) {
                if (calcData[fk] !== undefined) {
                    var oldVal = yr[fk];
                    var newVal = calcData[fk];
                    if (String(oldVal || '') !== String(newVal)) { needsUpdate = true; }
                }
            });

            if (needsUpdate) {
                // Update in-memory data immediately
                YEARLY_SUPPORT_FIELDS.forEach(function (fk) {
                    if (calcData[fk] !== undefined) yr[fk] = calcData[fk];
                });
                updated++;
                // Save to PocketBase in background
                var updatePayload = {};
                YEARLY_SUPPORT_FIELDS.forEach(function (fk) { if (calcData[fk] !== undefined) updatePayload[fk] = calcData[fk]; });
                supabaseClient.from('yearly_data').update(updatePayload).eq('Record_Id', yr.Record_Id)
                    .then(function () {})
                    .catch(function (e) { console.warn('Auto-fill save failed: ' + yr.Record_Id, e); });
            }
        } catch (e) {
            errors++;
            if (errors <= 3) console.warn('Auto-fill error for ' + (yr.Record_Id || '?'), e);
        }
    });
    console.log('Auto-fill complete: ' + updated + ' updated, ' + errors + ' errors, ' + yearly.length + ' total');
}

function showSingleItemDetails(type, id) {
    let dataList, idKey;
    if (type === 'Plots') { dataList = rawData.plots; idKey = 'Plot_Id'; }
    else if (type === 'Supported') { dataList = rawData.supported || []; idKey = 'Support_ID'; }
    else { dataList = rawData.yearly; idKey = 'Record_Id'; }
    let item = dataList.find(i => String(i[idKey]) === String(id));
    if (!item) return;

    // Find farmer name for display
    var farmerName = '';
    var farmerIdVal = item.Farmer_ID || item['Farmer ID'];
    if (farmerIdVal) {
        var farmer = (rawData.farmers || []).find(function (f) { return f.Farmer_ID === farmerIdVal; });
        if (farmer) farmerName = farmer.Full_Name || '';
    }

    let html = `<div class="row g-0 mb-3">`;
    var labels = FIELD_LABELS[type] || {};
    var labelKeys = Object.keys(labels);
    // Show FIELD_LABELS fields first (structured), then remaining
    var shownKeys = new Set();
    labelKeys.forEach(key => {
        shownKeys.add(key);
        let label = translations[currentLang][labels[key]] || key;
        let val = resolveValue(key, item[key], type);
        html += `<div class="col-12 col-md-6 detail-col-wrapper"><div class="detail-item"><div class="field-label">${label}:</div><div class="field-value">${val || '-'}</div></div></div>`;
    });
    html += `</div>`;

    // Title: farmer name + item ID
    var displayName = farmerName ? farmerName + ' - ' + id : id;
    var typeLabel = type === 'Plots' ? (currentLang === 'vi' ? 'Lô đất' : 'Plot') : type === 'Yearly_Data' ? (currentLang === 'vi' ? 'Đánh giá' : 'Yearly') : type;
    $('#farmerDetailTitle').html('<span style="font-size:0.75rem;opacity:0.85;display:block;">' + typeLabel + '</span>' + escapeHtml(displayName));

    // Action bar
    var actionsHtml = '';
    actionsHtml += '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-times"></i> ' + (translations[currentLang].btnClose) + '</button>';
    if (userPermissions.canEdit) {
        actionsHtml += '<button type="button" class="btn btn-warning" onclick="openEditForm(\'' + type + '\', \'' + escapeHtml(id) + '\')"><i class="fas fa-edit"></i> ' + (currentLang === 'vi' ? 'Sửa' : 'Edit') + '</button>';
    }
    if (userPermissions.canDelete) {
        actionsHtml += '<button type="button" class="btn btn-danger" onclick="deleteItem(\'' + type + '\', \'' + escapeHtml(id) + '\')"><i class="fas fa-trash"></i> ' + (currentLang === 'vi' ? 'Xóa' : 'Del') + '</button>';
    }
    if (farmerName && farmerIdVal) {
        actionsHtml += '<button type="button" class="btn btn-outline-primary" onclick="showFarmerDetails(\'' + escapeHtml(farmerIdVal) + '\')"><i class="fas fa-user"></i> ' + escapeHtml(farmerName) + '</button>';
    }
    $('#modalActions').html(actionsHtml);

    $('#detailContent').html(html);
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('farmerDetailModal'));
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
    // Tables removed from Dashboard - Data Browser is now the primary table view
    // Keep function signature for compatibility but skip if table elements don't exist
    if (!document.getElementById('mainTable')) return;
}
function updateDataTable(t, i, d, c) { if (!document.getElementById(t)) return; if (i) { i.clear().rows.add(d).draw(); } else { let n = $('#' + t).DataTable({ data: d, pageLength: 10, language: { search: "Tìm kiếm:", paginate: { next: ">>", previous: "<<" }, info: "_START_ - _END_ / _TOTAL_" }, deferRender: true, autoWidth: false }); c(n); } }


// --- USER FUNCTIONS (CẬP NHẬT: SẮP XẾP PENDING LÊN ĐẦU) ---
function renderUserTable() {
    const users = rawData.user || [];
    const auth = (currentUser && currentUser['Authority']) ? String(currentUser['Authority']).trim() : '';
    const isAdmin = (auth === ADMIN_ROLE);
    const isManager = MANAGER_ROLES.includes(auth);

    let displayUsers = users;

    // 1. Lọc theo tổ chức (multi-org support: WWF admin sees WFI+WFV, SLO admin sees SLO)
    if (!isAdmin && isManager) {
        var myOrgs = getUserOrgs(currentUser);
        var isWWF = myOrgs.some(function (o) { return o === 'WFI' || o === 'WFV'; });
        var isSLO = myOrgs.indexOf('SLO') !== -1;
        displayUsers = users.filter(function (u) {
            var uOrgs = getUserOrgs(u);
            if (isWWF && uOrgs.some(function (o) { return o === 'WFI' || o === 'WFV'; })) return true;
            if (isSLO && uOrgs.indexOf('SLO') !== -1) return true;
            return false;
        });
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
        let orgLabel = orgId.split(',').map(function (oid) {
            var tid = oid.trim();
            return dropMap[tid] ? (currentLang === 'vi' ? dropMap[tid].vi : dropMap[tid].en) : tid;
        }).join(', ');

        let posId = String(u['Position'] || '').trim();
        let posLabel = posId;
        if (dropMap[posId]) { posLabel = (currentLang === 'vi') ? dropMap[posId].vi : dropMap[posId].en; }

        let clickableName = `<span class="text-primary fw-bold" onclick="showUserDetails('${u['Staff ID']}')" style="cursor: pointer;">${u['Full name'] || ''}</span>`;

        // Permission summary badges
        let permBadges = '';
        let viewStr = String(u['View'] || '').trim();
        let ruleStr = String(u['Rule'] || '').trim();
        let roleStr2 = String(u['Role'] || '').trim();
        let uAuth = String(u['Authority'] || '').trim();
        // Group scope badge
        if (uAuth === ADMIN_ROLE) {
            permBadges += `<span class="badge bg-success mb-1" style="font-size:0.65rem;">${translations[currentLang].lblAllGroups}</span> `;
        } else if (roleStr2) {
            var gc = roleStr2.split(',').filter(Boolean).length;
            permBadges += `<span class="badge bg-secondary mb-1" style="font-size:0.65rem;">${gc} ${translations[currentLang].lblNGroups}</span> `;
        } else {
            permBadges += `<span class="badge bg-danger mb-1" style="font-size:0.65rem;">${translations[currentLang].lblNoGroups}</span> `;
        }
        // View tab badges
        if (viewStr) {
            viewStr.split(',').forEach(function (v) { var vt = v.trim(); if (vt) permBadges += `<span class="badge bg-info mb-1" style="font-size:0.6rem;">${vt}</span> `; });
        }
        // Rule operation badges
        if (ruleStr) {
            ruleStr.split(',').forEach(function (r) { var rt = r.trim(); if (rt) permBadges += `<span class="badge bg-warning text-dark mb-1" style="font-size:0.6rem;">${rt}</span> `; });
        }

        return [i + 1, u['Staff ID'] || '', clickableName, orgLabel, posLabel, roleLabel, u['Email'] || '', u['Phone'] || '', authLabel, `<div class="d-flex flex-wrap gap-1">${permBadges}</div>`, statusLabel, actions];
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
    let html = `<div class="print-main-title"><i class="fas fa-user-tie"></i> ${escapeHtml(user['Full name'])} (${escapeHtml(userId)})</div>`; html += `<div class="detail-group-title"><i class="fas fa-info-circle"></i> ${translations[currentLang].drilldownTitle}</div><div class="row g-0 mb-3">`;
    const renderField = (label, value) => { return `<div class="col-12 col-md-6 detail-col-wrapper"><div class="detail-item"><div class="field-label">${escapeHtml(label)}:</div><div class="field-value">${escapeHtml(value) || '-'}</div></div></div>`; };
    let orgId = user['Organization']; let orgLabel = String(orgId || '').split(',').map(function (oid) { var tid = oid.trim(); return dropMap[tid] ? (currentLang === 'vi' ? dropMap[tid].vi : dropMap[tid].en) : tid; }).join(', ');
    let posId = user['Position']; let posLabel = dropMap[posId] ? (currentLang === 'vi' ? dropMap[posId].vi : dropMap[posId].en) : posId;
    let authId = user['Authority']; let authLabel = dropMap[authId] ? (currentLang === 'vi' ? dropMap[authId].vi : dropMap[authId].en) : authId;
    html += renderField(translations[currentLang].lblStaffId, user['Staff ID']); html += renderField(translations[currentLang].lblFullName, user['Full name']); html += renderField(translations[currentLang].lblOrg, orgLabel); html += renderField(translations[currentLang].lblPosition, posLabel);
    html += renderField(translations[currentLang].lblEmail, user['Email']); html += renderField(translations[currentLang].lblPhone, user['Phone']); html += renderField(translations[currentLang].lblGender, user['Gender']); html += renderField(translations[currentLang].lblAuthority, authLabel); html += renderField(translations[currentLang].lblStatus, user['Status']);
    html += `</div>`; let roleId = user['Role'] || user['Area Manager'];
    if (roleId) {
        let roleLabel = String(roleId).split(',').map(id => { let tid = id.trim(); return adminMap[tid] ? (currentLang === 'vi' ? adminMap[tid].vi : adminMap[tid].en) : tid; }).join(', ');
        html += `<div class="detail-group-title"><i class="fas fa-map"></i> ${translations[currentLang].lblArea}</div><div class="p-2 border rounded bg-light">${escapeHtml(roleLabel)}</div>`;
    }
    // Permission detail section
    var detailAuth = String(user['Authority'] || '').trim();
    var detailAuthLabel = dropMap[detailAuth] ? (currentLang === 'vi' ? dropMap[detailAuth].vi : dropMap[detailAuth].en) : detailAuth;
    html += `<div class="detail-group-title"><i class="fas fa-shield-alt"></i> ${translations[currentLang].lblPermDetail}</div>`;
    html += `<div class="permission-section">`;
    // Authority badge
    var authBadgeClass = detailAuth === ADMIN_ROLE ? 'bg-danger' : (MANAGER_ROLES.includes(detailAuth) ? 'bg-primary' : 'bg-info');
    html += `<div class="mb-2"><strong>${translations[currentLang].lblAuthority}:</strong> <span class="badge ${authBadgeClass}">${escapeHtml(detailAuthLabel)}</span></div>`;
    // Tab access badges
    var detailViews = String(user['View'] || '').split(',').map(s => s.trim()).filter(Boolean);
    html += `<div class="mb-2"><strong>${translations[currentLang].lblTabAccess}:</strong> `;
    if (detailViews.length > 0) {
        detailViews.forEach(function (v) { html += `<span class="badge bg-info me-1">${escapeHtml(v)}</span>`; });
    } else { html += `<span class="text-muted fst-italic">-</span>`; }
    html += `</div>`;
    // Operations badges
    var detailRules = String(user['Rule'] || '').split(',').map(s => s.trim()).filter(Boolean);
    html += `<div class="mb-2"><strong>${translations[currentLang].lblOperations}:</strong> `;
    if (detailRules.length > 0) {
        detailRules.forEach(function (r) { html += `<span class="badge bg-warning text-dark me-1">${escapeHtml(r)}</span>`; });
    } else { html += `<span class="text-muted fst-italic">-</span>`; }
    html += `</div>`;
    // Group scope
    html += `<div class="mb-0"><strong>${translations[currentLang].lblGroupScope}:</strong> `;
    if (detailAuth === ADMIN_ROLE) {
        html += `<span class="badge bg-success">${translations[currentLang].lblAllGroups}</span>`;
    } else {
        var detailRoleStr = String(user['Role'] || '').trim();
        if (detailRoleStr) {
            detailRoleStr.split(',').forEach(function (rid) {
                var tid = rid.trim();
                var lbl = adminMap[tid] ? (currentLang === 'vi' ? adminMap[tid].vi : adminMap[tid].en) : tid;
                html += `<span class="badge bg-secondary me-1">${escapeHtml(lbl)}</span>`;
            });
        } else {
            html += `<span class="badge bg-danger">${translations[currentLang].lblNoGroups}</span>`;
        }
    }
    html += `</div></div>`;
    $('#detailContent').html(html); $('#farmerDetailTitle').text(translations[currentLang].detailPrefix + ": " + user['Full name']);
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
    // Use first org if comma-separated
    var primaryOrg = String(orgCode || '').split(',')[0].trim();
    if (!primaryOrg) primaryOrg = orgCode;
    if (!rawData.user) return primaryOrg + "-01"; const regex = new RegExp(`^${primaryOrg}-(\\d+)$`, 'i');
    let maxNum = 0; rawData.user.forEach(u => { let sid = String(u['Staff ID'] || '').trim(); let match = sid.match(regex); if (match) { let num = parseInt(match[1], 10); if (!isNaN(num) && num > maxNum) { maxNum = num; } } });
    let nextNum = maxNum + 1; let padded = String(nextNum).padStart(2, '0'); return primaryOrg + "-" + padded;
}
// --- AUTO-GENERATE FARMER_ID ---
// Format: {VillageCode}{YearLastDigit}{3-digit seq}
// VD: Village "DDO" + Year 2025 → prefix "DDO5", seq 005 → "DDO5005"
function generateNextFarmerId(villageCode, year) {
    if (!villageCode || !year) return '';
    var yearDigits = String(year).replace(/\D/g, ''); // "25Y" → "25", "2025" → "2025"
    var yearDigit = yearDigits.slice(-1); // "25" → '5', "2025" → '5'
    var prefix = villageCode.toUpperCase() + yearDigit;
    var escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var regex = new RegExp('^' + escapedPrefix + '(\\d+)$', 'i');
    var maxSeq = 0;
    (rawData.farmers || []).forEach(function (f) {
        var fid = String(f.Farmer_ID || '').trim();
        var match = fid.match(regex);
        if (match) {
            var seq = parseInt(match[1], 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
    });
    return prefix + String(maxSeq + 1).padStart(3, '0');
}

// --- AUTO-GENERATE RECORD_ID cho Yearly Data ---
// Format: {Farmer_ID}-{Year} VD: CHE4001-2024, HHA4006-2025
function generateRecordId(farmerId, year) {
    if (!farmerId || !year) return '';
    return farmerId + '-' + year;
}

function checkDuplicateYearlyRecord(farmerId, year) {
    if (!rawData.yearly) return false;
    return rawData.yearly.some(function (y) {
        return String(y.Farmer_ID) === String(farmerId) && String(y.Year) === String(year);
    });
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
    // Live Permission Preview
    if ($('#permPreviewSection').length === 0) {
        var previewHTML = `<div class="col-12 mt-3" id="permPreviewSection">
            <label class="form-label-custom mb-1"><i class="fas fa-eye"></i> <span data-i18n="lblEffectivePerms">${translations[currentLang].lblEffectivePerms}</span></label>
            <div class="permission-section" id="permPreviewContent"><span class="text-muted fst-italic">-</span></div>
        </div>`;
        $('#userForm .row').append(previewHTML);
        // Bind change events for live preview
        $(document).off('change.permPreview').on('change.permPreview', '#userAuthoritySelect, .chk-view, .chk-perm, #userRoleSelect', function () { updatePermPreview(); });
    }
    updatePermPreview();
}
function updatePermPreview() {
    var container = $('#permPreviewContent');
    if (container.length === 0) return;
    var html = '';
    // Authority
    var selAuth = String($('#userAuthoritySelect').val() || '').trim();
    var selAuthLabel = selAuth;
    if (dropMap[selAuth]) selAuthLabel = (currentLang === 'vi' ? dropMap[selAuth].vi : dropMap[selAuth].en);
    var authCls = selAuth === ADMIN_ROLE ? 'bg-danger' : (MANAGER_ROLES.includes(selAuth) ? 'bg-primary' : 'bg-info');
    if (selAuth) html += `<span class="badge ${authCls} me-1 mb-1">${selAuthLabel}</span>`;
    // Views
    var views = [];
    $('.chk-view:checked').each(function () { views.push($(this).val()); });
    views.forEach(function (v) { html += `<span class="badge bg-info me-1 mb-1">${v}</span>`; });
    // Rules
    var rules = [];
    $('.chk-perm:checked').each(function () { rules.push($(this).val()); });
    rules.forEach(function (r) { html += `<span class="badge bg-warning text-dark me-1 mb-1">${r}</span>`; });
    // Group scope
    var selRoles = $('#userRoleSelect').val() || [];
    if (selAuth === ADMIN_ROLE) {
        html += `<span class="badge bg-success me-1 mb-1">${translations[currentLang].lblAllGroups}</span>`;
    } else if (selRoles.length > 0) {
        selRoles.forEach(function (rid) {
            var lbl = adminMap[rid] ? (currentLang === 'vi' ? adminMap[rid].vi : adminMap[rid].en) : rid;
            html += `<span class="badge bg-secondary me-1 mb-1">${lbl}</span>`;
        });
    } else {
        html += `<span class="badge bg-danger me-1 mb-1">${translations[currentLang].lblNoGroups}</span>`;
    }
    container.html(html || '<span class="text-muted fst-italic">-</span>');
}
function showAddUserModal() {
    const currentAuth = (currentUser && currentUser['Authority']) ? String(currentUser['Authority']).trim() : '';
    if (!MANAGER_ROLES.includes(currentAuth)) { alert("Bạn không có quyền thêm nhân viên."); return; } updateUserModalStructure(); $('#userModalTitle').text(translations[currentLang].btnAddUser); $('#userForm')[0].reset();
    var myOrgs = getUserOrgs(currentUser); var orgSelect = $('#userOrgSelect'); $('#userForm input, #userForm select').prop('disabled', false);
    if (currentAuth === ADMIN_ROLE) { orgSelect.prop('disabled', false); } else { orgSelect.val(myOrgs); orgSelect.prop('disabled', true); }
    var primaryOrg = myOrgs[0] || ''; var nextId = generateNextStaffId(primaryOrg); $('#userForm input[name="Staff ID"]').val(nextId).prop('readonly', true); populateRoleDropdown(); populatePositionDropdown(); populateAuthorityDropdown('', currentAuth); $('#userStatusSelect').val('Act'); $('.chk-perm').prop('checked', false); $('.chk-view').prop('checked', false);
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('userEditModal')); modal.show();
}
function editUser(id) {
    updateUserModalStructure();
    const user = rawData.user.find(u => String(u['Staff ID']) === String(id)); if (!user) return; $('#userModalTitle').text(translations[currentLang].editPrefix + ': ' + user['Full name']); $('#userForm')[0].reset();
    const currentAuth = (currentUser && currentUser['Authority']) ? String(currentUser['Authority']).trim() : ''; const isManager = MANAGER_ROLES.includes(currentAuth); const form = document.getElementById('userForm');
    Object.keys(user).forEach(key => { const input = form.querySelector(`[name="${key}"]`); if (input && input.type !== 'checkbox' && input.type !== 'hidden' && !input.multiple) { input.value = user[key]; } });
    // Multi-org pre-selection
    if (user['Organization']) { var orgVals = String(user['Organization']).split(',').map(function (s) { return s.trim(); }); $('#userOrgSelect').val(orgVals); }
    populateRoleDropdown(user['Role']); populatePositionDropdown(user['Position']); populateAuthorityDropdown(user['Authority'], currentAuth); if (user['Status']) $('#userStatusSelect').val(String(user['Status']).trim()); let views = (user['View'] || '').split(',').map(s => s.trim()); $('.chk-view').each(function () { $(this).prop('checked', views.includes($(this).val())); });
    let rule = (user['Rule'] || '').split(',').map(s => s.trim()); $('.chk-perm').each(function () { let val = $(this).val(); let isChecked = rule.includes(val); if (val === 'Edit' && (rule.includes('Update'))) isChecked = true; if (val === 'Delete' && (rule.includes('Del'))) isChecked = true; $(this).prop('checked', isChecked); });
    $('#userForm input[name="Staff ID"]').prop('readonly', true); if (!isManager) {
        $('#userAuthoritySelect').prop('disabled', true); $('#userRoleSelect').prop('disabled', true); $('#userPositionSelect').prop('disabled', true); $('#userStatusSelect').prop('disabled', true); $('select[name="Organization"]').prop('disabled', true); $('.chk-view').prop('disabled', true);
        $('.chk-perm').prop('disabled', true);
    } else {
        $('#userAuthoritySelect').prop('disabled', false); $('#userRoleSelect').prop('disabled', false); $('#userPositionSelect').prop('disabled', false); $('#userStatusSelect').prop('disabled', false); $('select[name="Organization"]').prop('disabled', false); $('.chk-view').prop('disabled', false); $('.chk-perm').prop('disabled', false);
    } const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('userEditModal')); modal.show();
}


async function saveUser() {
    const form = document.getElementById('userForm');
    const formData = {};
    const inputs = form.querySelectorAll('input:not([type=checkbox]):not([type=hidden]), select');

    // Validate: all fields must not be empty
    var hasEmpty = false;
    $(form).find('.field-error-msg').remove();
    $(form).find('.is-invalid').removeClass('is-invalid');
    inputs.forEach(function (input) {
        if (!input.name || input.type === 'hidden') return;
        if (input.readOnly || input.disabled) return;
        // Password can be empty on edit (means "keep current")
        if (input.name === 'Password' && $(form).find('input[name="Staff ID"]').prop('readonly')) return;
        var val = '';
        if (input.tagName === 'SELECT' && input.multiple) {
            val = ($(input).val() || []).join('');
        } else {
            val = (input.value || '').trim();
        }
        if (val === '') {
            hasEmpty = true;
            $(input).addClass('is-invalid');
            var errMsg = currentLang === 'vi' ? 'Không được để trống' : 'This field is required';
            $(input).after('<div class="field-error-msg text-danger" style="font-size:0.72rem;margin-top:2px;"><i class="fas fa-exclamation-circle"></i> ' + errMsg + '</div>');
        }
    });
    if (hasEmpty) {
        var firstErr = $(form).find('.is-invalid').first();
        if (firstErr.length) { firstErr[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); firstErr.focus(); }
        return;
    }

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

    // Extract password for separate server-side handling
    var newPassword = formData['Password'] || '';
    delete formData['Password'];

    $('#loading').show();

    supabaseClient.from('users').upsert(formData, { onConflict: 'Staff ID' })
        .then(function (res) {
            if (res.error) {
                $('#loading').fadeOut();
                showError(res.error.message);
                return;
            }
            // If password was provided, change it via secure endpoint
            if (newPassword.trim()) {
                return fetch(PB_URL + '/api/custom/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ staffId: formData['Staff ID'], newPassword: newPassword.trim() })
                }).then(function (r) { return r.json(); }).then(function (pwRes) {
                    $('#loading').fadeOut();
                    if (!pwRes.success) {
                        showError('Lỗi đổi mật khẩu: ' + (pwRes.error || ''));
                        return;
                    }
                    if (typeof PFFP_DB !== 'undefined') {
                        PFFP_DB.saveToLocal('users', formData).catch(function () {});
                    }
                    bootstrap.Modal.getInstance(document.getElementById('userEditModal')).hide();
                    refreshData();
                    showToast(translations[currentLang].updateSuccess);
                });
            } else {
                $('#loading').fadeOut();
                if (typeof PFFP_DB !== 'undefined') {
                    PFFP_DB.saveToLocal('users', formData).catch(function () {});
                }
                bootstrap.Modal.getInstance(document.getElementById('userEditModal')).hide();
                refreshData();
                showToast(translations[currentLang].updateSuccess);
            }
        })
        .catch(function (err) { $('#loading').fadeOut(); showError(err); });
}



async function deleteUser(id) {
    const c = await showCustomConfirm(`${translations[currentLang].confirmDelete} ${id}?`, 'delete');
    if (!c) return;

    $('#loading').show();

    supabaseClient.from('users').delete().eq('Staff ID', id)
        .then(function (res) {
            $('#loading').fadeOut();
            if (res.error) {
                showError(res.error.message);
            } else {
                if (typeof PFFP_DB !== 'undefined') {
                    PFFP_DB.deleteFromLocal('users', id).catch(function () {});
                }
                refreshData();
                showToast(translations[currentLang].deleteSuccess);
            }
        })
        .catch(function (err) { $('#loading').fadeOut(); showError(err); });
}
function showCustomConfirm(m, t) { return new Promise((r) => { const e = document.getElementById('confirmModal'); const b = bootstrap.Modal.getOrCreateInstance(e); const h = e.querySelector('.modal-header'); const i = document.getElementById('confirmIcon'); const o = document.getElementById('btnConfirmOk'); const c = document.getElementById('btnConfirmCancel'); document.getElementById('confirmMessage').innerText = m; c.innerText = translations[currentLang].btnCancel; o.innerText = translations[currentLang].btnOk; if (t === 'delete') { h.className = 'modal-header delete'; i.innerHTML = '<i class="fas fa-exclamation-triangle text-danger"></i>'; o.className = 'btn btn-danger px-4'; } else { h.className = 'modal-header save'; i.innerHTML = '<i class="fas fa-question-circle text-primary"></i>'; o.className = 'btn btn-primary px-4'; } const cl = () => { o.removeEventListener('click', ok); e.removeEventListener('hidden.bs.modal', ca); }; const ok = () => { r(true); b.hide(); cl(); }; const ca = () => { r(false); cl(); }; o.addEventListener('click', ok); e.addEventListener('hidden.bs.modal', ca); b.show(); }); }
function stripHtml(h) { var t = document.createElement("DIV"); t.innerHTML = h; return t.textContent || t.innerText || ""; }
function exportTable() {
    try {
        if (!userPermissions.canExport) {
            alert("Bạn không có quyền xuất dữ liệu.");
            return;
        } if (!filteredData.farmers || filteredData.farmers.length === 0) { alert(translations[currentLang].noDataToExport); return; } var wb = XLSX.utils.book_new(); const cs = (sn, tid, hk) => { const dt = $('#' + tid).DataTable(); if (!dt) return; const dd = dt.rows({ search: 'applied' }).data().toArray(); if (dd.length === 0) return; const h = hk.map(k => translations[currentLang][k] || k); const ed = dd.map(ra => { let ro = {}; h.forEach((hd, idx) => { let cd = ra[idx]; if (typeof cd === 'string' && cd.includes('<')) { cd = stripHtml(cd); } ro[hd] = cd; }); return ro; }); var ws = XLSX.utils.json_to_sheet(ed); XLSX.utils.book_append_sheet(wb, ws, sn); };
        const fH = ['thNo', 'thYear', 'thFarmerID', 'thName', 'thYOB', 'thGender', 'thPhone', 'thGroup', 'thVillage', 'thCommune', 'thAddress', 'thIDCard', 'thEthnicity', 'thEcoStatus', 'thHHCircum', 'thMemCount', 'thWorkerCount', 'thTotalArea', 'thPlotCount', 'thSupportedBy', 'thSupportType', 'thRegFarms', 'thRegArea', 'thStaff', 'thStatus', 'thActivity', 'thDate', 'thUpdate']; const pH = ['thNo', 'thPlotId', 'thFarmerID', 'thName', 'thPlotName', 'thPlotArea', 'thLURC', 'thBorderForest', 'thPlaceName', 'thLocation', 'thShadeTreesBefore', 'thNameTreesBefore', 'thCoffeeTrees', 'thPlantYear', 'thNotes', 'thMapSheet', 'thSubMap', 'thStatus', 'thActivity', 'thUpdate']; const yH = ['thNo', 'thFarmerID', 'thName', 'thRecordID', 'thYearVal', 'thCherryVol', 'thVolHQ', 'thIncome', 'thFertApplied', 'thFertName', 'thFertVol', 'thFertCost', 'thPestApplied', 'thPestName', 'thPestVol', 'thPestCost', 'thHerbApplied', 'thHerbName', 'thHerbVol', 'thHerbCost', 'thLaborCost', 'thOtherCost', 'thTreeSupportBy', 'thTreesPlanted', 'thSpecies', 'thYearPlanted', 'thTreesDead', 'thSurvivalRate', 'thFertWWF', 'thLimeSlow', 'thCoverCrop', 'thSoilTest', 'thTraining', 'thOp6', 'thRegSales', 'thRealSales', 'thRevSales', 'thBoughtVia', 'thStatus', 'thActivity', 'thUpdate']; cs("Farmers", 'mainTable', fH); cs("Plots", 'plotsTable', pH); cs("Yearly_Data", 'yearlyTable', yH); const n = new Date(); const p = (num) => num.toString().padStart(2, '0'); const dateStr = `${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}_${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`; let fY = getSelectedValues('year');
        let fV = getSelectedValues('village'); let yearPart = (fY === 'All' || fY.length > 1) ? n.getFullYear() : fY[0];
        let villagePart = (fV === 'All' || fV.length > 1) ? "" : `_${fV[0].replace(/[^a-zA-Z0-9]/g, '')}`; let fn = "";
        if (villagePart !== "") { fn = `PFFP${villagePart}_${yearPart}_${dateStr}.xlsx`; } else { fn = `PFFP_Raw_data_${yearPart}_${dateStr}.xlsx`; } XLSX.writeFile(wb, fn);
    } catch (e) {
        console.error(e);
        alert("Lỗi xuất Excel.");
    }
}
// --- EXCEL EXPORT: Detail View (multi-sheet workbook) ---
function exportDetailToExcel(farmerId) {
    if (!userPermissions.canExport) {
        alert(currentLang === 'vi' ? 'Bạn không có quyền xuất dữ liệu.' : 'No export permission.');
        return;
    }
    var farmer = (rawData.farmers || []).find(function (f) { return String(f.Farmer_ID) === String(farmerId); });
    if (!farmer) return;

    var wb = XLSX.utils.book_new();

    // Sheet 1: Farmer Info (key-value pairs)
    var farmerLabels = FIELD_LABELS['Farmers'] || {};
    var farmerRows = [];
    Object.keys(farmerLabels).forEach(function (key) {
        var label = translations[currentLang][farmerLabels[key]] || key;
        var val = resolveValue(key, farmer[key], 'Farmers');
        farmerRows.push([label, val || '']);
    });
    var ws1 = XLSX.utils.aoa_to_sheet([[currentLang === 'vi' ? 'Trường' : 'Field', currentLang === 'vi' ? 'Giá trị' : 'Value']].concat(farmerRows));
    XLSX.utils.book_append_sheet(wb, ws1, 'Farmer Info');

    // Sheet 2: Plots
    var relatedPlots = (rawData.plots || []).filter(function (p) { return String(p.Farmer_ID) === String(farmerId); });
    if (relatedPlots.length > 0) {
        var plotLabels = FIELD_LABELS['Plots'] || {};
        var plotKeys = Object.keys(plotLabels);
        var plotHeaders = plotKeys.map(function (k) { return translations[currentLang][plotLabels[k]] || k; });
        var plotData = relatedPlots.map(function (p) {
            return plotKeys.map(function (k) { return resolveValue(k, p[k], 'Plots'); });
        });
        var ws2 = XLSX.utils.aoa_to_sheet([plotHeaders].concat(plotData));
        XLSX.utils.book_append_sheet(wb, ws2, 'Plots');
    }

    // Sheet 3: Yearly Data
    var relatedYearly = (rawData.yearly || []).filter(function (y) { return String(y.Farmer_ID) === String(farmerId); });
    if (relatedYearly.length > 0) {
        var yearlyLabels = FIELD_LABELS['Yearly_Data'] || {};
        var yearlyKeys = Object.keys(yearlyLabels);
        var yearlyHeaders = yearlyKeys.map(function (k) { return translations[currentLang][yearlyLabels[k]] || k; });
        var yearlyData = relatedYearly.map(function (y) {
            return yearlyKeys.map(function (k) { return resolveValue(k, y[k], 'Yearly_Data'); });
        });
        var ws3 = XLSX.utils.aoa_to_sheet([yearlyHeaders].concat(yearlyData));
        XLSX.utils.book_append_sheet(wb, ws3, 'Yearly Data');
    }

    // Sheet 4: Supported
    var relatedSupport = (rawData.supported || []).filter(function (s) { return String(s['Farmer ID'] || s.Farmer_ID) === String(farmerId); });
    if (relatedSupport.length > 0) {
        var supportLabels = FIELD_LABELS['Supported'] || {};
        var supportKeys = Object.keys(supportLabels);
        var supportHeaders = supportKeys.map(function (k) { return translations[currentLang][supportLabels[k]] || k; });
        var supportData = relatedSupport.map(function (s) {
            return supportKeys.map(function (k) { return resolveValue(k, s[k], 'Supported'); });
        });
        var ws4 = XLSX.utils.aoa_to_sheet([supportHeaders].concat(supportData));
        XLSX.utils.book_append_sheet(wb, ws4, 'Supported');
    }

    var fileName = (farmer.Full_Name || 'Farmer') + '_' + farmerId + '.xlsx';
    XLSX.writeFile(wb, fileName);
}

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

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('forgotPasswordModal'));
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

    fetch(PB_URL + '/api/custom/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: staffId, email: email })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
        btn.innerHTML = originalText; btn.disabled = false;
        if (data.success && data.newPassword) {
            bootstrap.Modal.getInstance(document.getElementById('forgotPasswordModal')).hide();
            alert("THÀNH CÔNG!\n\nMật khẩu mới: " + data.newPassword + "\nVui lòng ghi nhớ mật khẩu này.");
            refreshData();
        } else {
            msgDiv.text(data.error || "Lỗi không xác định.");
        }
    })
    .catch(function (err) {
        btn.innerHTML = originalText; btn.disabled = false;
        msgDiv.text("Lỗi kết nối: " + err.message);
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
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('registerModal'));
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

    // Generate Staff ID
    var orgCode = org;
    var nextId = orgCode + '-01';
    if (rawData.user) {
        var regex = new RegExp('^' + orgCode + '-(\\d+)$', 'i');
        var maxNum = 0;
        rawData.user.forEach(function (u) {
            var sid = String(u['Staff ID'] || '').trim();
            var match = sid.match(regex);
            if (match) { var num = parseInt(match[1], 10); if (!isNaN(num) && num > maxNum) maxNum = num; }
        });
        nextId = orgCode + '-' + String(maxNum + 1).padStart(2, '0');
    }

    var userData = {
        'Staff ID': nextId,
        'Full name': name,
        'Organization': org,
        'Email': email,
        'Phone': phone,
        'Password': pass,
        'Status': 'Pending',
        'Role': '',
        'Authority': '',
        'Position': '',
        'Gender': '',
        'View': '',
        'Rule': ''
    };

    supabaseClient.from('users').insert(userData)
        .then(function (res) {
            btn.innerHTML = originalText;
            btn.disabled = false;
            if (res.error) {
                msgDiv.text("Lỗi: " + res.error.message);
            } else {
                bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
                alert("ĐĂNG KY THÀNH CÔNG!\n\nThông tin của bạn đã được gửi.\nVui lòng đợi Admin phê duyệt trước khi đăng nhập.");
                refreshData();
            }
        })
        .catch(function (err) {
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



// ==========================================
// PROJECT INTRO MODAL
// ==========================================
function showProjectIntro() {
    try {
        if (localStorage.getItem('PFFP_SKIP_INTRO') === '1') return;
        var introModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('projectIntroModal'));
        introModal.show();
    } catch (e) {
        console.warn('Could not show project intro:', e);
    }
}
function toggleSkipIntro(cb) {
    if (cb.checked) {
        localStorage.setItem('PFFP_SKIP_INTRO', '1');
    } else {
        localStorage.removeItem('PFFP_SKIP_INTRO');
    }
}

// Config Settings: intro toggle (inverse logic — checkbox = show intro)
function toggleIntroSetting(cb) {
    if (cb.checked) {
        localStorage.removeItem('PFFP_SKIP_INTRO');
    } else {
        localStorage.setItem('PFFP_SKIP_INTRO', '1');
    }
}

function initSettingsPane() {
    var cb = document.getElementById('settingShowIntro');
    if (cb) cb.checked = localStorage.getItem('PFFP_SKIP_INTRO') !== '1';
}

// --- PROJECT DOCUMENT VIEWER (Bilingual) ---
var PROJECT_DOC = {
    vi: {
        title: 'Tài liệu Dự án PFFP',
        sections: [
            { heading: 'Tổng quan dự án', icon: 'fas fa-info-circle', content: '<p><strong>Tên dự án:</strong> Quan hệ đối tác Nông dân Thịnh vượng và Rừng (PFFP), Việt Nam</p><p><strong>Mã hồ sơ DGBP:</strong> 2022-40010</p><p><strong>Thời gian:</strong> 2023 - 2027 (4 năm)</p><p>WWF và Slow hợp tác xây dựng nền kinh tế rừng bền vững, có khả năng phục hồi và hòa nhập. Dự án chuyển đổi vườn cà phê độc canh sang mô hình nông lâm kết hợp tái sinh, đồng thời bảo vệ và cải thiện rừng tự nhiên, động vật hoang dã và đa dạng sinh học tại tỉnh Quảng Trị.</p><p>Mô hình đối tác cộng đồng-doanh nghiệp này chứng minh rằng bảo vệ rừng và trao quyền cho nông hộ nhỏ là một mô hình kinh doanh có thể mở rộng thương mại.</p>' },
            { heading: 'Vị trí dự án', icon: 'fas fa-map-marker-alt', content: '<p><strong>Tỉnh:</strong> Quảng Trị, khu vực Trường Sơn Trung Bộ, Việt Nam</p><p><strong>Huyện:</strong> Hướng Hóa</p><p><strong>Vị trí chiến lược:</strong> Nằm giữa hai khu bảo tồn thiên nhiên quan trọng - Bắc Hướng Hóa và Dakrông, tạo thành hành lang đa dạng sinh học kết nối hai khu bảo tồn.</p><p>Quảng Trị chiếm 1/7 sản lượng cà phê Arabica của Việt Nam. Ít nhất 53% diện tích đất trồng cà phê trong khu vực bị suy thoái.</p>' },
            { heading: 'Đối tác dự án', icon: 'fas fa-handshake', content: '<div class="row g-2"><div class="col-6"><div class="border rounded p-2 h-100"><strong>WWF Phần Lan</strong><br><small class="text-muted">Đối tác quản lý hành chính</small><br><small>Quản lý tổng thể dự án, hỗ trợ kỹ thuật trồng rừng & bảo tồn</small></div></div><div class="col-6"><div class="border rounded p-2 h-100"><strong>Slow A/S (Đan Mạch)</strong><br><small class="text-muted">Đối tác thương mại chính</small><br><small>Chuỗi giá trị cà phê nông lâm kết hợp, tiếp cận thị trường châu Âu</small></div></div><div class="col-6"><div class="border rounded p-2 h-100"><strong>WWF Việt Nam</strong><br><small class="text-muted">Đối tác triển khai</small><br><small>Hoạt động chuẩn bị, hợp tác cộng đồng, bảo tồn rừng</small></div></div><div class="col-6"><div class="border rounded p-2 h-100"><strong>WWF Đan Mạch</strong><br><small class="text-muted">Đối tác tư vấn</small><br><small>Tư vấn chiến lược và hướng dẫn</small></div></div></div>' },
            { heading: 'Mục tiêu dự án', icon: 'fas fa-bullseye', content: '<p>Góp phần giảm thiểu tổn thương do biến đổi khí hậu đối với rừng tự nhiên quan trọng trong hành lang đa dạng sinh học tại tỉnh Quảng Trị và các vườn cà phê, đồng thời cải thiện sinh kế địa phương thông qua nông lâm kết hợp bền vững và tăng trưởng khu vực tư nhân hòa nhập.</p><p><strong>SDG liên quan:</strong> SDG 2 (Xóa đói), SDG 8 (Việc làm), SDG 12 (Tiêu dùng bền vững), SDG 15 (Hệ sinh thái đất liền)</p><p><strong>Phù hợp chính sách quốc gia:</strong> Chương trình Một tỷ cây xanh của Việt Nam, Kế hoạch Thích ứng Quốc gia, Đóng góp NDC (giảm 9% phát thải GHG so với BAU).</p>' },
            { heading: 'Đối tượng thụ hưởng', icon: 'fas fa-people-carry', content: '<ul><li><strong>2.000 hộ</strong> nông dân nhỏ tại huyện Hướng Hóa</li><li>Người dân tộc thiểu số <strong>Bru-Vân Kiều</strong> chiếm khoảng 50% dân số khu vực</li><li>Phụ nữ chiếm <strong>60%</strong> đối tượng thụ hưởng (1.200 hộ)</li><li>Thanh niên chiếm <strong>25%</strong> đối tượng thụ hưởng</li><li>Ít nhất <strong>100 hộ</strong> hưởng lợi từ hoạt động bảo vệ & phục hồi rừng</li></ul><p>Các hộ mục tiêu có thu nhập trung bình thấp hơn 20% so với mức trung bình của Việt Nam.</p>' },
            { heading: 'Kết quả 1: Nông lâm kết hợp & Sinh kế', icon: 'fas fa-seedling', content: '<p>Mô hình nông lâm kết hợp cung cấp sinh kế dựa trên tự nhiên, bền vững, chống chịu khí hậu, giúp nông hộ nhỏ cải thiện cuộc sống thông qua sản xuất cà phê chất lượng cao, công bằng và thân thiện với rừng.</p><ul><li><strong>2.500 ha</strong> đất chuyển đổi sang nông lâm kết hợp tái sinh</li><li><strong>2.000 hộ</strong> nông dân tăng thu nhập trung bình <strong>40%</strong></li><li><strong>800 tấn</strong> cà phê nhân bán cho khách hàng doanh nghiệp châu Âu</li><li>Tích hợp hơn <strong>20 loài</strong> cây che bóng bản địa với cà phê</li><li>Thành lập vườn ươm giống bản địa để cung cấp cây giống</li></ul>' },
            { heading: 'Kết quả 2: Bảo vệ rừng & Đa dạng sinh học', icon: 'fas fa-tree', content: '<p><strong>18.000 ha</strong> rừng tự nhiên trong hành lang đa dạng sinh học giữa Khu bảo tồn Bắc Hướng Hóa và Đắk Rông được bảo vệ hiệu quả.</p><ul><li>Ít nhất <strong>20 ha</strong> rừng bị tác động nặng được phục hồi</li><li>Ít nhất <strong>100 hộ</strong> hưởng lợi từ hoạt động bảo vệ & phục hồi rừng</li><li>Giám sát bảo vệ rừng và đa dạng sinh học hàng tháng bởi cộng đồng</li><li>Nơi sinh sống của <strong>sao la</strong> - một trong những loài quý hiếm nhất thế giới</li></ul><p><strong>Các mối đe dọa hiện tại:</strong> khai thác gỗ trái phép, trồng keo trong rừng đặc dụng, vùng đệm suy thoái, săn bắt động vật hoang dã, sạt lở đất và lấn chiếm.</p>' },
            { heading: 'Chuỗi giá trị cà phê', icon: 'fas fa-coffee', content: '<ul><li>Chuỗi giá trị tích hợp từ <strong>"cây trồng đến tách cà phê"</strong> - loại bỏ trung gian, đảm bảo truy xuất nguồn gốc</li><li>Hợp đồng dài hạn <strong>7 năm</strong> (không thể chấm dứt) với doanh nghiệp Châu Âu</li><li>Mục tiêu: <strong>1.000 tấn</strong> cà phê nhân xanh bán cho thị trường Châu Âu</li><li>Quy trình chứng nhận hữu cơ (thời gian chuyển đổi tối thiểu 3 năm)</li><li>Cơ sở chế biến địa phương: xay ướt và xay khô</li><li>Mục tiêu chất lượng: Điểm cupping đạt <strong>83</strong>, giảm khuyết tật xuống <strong>5%</strong></li></ul>' },
            { heading: 'Các đầu ra chính (7 Outputs)', icon: 'fas fa-tasks', content: '<ol><li><strong>ĐR1:</strong> Hoạt động chuẩn bị hoàn thành (ESSF, FPIC, lập bản đồ, kế hoạch M&E)</li><li><strong>ĐR2:</strong> Hợp đồng dài hạn với khách hàng doanh nghiệp châu Âu (800 tấn cà phê nhân đến 2027)</li><li><strong>ĐR3:</strong> Nâng cao năng lực nông hộ về nông lâm kết hợp & canh tác hữu cơ (đào tạo 2.000 hộ qua TOT)</li><li><strong>ĐR4:</strong> Mô hình nông lâm kết hợp tối ưu được chứng minh (1.000 ha + 1.500 ha qua mô hình kinh doanh)</li><li><strong>ĐR5:</strong> Thu hoạch và chế biến cà phê được cải thiện (1.000 tấn cà phê nhân đạt tiêu chuẩn)</li><li><strong>ĐR6:</strong> Cộng đồng được hỗ trợ phục hồi và bảo vệ rừng tự nhiên (20 ha phục hồi, 100 hộ tham gia)</li><li><strong>ĐR7:</strong> Chuỗi giá trị vận hành bền vững, quản lý đối tác (cấu trúc quản trị, báo cáo & kiểm toán)</li></ol>' },
            { heading: 'Giới & Hòa nhập xã hội', icon: 'fas fa-venus-mars', content: '<ul><li>Phụ nữ chiếm <strong>60%</strong> đối tượng thụ hưởng mục tiêu</li><li>Thanh niên chiếm <strong>25%</strong> đối tượng thụ hưởng</li><li>Quan tâm đặc biệt đến người dân tộc thiểu số <strong>Bru-Vân Kiều</strong></li><li>Cung cấp thông tin cho người dân tộc thiểu số về quyền, nghĩa vụ và cơ chế khiếu nại</li><li>Tôn trọng văn hóa và tập quán trong tham vấn cộng đồng</li><li>Quyền con người được duy trì thông qua các quy trình ESSF và FPIC</li></ul>' },
            { heading: 'Bảo vệ Môi trường & Xã hội', icon: 'fas fa-shield-alt', content: '<ul><li>Tuân thủ UN Global Compact, UNGPs và tiêu chuẩn ILO</li><li>Nghiêm cấm lao động trẻ em với giám sát làm điều kiện tham gia</li><li>Loại trừ thuốc trừ sâu WHO Class IA/IB và Công ước Stockholm</li><li>Canh tác hữu cơ: chỉ sử dụng phân bón hữu cơ và ủ phân</li><li>Hệ thống xử lý nước thải cho cơ sở chế biến (than sinh học tre, đất ngập nước nhân tạo)</li><li>Đào tạo bảo tồn đất cho nông dân</li><li>Cơ chế giải quyết khiếu nại được công bố và hoạt động</li></ul>' },
            { heading: 'Tiến độ & Bền vững', icon: 'fas fa-calendar-alt', content: '<p><strong>2023:</strong> Giai đoạn chuẩn bị - thành lập pháp nhân Slow VN, ESSF, FPIC, lập bản đồ khu vực</p><p><strong>2024:</strong> Chuyển đổi 100ha, bán 60 tấn, đào tạo đợt 1</p><p><strong>2025:</strong> Chuyển đổi 600ha, bán 300 tấn, chứng nhận hữu cơ</p><p><strong>2026:</strong> Chuyển đổi 1.000ha, bán 600 tấn</p><p><strong>2027:</strong> Hoàn thành 2.500ha, bán 800 tấn, 2.000 hộ tăng thu nhập</p><hr><p><strong>Bền vững sau dự án:</strong> Dự án sẽ hoạt động như một phần tích hợp trong hoạt động của Slow. WWF cam kết tiếp tục hỗ trợ khu vực Trung Trường Sơn lâu dài.</p>' }
        ]
    },
    en: {
        title: 'PFFP Project Document',
        sections: [
            { heading: 'Project Overview', icon: 'fas fa-info-circle', content: '<p><strong>Project Title:</strong> Prosperous Farmers and Forests Partnership (PFFP), Viet Nam</p><p><strong>DGBP File No:</strong> 2022-40010</p><p><strong>Duration:</strong> 2023 - 2027 (4 years)</p><p>WWF and Slow are joining forces to build sustainable, resilient, and inclusive forest economies. The partnership transforms monoculture coffee plantations to regenerative agroforestry production while protecting and conserving natural forest areas, wildlife and biodiversity in Quang Tri province, Viet Nam.</p><p>This community-corporate partnership model demonstrates that protecting forests and empowering smallholders is a commercially scalable business model.</p>' },
            { heading: 'Project Location', icon: 'fas fa-map-marker-alt', content: '<p><strong>Province:</strong> Quang Tri, Central Annamites region, Vietnam</p><p><strong>District:</strong> Huong Hoa</p><p><strong>Strategic location:</strong> Between two critical nature reserves - Bac Huong Hoa and Da Krong (Dak Rong), forming a biodiversity corridor connecting the two reserves.</p><p>Quang Tri hosts 1/7th of Vietnam\'s Arabica coffee production. At least 53% of coffee lands in the area are considered degraded.</p>' },
            { heading: 'Project Partners', icon: 'fas fa-handshake', content: '<div class="row g-2"><div class="col-6"><div class="border rounded p-2 h-100"><strong>WWF Finland</strong><br><small class="text-muted">Administrative Partner</small><br><small>Overall project management, technical support for reforestation & conservation</small></div></div><div class="col-6"><div class="border rounded p-2 h-100"><strong>Slow A/S (Denmark)</strong><br><small class="text-muted">Key Commercial Partner</small><br><small>Agroforestry coffee value chain, European market access</small></div></div><div class="col-6"><div class="border rounded p-2 h-100"><strong>WWF Viet Nam</strong><br><small class="text-muted">Implementing Partner</small><br><small>Preparatory activities, community engagement, forest conservation</small></div></div><div class="col-6"><div class="border rounded p-2 h-100"><strong>WWF Denmark</strong><br><small class="text-muted">Advisory Partner</small><br><small>Strategic advice and guidance</small></div></div></div>' },
            { heading: 'Project Objective', icon: 'fas fa-bullseye', content: '<p>Contribute to climate vulnerability reduction of critically impacted natural forest in the biodiversity corridor in Quang Tri province and coffee plantations, and improve local livelihoods through sustainable agroforestry and inclusive private sector growth.</p><p><strong>Related SDGs:</strong> SDG 2 (Zero Hunger), SDG 8 (Decent Work), SDG 12 (Responsible Consumption), SDG 15 (Life on Land)</p><p><strong>National alignment:</strong> Vietnam\'s One Billion Tree Program, National Adaptation Plan, NDC contribution (9% GHG reduction vs. BAU).</p>' },
            { heading: 'Target Beneficiaries', icon: 'fas fa-people-carry', content: '<ul><li><strong>2,000</strong> smallholder farming households in Huong Hoa district</li><li><strong>Bru-Van Kieu</strong> ethnic minorities account for approximately 50% of the population</li><li>Women represent <strong>60%</strong> of target beneficiaries (1,200 households)</li><li>Youth represent <strong>25%</strong> of beneficiaries</li><li>At least <strong>100 households</strong> benefiting from forest protection & restoration</li></ul><p>Targeted households earn an average income 20% less than Vietnam\'s national average.</p>' },
            { heading: 'Outcome 1: Agroforestry & Livelihoods', icon: 'fas fa-seedling', content: '<p>The agroforestry model provides climate resilient, sustainable nature-based livelihoods which enable smallholders to improve their livelihoods through the production of high-quality, fair and forest-friendly coffee.</p><ul><li><strong>2,500 ha</strong> of land transformed to regenerative agroforestry</li><li><strong>2,000 households</strong> with income increase of <strong>40%</strong> on average</li><li><strong>800 tons</strong> of green beans sold to European corporate off-takers</li><li>Integration of more than <strong>20 native shade tree species</strong> with coffee</li><li>Native species nurseries established for seedling supply</li></ul>' },
            { heading: 'Outcome 2: Forest Protection & Biodiversity', icon: 'fas fa-tree', content: '<p><strong>18,000 ha</strong> of natural forest in the biodiversity corridor between Bac Huong Hoa and Dak Rong Nature Reserves effectively protected.</p><ul><li>At least <strong>20 ha</strong> of critically impacted forest restored</li><li>At least <strong>100 households</strong> benefiting from protection & restoration activities</li><li>Monthly forest protection and biodiversity monitoring by communities</li><li>Home to <strong>saola</strong> - one of the world\'s rarest mammals</li></ul><p><strong>Current threats:</strong> illegal logging, acacia plantation in special use forests, degraded buffer zones, wildlife poaching, landslides and encroachment.</p>' },
            { heading: 'Coffee Value Chain', icon: 'fas fa-coffee', content: '<ul><li>Fully integrated <strong>"crop to cup"</strong> value chain - removing middlemen, ensuring full traceability</li><li>Long-term contracts (<strong>7 years</strong> non-terminable) with European corporate off-takers</li><li>Target: <strong>1,000 tonnes</strong> of green beans sold to European markets</li><li>Organic certification process (minimum 3-year conversion period)</li><li>Local processing facilities: wet milling and dry milling</li><li>Quality target: Cupping score <strong>83</strong>, defect rate reduced to <strong>5%</strong></li></ul>' },
            { heading: 'Key Outputs (7 Outputs)', icon: 'fas fa-tasks', content: '<ol><li><strong>OP1:</strong> Preparatory activities completed (ESSF, FPIC, mapping, M&E plan)</li><li><strong>OP2:</strong> Long-term contracts with European corporate off-takers (800 tons by 2027)</li><li><strong>OP3:</strong> Smallholder capacity strengthened for agroforestry & organic cultivation (2,000 HH trained via TOT)</li><li><strong>OP4:</strong> Optimal agroforestry model demonstrated (1,000 ha + 1,500 ha via business model)</li><li><strong>OP5:</strong> Coffee harvesting & processing improved (1,000 tons meeting quality standards)</li><li><strong>OP6:</strong> Communities supported in forest restoration & protection (20 ha restored, 100 HH engaged)</li><li><strong>OP7:</strong> Value chain operated sustainably, partnership managed (governance structure, reporting & audits)</li></ol>' },
            { heading: 'Gender & Social Inclusion', icon: 'fas fa-venus-mars', content: '<ul><li>Women represent <strong>60%</strong> of target beneficiaries</li><li>Youth represent <strong>25%</strong> of beneficiaries</li><li>Special attention to <strong>Bru-Van Kieu</strong> ethnic minorities</li><li>Information provided to ethnic minorities about rights, obligations and grievance mechanisms</li><li>Respect for ethnic minority cultures and practices in community consultation</li><li>Human rights upheld through ESSF and FPIC processes</li></ul>' },
            { heading: 'Environmental & Social Safeguards', icon: 'fas fa-shield-alt', content: '<ul><li>Compliance with UN Global Compact, UNGPs and ILO standards</li><li>Strict prohibition of child labor with monitoring as pre-condition for participation</li><li>Exclusion of WHO Class IA/IB and Stockholm Convention-listed pesticides</li><li>Organic farming: only organic fertilizers and composting</li><li>Wastewater treatment for processing facilities (bamboo biochar, constructed wetland)</li><li>Soil conservation training for farmers</li><li>Grievance Redress Mechanism disclosed and operational</li></ul>' },
            { heading: 'Timeline & Sustainability', icon: 'fas fa-calendar-alt', content: '<p><strong>2023:</strong> Preparation phase - Slow VN entity setup, ESSF, FPIC, area mapping</p><p><strong>2024:</strong> Convert 100ha, sell 60 tons, first training batch</p><p><strong>2025:</strong> Convert 600ha, sell 300 tons, organic certification</p><p><strong>2026:</strong> Convert 1,000ha, sell 600 tons</p><p><strong>2027:</strong> Complete 2,500ha, sell 800 tons, 2,000 HH income increase</p><hr><p><strong>Post-project sustainability:</strong> The project will operate as a fully integrated part of Slow\'s operations. WWF is committed to long-term support in the Central Annamites landscape.</p>' }
        ]
    }
};

function showProjectDocument() {
    var isVi = currentLang === 'vi';
    var doc = isVi ? PROJECT_DOC.vi : PROJECT_DOC.en;
    var html = '';
    doc.sections.forEach(function (s, idx) {
        html += '<div class="detail-group-title"><i class="' + s.icon + '"></i> ' + s.heading + '</div>';
        html += '<div class="p-2 mb-3">' + s.content + '</div>';
    });
    $('#modalActions').html('');
    $('#printFooterContent').html('');
    $('#farmerDetailTitle').text(doc.title);
    $('#detailContent').html(html);
    var modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('farmerDetailModal'));
    modal.show();
}

// ==========================================
// KPI CROSS-LINK: Navigate to related table tab
// ==========================================
function navigateToTable(tabName, searchId) {
    // 1. Switch to Dashboard main tab
    var mainTabEl = document.getElementById('dashboard-main-tab');
    if (mainTabEl) {
        var mainTab = new bootstrap.Tab(mainTabEl);
        mainTab.show();
    }
    // 2. Switch to the correct data sub-tab
    var dataTabMap = {
        'Farmers': 'farmers-tab',
        'Plots': 'plots-tab',
        'Yearly_Data': 'yearly-tab'
    };
    var dataTabId = dataTabMap[tabName];
    if (dataTabId) {
        setTimeout(function () {
            var dataTabEl = document.getElementById(dataTabId);
            if (dataTabEl) {
                var dataTab = new bootstrap.Tab(dataTabEl);
                dataTab.show();
            }
            // 3. Scroll to table and optionally highlight a row
            setTimeout(function () {
                var wrapper = document.querySelector('#' + dataTabId.replace('-tab', '-pane') + ' .dataTables_wrapper');
                if (wrapper) {
                    wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                if (searchId) {
                    highlightTableRow(tabName, searchId);
                }
            }, 200);
        }, 150);
    }
}

// ==========================================
// HOME PAGE: Navigate to module from Home cards
// ==========================================
function goHomeTab() {
    clearHomeSearchResults();
    switchMainTab('home-main-tab');
}

function switchMainTab(tabId) {
    // Deactivate data-browser-pane if it was manually activated
    var dbPane = document.getElementById('data-browser-pane');
    if (dbPane && dbPane.classList.contains('active')) {
        dbPane.classList.remove('show', 'active');
    }
    var tabEl = document.getElementById(tabId);
    if (tabEl) bootstrap.Tab.getOrCreateInstance(tabEl).show();
    // Update bottom bar active state
    $('#mobileBottomBar .bottom-bar-btn').removeClass('active');
    $('#mobileBottomBar .bottom-bar-btn[data-target="' + tabId + '"]').addClass('active');
}

function navigateToModule(module) {
    // Farmers always opens grouped list (mobile + desktop)
    if (module === 'farmers') {
        showGroupedFarmerList();
        return;
    }

    var moduleMap = {
        'farmers':   { mainTab: 'dashboard-main-tab', subTab: 'farmers-tab' },
        'plots':     { mainTab: 'dashboard-main-tab', subTab: 'plots-tab' },
        'yearly':    { mainTab: 'dashboard-main-tab', subTab: 'yearly-tab' },
        'analytics': { mainTab: 'analytics-main-tab' },
        'users':     { mainTab: 'config-main-tab',    subTab: 'users-tab' }
    };

    var target = moduleMap[module];
    if (target) {
        // Show filters when navigating to data modules (mobile responsive)
        document.body.classList.add('show-filters');
        // Switch main tab
        var mainTabEl = document.getElementById(target.mainTab);
        if (mainTabEl) {
            var mainTab = new bootstrap.Tab(mainTabEl);
            mainTab.show();
        }
        // Switch sub-tab if needed
        if (target.subTab) {
            setTimeout(function () {
                var subTabEl = document.getElementById(target.subTab);
                if (subTabEl) {
                    var subTab = new bootstrap.Tab(subTabEl);
                    subTab.show();
                }
            }, 150);
        }
    } else if (['op6', 'species', 'admin', 'training'].indexOf(module) >= 0) {
        showLibraryList(module);
    }
}

// ==========================================
// DATA BROWSER — Breadcrumb Drill-Down Navigation
// ==========================================
var dbState = { type: null, year: null, group: null, farmerId: null };
var dbRenderedData = []; // current level data for filtering

function openDataBrowser(type) {
    dbState = { type: type, year: null, group: null, farmerId: null };
    // Remove Home tab class, add filters
    document.body.classList.remove('tab-home');
    document.body.classList.add('show-filters');
    // Switch to data-browser-pane
    document.querySelectorAll('#mainTabContent > .tab-pane').forEach(function (p) {
        p.classList.remove('show', 'active');
    });
    document.querySelectorAll('.nav-link[data-bs-toggle="tab"]').forEach(function (t) {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
    });
    var dbPane = document.getElementById('data-browser-pane');
    if (dbPane) { dbPane.classList.add('show', 'active'); }
    // Hide AI widget on data browser
    var aiW = document.getElementById('aiChatWidget');
    if (aiW) aiW.style.display = 'none';
    document.getElementById('dbSearch').value = '';
    var dbSearchBar = document.getElementById('dbSearchBar');
    if (dbSearchBar) dbSearchBar.style.display = '';
    dbUpdateBreadcrumb();
    dbRenderYears();
}

function dbGoHome() {
    dbState = { type: null, year: null, group: null, farmerId: null };
    // Deactivate data-browser-pane explicitly (it was activated outside Bootstrap)
    var dbPane = document.getElementById('data-browser-pane');
    if (dbPane) { dbPane.classList.remove('show', 'active'); }
    // Clear any home search results
    clearHomeSearchResults();
    // Switch back to home
    switchMainTab('home-main-tab');
}

function dbGoToLevel(level) {
    if (level === 0) { dbGoHome(); return; }
    document.getElementById('dbSearch').value = '';
    if (level === 1) { dbState.year = null; dbState.group = null; dbState.farmerId = null; dbRenderYears(); }
    else if (level === 2) { dbState.group = null; dbState.farmerId = null; dbRenderGroups(); }
    else if (level === 3) { dbState.farmerId = null; dbRenderFarmers(); }
    dbUpdateBreadcrumb();
}

// Re-render current Data Browser view after data refresh
function dbRefreshCurrentView() {
    var dbPane = document.getElementById('data-browser-pane');
    if (!dbPane || !dbPane.classList.contains('active')) return;
    if (!dbState.type) return;
    if (dbState.farmerId) { dbRenderRecords(); }
    else if (dbState.group) { dbRenderFarmers(); }
    else if (dbState.year) { dbRenderGroups(); }
    else { dbRenderYears(); }
    dbUpdateBreadcrumb();
}

function dbUpdateBreadcrumb() {
    var isVi = currentLang === 'vi';
    var typeLabels = { 'Farmers': isVi ? 'Hộ dân' : 'Farmers', 'Plots': isVi ? 'Lô đất' : 'Plots', 'Supported': isVi ? 'Hỗ trợ' : 'Support', 'Yearly_Data': isVi ? 'Đánh giá hàng năm' : 'Yearly Data' };

    var crumbType = document.getElementById('dbCrumbType');
    var crumbYear = document.getElementById('dbCrumbYear');
    var crumbGroup = document.getElementById('dbCrumbGroup');
    var crumbFarmer = document.getElementById('dbCrumbFarmer');

    crumbType.style.display = dbState.type ? '' : 'none';
    crumbYear.style.display = dbState.year ? '' : 'none';
    crumbGroup.style.display = dbState.group ? '' : 'none';
    crumbFarmer.style.display = dbState.farmerId ? '' : 'none';

    if (dbState.type) {
        crumbType.textContent = typeLabels[dbState.type] || dbState.type;
        crumbType.className = 'db-crumb' + (!dbState.year ? ' db-crumb-active' : '');
        crumbType.onclick = function () { dbGoToLevel(1); };
    }
    if (dbState.year) {
        var yearLabel = dbState.year;
        if (dropMap[dbState.year]) yearLabel = (isVi ? dropMap[dbState.year].vi : dropMap[dbState.year].en) || dbState.year;
        crumbYear.textContent = yearLabel;
        crumbYear.className = 'db-crumb' + (!dbState.group ? ' db-crumb-active' : '');
        crumbYear.onclick = function () { dbGoToLevel(2); };
    }
    if (dbState.group) {
        var gLabel = dbState.group;
        if (adminMap[dbState.group]) gLabel = (isVi ? adminMap[dbState.group].vi : adminMap[dbState.group].en) || dbState.group;
        crumbGroup.textContent = gLabel;
        crumbGroup.className = 'db-crumb' + (!dbState.farmerId ? ' db-crumb-active' : '');
        crumbGroup.onclick = function () { dbGoToLevel(3); };
    }
    if (dbState.farmerId) {
        var farmer = (rawData.farmers || []).find(function (f) { return f.Farmer_ID === dbState.farmerId; });
        crumbFarmer.textContent = farmer ? farmer.Full_Name : dbState.farmerId;
        crumbFarmer.className = 'db-crumb db-crumb-active';
        crumbFarmer.onclick = null;
    }
}

function dbRenderYears() {
    var isVi = currentLang === 'vi';
    // Get participation years from dropMap
    var years = [];
    Object.keys(dropMap).forEach(function (k) {
        if (dropMap[k].condition === 'Participation Year') {
            years.push({ code: k, label: isVi ? dropMap[k].vi : dropMap[k].en });
        }
    });
    years.sort(function (a, b) { return b.code.localeCompare(a.code); });

    // Count farmers per year
    var farmers = rawData.farmers || [];
    var yearCounts = {};
    farmers.forEach(function (f) {
        var y = f['Participation Year'];
        if (y) { yearCounts[y] = (yearCounts[y] || 0) + 1; }
    });

    var html = '<div class="db-toolbar"><div class="db-level-title">' + (isVi ? 'Chọn năm tham gia' : 'Select Participation Year') + '</div></div>';
    html += '<div class="db-year-grid">';
    years.forEach(function (y) {
        var count = yearCounts[y.code] || 0;
        html += '<div class="db-year-card" onclick="dbSelectYear(\'' + escapeHtml(y.code) + '\')">';
        html += '<div class="db-year-label">' + escapeHtml(y.label) + '</div>';
        html += '<div class="db-year-count">' + count + ' ' + (isVi ? 'hộ' : 'farmers') + '</div>';
        html += '</div>';
    });
    html += '</div>';
    document.getElementById('dbContent').innerHTML = html;
    dbRenderedData = years;
}

function dbSelectYear(yearCode) {
    dbState.year = yearCode;
    dbState.group = null;
    dbState.farmerId = null;
    document.getElementById('dbSearch').value = '';
    dbUpdateBreadcrumb();
    dbRenderGroups();
}

function dbRenderGroups() {
    var isVi = currentLang === 'vi';
    var farmers = (rawData.farmers || []).filter(function (f) { return f['Participation Year'] === dbState.year; });
    var plots = rawData.plots || [];
    var supported = rawData.supported || [];

    // Build groups
    var groups = {};
    farmers.forEach(function (f) {
        var g = f.Farmer_Group_Name || 'N/A';
        if (!groups[g]) groups[g] = { farmers: [], plotCount: 0, area: 0, supportCount: 0 };
        groups[g].farmers.push(f);
        groups[g].area += parseFloat(f.Total_Coffee_Area) || 0;
    });

    var farmerSet = {};
    farmers.forEach(function (f) { farmerSet[f.Farmer_ID] = f.Farmer_Group_Name || 'N/A'; });
    plots.forEach(function (p) {
        var g = farmerSet[p.Farmer_ID];
        if (g && groups[g]) groups[g].plotCount++;
    });
    supported.forEach(function (s) {
        var fid = s['Farmer ID'] || s.Farmer_ID;
        var g = farmerSet[fid];
        if (g && groups[g]) groups[g].supportCount++;
    });

    var groupNames = Object.keys(groups).sort();
    dbRenderedData = groupNames.map(function (gn) { return { code: gn, data: groups[gn] }; });

    var html = '<div class="db-toolbar"><div class="db-level-title">' + groupNames.length + ' ' + (isVi ? 'nhóm' : 'groups') + ' &middot; ' + farmers.length + ' ' + (isVi ? 'hộ' : 'farmers') + '</div></div>';
    html += '<div class="db-group-grid">';
    groupNames.forEach(function (gn) {
        var g = groups[gn];
        var gLabel = gn;
        if (adminMap[gn]) gLabel = (isVi ? adminMap[gn].vi : adminMap[gn].en) || gn;
        html += '<div class="db-group-card" onclick="dbSelectGroup(\'' + escapeHtml(gn) + '\')">';
        html += '<div class="db-group-name"><i class="fas fa-layer-group me-2"></i>' + escapeHtml(gLabel) + '</div>';
        html += '<div class="db-group-stats">';
        html += '<div class="db-group-stat-item"><div class="db-group-stat-value">' + g.farmers.length + '</div><div class="db-group-stat-label">' + (isVi ? 'Hộ dân' : 'Farmers') + '</div></div>';
        html += '<div class="db-group-stat-item"><div class="db-group-stat-value">' + g.plotCount + '</div><div class="db-group-stat-label">' + (isVi ? 'Lô đất' : 'Plots') + '</div></div>';
        html += '<div class="db-group-stat-item"><div class="db-group-stat-value">' + g.area.toFixed(1) + '</div><div class="db-group-stat-label">ha</div></div>';
        html += '</div></div>';
    });
    html += '</div>';
    document.getElementById('dbContent').innerHTML = html;
}

function dbSelectGroup(groupCode) {
    dbState.group = groupCode;
    dbState.farmerId = null;
    document.getElementById('dbSearch').value = '';
    dbUpdateBreadcrumb();
    dbRenderFarmers();
}

function dbRenderFarmers() {
    var isVi = currentLang === 'vi';
    var farmers = (rawData.farmers || []).filter(function (f) {
        return f['Participation Year'] === dbState.year && (f.Farmer_Group_Name || 'N/A') === dbState.group;
    });
    farmers.sort(function (a, b) { return (a.Full_Name || '').localeCompare(b.Full_Name || ''); });
    dbRenderedData = farmers;

    var html = '<div class="db-toolbar">';
    html += '<div class="db-level-title">' + (isVi ? 'Danh sách hộ dân' : 'Farmer List') + ' (' + farmers.length + ')</div>';
    if (userPermissions.canAdd) {
        html += '<button class="btn-add" onclick="showAddFarmerModal()"><i class="fas fa-plus me-1"></i>' + (isVi ? 'Thêm hộ dân' : 'Add Farmer') + '</button>';
    }
    html += '</div>';

    // Excel-like table with key farmer columns
    var farmerCols = ['Farmer_ID', 'Full_Name', 'Year_Of_Birth', 'Gender', 'Phone_Number', 'Total_Coffee_Area', 'Number of coffee farm plots', 'Status'];
    var farmerLabels = FIELD_LABELS.Farmers;

    html += '<div class="table-responsive"><table class="db-record-table">';
    html += '<thead><tr><th>#</th>';
    farmerCols.forEach(function (k) {
        var lk = farmerLabels[k] || k;
        html += '<th>' + escapeHtml(translations[currentLang][lk] || k) + '</th>';
    });
    html += '<th>' + (isVi ? 'Thao tác' : 'Actions') + '</th>';
    html += '</tr></thead><tbody>';

    farmers.forEach(function (f, idx) {
        html += '<tr style="cursor:pointer" onclick="dbSelectFarmer(\'' + escapeHtml(f.Farmer_ID) + '\')">';
        html += '<td>' + (idx + 1) + '</td>';
        farmerCols.forEach(function (k) {
            var val = f[k];
            if (val === undefined || val === null) val = '';
            val = resolveValue(k, val, 'Farmers');
            var emptyClass = (String(val).trim() === '' || val === 0) ? ' class="db-empty-cell"' : '';
            html += '<td' + emptyClass + '>' + escapeHtml(String(val)) + '</td>';
        });
        html += '<td class="text-nowrap" onclick="event.stopPropagation()">';
        html += '<button class="db-action-btn btn-view" onclick="showFarmerDetails(\'' + escapeHtml(f.Farmer_ID) + '\')"><i class="fas fa-eye"></i></button>';
        if (userPermissions.canEdit) html += '<button class="db-action-btn btn-edit" onclick="openEditForm(\'Farmers\', \'' + escapeHtml(f.Farmer_ID) + '\')"><i class="fas fa-edit"></i></button>';
        if (userPermissions.canDelete) html += '<button class="db-action-btn btn-delete" onclick="deleteItem(\'Farmers\', \'' + escapeHtml(f.Farmer_ID) + '\')"><i class="fas fa-trash"></i></button>';
        html += '</td></tr>';
    });
    html += '</tbody></table></div>';
    document.getElementById('dbContent').innerHTML = html;
}

function dbSelectFarmer(farmerId) {
    if (dbState.type === 'Farmers') {
        // Open detail modal directly (matches reference layout)
        showFarmerDetails(farmerId);
        return;
    }
    dbState.farmerId = farmerId;
    document.getElementById('dbSearch').value = '';
    dbUpdateBreadcrumb();
    dbRenderRecords();
}

function dbRenderRecords() {
    var isVi = currentLang === 'vi';
    var farmerId = dbState.farmerId;
    var type = dbState.type;
    var farmer = (rawData.farmers || []).find(function (f) { return f.Farmer_ID === farmerId; });

    if (type === 'Farmers') {
        dbRenderFarmerDetail(farmer);
    } else if (type === 'Plots') {
        dbRenderChildTable(farmerId, 'Plots', 'Plot_Id');
    } else if (type === 'Supported') {
        dbRenderChildTable(farmerId, 'Supported', 'Support_ID');
    } else if (type === 'Yearly_Data') {
        dbRenderChildTable(farmerId, 'Yearly_Data', 'Record_Id');
    }
}

function dbRenderFarmerDetail(farmer) {
    if (!farmer) { document.getElementById('dbContent').innerHTML = '<p class="text-muted">Not found</p>'; return; }
    var isVi = currentLang === 'vi';
    var labels = FIELD_LABELS.Farmers;
    var html = '<div class="db-toolbar">';
    html += '<div class="db-level-title"><i class="fas fa-user text-success me-2"></i>' + escapeHtml(farmer.Full_Name || '') + ' (' + farmer.Farmer_ID + ')</div>';
    html += '<div>';
    html += '<button class="db-action-btn btn-view" onclick="dbPrintFarmerReport(\'' + farmer.Farmer_ID + '\')"><i class="fas fa-print"></i> ' + (isVi ? 'In báo cáo' : 'Print Report') + '</button>';
    if (userPermissions.canEdit) html += '<button class="db-action-btn btn-edit" onclick="openEditForm(\'Farmers\', \'' + farmer.Farmer_ID + '\')"><i class="fas fa-edit"></i> ' + (isVi ? 'Sửa' : 'Edit') + '</button>';
    if (userPermissions.canDelete) html += '<button class="db-action-btn btn-delete" onclick="deleteItem(\'Farmers\', \'' + farmer.Farmer_ID + '\')"><i class="fas fa-trash"></i> ' + (isVi ? 'Xóa' : 'Delete') + '</button>';
    html += '</div></div>';

    // Info grid
    html += '<div class="detail-grid-container mb-3">';
    Object.keys(labels).forEach(function (key) {
        var val = farmer[key] || '';
        var label = translations[currentLang][labels[key]] || key;
        if (key === 'Farmer_ID') return; // already shown in title
        // Resolve using FIELD_MAPPING (condition-aware)
        val = resolveValue(key, val, 'Farmers');
        var emptyClass = (String(val).trim() === '' || String(val).trim() === '-') ? ' db-empty-cell' : '';
        html += '<div class="detail-item' + emptyClass + '"><span class="detail-label">' + escapeHtml(label) + '</span><span class="detail-value">' + escapeHtml(String(val) || '-') + '</span></div>';
    });
    html += '</div>';

    // Related tables summary
    var relPlots = (rawData.plots || []).filter(function (p) { return p.Farmer_ID === farmer.Farmer_ID; });
    var relYearly = (rawData.yearly || []).filter(function (y) { return y.Farmer_ID === farmer.Farmer_ID; });
    var relSupported = (rawData.supported || []).filter(function (s) { return (s['Farmer ID'] || s.Farmer_ID) === farmer.Farmer_ID; });

    html += '<div class="d-flex flex-wrap gap-2 mt-3">';
    html += '<button class="btn btn-sm btn-outline-info" onclick="dbState.type=\'Plots\';dbRenderRecords();dbUpdateBreadcrumb()"><i class="fas fa-map me-1"></i>' + (isVi ? 'Lô đất' : 'Plots') + ' (' + relPlots.length + ')</button>';
    html += '<button class="btn btn-sm btn-outline-warning" onclick="dbState.type=\'Yearly_Data\';dbRenderRecords();dbUpdateBreadcrumb()"><i class="fas fa-calendar-check me-1"></i>' + (isVi ? 'Đánh giá' : 'Yearly') + ' (' + relYearly.length + ')</button>';
    html += '<button class="btn btn-sm btn-outline-success" onclick="dbState.type=\'Supported\';dbRenderRecords();dbUpdateBreadcrumb()"><i class="fas fa-hands-helping me-1"></i>' + (isVi ? 'Hỗ trợ' : 'Support') + ' (' + relSupported.length + ')</button>';
    html += '</div>';

    document.getElementById('dbContent').innerHTML = html;
}

function dbRenderChildTable(farmerId, type, idCol) {
    var isVi = currentLang === 'vi';
    var labels = FIELD_LABELS[type] || {};
    var dataSource;

    if (type === 'Plots') {
        dataSource = (rawData.plots || []).filter(function (r) { return r.Farmer_ID === farmerId; });
    } else if (type === 'Supported') {
        dataSource = (rawData.supported || []).filter(function (r) { return (r['Farmer ID'] || r.Farmer_ID) === farmerId; });
        // Optionally filter by year
        if (dbState.year) {
            var year4 = dbState.year;
            // dropMap year codes may be like '24Y' - need to check supported_year format
            // Supported year is stored as '2024' etc.
            var matchYears = [year4];
            // Try mapping: if year is '24Y', also match '2024'
            if (/^\d{2}Y$/.test(year4)) matchYears.push('20' + year4.replace('Y', ''));
            // If year is '2024', also match '24Y'
            if (/^\d{4}$/.test(year4)) matchYears.push(year4.slice(-2) + 'Y');
            dataSource = dataSource.filter(function (r) {
                var sy = String(r['Supported year'] || '');
                return matchYears.some(function (my) { return sy === my; });
            });
        }
    } else if (type === 'Yearly_Data') {
        dataSource = (rawData.yearly || []).filter(function (r) { return r.Farmer_ID === farmerId; });
        if (dbState.year) {
            dataSource = dataSource.filter(function (r) { return r.Year === dbState.year; });
        }
    }
    dataSource = dataSource || [];
    dbRenderedData = dataSource;

    // Add button label
    var addLabels = { 'Plots': isVi ? 'Thêm lô' : 'Add Plot', 'Supported': isVi ? 'Thêm hỗ trợ' : 'Add Support', 'Yearly_Data': isVi ? 'Thêm năm' : 'Add Yearly' };
    var addFns = { 'Plots': 'showAddPlotModal', 'Supported': 'showAddSupportedModal', 'Yearly_Data': 'showAddYearlyModal' };

    var html = '<div class="db-toolbar">';
    html += '<div class="db-level-title">' + (translations[currentLang]['homeCard' + (type === 'Yearly_Data' ? 'Yearly' : type === 'Supported' ? 'Supported' : type)] || type) + ' (' + dataSource.length + ')</div>';
    if (userPermissions.canAdd && addFns[type]) {
        html += '<button class="btn-add" onclick="' + addFns[type] + '(\'' + escapeHtml(farmerId) + '\')"><i class="fas fa-plus me-1"></i>' + addLabels[type] + '</button>';
    }
    html += '</div>';

    if (dataSource.length === 0) {
        html += '<p class="text-muted mt-3">' + (isVi ? 'Chưa có dữ liệu' : 'No data') + '</p>';
        document.getElementById('dbContent').innerHTML = html;
        return;
    }

    // Select visible columns (skip Farmer_ID and limit for readability)
    var visibleKeys = Object.keys(labels).filter(function (k) { return k !== 'Farmer_ID' && k !== 'Farmer ID'; });

    html += '<div class="table-responsive"><table class="db-record-table" id="dbChildTable">';
    html += '<thead><tr>';
    html += '<th data-col="_idx">#<span class="sort-icon"></span></th>';
    visibleKeys.forEach(function (k) {
        html += '<th data-col="' + escapeHtml(k) + '">' + escapeHtml(translations[currentLang][labels[k]] || k) + '<span class="sort-icon"></span></th>';
    });
    if (userPermissions.canEdit || userPermissions.canDelete) {
        html += '<th style="cursor:default">' + (isVi ? 'Thao tác' : 'Actions') + '</th>';
    }
    html += '</tr></thead><tbody>';

    dataSource.forEach(function (row, idx) {
        var itemId = row[idCol] || '';
        html += '<tr data-id="' + escapeHtml(itemId) + '" data-type="' + type + '" onclick="dbRowClick(event, \'' + type + '\', \'' + escapeHtml(itemId) + '\')">';
        html += '<td>' + (idx + 1) + '</td>';
        visibleKeys.forEach(function (k) {
            var val = row[k];
            if (val === undefined || val === null) val = '';
            val = resolveValue(k, val, type);
            var isNum = typeof val === 'number' || (!isNaN(parseFloat(val)) && isFinite(val) && String(val).trim() !== '');
            var emptyClass = (String(val).trim() === '' || val === 0) ? ' db-empty-cell' : '';
            var numClass = (isNum && !emptyClass) ? ' num-col' : '';
            html += '<td class="' + emptyClass + numClass + '">' + escapeHtml(String(val)) + '</td>';
        });
        if (userPermissions.canEdit || userPermissions.canDelete) {
            html += '<td class="text-nowrap" onclick="event.stopPropagation()">';
            if (userPermissions.canEdit) html += '<button class="db-action-btn btn-edit" onclick="openEditForm(\'' + type + '\', \'' + escapeHtml(itemId) + '\')"><i class="fas fa-edit"></i></button>';
            if (userPermissions.canDelete) html += '<button class="db-action-btn btn-delete" onclick="deleteItem(\'' + type + '\', \'' + escapeHtml(itemId) + '\')"><i class="fas fa-trash"></i></button>';
            html += '</td>';
        }
        html += '</tr>';
    });
    html += '</tbody></table></div>';

    document.getElementById('dbContent').innerHTML = html;
    // Attach sort handlers
    dbAttachSort('dbChildTable', dataSource, visibleKeys, type, idCol);
}

// Click on any table row → show detail view
function dbRowClick(event, type, itemId) {
    if (event.target.closest('.db-action-btn')) return; // Don't trigger on action buttons
    showSingleItemDetails(type, itemId);
}

// Attach sort handlers to table headers
function dbAttachSort(tableId, dataSource, visibleKeys, type, idCol) {
    var table = document.getElementById(tableId);
    if (!table) return;
    var headers = table.querySelectorAll('thead th[data-col]');
    headers.forEach(function (th) {
        th.addEventListener('click', function () {
            var col = th.getAttribute('data-col');
            var isAsc = th.classList.contains('sort-asc');
            // Remove sort from all headers
            headers.forEach(function (h) { h.classList.remove('sort-asc', 'sort-desc'); });
            // Toggle direction
            if (isAsc) { th.classList.add('sort-desc'); } else { th.classList.add('sort-asc'); }
            var dir = th.classList.contains('sort-asc') ? 1 : -1;
            var tbody = table.querySelector('tbody');
            var rows = Array.from(tbody.querySelectorAll('tr'));
            var colIdx = Array.from(th.parentNode.children).indexOf(th);
            rows.sort(function (a, b) {
                var aText = (a.children[colIdx] || {}).textContent || '';
                var bText = (b.children[colIdx] || {}).textContent || '';
                var aNum = parseFloat(aText.replace(/,/g, ''));
                var bNum = parseFloat(bText.replace(/,/g, ''));
                if (!isNaN(aNum) && !isNaN(bNum)) return (aNum - bNum) * dir;
                return aText.localeCompare(bText, 'vi') * dir;
            });
            rows.forEach(function (row) { tbody.appendChild(row); });
        });
    });
}

function dbFilterContent() {
    var q = (document.getElementById('dbSearch').value || '').trim().toLowerCase();
    if (!q) {
        // Re-render current level
        if (dbState.farmerId) { dbRenderRecords(); }
        else if (dbState.group) { dbRenderFarmers(); }
        else if (dbState.year) { dbRenderGroups(); }
        else if (dbState.type) { dbRenderYears(); }
        return;
    }
    // Filter visible items by text content
    var container = document.getElementById('dbContent');
    var cards = container.querySelectorAll('.db-year-card, .db-group-card, .db-farmer-row');
    cards.forEach(function (card) {
        var text = card.textContent.toLowerCase();
        card.style.display = text.indexOf(q) >= 0 ? '' : 'none';
    });
    // Filter table rows
    var rows = container.querySelectorAll('.db-record-table tbody tr');
    rows.forEach(function (row) {
        var text = row.textContent.toLowerCase();
        row.style.display = text.indexOf(q) >= 0 ? '' : 'none';
    });
}

function dbPrintFarmerReport(farmerId) {
    var isVi = currentLang === 'vi';
    var farmer = (rawData.farmers || []).find(function (f) { return f.Farmer_ID === farmerId; });
    if (!farmer) return;

    var relPlots = (rawData.plots || []).filter(function (p) { return p.Farmer_ID === farmerId; });
    var relYearly = (rawData.yearly || []).filter(function (y) { return y.Farmer_ID === farmerId; });
    relYearly.sort(function (a, b) { return (b.Year || '').localeCompare(a.Year || ''); });
    var relSupported = (rawData.supported || []).filter(function (s) { return (s['Farmer ID'] || s.Farmer_ID) === farmerId; });

    var farmerLabels = FIELD_LABELS.Farmers;
    var plotLabels = FIELD_LABELS.Plots;
    var yearlyLabels = FIELD_LABELS.Yearly_Data;
    var supportLabels = FIELD_LABELS.Supported;

    function rv(val) {
        if (!val) return '';
        if (adminMap[val]) return (isVi ? adminMap[val].vi : adminMap[val].en) || val;
        if (dropMap[val]) return (isVi ? dropMap[val].vi : dropMap[val].en) || val;
        return val;
    }

    var html = '<html><head><meta charset="utf-8"><title>' + (isVi ? 'Báo cáo hộ dân' : 'Farmer Report') + ' - ' + farmer.Full_Name + '</title>';
    html += '<style>body{font-family:Arial,sans-serif;margin:20px;font-size:12px} h1{font-size:16px;color:#2E7D32;border-bottom:2px solid #2E7D32;padding-bottom:5px} h2{font-size:14px;color:#333;margin-top:18px;border-left:3px solid #2E7D32;padding-left:8px} table{width:100%;border-collapse:collapse;margin:8px 0} th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;font-size:11px} th{background:#f5f5f5;font-weight:600} .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px 12px} .info-item{display:flex;gap:4px} .info-label{font-weight:600;color:#555;white-space:nowrap} .empty{background:#fff0f0} .footer{margin-top:30px;border-top:1px solid #ccc;padding-top:10px;font-size:10px;color:#888} @media print{body{margin:10px}}</style></head><body>';

    // Header
    html += '<h1>' + (isVi ? 'BÁO CÁO NÔNG HỘ' : 'FARMER REPORT') + '</h1>';
    html += '<h2>' + escapeHtml(farmer.Full_Name) + ' (' + farmer.Farmer_ID + ')</h2>';

    // Farmer info
    html += '<div class="info-grid">';
    Object.keys(farmerLabels).forEach(function (k) {
        if (k === 'Farmer_ID') return;
        var label = translations[currentLang][farmerLabels[k]] || k;
        var val = rv(farmer[k] || '');
        html += '<div class="info-item"><span class="info-label">' + escapeHtml(label) + ':</span> ' + escapeHtml(String(val)) + '</div>';
    });
    html += '</div>';

    // Plots
    html += '<h2>' + (isVi ? 'Lô đất' : 'Plots') + ' (' + relPlots.length + ')</h2>';
    if (relPlots.length > 0) {
        var pKeys = Object.keys(plotLabels).filter(function (k) { return k !== 'Farmer_ID'; });
        html += '<table><tr>';
        pKeys.forEach(function (k) { html += '<th>' + escapeHtml(translations[currentLang][plotLabels[k]] || k) + '</th>'; });
        html += '</tr>';
        relPlots.forEach(function (p) {
            html += '<tr>';
            pKeys.forEach(function (k) { var v = rv(p[k] || ''); html += '<td' + (String(v).trim() === '' ? ' class="empty"' : '') + '>' + escapeHtml(String(v)) + '</td>'; });
            html += '</tr>';
        });
        html += '</table>';
    }

    // Yearly Data
    html += '<h2>' + (isVi ? 'Đánh giá hàng năm' : 'Yearly Data') + ' (' + relYearly.length + ')</h2>';
    if (relYearly.length > 0) {
        var yKeys = Object.keys(yearlyLabels).filter(function (k) { return k !== 'Farmer_ID'; });
        html += '<table><tr>';
        yKeys.forEach(function (k) { html += '<th>' + escapeHtml(translations[currentLang][yearlyLabels[k]] || k) + '</th>'; });
        html += '</tr>';
        relYearly.forEach(function (y) {
            html += '<tr>';
            yKeys.forEach(function (k) { var v = rv(y[k] || ''); html += '<td' + (String(v).trim() === '' ? ' class="empty"' : '') + '>' + escapeHtml(String(v)) + '</td>'; });
            html += '</tr>';
        });
        html += '</table>';
    }

    // Supported
    html += '<h2>' + (isVi ? 'Hỗ trợ' : 'Support') + ' (' + relSupported.length + ')</h2>';
    if (relSupported.length > 0) {
        var sKeys = Object.keys(supportLabels);
        html += '<table><tr>';
        sKeys.forEach(function (k) { html += '<th>' + escapeHtml(translations[currentLang][supportLabels[k]] || k) + '</th>'; });
        html += '</tr>';
        relSupported.forEach(function (s) {
            html += '<tr>';
            sKeys.forEach(function (k) { var v = rv(s[k] || ''); html += '<td' + (String(v).trim() === '' ? ' class="empty"' : '') + '>' + escapeHtml(String(v)) + '</td>'; });
            html += '</tr>';
        });
        html += '</table>';
    }

    // Footer
    html += '<div class="footer">' + (isVi ? 'Ngày in: ' : 'Printed: ') + new Date().toLocaleDateString() + ' | PFFP Database</div>';
    html += '</body></html>';

    var printWin = window.open('', '_blank');
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    printWin.print();
}

function updateDataIconCounts() {
    var el;
    el = document.getElementById('diCountFarmers');
    if (el) el.textContent = (rawData.farmers || []).length;
    el = document.getElementById('diCountPlots');
    if (el) el.textContent = (rawData.plots || []).length;
    el = document.getElementById('diCountSupported');
    if (el) el.textContent = (rawData.supported || []).length;
    el = document.getElementById('diCountYearly');
    if (el) el.textContent = (rawData.yearly || []).length;
}

// ==========================================
// GROUPED FARMER LIST (accordion by Farmer_Group_Name + smart search)
// ==========================================
function showGroupedFarmerList() {
    var farmers = filteredData.farmers || [];
    var plots = filteredData.plots || [];
    var yearly = filteredData.yearly || [];

    // Build group data
    var groups = {};
    farmers.forEach(function (f) {
        var g = f.Farmer_Group_Name || 'N/A';
        if (!groups[g]) groups[g] = { farmers: [], plotCount: 0, yearlyCount: 0, totalArea: 0 };
        groups[g].farmers.push(f);
        groups[g].totalArea += parseFloat(f.Total_Coffee_Area) || 0;
    });

    // Count plots and yearly per group
    var farmerGroupMap = {};
    farmers.forEach(function (f) { farmerGroupMap[f.Farmer_ID] = f.Farmer_Group_Name || 'N/A'; });
    plots.forEach(function (p) {
        var g = farmerGroupMap[p.Farmer_ID];
        if (g && groups[g]) groups[g].plotCount++;
    });
    yearly.forEach(function (y) {
        var g = farmerGroupMap[y.Farmer_ID];
        if (g && groups[g]) groups[g].yearlyCount++;
    });

    var groupNames = Object.keys(groups).sort();
    var isVi = currentLang === 'vi';

    // Build HTML
    var html = '';

    // Search bar
    html += '<div class="mb-3">';
    html += '<div class="input-group input-group-sm">';
    html += '<span class="input-group-text"><i class="fas fa-search"></i></span>';
    html += '<input type="text" class="form-control" id="groupedListSearch" placeholder="' + (isVi ? 'Tìm hộ dân, mã ID, lô đất...' : 'Search farmer, ID, plot...') + '" oninput="filterGroupedList()">';
    html += '<button class="btn btn-outline-secondary" type="button" onclick="$(\'#groupedListSearch\').val(\'\');filterGroupedList()"><i class="fas fa-times"></i></button>';
    html += '</div></div>';

    // Search results container (hidden by default)
    html += '<div id="groupedSearchResults" style="display:none;" class="mb-3"></div>';

    // Add farmer button
    if (userPermissions.canAdd) {
        html += '<div class="mb-2 text-end"><button class="btn btn-sm btn-success" onclick="showAddFarmerModal()"><i class="fas fa-plus"></i> ' + (isVi ? 'Thêm hộ dân' : 'Add Farmer') + '</button></div>';
    }

    // Group accordion
    html += '<div class="accordion" id="farmerGroupAccordion">';
    groupNames.forEach(function (gName, idx) {
        var g = groups[gName];
        var gId = 'grp_' + idx;
        var farmerIds = g.farmers.map(function (f) { return f.Farmer_ID; });
        // Resolve group code to label via adminMap
        var gLabel = gName;
        if (adminMap[gName]) { gLabel = (isVi ? adminMap[gName].vi : adminMap[gName].en) || gName; }

        html += '<div class="accordion-item farmer-group-item" data-group="' + escapeHtml(gName) + '" data-label="' + escapeHtml(gLabel.toLowerCase()) + '">';
        // Header
        html += '<h2 class="accordion-header">';
        html += '<button class="accordion-button collapsed py-2 px-3" type="button" data-bs-toggle="collapse" data-bs-target="#' + gId + '">';
        html += '<div class="d-flex flex-wrap align-items-center w-100 gap-2">';
        html += '<i class="fas fa-layer-group text-success me-1"></i>';
        html += '<strong class="me-auto">' + escapeHtml(gLabel) + '</strong>';
        html += '<span class="badge bg-primary rounded-pill" title="' + (isVi ? 'Số hộ' : 'Farmers') + '">' + g.farmers.length + ' <i class="fas fa-users fa-xs"></i></span>';
        html += '<span class="badge bg-info rounded-pill" title="' + (isVi ? 'Số lô' : 'Plots') + '">' + g.plotCount + ' <i class="fas fa-map fa-xs"></i></span>';
        html += '<span class="badge bg-success rounded-pill" title="' + (isVi ? 'Tổng DT' : 'Area') + '">' + g.totalArea.toFixed(2) + ' ha</span>';
        html += '</div>';
        html += '</button></h2>';

        // Collapsible body
        html += '<div id="' + gId + '" class="accordion-collapse collapse" data-bs-parent="#farmerGroupAccordion">';
        html += '<div class="accordion-body p-2">';

        // Member list (compact)
        html += '<div class="list-group list-group-flush mb-2">';
        g.farmers.forEach(function (f) {
            html += '<a href="javascript:void(0)" class="list-group-item list-group-item-action py-1 px-2 d-flex justify-content-between align-items-center farmer-list-item" ';
            html += 'data-name="' + escapeHtml((f.Full_Name || '').toLowerCase()) + '" data-id="' + escapeHtml((f.Farmer_ID || '').toLowerCase()) + '" ';
            html += 'onclick="showFarmerDetails(\'' + escapeHtml(f.Farmer_ID) + '\')">';
            html += '<div><strong style="font-size:0.82rem;">' + escapeHtml(f.Full_Name || '') + '</strong>';
            html += ' <small class="text-muted">(' + escapeHtml(f.Farmer_ID) + ')</small></div>';
            html += '<span class="badge bg-success rounded-pill">' + (f.Total_Coffee_Area || '0') + ' ha</span>';
            html += '</a>';
        });
        html += '</div>';

        // Action buttons: detail views for group (encode group name to avoid quote issues)
        var encodedG = btoa(unescape(encodeURIComponent(gName)));
        html += '<div class="d-flex flex-wrap gap-1 mt-1 border-top pt-2">';
        html += '<button class="btn btn-xs btn-outline-primary" onclick="showGroupDetailEncoded(\'' + encodedG + '\', \'farmers\')"><i class="fas fa-users"></i> ' + (isVi ? 'DS Hộ dân' : 'Farmers') + ' (' + g.farmers.length + ')</button>';
        html += '<button class="btn btn-xs btn-outline-info" onclick="showGroupDetailEncoded(\'' + encodedG + '\', \'plots\')"><i class="fas fa-map"></i> ' + (isVi ? 'DS Lô đất' : 'Plots') + ' (' + g.plotCount + ')</button>';
        html += '<button class="btn btn-xs btn-outline-warning" onclick="showGroupDetailEncoded(\'' + encodedG + '\', \'yearly\')"><i class="fas fa-calendar-check"></i> ' + (isVi ? 'Đánh giá HN' : 'Yearly') + ' (' + g.yearlyCount + ')</button>';
        html += '</div>';

        html += '</div></div>'; // accordion-body, collapse
        html += '</div>'; // accordion-item
    });
    html += '</div>'; // accordion

    var title = (isVi ? 'Danh sách hộ dân' : 'Farmer List') + ' (' + farmers.length + ' ' + (isVi ? 'hộ' : 'farmers') + ' / ' + groupNames.length + ' ' + (isVi ? 'nhóm' : 'groups') + ')';
    $('#farmerDetailTitle').text(title);
    $('#detailContent').html(html);
    $('#modalActions').html('');
    var modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('farmerDetailModal'));
    modal.show();
}

// --- SMART SEARCH within Grouped Farmer List ---
function filterGroupedList() {
    var q = ($('#groupedListSearch').val() || '').trim().toLowerCase();
    var resultsDiv = $('#groupedSearchResults');

    if (!q || q.length < 2) {
        resultsDiv.hide().empty();
        // Show all groups
        $('.farmer-group-item').show();
        $('.farmer-list-item').show();
        return;
    }

    var isVi = currentLang === 'vi';
    var farmers = filteredData.farmers || [];
    var plots = filteredData.plots || [];
    var farmerMap = {};
    farmers.forEach(function (f) { farmerMap[f.Farmer_ID] = f; });

    // Search farmers by name, ID, group code + group label
    var matchedFarmers = farmers.filter(function (f) {
        var groupCode = (f.Farmer_Group_Name || '').toLowerCase();
        var groupLbl = adminMap[f.Farmer_Group_Name] ? (isVi ? adminMap[f.Farmer_Group_Name].vi : adminMap[f.Farmer_Group_Name].en) || '' : '';
        return (f.Full_Name || '').toLowerCase().indexOf(q) >= 0 ||
               (f.Farmer_ID || '').toLowerCase().indexOf(q) >= 0 ||
               groupCode.indexOf(q) >= 0 ||
               groupLbl.toLowerCase().indexOf(q) >= 0 ||
               (f.Phone_Number || '').toLowerCase().indexOf(q) >= 0;
    });

    // Search plots by Plot_Id, Plot_Name
    var matchedPlots = plots.filter(function (p) {
        return (p.Plot_Id || '').toLowerCase().indexOf(q) >= 0 ||
               (p.Plot_Name || '').toLowerCase().indexOf(q) >= 0 ||
               (p.Farmer_ID || '').toLowerCase().indexOf(q) >= 0;
    });

    var html = '';
    var totalResults = matchedFarmers.length + matchedPlots.length;
    html += '<div class="small text-muted mb-1"><i class="fas fa-search"></i> ' + totalResults + ' ' + (isVi ? 'kết quả' : 'results') + '</div>';

    if (matchedFarmers.length > 0) {
        html += '<div class="small fw-bold text-primary mb-1"><i class="fas fa-users"></i> ' + (isVi ? 'Hộ dân' : 'Farmers') + ' (' + matchedFarmers.length + ')</div>';
        html += '<div class="list-group list-group-flush mb-2">';
        matchedFarmers.slice(0, 20).forEach(function (f) {
            html += '<a href="javascript:void(0)" class="list-group-item list-group-item-action py-1 px-2" onclick="showFarmerDetails(\'' + escapeHtml(f.Farmer_ID) + '\')">';
            html += '<strong style="font-size:0.82rem;">' + escapeHtml(f.Full_Name || '') + '</strong>';
            html += ' <small class="text-muted">(' + escapeHtml(f.Farmer_ID) + ' - ' + escapeHtml(f.Farmer_Group_Name || '') + ')</small>';
            html += '</a>';
        });
        if (matchedFarmers.length > 20) html += '<div class="text-muted small px-2">... +' + (matchedFarmers.length - 20) + ' ' + (isVi ? 'khác' : 'more') + '</div>';
        html += '</div>';
    }

    if (matchedPlots.length > 0) {
        html += '<div class="small fw-bold text-info mb-1"><i class="fas fa-map"></i> ' + (isVi ? 'Lô đất' : 'Plots') + ' (' + matchedPlots.length + ')</div>';
        html += '<div class="list-group list-group-flush mb-2">';
        matchedPlots.slice(0, 20).forEach(function (p) {
            var farmer = farmerMap[p.Farmer_ID] || {};
            html += '<a href="javascript:void(0)" class="list-group-item list-group-item-action py-1 px-2" onclick="showSingleItemDetails(\'Plots\', \'' + escapeHtml(p.Plot_Id) + '\')">';
            html += '<strong style="font-size:0.82rem;">' + escapeHtml(p.Plot_Name || p.Plot_Id) + '</strong>';
            html += ' <small class="text-muted">(' + escapeHtml(p['Area (ha)'] || '0') + ' ha - ' + escapeHtml(farmer.Full_Name || p.Farmer_ID) + ')</small>';
            html += '</a>';
        });
        if (matchedPlots.length > 20) html += '<div class="text-muted small px-2">... +' + (matchedPlots.length - 20) + ' ' + (isVi ? 'khác' : 'more') + '</div>';
        html += '</div>';
    }

    if (totalResults === 0) {
        html += '<div class="text-center text-muted py-2">' + (isVi ? 'Không tìm thấy kết quả' : 'No results found') + '</div>';
    }

    resultsDiv.html(html).show();

    // Also filter the accordion groups
    var matchedGroups = new Set();
    matchedFarmers.forEach(function (f) { matchedGroups.add(f.Farmer_Group_Name || 'N/A'); });
    matchedPlots.forEach(function (p) {
        var farmer = farmerMap[p.Farmer_ID];
        if (farmer) matchedGroups.add(farmer.Farmer_Group_Name || 'N/A');
    });

    $('.farmer-group-item').each(function () {
        var gName = $(this).data('group');
        if (matchedGroups.has(gName)) {
            $(this).show();
        } else {
            $(this).hide();
        }
    });
}

// Decode wrapper for onclick (avoids quote issues in group names)
function showGroupDetailEncoded(encodedGroup, detailType) {
    var groupName = decodeURIComponent(escape(atob(encodedGroup)));
    showGroupDetail(groupName, detailType);
}

// ==========================================
// GROUP DETAIL: Full-column table for a specific group
// ==========================================
function showGroupDetail(groupName, detailType) {
    var farmers = filteredData.farmers || [];
    var plots = filteredData.plots || [];
    var yearly = filteredData.yearly || [];
    var isVi = currentLang === 'vi';

    // Get farmers in this group
    var groupFarmers = farmers.filter(function (f) { return (f.Farmer_Group_Name || 'N/A') === groupName; });
    var groupFarmerIds = groupFarmers.map(function (f) { return f.Farmer_ID; });
    var farmerMap = {};
    groupFarmers.forEach(function (f) { farmerMap[f.Farmer_ID] = f; });

    var title = '';
    var headers = [];
    var rows = [];
    var exportData = [];

    if (detailType === 'farmers') {
        title = (isVi ? 'Hộ dân - Nhóm: ' : 'Farmers - Group: ') + groupName;
        var cols = ['Farmer_ID', 'Full_Name', 'Year_Of_Birth', 'Gender', 'Phone_Number', 'Farmer_Group_Name', 'Commune_Name', 'Ethnicity', 'Total_Coffee_Area', 'Number of coffee farm plots', 'Supported by', 'Participation Year', 'Status', 'Activity'];
        headers = cols.map(function (c) {
            var lk = FIELD_LABELS['Farmers'][c] || c;
            return translations[currentLang][lk] || c;
        });

        groupFarmers.forEach(function (f, i) {
            var row = cols.map(function (c) { return resolveValue(c, f[c], 'Farmers'); });
            rows.push({ data: row, farmerId: f.Farmer_ID });
            exportData.push(row);
        });

    } else if (detailType === 'plots') {
        title = (isVi ? 'Lô đất - Nhóm: ' : 'Plots - Group: ') + groupName;
        var groupPlots = plots.filter(function (p) { return groupFarmerIds.indexOf(p.Farmer_ID) >= 0; });
        var cols = ['Plot_Id', 'Farmer_ID', 'Plot_Name', 'Area (ha)', 'Land use rights certificate?', 'Border_Natural_Forest', 'Place name', 'Num_Shade_Trees_Before', 'Num_Coffee_Trees', 'Coffee_Planted_Year'];
        // Add farmer name as first extra column
        headers = [(isVi ? 'Tên hộ dân' : 'Farmer Name')].concat(cols.map(function (c) {
            var lk = FIELD_LABELS['Plots'][c] || c;
            return translations[currentLang][lk] || c;
        }));

        groupPlots.forEach(function (p, i) {
            var farmer = farmerMap[p.Farmer_ID] || {};
            var row = [farmer.Full_Name || p.Farmer_ID].concat(cols.map(function (c) { return resolveValue(c, p[c], 'Plots'); }));
            rows.push({ data: row, plotId: p.Plot_Id });
            exportData.push(row);
        });

    } else if (detailType === 'yearly') {
        title = (isVi ? 'Đánh giá hàng năm - Nhóm: ' : 'Yearly Data - Group: ') + groupName;
        var groupYearly = yearly.filter(function (y) { return groupFarmerIds.indexOf(y.Farmer_ID) >= 0; });
        // Sort by year desc
        groupYearly.sort(function (a, b) { return (b.Year || '').localeCompare(a.Year || ''); });
        var cols = ['Record_Id', 'Farmer_ID', 'Year', 'Annual_Volume_Cherry', 'Volume_High_Quality', 'Total_Coffee_Income', 'Number_Shade_Trees_Planted', 'Shade_Trees_Species', 'Shade_Trees_Died', 'Survival', 'Attending training capacity organized by PFFP', 'Op6_Activities'];
        headers = [(isVi ? 'Tên hộ dân' : 'Farmer Name')].concat(cols.map(function (c) {
            var lk = FIELD_LABELS['Yearly_Data'][c] || c;
            return translations[currentLang][lk] || c;
        }));

        groupYearly.forEach(function (y, i) {
            var farmer = farmerMap[y.Farmer_ID] || {};
            var row = [farmer.Full_Name || y.Farmer_ID].concat(cols.map(function (c) { return resolveValue(c, y[c], 'Yearly_Data'); }));
            rows.push({ data: row, recordId: y.Record_Id, farmerId: y.Farmer_ID });
            exportData.push(row);
        });
    }

    // Build table HTML
    var html = '';

    // Export button
    if (userPermissions.canExport && rows.length > 0) {
        html += '<div class="mb-2 d-flex justify-content-between align-items-center">';
        html += '<small class="text-muted">' + rows.length + ' ' + (isVi ? 'bản ghi' : 'records') + '</small>';
        html += '<button class="btn btn-sm btn-success" onclick="exportGroupDetailToExcel()"><i class="fas fa-file-excel"></i> ' + (isVi ? 'Xuất Excel' : 'Export Excel') + '</button>';
        html += '</div>';
    }

    html += '<div class="table-responsive"><table class="table table-sm table-striped table-hover" id="groupDetailTable" style="font-size:0.78rem;">';
    html += '<thead class="table-custom-header"><tr>';
    html += '<th>#</th>';
    headers.forEach(function (h) { html += '<th>' + escapeHtml(h) + '</th>'; });
    html += '</tr></thead><tbody>';

    rows.forEach(function (r, i) {
        var clickAttr = '';
        if (r.farmerId) {
            clickAttr = ' style="cursor:pointer" onclick="showFarmerDetails(\'' + escapeHtml(r.farmerId) + '\')"';
        } else if (r.plotId) {
            clickAttr = ' style="cursor:pointer" onclick="showSingleItemDetails(\'Plots\', \'' + escapeHtml(r.plotId) + '\')"';
        }
        html += '<tr' + clickAttr + '>';
        html += '<td>' + (i + 1) + '</td>';
        r.data.forEach(function (val) { html += '<td>' + escapeHtml(val || '') + '</td>'; });
        html += '</tr>';
    });

    if (rows.length === 0) {
        html += '<tr><td colspan="' + (headers.length + 1) + '" class="text-center text-muted py-3">' + (isVi ? 'Không có dữ liệu' : 'No data') + '</td></tr>';
    }
    html += '</tbody></table></div>';

    // Store export data globally for the export button
    window._groupDetailExport = { headers: headers, data: exportData, title: title };

    // Show in a new modal approach: replace detailContent
    // First close current modal, then show new one
    var existingModal = bootstrap.Modal.getInstance(document.getElementById('farmerDetailModal'));
    if (existingModal) existingModal.hide();

    setTimeout(function () {
        $('#farmerDetailTitle').text(title);
        $('#detailContent').html(html);
        $('#modalActions').html('<button class="btn btn-sm btn-outline-secondary me-2" onclick="showGroupedFarmerList()"><i class="fas fa-arrow-left"></i> ' + (isVi ? 'Quay lại' : 'Back') + '</button>');
        var modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('farmerDetailModal'));
        modal.show();
    }, 300);
}

// --- Export Group Detail to Excel ---
function exportGroupDetailToExcel() {
    if (!window._groupDetailExport) return;
    var exp = window._groupDetailExport;
    var wb = XLSX.utils.book_new();
    var sheetData = [['#'].concat(exp.headers)];
    exp.data.forEach(function (row, i) {
        sheetData.push([i + 1].concat(row));
    });
    var ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    var fileName = (exp.title || 'GroupDetail').replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF ]/g, '_') + '.xlsx';
    XLSX.writeFile(wb, fileName);
}

// ==========================================
// KPI DRILL-DOWN: Click KPI → structured list → farmer detail
// ==========================================
var kpiDrillHistory = [];

function kpiDrillPush(title, html) {
    kpiDrillHistory.push({
        title: $('#farmerDetailTitle').text(),
        html: $('#detailContent').html()
    });
    $('#farmerDetailTitle').text(title);
    $('#detailContent').html(kpiBackBtn() + html);
}

function kpiDrillBack() {
    var prev = kpiDrillHistory.pop();
    if (prev) {
        $('#farmerDetailTitle').text(prev.title);
        $('#detailContent').html(prev.html);
    }
}

function kpiBackBtn() {
    return '<button class="btn btn-sm btn-outline-secondary mb-2" onclick="kpiDrillBack()"><i class="fas fa-arrow-left me-1"></i>' + (currentLang === 'vi' ? 'Quay lại' : 'Back') + '</button>';
}

function showKpiDrilldown(kpiType) {
    kpiDrillHistory = []; // reset drill stack
    var farmers = filteredData.farmers || [];
    var plots = filteredData.plots || [];
    var yearly = filteredData.yearly || [];
    var farmerMap = {};
    (rawData.farmers || []).forEach(function (f) { farmerMap[f.Farmer_ID] = f; });
    var isVi = currentLang === 'vi';

    var titleMap = {
        totalFarmers:   { vi: 'Tổng số hộ dân', en: 'Total Farmers' },
        female:         { vi: 'Hộ dân nữ', en: 'Female Farmers' },
        totalPlots:     { vi: 'Tổng số lô', en: 'Total Plots' },
        totalArea:      { vi: 'Tổng diện tích', en: 'Total Area' },
        shadeExisting:  { vi: 'Cây che bóng có sẵn', en: 'Existing Shade Trees' },
        shadePlanted:   { vi: 'Cây che bóng đã trồng', en: 'Shade Trees Planted' },
        totalSpecies:   { vi: 'Loài cây che bóng', en: 'Shade Tree Species' },
        totalGroups:    { vi: 'Nhóm hộ', en: 'Farmer Groups' },
        completionRate: { vi: 'Tỷ lệ hoàn thành', en: 'Completion Rate' },
        survivalRate:   { vi: 'Tỷ lệ sống cây', en: 'Survival Rate' },
        cherryVol:      { vi: 'Sản lượng đại trà', en: 'Cherry Volume' },
        hqVol:          { vi: 'Sản lượng CLC', en: 'High Quality Volume' }
    };

    var title = titleMap[kpiType] ? (isVi ? titleMap[kpiType].vi : titleMap[kpiType].en) : kpiType;

    // --- Special flat table: Species (from Supported data) ---
    if (kpiType === 'totalSpecies') {
        var suppAll3 = rawData.supported || [];
        var fids3 = new Set(farmers.map(function (ff) { return ff.Farmer_ID; }));
        var treeRecs3 = suppAll3.filter(function (s) { return fids3.has(s['Farmer ID']) && (s.Unit || '').toLowerCase().indexOf('tree') >= 0; });
        var speciesStats = {};
        treeRecs3.forEach(function (s) {
            var sp = s.Item_Detail || 'Unknown';
            if (!speciesStats[sp]) speciesStats[sp] = { planted: 0, alive: 0, evaluated: 0, records: 0, farmers: new Set() };
            speciesStats[sp].records++;
            speciesStats[sp].planted += parseFloat(s.Quantity) || 0;
            speciesStats[sp].farmers.add(s['Farmer ID']);
            var aVal = s['A live'];
            if (aVal !== null && aVal !== '' && aVal !== undefined && parseFloat(aVal) > 0) {
                speciesStats[sp].alive += parseFloat(aVal) || 0;
                speciesStats[sp].evaluated++;
            }
        });
        var spMap = {};
        (rawData.species || []).forEach(function (s) { spMap[s.Species_ID] = s.Species_name || s.Species_ID; });
        var spKeys = Object.keys(speciesStats).sort();
        var html = '<div class="table-responsive"><table class="table table-sm table-striped table-hover" style="font-size:0.82rem;">';
        html += '<thead class="table-custom-header"><tr>';
        html += '<th>#</th>';
        html += '<th>' + (isVi ? 'Mã' : 'Code') + '</th>';
        html += '<th>' + (isVi ? 'Tên loài' : 'Species') + '</th>';
        html += '<th>' + (isVi ? 'Số hộ' : 'Farmers') + '</th>';
        html += '<th>' + (isVi ? 'Số cây trồng' : 'Planted') + '</th>';
        html += '<th>' + (isVi ? 'Còn sống' : 'Alive') + '</th>';
        html += '<th>' + (isVi ? 'Đã đánh giá' : 'Evaluated') + '</th>';
        html += '<th>' + (isVi ? 'Tỷ lệ sống' : 'Survival') + '</th>';
        html += '</tr></thead><tbody>';
        // Calculate evaluated qty per species for survival rate
        var evalQtyBySpecies = {};
        treeRecs3.forEach(function (s) {
            var sp = s.Item_Detail || 'Unknown';
            var aVal = s['A live'];
            if (aVal !== null && aVal !== '' && aVal !== undefined && parseFloat(aVal) > 0) {
                evalQtyBySpecies[sp] = (evalQtyBySpecies[sp] || 0) + (parseFloat(s.Quantity) || 0);
            }
        });
        var totalPlanted3 = 0, totalAlive3 = 0;
        spKeys.forEach(function (sp, i) {
            var st = speciesStats[sp];
            var eQty = evalQtyBySpecies[sp] || 0;
            var survVal = eQty > 0 ? ((st.alive / eQty) * 100).toFixed(1) + '%' : (isVi ? 'Chưa ĐG' : 'N/A');
            totalPlanted3 += st.planted;
            totalAlive3 += st.alive;
            html += '<tr class="kpi-drill-row" onclick="kpiDrillSpeciesToGroups(\'' + escapeHtml(sp) + '\')">';
            html += '<td>' + (i + 1) + '</td>';
            html += '<td><code>' + escapeHtml(sp) + '</code></td>';
            html += '<td>' + escapeHtml(getSpeciesName(sp)) + '</td>';
            html += '<td>' + st.farmers.size + '</td>';
            html += '<td>' + st.planted.toLocaleString() + '</td>';
            html += '<td>' + (st.alive > 0 ? st.alive.toLocaleString() : '-') + '</td>';
            html += '<td>' + st.evaluated + '/' + st.records + '</td>';
            html += '<td>' + survVal + '</td>';
            html += '</tr>';
        });
        if (spKeys.length === 0) html += '<tr><td colspan="8" class="text-center text-muted py-3">' + (isVi ? 'Không có dữ liệu' : 'No data') + '</td></tr>';
        html += '</tbody></table></div>';
        $('#farmerDetailTitle').text(title + ' (' + spKeys.length + ')');
        $('#detailContent').html(html);
        $('#modalActions').html('');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('farmerDetailModal')).show();
        return;
    }

    // --- Special flat table: Groups ---
    if (kpiType === 'totalGroups') {
        var groupFarmers = {};
        farmers.forEach(function (f) { var g = f.Farmer_Group_Name || 'N/A'; if (!groupFarmers[g]) groupFarmers[g] = []; groupFarmers[g].push(f); });
        var gKeys = Object.keys(groupFarmers).sort();
        var html = '<div class="table-responsive"><table class="table table-sm table-striped table-hover" style="font-size:0.82rem;">';
        html += '<thead class="table-custom-header"><tr><th>#</th><th>' + (isVi ? 'Nhóm hộ' : 'Group') + '</th><th>' + (isVi ? 'Số hộ' : 'Farmers') + '</th><th>' + (isVi ? 'Tổng DT' : 'Area') + '</th></tr></thead><tbody>';
        gKeys.forEach(function (g, i) {
            var list = groupFarmers[g];
            var totalArea = list.reduce(function (s, f) { return s + (parseFloat(f.Total_Coffee_Area) || 0); }, 0);
            var gLabel = adminMap[g] ? (isVi ? adminMap[g].vi : adminMap[g].en) || g : g;
            html += '<tr class="kpi-drill-row" onclick="kpiDrillGroupFarmers(\'' + escapeHtml(g) + '\')"><td>' + (i + 1) + '</td><td>' + escapeHtml(gLabel) + '</td><td>' + list.length + '</td><td>' + totalArea.toFixed(2) + ' ha</td></tr>';
        });
        if (gKeys.length === 0) html += '<tr><td colspan="4" class="text-center text-muted py-3">' + (isVi ? 'Không có dữ liệu' : 'No data') + '</td></tr>';
        html += '</tbody></table></div>';
        $('#farmerDetailTitle').text(title + ' (' + gKeys.length + ')');
        $('#detailContent').html(html);
        $('#modalActions').html('');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('farmerDetailModal')).show();
        return;
    }

    // --- Special: Female — Village ratio table with bars, sorted desc ---
    if (kpiType === 'female') {
        var groupStats = {};
        farmers.forEach(function (f) {
            var g = f.Farmer_Group_Name || 'N/A';
            if (!groupStats[g]) groupStats[g] = { total: 0, female: 0, male: 0 };
            groupStats[g].total++;
            var gd = (f.Gender || '').trim().toLowerCase();
            if (gd === 'nữ' || gd === 'female' || gd === 'f') groupStats[g].female++;
            else groupStats[g].male++;
        });
        var gKeys = Object.keys(groupStats);
        gKeys.sort(function (a, b) {
            var ra = groupStats[a].total > 0 ? groupStats[a].female / groupStats[a].total : 0;
            var rb = groupStats[b].total > 0 ? groupStats[b].female / groupStats[b].total : 0;
            return rb - ra;
        });
        var totalFemale = gKeys.reduce(function (s, g) { return s + groupStats[g].female; }, 0);
        var totalMale = gKeys.reduce(function (s, g) { return s + groupStats[g].male; }, 0);
        var totalAll = totalFemale + totalMale;
        var overallFR = totalAll > 0 ? (totalFemale / totalAll * 100).toFixed(1) : '0';
        var html = '<p class="mb-2 text-muted" style="font-size:0.85rem;">' + (isVi ? 'Tổng: ' : 'Overall: ');
        html += '<strong><i class="fas fa-female text-danger me-1"></i>' + totalFemale + ' (' + overallFR + '%) / <i class="fas fa-male text-primary me-1"></i>' + totalMale + ' (' + (totalAll > 0 ? (totalMale / totalAll * 100).toFixed(1) : '0') + '%)</strong></p>';
        html += '<div class="table-responsive"><table class="table table-sm table-hover" style="font-size:0.82rem;">';
        html += '<thead class="table-custom-header"><tr><th>#</th>';
        html += '<th>' + (isVi ? 'Nhóm hộ' : 'Farmer Group') + '</th>';
        html += '<th><i class="fas fa-female"></i> ' + (isVi ? 'Nữ' : 'F') + '</th>';
        html += '<th><i class="fas fa-male"></i> ' + (isVi ? 'Nam' : 'M') + '</th>';
        html += '<th>' + (isVi ? 'Tổng' : 'Total') + '</th>';
        html += '<th style="min-width:150px">' + (isVi ? 'Tỷ lệ Nam / Nữ' : 'M / F Ratio') + '</th>';
        html += '</tr></thead><tbody>';
        gKeys.forEach(function (g, i) {
            var st = groupStats[g];
            var fRatio = st.total > 0 ? (st.female / st.total * 100) : 0;
            var mRatio = st.total > 0 ? (st.male / st.total * 100) : 0;
            var gLabel = adminMap[g] ? (isVi ? adminMap[g].vi : adminMap[g].en) || g : g;
            html += '<tr class="kpi-drill-row" onclick="kpiDrillFemaleGroup(\'' + escapeHtml(g) + '\')">';
            html += '<td>' + (i + 1) + '</td>';
            html += '<td>' + escapeHtml(gLabel) + '</td>';
            html += '<td class="fw-bold text-danger">' + st.female + '</td>';
            html += '<td class="fw-bold text-primary">' + st.male + '</td>';
            html += '<td>' + st.total + '</td>';
            html += '<td><div class="kpi-gender-bar">';
            html += '<div class="kpi-gender-fill-m" style="width:' + mRatio + '%">' + (mRatio >= 15 ? mRatio.toFixed(0) + '%' : '') + '</div>';
            html += '<div class="kpi-gender-fill-f" style="width:' + fRatio + '%">' + (fRatio >= 15 ? fRatio.toFixed(0) + '%' : '') + '</div>';
            html += '</div></td>';
            html += '</tr>';
        });
        if (gKeys.length === 0) html += '<tr><td colspan="6" class="text-center text-muted py-3">' + (isVi ? 'Không có dữ liệu' : 'No data') + '</td></tr>';
        html += '</tbody></table></div>';
        $('#farmerDetailTitle').text(title + ' (' + totalFemale + '/' + totalAll + ')');
        $('#detailContent').html(html);
        $('#modalActions').html('');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('farmerDetailModal')).show();
        return;
    }

    // --- Special: Completion Rate — Groups with completion bars, sorted desc ---
    if (kpiType === 'completionRate') {
        var grpComp = {};
        farmers.forEach(function (f) {
            var g = f.Farmer_Group_Name || 'N/A';
            if (!grpComp[g]) grpComp[g] = { total: 0, done: 0 };
            grpComp[g].total++;
            if ((f.Activity || '').trim() === 'Done') grpComp[g].done++;
        });
        var cKeys = Object.keys(grpComp);
        cKeys.sort(function (a, b) {
            var ra = grpComp[a].total > 0 ? grpComp[a].done / grpComp[a].total : 0;
            var rb = grpComp[b].total > 0 ? grpComp[b].done / grpComp[b].total : 0;
            return rb - ra;
        });
        var totalDone = cKeys.reduce(function (s, g) { return s + grpComp[g].done; }, 0);
        var totalAll = cKeys.reduce(function (s, g) { return s + grpComp[g].total; }, 0);
        var overallRate = totalAll > 0 ? (totalDone / totalAll * 100).toFixed(1) : '0';
        var html = '<p class="mb-2 text-muted" style="font-size:0.85rem;">' + (isVi ? 'Tổng: ' : 'Overall: ') + '<strong>' + totalDone + '/' + totalAll + ' (' + overallRate + '%)</strong></p>';
        html += '<div class="table-responsive"><table class="table table-sm table-hover" style="font-size:0.82rem;">';
        html += '<thead class="table-custom-header"><tr><th>#</th>';
        html += '<th>' + (isVi ? 'Nhóm hộ' : 'Group') + '</th>';
        html += '<th>' + (isVi ? 'Hoàn thành' : 'Done') + '</th>';
        html += '<th>' + (isVi ? 'Tổng' : 'Total') + '</th>';
        html += '<th>' + (isVi ? 'Tỷ lệ' : 'Rate') + '</th>';
        html += '<th style="min-width:120px"></th>';
        html += '</tr></thead><tbody>';
        cKeys.forEach(function (g, i) {
            var st = grpComp[g];
            var rate = st.total > 0 ? (st.done / st.total * 100) : 0;
            var gLabel = adminMap[g] ? (isVi ? adminMap[g].vi : adminMap[g].en) || g : g;
            var barClass = rate >= 80 ? '' : (rate >= 50 ? ' warning' : ' danger');
            html += '<tr class="kpi-drill-row" onclick="kpiDrillCompletionGroup(\'' + escapeHtml(g) + '\')">';
            html += '<td>' + (i + 1) + '</td>';
            html += '<td>' + escapeHtml(gLabel) + '</td>';
            html += '<td class="fw-bold">' + st.done + '</td>';
            html += '<td>' + st.total + '</td>';
            html += '<td>' + rate.toFixed(1) + '%</td>';
            html += '<td><div class="kpi-drill-bar"><div class="kpi-drill-bar-fill' + barClass + '" style="width:' + rate + '%"></div></div></td>';
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        $('#farmerDetailTitle').text(title + ' (' + overallRate + '%)');
        $('#detailContent').html(html);
        $('#modalActions').html('');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('farmerDetailModal')).show();
        return;
    }

    // --- Special: Survival Rate — Groups with survival bars, sorted desc ---
    if (kpiType === 'survivalRate') {
        var suppAll = rawData.supported || [];
        var fids = new Set(farmers.map(function (ff) { return ff.Farmer_ID; }));
        var treeRecsS = suppAll.filter(function (s) {
            return fids.has(s['Farmer ID']) && (s.Unit || '').toLowerCase().indexOf('tree') >= 0;
        });
        // Group by farmer group
        var grpSurv = {};
        treeRecsS.forEach(function (s) {
            var fid = s['Farmer ID'];
            var ff = farmerMap[fid] || {};
            var g = ff.Farmer_Group_Name || 'N/A';
            if (!grpSurv[g]) grpSurv[g] = { planted: 0, alive: 0, evalQty: 0 };
            grpSurv[g].planted += parseFloat(s.Quantity) || 0;
            var aVal = s['A live'];
            if (aVal !== null && aVal !== '' && aVal !== undefined && parseFloat(aVal) > 0) {
                grpSurv[g].alive += parseFloat(aVal) || 0;
                grpSurv[g].evalQty += parseFloat(s.Quantity) || 0;
            }
        });
        var sKeys = Object.keys(grpSurv);
        sKeys.sort(function (a, b) {
            var ra = grpSurv[a].evalQty > 0 ? grpSurv[a].alive / grpSurv[a].evalQty : -1;
            var rb = grpSurv[b].evalQty > 0 ? grpSurv[b].alive / grpSurv[b].evalQty : -1;
            return rb - ra;
        });
        var totalAliveS = sKeys.reduce(function (s, g) { return s + grpSurv[g].alive; }, 0);
        var totalEvalS = sKeys.reduce(function (s, g) { return s + grpSurv[g].evalQty; }, 0);
        var overallSurv = totalEvalS > 0 ? (totalAliveS / totalEvalS * 100).toFixed(1) : 'N/A';
        var html = '<p class="mb-2 text-muted" style="font-size:0.85rem;">' + (isVi ? 'Tổng tỷ lệ sống: ' : 'Overall survival: ') + '<strong>' + overallSurv + '%</strong></p>';
        html += '<div class="table-responsive"><table class="table table-sm table-hover" style="font-size:0.82rem;">';
        html += '<thead class="table-custom-header"><tr><th>#</th>';
        html += '<th>' + (isVi ? 'Nhóm hộ' : 'Group') + '</th>';
        html += '<th>' + (isVi ? 'Trồng' : 'Planted') + '</th>';
        html += '<th>' + (isVi ? 'Sống' : 'Alive') + '</th>';
        html += '<th>' + (isVi ? 'Tỷ lệ' : 'Rate') + '</th>';
        html += '<th style="min-width:120px"></th>';
        html += '</tr></thead><tbody>';
        sKeys.forEach(function (g, i) {
            var st = grpSurv[g];
            var rate = st.evalQty > 0 ? (st.alive / st.evalQty * 100) : 0;
            var rateStr = st.evalQty > 0 ? rate.toFixed(1) + '%' : (isVi ? 'Chưa ĐG' : 'N/A');
            var gLabel = adminMap[g] ? (isVi ? adminMap[g].vi : adminMap[g].en) || g : g;
            var barClass = rate >= 80 ? '' : (rate >= 50 ? ' warning' : ' danger');
            html += '<tr class="kpi-drill-row" onclick="kpiDrillSurvivalGroup(\'' + escapeHtml(g) + '\')">';
            html += '<td>' + (i + 1) + '</td>';
            html += '<td>' + escapeHtml(gLabel) + '</td>';
            html += '<td>' + st.planted.toLocaleString() + '</td>';
            html += '<td>' + (st.alive > 0 ? st.alive.toLocaleString() : '-') + '</td>';
            html += '<td>' + rateStr + '</td>';
            html += '<td><div class="kpi-drill-bar"><div class="kpi-drill-bar-fill' + barClass + '" style="width:' + (st.evalQty > 0 ? rate : 0) + '%"></div></div></td>';
            html += '</tr>';
        });
        if (sKeys.length === 0) html += '<tr><td colspan="6" class="text-center text-muted py-3">' + (isVi ? 'Không có dữ liệu' : 'No data') + '</td></tr>';
        html += '</tbody></table></div>';
        $('#farmerDetailTitle').text(title + ' (' + overallSurv + '%)');
        $('#detailContent').html(html);
        $('#modalActions').html('');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('farmerDetailModal')).show();
        return;
    }

    // --- Hierarchical: Year → Group → Farmer ---
    var rows = [];
    var valueLabel;
    if (kpiType === 'shadeExisting') valueLabel = isVi ? 'SL cây CB' : 'Shade Trees';
    else if (kpiType === 'shadePlanted') valueLabel = isVi ? 'SL trồng' : 'Planted';
    else if (kpiType === 'survivalRate') valueLabel = isVi ? 'Tỷ lệ sống' : 'Survival';
    else if (kpiType === 'cherryVol' || kpiType === 'hqVol') valueLabel = isVi ? 'SL (T)' : 'Vol (T)';
    else if (kpiType === 'totalPlots') valueLabel = isVi ? 'DT (ha)' : 'Area (ha)';
    else valueLabel = isVi ? 'DT (ha)' : 'Area (ha)';

    if (kpiType === 'totalFarmers') {
        farmers.forEach(function (f) {
            rows.push({ farmerId: f.Farmer_ID, group: f.Farmer_Group_Name || '', name: f.Full_Name || '', value: f.Total_Coffee_Area || '', partYear: f['Participation Year'] || '' });
        });
    } else if (kpiType === 'totalPlots') {
        plots.forEach(function (p) {
            var f = farmerMap[p.Farmer_ID] || {};
            rows.push({ farmerId: p.Farmer_ID, group: f.Farmer_Group_Name || '', name: (f.Full_Name || '') + ' \u2014 ' + (p.Plot_Id || ''), value: p['Area (ha)'] || '', partYear: f['Participation Year'] || '' });
        });
    } else if (kpiType === 'totalArea') {
        plots.filter(function (p) { return parseFloat(p['Area (ha)']) > 0; }).forEach(function (p) {
            var f = farmerMap[p.Farmer_ID] || {};
            rows.push({ farmerId: p.Farmer_ID, group: f.Farmer_Group_Name || '', name: f.Full_Name || '', value: p['Area (ha)'] || '', partYear: f['Participation Year'] || '' });
        });
    } else if (kpiType === 'shadeExisting') {
        plots.filter(function (p) { return parseFloat(p.Num_Shade_Trees_Before) > 0; }).forEach(function (p) {
            var f = farmerMap[p.Farmer_ID] || {};
            rows.push({ farmerId: p.Farmer_ID, group: f.Farmer_Group_Name || '', name: f.Full_Name || '', value: p.Num_Shade_Trees_Before || '0', partYear: f['Participation Year'] || '' });
        });
    } else if (kpiType === 'shadePlanted') {
        // Use Supported data directly (tree records)
        var suppAll2 = rawData.supported || [];
        var fids2 = new Set(farmers.map(function (ff) { return ff.Farmer_ID; }));
        var treeRecs2 = suppAll2.filter(function (s) { return fids2.has(s['Farmer ID']) && (s.Unit || '').toLowerCase().indexOf('tree') >= 0; });
        var farmerPlanted = {};
        treeRecs2.forEach(function (s) {
            var fid = s['Farmer ID'];
            if (!farmerPlanted[fid]) farmerPlanted[fid] = 0;
            farmerPlanted[fid] += parseFloat(s.Quantity) || 0;
        });
        for (var fid2 in farmerPlanted) {
            var ff2 = farmerMap[fid2] || {};
            rows.push({ farmerId: fid2, group: ff2.Farmer_Group_Name || '', name: ff2.Full_Name || '', value: farmerPlanted[fid2].toLocaleString(), partYear: ff2['Participation Year'] || '' });
        }
    } else if (kpiType === 'cherryVol') {
        yearly.filter(function (y) { return parseFloat(y.Annual_Volume_Cherry) > 0; }).forEach(function (y) {
            var f = farmerMap[y.Farmer_ID] || {};
            rows.push({ farmerId: y.Farmer_ID, group: f.Farmer_Group_Name || '', name: f.Full_Name || '', value: y.Annual_Volume_Cherry || '0', partYear: f['Participation Year'] || '' });
        });
    } else if (kpiType === 'hqVol') {
        yearly.filter(function (y) { return parseFloat(y.Volume_High_Quality) > 0; }).forEach(function (y) {
            var f = farmerMap[y.Farmer_ID] || {};
            rows.push({ farmerId: y.Farmer_ID, group: f.Farmer_Group_Name || '', name: f.Full_Name || '', value: y.Volume_High_Quality || '0', partYear: f['Participation Year'] || '' });
        });
    }

    var totalCount = rows.length;
    if (totalCount === 0) {
        $('#farmerDetailTitle').text(title + ' (0)');
        $('#detailContent').html('<div class="text-center text-muted py-4">' + (isVi ? 'Không có dữ liệu' : 'No data') + '</div>');
        $('#modalActions').html('');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('farmerDetailModal')).show();
        return;
    }

    // Group by Participation Year → Group Name
    var yearMap = {};
    rows.forEach(function (r) {
        var py = r.partYear || 'N/A';
        var g = r.group || 'N/A';
        if (!yearMap[py]) yearMap[py] = {};
        if (!yearMap[py][g]) yearMap[py][g] = [];
        yearMap[py][g].push(r);
    });
    var sortedYears = Object.keys(yearMap).sort();

    // Render hierarchical accordion
    var html = '<div class="accordion" id="kpiDrillAcc">';
    sortedYears.forEach(function (year, yi) {
        var groups = yearMap[year];
        var sortedGroups = Object.keys(groups).sort();
        var yearCount = sortedGroups.reduce(function (s, g) { return s + groups[g].length; }, 0);
        var yearId = 'kpiY' + yi;
        // Format: "24Y" → "Năm 2024"
        var yearDisplay = year;
        var ym = year.match(/^(\d{2})Y$/);
        if (ym) yearDisplay = (isVi ? 'Năm 20' : 'Year 20') + ym[1];

        html += '<div class="accordion-item">';
        html += '<h2 class="accordion-header"><button class="accordion-button' + (yi === 0 ? '' : ' collapsed') + '" type="button" data-bs-toggle="collapse" data-bs-target="#' + yearId + '">';
        html += '<i class="fas fa-calendar-alt me-2 text-success"></i> <strong>' + escapeHtml(yearDisplay) + '</strong>';
        html += '<span class="badge bg-success ms-2">' + yearCount + '</span>';
        html += '</button></h2>';
        html += '<div id="' + yearId + '" class="accordion-collapse collapse' + (yi === 0 ? ' show' : '') + '" data-bs-parent="#kpiDrillAcc">';
        html += '<div class="accordion-body p-2">';

        // Nested group accordion
        var grpAccId = 'kpiGA' + yi;
        html += '<div class="accordion" id="' + grpAccId + '">';
        sortedGroups.forEach(function (grp, gi) {
            var items = groups[grp];
            var grpElId = 'kpiG' + yi + '_' + gi;
            var grpLabel = adminMap[grp] ? (isVi ? adminMap[grp].vi : adminMap[grp].en) || grp : grp;

            html += '<div class="accordion-item">';
            html += '<h2 class="accordion-header"><button class="accordion-button collapsed py-2" style="font-size:0.85rem;" type="button" data-bs-toggle="collapse" data-bs-target="#' + grpElId + '">';
            html += '<i class="fas fa-users me-2 text-primary"></i> ' + escapeHtml(grpLabel);
            html += '<span class="badge bg-primary ms-2">' + items.length + '</span>';
            html += '</button></h2>';
            html += '<div id="' + grpElId + '" class="accordion-collapse collapse" data-bs-parent="#' + grpAccId + '">';
            html += '<div class="accordion-body p-1">';

            // Farmer table inside group
            html += '<table class="table table-sm table-striped mb-0" style="font-size:0.8rem;">';
            html += '<thead><tr><th style="width:30px">#</th><th>' + (isVi ? 'Hộ dân' : 'Farmer') + '</th><th class="text-end">' + valueLabel + '</th></tr></thead><tbody>';
            items.forEach(function (r, ri) {
                var click = r.farmerId ? ' style="cursor:pointer" onclick="showFarmerDetails(\'' + escapeHtml(r.farmerId) + '\')"' : '';
                html += '<tr' + click + '><td>' + (ri + 1) + '</td><td>' + escapeHtml(r.name) + '</td><td class="text-end">' + escapeHtml(String(r.value)) + '</td></tr>';
            });
            html += '</tbody></table>';
            html += '</div></div></div>';
        });
        html += '</div>';
        html += '</div></div></div>';
    });
    html += '</div>';

    $('#farmerDetailTitle').text(title + ' (' + totalCount + ')');
    $('#detailContent').html(html);
    $('#modalActions').html('');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('farmerDetailModal')).show();
}

// --- KPI Drill sub-handlers ---

// Species → Groups growing that species
function kpiDrillSpeciesToGroups(speciesCode) {
    var isVi = currentLang === 'vi';
    var farmers = filteredData.farmers || [];
    var farmerMap = {};
    (rawData.farmers || []).forEach(function (f) { farmerMap[f.Farmer_ID] = f; });
    var fids = new Set(farmers.map(function (f) { return f.Farmer_ID; }));
    var suppAll = rawData.supported || [];
    var recs = suppAll.filter(function (s) {
        return fids.has(s['Farmer ID']) && s.Item_Detail === speciesCode && (s.Unit || '').toLowerCase().indexOf('tree') >= 0;
    });
    // Group by Farmer_Group_Name
    var grpData = {};
    recs.forEach(function (s) {
        var fid = s['Farmer ID'];
        var ff = farmerMap[fid] || {};
        var g = ff.Farmer_Group_Name || 'N/A';
        if (!grpData[g]) grpData[g] = { farmers: new Set(), planted: 0, alive: 0 };
        grpData[g].farmers.add(fid);
        grpData[g].planted += parseFloat(s.Quantity) || 0;
        var aVal = s['A live'];
        if (aVal !== null && aVal !== '' && aVal !== undefined && parseFloat(aVal) > 0) {
            grpData[g].alive += parseFloat(aVal) || 0;
        }
    });
    var gKeys = Object.keys(grpData).sort();
    var spName = getSpeciesName(speciesCode);
    var title = spName + ' (' + (isVi ? 'Nhóm' : 'Groups') + ')';
    var html = '<div class="table-responsive"><table class="table table-sm table-hover" style="font-size:0.82rem;">';
    html += '<thead class="table-custom-header"><tr><th>#</th>';
    html += '<th>' + (isVi ? 'Nhóm hộ' : 'Group') + '</th>';
    html += '<th>' + (isVi ? 'Số hộ' : 'Farmers') + '</th>';
    html += '<th>' + (isVi ? 'Trồng' : 'Planted') + '</th>';
    html += '<th>' + (isVi ? 'Sống' : 'Alive') + '</th>';
    html += '</tr></thead><tbody>';
    gKeys.forEach(function (g, i) {
        var st = grpData[g];
        var gLabel = adminMap[g] ? (isVi ? adminMap[g].vi : adminMap[g].en) || g : g;
        html += '<tr class="kpi-drill-row" onclick="kpiDrillSpeciesGroupFarmers(\'' + escapeHtml(speciesCode) + '\',\'' + escapeHtml(g) + '\')">';
        html += '<td>' + (i + 1) + '</td>';
        html += '<td>' + escapeHtml(gLabel) + '</td>';
        html += '<td>' + st.farmers.size + '</td>';
        html += '<td>' + st.planted.toLocaleString() + '</td>';
        html += '<td>' + (st.alive > 0 ? st.alive.toLocaleString() : '-') + '</td>';
        html += '</tr>';
    });
    if (gKeys.length === 0) html += '<tr><td colspan="5" class="text-center text-muted py-3">' + (isVi ? 'Không có dữ liệu' : 'No data') + '</td></tr>';
    html += '</tbody></table></div>';
    kpiDrillPush(title, html);
}

// Species + Group → Farmer list
function kpiDrillSpeciesGroupFarmers(speciesCode, groupCode) {
    var isVi = currentLang === 'vi';
    var farmers = filteredData.farmers || [];
    var farmerMap = {};
    (rawData.farmers || []).forEach(function (f) { farmerMap[f.Farmer_ID] = f; });
    var fids = new Set(farmers.map(function (f) { return f.Farmer_ID; }));
    var suppAll = rawData.supported || [];
    var recs = suppAll.filter(function (s) {
        return fids.has(s['Farmer ID']) && s.Item_Detail === speciesCode && (s.Unit || '').toLowerCase().indexOf('tree') >= 0;
    });
    // Filter by group
    var farmerData = {};
    recs.forEach(function (s) {
        var fid = s['Farmer ID'];
        var ff = farmerMap[fid] || {};
        if ((ff.Farmer_Group_Name || 'N/A') !== groupCode) return;
        if (!farmerData[fid]) farmerData[fid] = { name: ff.Full_Name || fid, planted: 0, alive: 0 };
        farmerData[fid].planted += parseFloat(s.Quantity) || 0;
        var aVal = s['A live'];
        if (aVal !== null && aVal !== '' && aVal !== undefined && parseFloat(aVal) > 0) {
            farmerData[fid].alive += parseFloat(aVal) || 0;
        }
    });
    var fKeys = Object.keys(farmerData).sort(function (a, b) { return farmerData[a].name.localeCompare(farmerData[b].name); });
    var gLabel = adminMap[groupCode] ? (isVi ? adminMap[groupCode].vi : adminMap[groupCode].en) || groupCode : groupCode;
    var title = gLabel + ' — ' + getSpeciesName(speciesCode);
    var html = '<div class="table-responsive"><table class="table table-sm table-hover" style="font-size:0.82rem;">';
    html += '<thead class="table-custom-header"><tr><th>#</th>';
    html += '<th>' + (isVi ? 'Hộ dân' : 'Farmer') + '</th>';
    html += '<th>' + (isVi ? 'Trồng' : 'Planted') + '</th>';
    html += '<th>' + (isVi ? 'Sống' : 'Alive') + '</th>';
    html += '</tr></thead><tbody>';
    fKeys.forEach(function (fid, i) {
        var d = farmerData[fid];
        html += '<tr class="kpi-drill-row" onclick="showFarmerDetails(\'' + escapeHtml(fid) + '\')">';
        html += '<td>' + (i + 1) + '</td>';
        html += '<td>' + escapeHtml(d.name) + '</td>';
        html += '<td>' + d.planted.toLocaleString() + '</td>';
        html += '<td>' + (d.alive > 0 ? d.alive.toLocaleString() : '-') + '</td>';
        html += '</tr>';
    });
    if (fKeys.length === 0) html += '<tr><td colspan="4" class="text-center text-muted py-3">' + (isVi ? 'Không có dữ liệu' : 'No data') + '</td></tr>';
    html += '</tbody></table></div>';
    kpiDrillPush(title, html);
}

// Groups KPI → Farmer list for a group
function kpiDrillGroupFarmers(groupCode) {
    var isVi = currentLang === 'vi';
    var farmers = filteredData.farmers || [];
    var plots = filteredData.plots || [];
    var list = farmers.filter(function (f) { return (f.Farmer_Group_Name || 'N/A') === groupCode; });
    list.sort(function (a, b) { return (a.Full_Name || '').localeCompare(b.Full_Name || ''); });
    var gLabel = adminMap[groupCode] ? (isVi ? adminMap[groupCode].vi : adminMap[groupCode].en) || groupCode : groupCode;
    var title = gLabel + ' (' + list.length + ' ' + (isVi ? 'hộ' : 'farmers') + ')';
    // Count plots per farmer
    var plotCount = {};
    plots.forEach(function (p) { plotCount[p.Farmer_ID] = (plotCount[p.Farmer_ID] || 0) + 1; });
    var html = '<div class="table-responsive"><table class="table table-sm table-hover" style="font-size:0.82rem;">';
    html += '<thead class="table-custom-header"><tr><th>#</th>';
    html += '<th>' + (isVi ? 'Hộ dân' : 'Farmer') + '</th>';
    html += '<th>' + (isVi ? 'Số lô' : 'Plots') + '</th>';
    html += '<th>' + (isVi ? 'DT (ha)' : 'Area') + '</th>';
    html += '</tr></thead><tbody>';
    list.forEach(function (f, i) {
        html += '<tr class="kpi-drill-row" onclick="showFarmerDetails(\'' + escapeHtml(f.Farmer_ID) + '\')">';
        html += '<td>' + (i + 1) + '</td>';
        html += '<td>' + escapeHtml(f.Full_Name || f.Farmer_ID) + '</td>';
        html += '<td>' + (plotCount[f.Farmer_ID] || 0) + '</td>';
        html += '<td>' + (parseFloat(f.Total_Coffee_Area) || 0).toFixed(2) + '</td>';
        html += '</tr>';
    });
    if (list.length === 0) html += '<tr><td colspan="4" class="text-center text-muted py-3">' + (isVi ? 'Không có dữ liệu' : 'No data') + '</td></tr>';
    html += '</tbody></table></div>';
    kpiDrillPush(title, html);
}

// Female KPI → Group → Farmer list
function kpiDrillFemaleGroup(groupCode) {
    var isVi = currentLang === 'vi';
    var farmers = filteredData.farmers || [];
    var list = farmers.filter(function (f) { return (f.Farmer_Group_Name || 'N/A') === groupCode; });
    list.sort(function (a, b) {
        var ga = (a.Gender || '').trim().toLowerCase();
        var gb = (b.Gender || '').trim().toLowerCase();
        var fa = (ga === 'nữ' || ga === 'female' || ga === 'f') ? 0 : 1;
        var fb = (gb === 'nữ' || gb === 'female' || gb === 'f') ? 0 : 1;
        return fa - fb || (a.Full_Name || '').localeCompare(b.Full_Name || '');
    });
    var gLabel = adminMap[groupCode] ? (isVi ? adminMap[groupCode].vi : adminMap[groupCode].en) || groupCode : groupCode;
    var femaleCount = list.filter(function (f) { var g = (f.Gender || '').trim().toLowerCase(); return g === 'nữ' || g === 'female' || g === 'f'; }).length;
    var title = gLabel + ' (' + femaleCount + '/' + list.length + ')';
    var html = '<div class="table-responsive"><table class="table table-sm table-hover" style="font-size:0.82rem;">';
    html += '<thead class="table-custom-header"><tr><th>#</th>';
    html += '<th>' + (isVi ? 'Hộ dân' : 'Farmer') + '</th>';
    html += '<th>' + (isVi ? 'Giới tính' : 'Gender') + '</th>';
    html += '<th>' + (isVi ? 'Thôn' : 'Village') + '</th>';
    html += '</tr></thead><tbody>';
    list.forEach(function (f, i) {
        var g = (f.Gender || '').trim().toLowerCase();
        var isFemale = g === 'nữ' || g === 'female' || g === 'f';
        var vLabel = adminMap[f.Village_Name] ? (isVi ? adminMap[f.Village_Name].vi : adminMap[f.Village_Name].en) || f.Village_Name : (f.Village_Name || '');
        html += '<tr class="kpi-drill-row' + (isFemale ? ' table-success' : '') + '" onclick="showFarmerDetails(\'' + escapeHtml(f.Farmer_ID) + '\')">';
        html += '<td>' + (i + 1) + '</td>';
        html += '<td>' + escapeHtml(f.Full_Name || f.Farmer_ID) + '</td>';
        html += '<td>' + (isFemale ? '<i class="fas fa-venus text-danger"></i> ' : '') + escapeHtml(f.Gender || '') + '</td>';
        html += '<td>' + escapeHtml(vLabel) + '</td>';
        html += '</tr>';
    });
    if (list.length === 0) html += '<tr><td colspan="4" class="text-center text-muted py-3">' + (isVi ? 'Không có dữ liệu' : 'No data') + '</td></tr>';
    html += '</tbody></table></div>';
    kpiDrillPush(title, html);
}

// Completion Rate → Group → Farmer list with status
function kpiDrillCompletionGroup(groupCode) {
    var isVi = currentLang === 'vi';
    var farmers = filteredData.farmers || [];
    var list = farmers.filter(function (f) { return (f.Farmer_Group_Name || 'N/A') === groupCode; });
    list.sort(function (a, b) {
        var da = (a.Activity || '').trim() === 'Done' ? 0 : 1;
        var db = (b.Activity || '').trim() === 'Done' ? 0 : 1;
        return da - db || (a.Full_Name || '').localeCompare(b.Full_Name || '');
    });
    var gLabel = adminMap[groupCode] ? (isVi ? adminMap[groupCode].vi : adminMap[groupCode].en) || groupCode : groupCode;
    var doneCount = list.filter(function (f) { return (f.Activity || '').trim() === 'Done'; }).length;
    var title = gLabel + ' (' + doneCount + '/' + list.length + ')';
    var html = '<div class="table-responsive"><table class="table table-sm table-hover" style="font-size:0.82rem;">';
    html += '<thead class="table-custom-header"><tr><th>#</th>';
    html += '<th>' + (isVi ? 'Hộ dân' : 'Farmer') + '</th>';
    html += '<th>' + (isVi ? 'Trạng thái' : 'Status') + '</th>';
    html += '<th>' + (isVi ? 'DT (ha)' : 'Area') + '</th>';
    html += '</tr></thead><tbody>';
    list.forEach(function (f, i) {
        var isDone = (f.Activity || '').trim() === 'Done';
        html += '<tr class="kpi-drill-row' + (isDone ? ' table-success' : '') + '" onclick="showFarmerDetails(\'' + escapeHtml(f.Farmer_ID) + '\')">';
        html += '<td>' + (i + 1) + '</td>';
        html += '<td>' + escapeHtml(f.Full_Name || f.Farmer_ID) + '</td>';
        html += '<td>' + (isDone ? '<i class="fas fa-check-circle text-success"></i> Done' : '<i class="fas fa-clock text-warning"></i> ' + (isVi ? 'Chưa xong' : 'Pending')) + '</td>';
        html += '<td>' + (parseFloat(f.Total_Coffee_Area) || 0).toFixed(2) + '</td>';
        html += '</tr>';
    });
    if (list.length === 0) html += '<tr><td colspan="4" class="text-center text-muted py-3">' + (isVi ? 'Không có dữ liệu' : 'No data') + '</td></tr>';
    html += '</tbody></table></div>';
    kpiDrillPush(title, html);
}

// Survival Rate → Group → Farmer list with tree data
function kpiDrillSurvivalGroup(groupCode) {
    var isVi = currentLang === 'vi';
    var farmers = filteredData.farmers || [];
    var farmerMap = {};
    (rawData.farmers || []).forEach(function (f) { farmerMap[f.Farmer_ID] = f; });
    var fids = new Set(farmers.filter(function (f) { return (f.Farmer_Group_Name || 'N/A') === groupCode; }).map(function (f) { return f.Farmer_ID; }));
    var suppAll = rawData.supported || [];
    var treeRecs = suppAll.filter(function (s) {
        return fids.has(s['Farmer ID']) && (s.Unit || '').toLowerCase().indexOf('tree') >= 0;
    });
    // Group by farmer → species
    var farmerSpecies = {};
    treeRecs.forEach(function (s) {
        var fid = s['Farmer ID'];
        var sp = s.Item_Detail || 'Unknown';
        var key = fid + '|' + sp;
        if (!farmerSpecies[key]) farmerSpecies[key] = { fid: fid, species: sp, name: (farmerMap[fid] || {}).Full_Name || fid, planted: 0, alive: 0, evalQty: 0 };
        farmerSpecies[key].planted += parseFloat(s.Quantity) || 0;
        var aVal = s['A live'];
        if (aVal !== null && aVal !== '' && aVal !== undefined && parseFloat(aVal) > 0) {
            farmerSpecies[key].alive += parseFloat(aVal) || 0;
            farmerSpecies[key].evalQty += parseFloat(s.Quantity) || 0;
        }
    });
    var rows = Object.keys(farmerSpecies).map(function (k) { return farmerSpecies[k]; });
    rows.sort(function (a, b) {
        var cmp = a.name.localeCompare(b.name);
        if (cmp !== 0) return cmp;
        return (getSpeciesName(a.species)).localeCompare(getSpeciesName(b.species));
    });
    var gLabel = adminMap[groupCode] ? (isVi ? adminMap[groupCode].vi : adminMap[groupCode].en) || groupCode : groupCode;
    var title = gLabel + ' — ' + (isVi ? 'Tỷ lệ sống' : 'Survival');
    var html = '<div class="table-responsive"><table class="table table-sm table-hover" style="font-size:0.82rem;">';
    html += '<thead class="table-custom-header"><tr><th>#</th>';
    html += '<th>' + (isVi ? 'Hộ dân' : 'Farmer') + '</th>';
    html += '<th>' + (isVi ? 'Loài cây' : 'Species') + '</th>';
    html += '<th>' + (isVi ? 'Trồng' : 'Planted') + '</th>';
    html += '<th>' + (isVi ? 'Sống' : 'Alive') + '</th>';
    html += '<th>' + (isVi ? 'Tỷ lệ' : 'Rate') + '</th>';
    html += '</tr></thead><tbody>';
    var prevFid = '';
    rows.forEach(function (d, i) {
        var rate = d.evalQty > 0 ? (d.alive / d.evalQty * 100).toFixed(1) + '%' : (isVi ? 'Chưa ĐG' : 'N/A');
        var showName = d.fid !== prevFid;
        prevFid = d.fid;
        html += '<tr class="kpi-drill-row" onclick="showFarmerDetails(\'' + escapeHtml(d.fid) + '\')">';
        html += '<td>' + (i + 1) + '</td>';
        html += '<td>' + (showName ? escapeHtml(d.name) : '<span class="text-muted">↳</span>') + '</td>';
        html += '<td><small>' + escapeHtml(getSpeciesName(d.species)) + '</small></td>';
        html += '<td>' + d.planted.toLocaleString() + '</td>';
        html += '<td>' + (d.alive > 0 ? d.alive.toLocaleString() : '-') + '</td>';
        html += '<td>' + rate + '</td>';
        html += '</tr>';
    });
    if (rows.length === 0) html += '<tr><td colspan="6" class="text-center text-muted py-3">' + (isVi ? 'Không có dữ liệu' : 'No data') + '</td></tr>';
    html += '</tbody></table></div>';
    kpiDrillPush(title, html);
}

// ==========================================
// SURVIVAL RATE ASSESSMENT ACTIVITY
// ==========================================
function showSurvivalAssessment() {
    var isVi = currentLang === 'vi';
    var supported = rawData.supported || [];

    // Get tree records only (Unit contains 'tree')
    var treeRecs = supported.filter(function (s) {
        return (s.Unit || '').toLowerCase().indexOf('tree') >= 0;
    });

    // Collect available years
    var yearSet = {};
    treeRecs.forEach(function (s) {
        var y = s['Supported year'] || s.Supported_year || '';
        if (y) yearSet[y] = true;
    });
    var years = Object.keys(yearSet).sort().reverse();
    var defaultYear = years[0] || '';

    // Build year selector + summary
    var html = '<div class="d-flex align-items-center gap-2 mb-3 flex-wrap">';
    html += '<label class="fw-bold text-muted" style="font-size:0.85rem;">' + (isVi ? 'Năm hỗ trợ:' : 'Support Year:') + '</label>';
    html += '<select class="form-select form-select-sm" style="width:auto;min-width:100px;" onchange="renderSurvivalYear(this.value)">';
    html += '<option value="">' + (isVi ? 'Tất cả' : 'All') + '</option>';
    years.forEach(function (y) {
        html += '<option value="' + y + '"' + (y === defaultYear ? ' selected' : '') + '>' + y + '</option>';
    });
    html += '</select>';
    html += '<span id="survivalSummaryBadge" class="badge bg-success" style="font-size:0.75rem;"></span>';
    html += '</div>';
    html += '<div id="survivalAssessContent"></div>';

    var title = isVi ? 'Đánh giá tỷ lệ sống cây giống' : 'Seedling Survival Assessment';
    $('#farmerDetailTitle').text(title);
    $('#detailContent').html(html);
    $('#modalActions').html('');
    var modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('farmerDetailModal'));
    modal.show();

    // Render default year
    renderSurvivalYear(defaultYear);
}

function renderSurvivalYear(year) {
    var isVi = currentLang === 'vi';
    var supported = rawData.supported || [];

    // Filter tree records
    var treeRecs = supported.filter(function (s) {
        if ((s.Unit || '').toLowerCase().indexOf('tree') < 0) return false;
        if (year) {
            var sy = s['Supported year'] || s.Supported_year || '';
            return String(sy) === String(year);
        }
        return true;
    });

    // Group by farmer
    var farmerGroups = {};
    treeRecs.forEach(function (s) {
        var fid = s['Farmer ID'] || s.Farmer_ID || '';
        if (!fid) return;
        if (!farmerGroups[fid]) farmerGroups[fid] = { fid: fid, records: [], planted: 0, alive: 0, evaluated: 0, evalQty: 0 };
        var qty = parseFloat(s.Quantity) || 0;
        var aVal = s['A live'] !== undefined ? s['A live'] : s.A_live;
        var hasEval = aVal !== null && aVal !== '' && aVal !== undefined && String(aVal).trim() !== '';

        farmerGroups[fid].records.push(s);
        farmerGroups[fid].planted += qty;
        if (hasEval) {
            farmerGroups[fid].evaluated++;
            farmerGroups[fid].evalQty += qty;
            farmerGroups[fid].alive += parseFloat(aVal) || 0;
        }
    });

    // Sort by farmer name
    var farmerList = Object.values(farmerGroups);
    farmerList.sort(function (a, b) {
        var na = farmersMap[a.fid] ? (isVi ? farmersMap[a.fid].vi : farmersMap[a.fid].en) : a.fid;
        var nb = farmersMap[b.fid] ? (isVi ? farmersMap[b.fid].vi : farmersMap[b.fid].en) : b.fid;
        return na.localeCompare(nb);
    });

    // Summary stats
    var totalPlanted = farmerList.reduce(function (s, f) { return s + f.planted; }, 0);
    var totalAlive = farmerList.reduce(function (s, f) { return s + f.alive; }, 0);
    var totalEvalQty = farmerList.reduce(function (s, f) { return s + f.evalQty; }, 0);
    var overallRate = totalEvalQty > 0 ? (totalAlive / totalEvalQty * 100).toFixed(1) : 0;
    var evalCount = farmerList.filter(function (f) { return f.evaluated > 0; }).length;

    // Summary badge
    var badge = document.getElementById('survivalSummaryBadge');
    if (badge) {
        badge.innerHTML = (isVi ? 'Đã đánh giá: ' : 'Evaluated: ') + evalCount + '/' + farmerList.length +
            ' | ' + (isVi ? 'Tỷ lệ sống: ' : 'Survival: ') + overallRate + '%';
        badge.className = 'badge ' + (parseFloat(overallRate) >= 70 ? 'bg-success' : parseFloat(overallRate) >= 50 ? 'bg-warning text-dark' : 'bg-danger');
    }

    // Build table
    var html = '<div class="table-responsive"><table class="table table-striped table-hover table-sm" style="font-size:0.8rem;">';
    html += '<thead class="table-custom-header"><tr>';
    html += '<th>#</th>';
    html += '<th>' + (isVi ? 'Nông hộ' : 'Farmer') + '</th>';
    html += '<th>' + (isVi ? 'Nhóm' : 'Group') + '</th>';
    html += '<th>' + (isVi ? 'Số lượt' : 'Records') + '</th>';
    html += '<th>' + (isVi ? 'Đã trồng' : 'Planted') + '</th>';
    html += '<th>' + (isVi ? 'Còn sống' : 'Alive') + '</th>';
    html += '<th>' + (isVi ? 'Tỷ lệ' : 'Rate') + '</th>';
    html += '<th>' + (isVi ? 'Trạng thái' : 'Status') + '</th>';
    html += '</tr></thead><tbody>';

    farmerList.forEach(function (f, i) {
        var name = farmersMap[f.fid] ? (isVi ? farmersMap[f.fid].vi : farmersMap[f.fid].en) : f.fid;
        // Get group from farmer data
        var farmer = (rawData.farmers || []).find(function (fr) { return fr.Farmer_ID === f.fid; });
        var groupCode = farmer ? (farmer.Farmer_Group_Name || farmer['Farmer_Group_Name'] || '') : '';
        var groupLabel = groupCode && adminMap[groupCode] ? (isVi ? adminMap[groupCode].vi : adminMap[groupCode].en) : groupCode;

        var rate = f.evalQty > 0 ? (f.alive / f.evalQty * 100).toFixed(1) : '-';
        var rateNum = parseFloat(rate) || 0;
        var statusHtml;
        if (f.evaluated === 0) {
            statusHtml = '<span class="badge bg-secondary">' + (isVi ? 'Chưa ĐG' : 'Pending') + '</span>';
        } else if (f.evaluated < f.records.length) {
            statusHtml = '<span class="badge bg-warning text-dark">' + f.evaluated + '/' + f.records.length + '</span>';
        } else {
            statusHtml = '<span class="badge ' + (rateNum >= 70 ? 'bg-success' : rateNum >= 50 ? 'bg-warning text-dark' : 'bg-danger') + '">' + rate + '%</span>';
        }

        html += '<tr class="kpi-drill-row" onclick="showSurvivalFarmerDetail(\'' + escapeHtml(f.fid) + '\', \'' + escapeHtml(year) + '\')">';
        html += '<td>' + (i + 1) + '</td>';
        html += '<td>' + escapeHtml(name) + '</td>';
        html += '<td><small>' + escapeHtml(groupLabel) + '</small></td>';
        html += '<td>' + f.records.length + '</td>';
        html += '<td>' + f.planted.toLocaleString() + '</td>';
        html += '<td>' + (f.alive > 0 ? f.alive.toLocaleString() : (f.evaluated > 0 ? '0' : '-')) + '</td>';
        html += '<td>';
        if (f.evalQty > 0) {
            var barW = Math.max(5, rateNum);
            html += '<div class="kpi-drill-bar" style="min-width:60px;"><div class="kpi-drill-bar-fill' + (rateNum < 50 ? ' danger' : '') + '" style="width:' + barW + '%;"></div></div>';
        } else {
            html += '-';
        }
        html += '</td>';
        html += '<td>' + statusHtml + '</td>';
        html += '</tr>';
    });
    if (farmerList.length === 0) {
        html += '<tr><td colspan="8" class="text-center text-muted py-3">' + (isVi ? 'Không có dữ liệu cây giống' : 'No seedling data') + '</td></tr>';
    }
    html += '</tbody></table></div>';

    var container = document.getElementById('survivalAssessContent');
    if (container) container.innerHTML = html;
}

function showSurvivalFarmerDetail(farmerId, year) {
    var isVi = currentLang === 'vi';
    var supported = rawData.supported || [];

    // Filter tree records for this farmer
    var treeRecs = supported.filter(function (s) {
        if ((s.Unit || '').toLowerCase().indexOf('tree') < 0) return false;
        var fid = s['Farmer ID'] || s.Farmer_ID || '';
        if (String(fid) !== String(farmerId)) return false;
        if (year) {
            var sy = s['Supported year'] || s.Supported_year || '';
            return String(sy) === String(year);
        }
        return true;
    });

    var farmerName = farmersMap[farmerId] ? (isVi ? farmersMap[farmerId].vi : farmersMap[farmerId].en) : farmerId;

    // Back button
    var html = '<button class="btn btn-sm btn-outline-secondary mb-3" onclick="showSurvivalAssessment()"><i class="fas fa-arrow-left me-1"></i>' + (isVi ? 'Quay lại' : 'Back') + '</button>';

    // Link to farmer details
    html += ' <button class="btn btn-sm btn-outline-primary mb-3 ms-2" onclick="showFarmerDetails(\'' + escapeHtml(farmerId) + '\')"><i class="fas fa-user me-1"></i>' + (isVi ? 'Xem hồ sơ' : 'Profile') + '</button>';

    // Summary for this farmer
    var totalPlanted = 0, totalAlive = 0, totalEvalQty = 0;
    treeRecs.forEach(function (s) {
        var qty = parseFloat(s.Quantity) || 0;
        totalPlanted += qty;
        var aVal = s['A live'] !== undefined ? s['A live'] : s.A_live;
        var hasEval = aVal !== null && aVal !== '' && aVal !== undefined && String(aVal).trim() !== '';
        if (hasEval) {
            totalEvalQty += qty;
            totalAlive += parseFloat(aVal) || 0;
        }
    });
    var overallRate = totalEvalQty > 0 ? (totalAlive / totalEvalQty * 100).toFixed(1) : '-';

    html += '<div class="card border-0 bg-light mb-3"><div class="card-body py-2 px-3" style="font-size:0.85rem;">';
    html += '<div class="d-flex gap-4 flex-wrap">';
    html += '<span><i class="fas fa-seedling text-success me-1"></i><strong>' + totalPlanted.toLocaleString() + '</strong> ' + (isVi ? 'cây trồng' : 'planted') + '</span>';
    html += '<span><i class="fas fa-check-circle text-primary me-1"></i><strong>' + totalAlive.toLocaleString() + '</strong> ' + (isVi ? 'còn sống' : 'alive') + '</span>';
    html += '<span><i class="fas fa-chart-line me-1"></i>' + (isVi ? 'Tỷ lệ: ' : 'Rate: ') + '<strong>' + overallRate + (overallRate !== '-' ? '%' : '') + '</strong></span>';
    html += '</div></div></div>';

    // Detail table with editable A_live
    html += '<div class="table-responsive"><table class="table table-sm table-bordered" style="font-size:0.8rem;">';
    html += '<thead class="table-custom-header"><tr>';
    html += '<th>#</th>';
    html += '<th>' + (isVi ? 'Mã hỗ trợ' : 'Support ID') + '</th>';
    html += '<th>' + (isVi ? 'Loài cây' : 'Species') + '</th>';
    html += '<th>' + (isVi ? 'Số lượng' : 'Qty') + '</th>';
    html += '<th>' + (isVi ? 'Năm' : 'Year') + '</th>';
    html += '<th>' + (isVi ? 'Hỗ trợ bởi' : 'Supported by') + '</th>';
    html += '<th style="min-width:100px;">' + (isVi ? 'Còn sống' : 'Alive') + ' <i class="fas fa-edit text-primary" style="font-size:0.65rem;"></i></th>';
    html += '<th>' + (isVi ? 'Tỷ lệ' : 'Rate') + '</th>';
    html += '</tr></thead><tbody>';

    treeRecs.forEach(function (s, i) {
        var sid = s.Support_ID || s['Support_ID'] || '';
        var species = s.Item_Detail || '';
        var speciesName = (typeof getSpeciesName === 'function') ? getSpeciesName(species) : species;
        var qty = parseFloat(s.Quantity) || 0;
        var sy = s['Supported year'] || s.Supported_year || '';
        var supportBy = s['Supported by'] || s.Supported_by || '';
        var supportByLabel = resolveValue('Supported by', supportBy, 'Supported') || supportBy;
        var aVal = s['A live'] !== undefined ? s['A live'] : s.A_live;
        var hasEval = aVal !== null && aVal !== '' && aVal !== undefined && String(aVal).trim() !== '';
        var aliveNum = hasEval ? parseFloat(aVal) || 0 : '';
        var rate = hasEval && qty > 0 ? (aliveNum / qty * 100).toFixed(1) + '%' : '-';

        html += '<tr>';
        html += '<td>' + (i + 1) + '</td>';
        html += '<td><small>' + escapeHtml(sid) + '</small></td>';
        html += '<td>' + escapeHtml(speciesName) + '</td>';
        html += '<td>' + qty.toLocaleString() + '</td>';
        html += '<td>' + escapeHtml(sy) + '</td>';
        html += '<td><small>' + escapeHtml(supportByLabel) + '</small></td>';
        html += '<td><input type="number" class="form-control form-control-sm" style="width:80px;font-size:0.8rem;" ' +
            'value="' + (hasEval ? aliveNum : '') + '" min="0" max="' + qty + '" ' +
            'data-support-id="' + escapeHtml(sid) + '" data-farmer-id="' + escapeHtml(farmerId) + '" data-year="' + escapeHtml(year) + '" ' +
            'onchange="saveSurvivalValue(this)" placeholder="—"></td>';
        html += '<td>' + rate + '</td>';
        html += '</tr>';
    });
    if (treeRecs.length === 0) {
        html += '<tr><td colspan="8" class="text-center text-muted py-3">' + (isVi ? 'Không có bản ghi cây giống' : 'No seedling records') + '</td></tr>';
    }
    html += '</tbody></table></div>';

    // Link to supported data browser
    html += '<div class="mt-2"><button class="btn btn-sm btn-outline-success" onclick="openDataBrowser(\'Supported\');$(\'#farmerDetailModal\').modal(\'hide\');"><i class="fas fa-database me-1"></i>' + (isVi ? 'Xem tất cả dữ liệu hỗ trợ' : 'View all support data') + '</button></div>';

    var title = farmerName + ' — ' + (isVi ? 'Đánh giá tỷ lệ sống' : 'Survival Assessment');
    $('#farmerDetailTitle').text(title);
    $('#detailContent').html(html);
    $('#modalActions').html('');
}

function saveSurvivalValue(inputEl) {
    var supportId = inputEl.getAttribute('data-support-id');
    var farmerId = inputEl.getAttribute('data-farmer-id');
    var year = inputEl.getAttribute('data-year');
    var value = inputEl.value.trim();
    var isVi = currentLang === 'vi';

    if (!supportId) return;
    if (value === '') return; // Don't save empty

    var numVal = parseFloat(value);
    if (isNaN(numVal) || numVal < 0) {
        showToast(isVi ? 'Giá trị không hợp lệ' : 'Invalid value');
        return;
    }

    // Update in PocketBase
    inputEl.disabled = true;
    supabaseClient.from('supported').update({ 'A live': String(numVal) }).eq('Support_ID', supportId)
        .then(function (res) {
            inputEl.disabled = false;
            if (res.error) {
                showToast(isVi ? 'Lỗi lưu: ' + res.error.message : 'Save error: ' + res.error.message);
                return;
            }
            // Update rawData in memory
            var rec = (rawData.supported || []).find(function (s) { return (s.Support_ID || s['Support_ID']) === supportId; });
            if (rec) {
                rec['A live'] = String(numVal);
                rec.A_live = String(numVal);
            }
            // Update the rate cell next to the input
            var row = inputEl.closest('tr');
            if (row) {
                var qty = parseFloat(row.cells[3].textContent.replace(/,/g, '')) || 0;
                var rate = qty > 0 ? (numVal / qty * 100).toFixed(1) + '%' : '-';
                row.cells[7].textContent = rate;
            }
            // Recalculate yearly data
            var suppYear = year || '';
            if (suppYear) recalcYearlyForFarmer(farmerId, suppYear);

            showToast(isVi ? 'Đã lưu' : 'Saved', 1500);
            inputEl.classList.add('border-success');
            setTimeout(function () { inputEl.classList.remove('border-success'); }, 2000);
        }).catch(function (err) {
            inputEl.disabled = false;
            console.error('Save survival error:', err);
            showToast(isVi ? 'Lỗi kết nối' : 'Connection error');
        });
}

var LIBRARY_CONFIG = {
    'op6':      { key: 'op6',          tableType: 'Op6',      idCol: 'OP6 ID',     cols: ['OP6 ID', 'Name_EN', 'Name_VI', 'Type', 'From date', 'To date'],         titleVi: 'Danh sách hoạt động OP6', titleEn: 'OP6 Activities List' },
    'species':  { key: 'species',      tableType: 'Species',  idCol: 'Species_ID', cols: ['Species_ID', 'Species_name', 'Species type', 'Species Info'],            titleVi: 'Thông tin loài cây',      titleEn: 'Species Information' },
    'admin':    { key: 'admin',        tableType: 'Admin',    idCol: 'Adm_ID',     cols: ['Adm_ID', 'Condition', 'Label EN', 'Label VN', 'Notes'],                  titleVi: 'Danh mục quản trị',       titleEn: 'Admin List' },
    'training': { key: 'trainingList', tableType: 'Training', idCol: 'Train_ID',   cols: ['Train_ID', 'Name_EN', 'Name_VI'],                                       titleVi: 'Danh sách tập huấn',      titleEn: 'Training List' }
};

function showLibraryList(type) {
    var cfg = LIBRARY_CONFIG[type];
    if (!cfg) return;
    var title = currentLang === 'vi' ? cfg.titleVi : cfg.titleEn;
    var items = rawData[cfg.key] || [];
    console.log('showLibraryList(' + type + '): items=' + items.length);

    // Auto-fetch from PB if data is empty (handles stale cache)
    if (items.length === 0 && !cfg._fetching) {
        cfg._fetching = true;
        var tableName = TABLE_MAP[cfg.tableType] ? TABLE_MAP[cfg.tableType].table : null;
        if (tableName) {
            console.log('showLibraryList: auto-fetching ' + tableName + ' from PocketBase...');
            supabaseClient.from(tableName).select('*').limit(10000).then(function (result) {
                cfg._fetching = false;
                if (result && !result.error && result.data && result.data.length > 0) {
                    rawData[cfg.key] = result.data;
                    console.log('showLibraryList: fetched ' + result.data.length + ' records for ' + type);
                    showLibraryList(type); // Re-render with data
                } else {
                    console.log('showLibraryList: no data found for ' + type, result && result.error ? result.error : '');
                    _renderLibraryList(type, cfg, title, []);
                }
            }).catch(function (err) {
                cfg._fetching = false;
                console.error('showLibraryList: fetch error for ' + type, err);
                _renderLibraryList(type, cfg, title, []);
            });
            // Show loading state in modal while fetching
            $('#farmerDetailTitle').text(title);
            $('#detailContent').html('<div class="text-center py-4"><i class="fas fa-spinner fa-spin me-2"></i>' + (currentLang === 'vi' ? 'Đang tải dữ liệu...' : 'Loading data...') + '</div>');
            $('#modalActions').html('');
            var modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('farmerDetailModal'));
            modal.show();
            return;
        }
    }
    _renderLibraryList(type, cfg, title, items);
}

function _renderLibraryList(type, cfg, title, items) {
    var canAdd = userPermissions.canAdd;

    var html = '';
    if (canAdd) {
        html += '<div class="mb-2 text-end"><button class="btn btn-sm btn-success" onclick="showAddLibraryModal(\'' + cfg.tableType + '\', \'' + type + '\')"><i class="fas fa-plus"></i> ' + (translations[currentLang].btnAddLibrary || 'Thêm mới') + '</button></div>';
    }

    html += '<div class="table-responsive"><table class="table table-striped table-hover table-sm" style="font-size:0.8rem;"><thead class="table-custom-header"><tr>';
    cfg.cols.forEach(function (col) {
        var labelKey = FIELD_LABELS[cfg.tableType] ? FIELD_LABELS[cfg.tableType][col] : null;
        var label = labelKey ? (translations[currentLang][labelKey] || col) : col;
        html += '<th>' + escapeHtml(label) + '</th>';
    });
    html += '</tr></thead><tbody>';

    items.forEach(function (item) {
        var itemId = escapeHtml(item[cfg.idCol] || '');
        html += '<tr class="kpi-drill-row" onclick="showLibraryDetail(\'' + type + '\', \'' + itemId + '\')" style="cursor:pointer;">';
        cfg.cols.forEach(function (col) {
            var val = item[col] || '';
            // Resolve mapped values (e.g., Type in OP6)
            var mapping = FIELD_MAPPING[cfg.tableType] ? FIELD_MAPPING[cfg.tableType][col] : null;
            if (mapping) {
                var mapName = (typeof mapping === 'string') ? mapping : mapping.map;
                var condition = (typeof mapping === 'object') ? mapping.condition : null;
                var mapObj = mapName === 'drop' ? dropMap : mapName === 'admin' ? adminMap : null;
                if (mapObj && mapObj[val]) {
                    val = (currentLang === 'vi' ? mapObj[val].vi : mapObj[val].en) || val;
                }
            }
            html += '<td>' + escapeHtml(val) + '</td>';
        });
        html += '</tr>';
    });
    if (items.length === 0) {
        html += '<tr><td colspan="' + cfg.cols.length + '" class="text-center text-muted py-3">' + (currentLang === 'vi' ? 'Chưa có dữ liệu' : 'No data') + '</td></tr>';
    }
    html += '</tbody></table></div>';

    $('#farmerDetailTitle').text(title + ' (' + items.length + ')');
    $('#detailContent').html(html);
    $('#modalActions').html('');
    var modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('farmerDetailModal'));
    modal.show();
}

function showLibraryDetail(type, id) {
    var cfg = LIBRARY_CONFIG[type];
    if (!cfg) return;
    var items = rawData[cfg.key] || [];
    var item = items.find(function (i) { return String(i[cfg.idCol]) === String(id); });
    if (!item) return;

    var labels = FIELD_LABELS[cfg.tableType] || {};
    var canEdit = userPermissions.canEdit;
    var canDelete = userPermissions.canDelete;

    // Title
    var itemTitle = item[cfg.cols[1]] || item[cfg.cols[0]] || id;
    var html = '<button class="btn btn-sm btn-outline-secondary mb-3" onclick="showLibraryList(\'' + type + '\')"><i class="fas fa-arrow-left me-1"></i>' + (currentLang === 'vi' ? 'Quay lại' : 'Back') + '</button>';

    // Action buttons
    if (canEdit || canDelete) {
        html += '<div class="d-flex gap-2 mb-3">';
        if (canEdit) {
            html += '<button class="btn btn-sm btn-outline-warning" onclick="openEditForm(\'' + cfg.tableType + '\', \'' + escapeHtml(id) + '\')"><i class="fas fa-edit me-1"></i>' + (currentLang === 'vi' ? 'Sửa' : 'Edit') + '</button>';
        }
        if (canDelete) {
            html += '<button class="btn btn-sm btn-outline-danger" onclick="deleteItem(\'' + cfg.tableType + '\', \'' + escapeHtml(id) + '\')"><i class="fas fa-trash me-1"></i>' + (currentLang === 'vi' ? 'Xóa' : 'Delete') + '</button>';
        }
        html += '</div>';
    }

    // Detail card
    html += '<div class="card border-0 shadow-sm"><div class="card-body p-0">';
    html += '<table class="table table-sm mb-0" style="font-size:0.85rem;">';
    Object.keys(labels).forEach(function (key) {
        var labelKey = labels[key];
        var label = translations[currentLang][labelKey] || key;
        var val = item[key] || '';
        // Resolve mapped values
        var mapping = FIELD_MAPPING[cfg.tableType] ? FIELD_MAPPING[cfg.tableType][key] : null;
        if (mapping) {
            var mapName = (typeof mapping === 'string') ? mapping : mapping.map;
            var mapObj = mapName === 'drop' ? dropMap : mapName === 'admin' ? adminMap : mapName === 'species' ? speciesMap : null;
            if (mapObj && mapObj[val]) {
                val = (currentLang === 'vi' ? mapObj[val].vi : mapObj[val].en) || val;
            }
        }
        html += '<tr><td class="fw-bold text-muted" style="width:40%;">' + escapeHtml(label) + '</td><td>' + escapeHtml(val) + '</td></tr>';
    });
    html += '</table></div></div>';

    $('#farmerDetailTitle').text(itemTitle);
    $('#detailContent').html(html);
    $('#modalActions').html('');
}

// --- ADD NEW LIBRARY ITEM ---
function generateNextLibraryId(tableType, prefix) {
    var mapping = TABLE_MAP[tableType];
    if (!mapping) return '1';
    var idCol = mapping.idCol;
    var rawKeyMap = { 'Op6': 'op6', 'Species': 'species', 'Admin': 'admin', 'Training': 'trainingList' };
    var dataKey = rawKeyMap[tableType];
    if (!dataKey || !rawData[dataKey]) return prefix ? prefix + '-01' : '1';
    var items = rawData[dataKey];

    // Prefixed ID generation (TR-06, OP6-07, FRU-12, TIM-18, etc.)
    var prefixMap = { 'Training': 'TR', 'Op6': 'OP6' };
    var pfx = prefix || prefixMap[tableType] || '';

    if (pfx) {
        var maxNum = 0;
        items.forEach(function (item) {
            var id = String(item[idCol] || '').trim();
            if (id.toUpperCase().indexOf(pfx.toUpperCase()) === 0) {
                var numMatch = id.match(/(\d+)$/);
                if (numMatch) {
                    var num = parseInt(numMatch[1], 10);
                    if (!isNaN(num) && num > maxNum) maxNum = num;
                }
            }
        });
        var nextNum = maxNum + 1;
        return pfx + '-' + String(nextNum).padStart(2, '0');
    }

    // Fallback: just increment max number
    var maxNum = 0;
    items.forEach(function (item) {
        var id = String(item[idCol] || '').trim();
        var numMatch = id.match(/(\d+)/);
        if (numMatch) {
            var num = parseInt(numMatch[1], 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
        }
    });
    return String(maxNum + 1);
}

// Generate Species ID based on selected type (FRU, TIM, OTH)
function generateSpeciesId(speciesType) {
    if (!speciesType || !rawData || !rawData.species) return '';
    var items = rawData.species;
    var maxNum = 0;
    items.forEach(function (item) {
        var id = String(item['Species_ID'] || '').trim();
        if (id.toUpperCase().indexOf(speciesType.toUpperCase()) === 0) {
            var numMatch = id.match(/(\d+)$/);
            if (numMatch) {
                var num = parseInt(numMatch[1], 10);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        }
    });
    return speciesType + '-' + String(maxNum + 1).padStart(2, '0');
}

// Called when Species type dropdown changes in add form
function onSpeciesTypeChange(selectEl) {
    var val = selectEl.value;
    if (val) {
        var newId = generateSpeciesId(val);
        var idInput = document.querySelector('#formFields input[name="Species_ID"]');
        if (idInput) idInput.value = newId;
    }
}

function showAddLibraryModal(tableType, listType) {
    if (!userPermissions.canAdd) {
        alert(currentLang === 'vi' ? 'Bạn không có quyền thêm mới.' : 'You do not have permission to add.');
        return;
    }

    // Close list modal
    var detailModal = bootstrap.Modal.getInstance(document.getElementById('farmerDetailModal'));
    if (detailModal) detailModal.hide();

    var titleText = (translations[currentLang].btnAddLibrary || 'Thêm mới') + ': ' + tableType;
    $('#editFormTitle').text(titleText);
    $('#genericForm').trigger('reset');
    $('#formFields').empty();
    $('#formType').val(tableType);
    $('#formId').val(''); // Empty = Add mode

    var fieldsHtml = '';
    var labels = FIELD_LABELS[tableType] || {};
    var idCol = TABLE_MAP[tableType] ? TABLE_MAP[tableType].idCol : '';
    Object.keys(labels).forEach(function (key) {
        fieldsHtml += generateInputField(key, '', tableType);
    });
    $('#formFields').html(fieldsHtml);

    // Auto-generate next ID
    if (idCol) {
        if (tableType === 'Species') {
            // Species ID depends on type selection - set readonly, will be filled by onSpeciesTypeChange
            $('#formFields input[name="' + idCol + '"]').val('').prop('readonly', true)
                .attr('placeholder', currentLang === 'vi' ? 'Chọn loại cây trước' : 'Select species type first');
        } else {
            var nextId = generateNextLibraryId(tableType);
            $('#formFields input[name="' + idCol + '"]').val(nextId).prop('readonly', true);
        }
    }

    // Store listType for refresh after save
    $('#formFields').data('libraryListType', listType);

    var editModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('editFormModal'));
    editModal.show();
}

function highlightTableRow(tabName, searchId) {
    var dtInstance = null;
    var idColIndex = -1;
    if (tabName === 'Farmers') { dtInstance = dtFarmers; idColIndex = 2; }
    else if (tabName === 'Plots') { dtInstance = dtPlots; idColIndex = 1; }
    else if (tabName === 'Yearly_Data') { dtInstance = dtYearly; idColIndex = 1; }
    if (!dtInstance) return;
    // Search in DataTable and go to the page containing this row
    var found = false;
    dtInstance.rows().every(function (rowIdx) {
        var data = this.data();
        if (data && data[idColIndex] === searchId) {
            var pageInfo = dtInstance.page.info();
            var rowPage = Math.floor(rowIdx / pageInfo.length);
            dtInstance.page(rowPage).draw(false);
            setTimeout(function () {
                var rowNode = dtInstance.row(rowIdx).node();
                if (rowNode) {
                    rowNode.classList.add('search-highlight-row');
                    rowNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(function () {
                        rowNode.classList.remove('search-highlight-row');
                    }, 3500);
                }
            }, 100);
            found = true;
        }
    });
    if (!found) {
        // Fallback: search by DataTable search API
        dtInstance.search(searchId).draw();
    }
}

// ==========================================
// SMART GLOBAL SEARCH
// ==========================================
(function () {
    var searchInput, searchResults, searchClearBtn;
    var searchDebounce = null;

    document.addEventListener('DOMContentLoaded', function () {
        searchInput = document.getElementById('globalSearchInput');
        searchResults = document.getElementById('searchResults');
        searchClearBtn = document.getElementById('searchClearBtn');

        if (!searchInput) return;

        searchInput.addEventListener('input', function () {
            clearTimeout(searchDebounce);
            var query = this.value.trim();
            if (query.length < 2) {
                searchResults.style.display = 'none';
                searchClearBtn.style.display = 'none';
                return;
            }
            searchClearBtn.style.display = '';
            searchDebounce = setTimeout(function () {
                performGlobalSearch(query);
            }, 250);
        });

        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                var query = this.value.trim();
                if (query.length >= 2) {
                    searchResults.style.display = 'none';
                    showSearchResultsTable(query);
                }
            }
        });

        searchInput.addEventListener('focus', function () {
            if (this.value.trim().length >= 2) {
                performGlobalSearch(this.value.trim());
            }
        });

        document.addEventListener('click', function (e) {
            if (searchResults && !searchResults.contains(e.target) && e.target !== searchInput) {
                searchResults.style.display = 'none';
            }
        });
    });

    function performGlobalSearch(query) {
        if (!rawData) return;
        var results = [];
        var q = query.toLowerCase();
        var maxResults = 15;

        // Search Farmers
        (rawData.farmers || []).forEach(function (f) {
            if (results.length >= maxResults) return;
            var name = (f['Full_Name'] || '').toLowerCase();
            var id = (f['Farmer_ID'] || '').toLowerCase();
            var phone = (f['Phone_Number'] || '').toLowerCase();
            var group = (f['Farmer_Group_Name'] || '').toLowerCase();
            if (name.indexOf(q) >= 0 || id.indexOf(q) >= 0 || phone.indexOf(q) >= 0 || group.indexOf(q) >= 0) {
                results.push({
                    type: 'farmer',
                    icon: 'fa-user',
                    title: f['Full_Name'] || f['Farmer_ID'],
                    subtitle: f['Farmer_ID'] + ' - ' + (f['Farmer_Group_Name'] || ''),
                    id: f['Farmer_ID']
                });
            }
        });

        // Search Plots
        (rawData.plots || []).forEach(function (p) {
            if (results.length >= maxResults) return;
            var name = (p['Plot_Name'] || '').toLowerCase();
            var id = (p['Plot_Id'] || '').toLowerCase();
            var place = (p['Place name'] || '').toLowerCase();
            if (name.indexOf(q) >= 0 || id.indexOf(q) >= 0 || place.indexOf(q) >= 0) {
                results.push({
                    type: 'plot',
                    icon: 'fa-map-marker-alt',
                    title: p['Plot_Name'] || p['Plot_Id'],
                    subtitle: p['Plot_Id'] + ' - ' + (p['Place name'] || '') + ' (' + (p['Area (ha)'] || '?') + ' ha)',
                    id: p['Plot_Id'],
                    farmerId: p['Farmer_ID']
                });
            }
        });

        // Search Yearly Data
        (rawData.yearly || []).forEach(function (y) {
            if (results.length >= maxResults) return;
            var recId = (y['Record_Id'] || '').toLowerCase();
            var fId = (y['Farmer_ID'] || '').toLowerCase();
            var species = (y['Shade_Trees_Species'] || '').toLowerCase();
            if (recId.indexOf(q) >= 0 || species.indexOf(q) >= 0) {
                var farmerName = '';
                if (farmersMap && farmersMap[y['Farmer_ID']]) farmerName = farmersMap[y['Farmer_ID']]['Full_Name'] || '';
                results.push({
                    type: 'yearly',
                    icon: 'fa-calendar-alt',
                    title: y['Record_Id'] + (farmerName ? ' - ' + farmerName : ''),
                    subtitle: (y['Year'] || '') + ' | ' + (y['Shade_Trees_Species'] || ''),
                    id: y['Record_Id'],
                    farmerId: y['Farmer_ID']
                });
            }
        });

        // Search Supported
        (rawData.supported || []).forEach(function (s) {
            if (results.length >= maxResults) return;
            var sid = (s['Support_ID'] || '').toLowerCase();
            var fid = (s['Farmer ID'] || s['Farmer_ID'] || '').toLowerCase();
            var item = (s['Item_Detail'] || '').toLowerCase();
            var by = (s['Supported by'] || '').toLowerCase();
            if (sid.indexOf(q) >= 0 || fid.indexOf(q) >= 0 || item.indexOf(q) >= 0 || by.indexOf(q) >= 0) {
                var farmerName = '';
                var farmId = s['Farmer ID'] || s['Farmer_ID'] || '';
                if (farmersMap && farmersMap[farmId]) farmerName = farmersMap[farmId]['Full_Name'] || '';
                results.push({
                    type: 'supported',
                    icon: 'fa-hands-helping',
                    title: s['Support_ID'] + (farmerName ? ' - ' + farmerName : ''),
                    subtitle: (s['Supported year'] || '') + ' | ' + (s['Item_Detail'] || '') + ' | ' + (s['Supported by'] || ''),
                    id: s['Support_ID'],
                    farmerId: farmId
                });
            }
        });

        // Search App Functions
        var isVi = currentLang === 'vi';
        var appFunctions = [
            { id: 'addFarmer', icon: 'fa-user-plus', title: isVi ? 'Thêm hộ dân mới' : 'Add New Farmer', subtitle: isVi ? 'Tạo bản ghi nông hộ mới' : 'Create new farmer record', keywords: 'thêm hộ dân farmer add tạo mới nông hộ' },
            { id: 'browseF', icon: 'fa-users', title: isVi ? 'Duyệt Hộ dân' : 'Browse Farmers', subtitle: isVi ? 'Xem danh sách nông hộ' : 'View farmer list', keywords: 'hộ dân farmers danh sách browse duyệt' },
            { id: 'browseP', icon: 'fa-map-marked-alt', title: isVi ? 'Duyệt Lô đất' : 'Browse Plots', subtitle: isVi ? 'Xem danh sách lô đất' : 'View plot list', keywords: 'lô đất plots danh sách browse duyệt' },
            { id: 'browseS', icon: 'fa-hands-helping', title: isVi ? 'Duyệt Hỗ trợ' : 'Browse Support', subtitle: isVi ? 'Xem danh sách hỗ trợ' : 'View support list', keywords: 'hỗ trợ support danh sách browse duyệt' },
            { id: 'browseY', icon: 'fa-calendar-check', title: isVi ? 'Duyệt Đánh giá hàng năm' : 'Browse Yearly Data', subtitle: isVi ? 'Xem dữ liệu hàng năm' : 'View yearly data', keywords: 'đánh giá hàng năm yearly data duyệt' },
            { id: 'dashboard', icon: 'fa-chart-line', title: 'Dashboard', subtitle: isVi ? 'Biểu đồ tổng hợp' : 'Overview charts', keywords: 'dashboard biểu đồ tổng hợp' },
            { id: 'analytics', icon: 'fa-chart-pie', title: isVi ? 'Phân tích dữ liệu' : 'Analytics', subtitle: isVi ? 'Biểu đồ phân tích chi tiết' : 'Detailed analytics charts', keywords: 'analytics phân tích dữ liệu biểu đồ' },
            { id: 'config', icon: 'fa-cogs', title: isVi ? 'Cấu hình' : 'Configuration', subtitle: isVi ? 'Quản lý nhân sự & phân quyền' : 'User management & permissions', keywords: 'cấu hình config quản lý nhân sự phân quyền' },
            { id: 'species', icon: 'fa-leaf', title: isVi ? 'Loài cây' : 'Species', subtitle: isVi ? 'Tra cứu loài cây trồng' : 'Browse tree species', keywords: 'loài cây species tra cứu' },
            { id: 'training', icon: 'fa-chalkboard-teacher', title: isVi ? 'Tập huấn' : 'Training', subtitle: isVi ? 'Danh sách tập huấn' : 'Training list', keywords: 'tập huấn training đào tạo' }
        ];
        appFunctions.forEach(function (fn) {
            if (results.length >= maxResults) return;
            if (fn.title.toLowerCase().indexOf(q) >= 0 || fn.keywords.indexOf(q) >= 0) {
                results.push({ type: 'function', icon: fn.icon, title: fn.title, subtitle: fn.subtitle, id: fn.id, farmerId: '' });
            }
        });

        // Render results
        renderSearchResults(results, query);
    }

    function renderSearchResults(results, query) {
        if (!searchResults) return;
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-no-results"><i class="fas fa-search"></i> ' +
                (currentLang === 'vi' ? 'Không tìm thấy kết quả' : 'No results found') + '</div>';
            searchResults.style.display = 'block';
            return;
        }

        var html = '';
        results.forEach(function (r) {
            html += '<div class="search-result-item" onclick="onSearchResultClick(\'' + escapeHtml(r.type) + '\', \'' + escapeHtml(r.id) + '\', \'' + escapeHtml(r.farmerId || '') + '\')">';
            html += '<div class="result-icon"><i class="fas ' + r.icon + '"></i></div>';
            html += '<div class="result-text">';
            html += '<div class="result-title">' + highlightMatch(escapeHtml(r.title), query) + '</div>';
            html += '<div class="result-subtitle">' + escapeHtml(r.subtitle) + '</div>';
            html += '</div></div>';
        });
        html += '<div class="search-enter-hint" style="padding:8px 14px;text-align:center;color:#888;font-size:0.72rem;border-top:1px solid #eee;">';
        html += '<i class="fas fa-level-down-alt fa-rotate-90 me-1"></i>' +
            (currentLang === 'vi' ? 'Nhấn Enter để xem bảng kết quả đầy đủ' : 'Press Enter for full table view');
        html += '</div>';
        searchResults.innerHTML = html;
        searchResults.style.display = 'block';
    }

    function highlightMatch(text, query) {
        if (!query) return text;
        var regex = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        return text.replace(regex, '<strong style="color:#2E7D32;">$1</strong>');
    }
})();

function onSearchResultClick(type, id, farmerId) {
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('globalSearchInput').value = '';
    document.getElementById('searchClearBtn').style.display = 'none';

    if (type === 'farmer') {
        // Open farmer detail modal (stay on current tab)
        showFarmerDetails(id);
    } else if (type === 'plot') {
        // Open farmer detail for the plot owner
        if (farmerId) showFarmerDetails(farmerId);
    } else if (type === 'yearly') {
        // Open farmer detail for yearly record
        if (farmerId) showFarmerDetails(farmerId);
    } else if (type === 'supported') {
        // Open farmer detail for supported record
        if (farmerId) {
            showFarmerDetails(farmerId);
        }
    } else if (type === 'function') {
        // Navigate to app function
        if (id === 'addFarmer') { showAddFarmerModal(); }
        else if (id === 'browseF') { openDataBrowser('Farmers'); }
        else if (id === 'browseP') { openDataBrowser('Plots'); }
        else if (id === 'browseS') { openDataBrowser('Supported'); }
        else if (id === 'browseY') { openDataBrowser('Yearly_Data'); }
        else if (id === 'dashboard') { var t = document.getElementById('dashboard-main-tab'); if (t) new bootstrap.Tab(t).show(); }
        else if (id === 'analytics') { var t = document.getElementById('analytics-main-tab'); if (t) new bootstrap.Tab(t).show(); }
        else if (id === 'config') { var t = document.getElementById('config-main-tab'); if (t) new bootstrap.Tab(t).show(); }
        else if (id === 'species') { navigateToModule('species'); }
        else if (id === 'training') { navigateToModule('training'); }
    }
}

function clearGlobalSearch() {
    var input = document.getElementById('globalSearchInput');
    var results = document.getElementById('searchResults');
    var clearBtn = document.getElementById('searchClearBtn');
    if (input) input.value = '';
    if (results) results.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';
    if (input) input.focus();
    clearHomeSearchResults();
}

function showSearchResultsTable(query) {
    if (!rawData) return;
    var isVi = currentLang === 'vi';
    var q = query.toLowerCase();

    // Collect ALL matching farmers (no limit)
    var matchedFarmers = (rawData.farmers || []).filter(function (f) {
        var name = (f['Full_Name'] || '').toLowerCase();
        var id = (f['Farmer_ID'] || '').toLowerCase();
        var phone = (f['Phone_Number'] || '').toLowerCase();
        var group = (f['Farmer_Group_Name'] || '').toLowerCase();
        return name.indexOf(q) >= 0 || id.indexOf(q) >= 0 || phone.indexOf(q) >= 0 || group.indexOf(q) >= 0;
    });

    // Collect matching plots
    var matchedPlots = (rawData.plots || []).filter(function (p) {
        var name = (p['Plot_Name'] || '').toLowerCase();
        var id = (p['Plot_Id'] || '').toLowerCase();
        var place = (p['Place name'] || '').toLowerCase();
        return name.indexOf(q) >= 0 || id.indexOf(q) >= 0 || place.indexOf(q) >= 0;
    });

    // Collect matching supported
    var matchedSupported = (rawData.supported || []).filter(function (s) {
        var sid = (s['Support_ID'] || '').toLowerCase();
        var fid = (s['Farmer ID'] || s['Farmer_ID'] || '').toLowerCase();
        var item = (s['Item_Detail'] || '').toLowerCase();
        var by = (s['Supported by'] || '').toLowerCase();
        return sid.indexOf(q) >= 0 || fid.indexOf(q) >= 0 || item.indexOf(q) >= 0 || by.indexOf(q) >= 0;
    });

    // Collect matching yearly
    var matchedYearly = (rawData.yearly || []).filter(function (y) {
        var recId = (y['Record_Id'] || '').toLowerCase();
        var species = (y['Shade_Trees_Species'] || '').toLowerCase();
        return recId.indexOf(q) >= 0 || species.indexOf(q) >= 0;
    });

    var totalResults = matchedFarmers.length + matchedPlots.length + matchedSupported.length + matchedYearly.length;
    var html = '';

    // Search header with close button
    html += '<div class="d-flex justify-content-between align-items-center mb-2">';
    html += '<h6 class="m-0 text-success"><i class="fas fa-search me-1"></i> ' +
        (isVi ? 'Kết quả tìm kiếm: ' : 'Search results: ') + '"' + escapeHtml(query) + '"</h6>';
    html += '<button class="btn btn-sm btn-outline-secondary" onclick="closeSearchOverlay()"><i class="fas fa-times me-1"></i>' + (isVi ? 'Đóng' : 'Close') + '</button>';
    html += '</div>';

    if (totalResults === 0) {
        html += '<div class="text-center py-5 text-muted">';
        html += '<i class="fas fa-search fa-3x mb-3"></i>';
        html += '<p class="fs-6">' + (isVi ? 'Không tìm thấy kết quả cho' : 'No results found for') + ' "<strong>' + escapeHtml(query) + '</strong>"</p>';
        html += '</div>';
    } else {
        html += '<p class="text-muted mb-3" style="font-size:0.85rem;">' +
            (isVi ? 'Tìm thấy ' : 'Found ') + '<strong>' + totalResults + '</strong>' +
            (isVi ? ' kết quả' : ' results') + '</p>';

        // Farmers table
        if (matchedFarmers.length > 0) {
            html += '<div class="mb-4">';
            html += '<h6 class="mb-2" style="color:#1a237e;"><i class="fas fa-users me-1"></i> ' +
                (isVi ? 'Hộ dân' : 'Farmers') + ' (' + matchedFarmers.length + ')</h6>';
            html += '<div class="table-responsive"><table class="table table-sm table-hover table-bordered search-results-table">';
            html += '<thead><tr>';
            html += '<th>' + (isVi ? 'Mã hộ' : 'Farmer ID') + '</th>';
            html += '<th>' + (isVi ? 'Họ tên' : 'Full Name') + '</th>';
            html += '<th>' + (isVi ? 'Nhóm' : 'Group') + '</th>';
            html += '<th>' + (isVi ? 'Thôn' : 'Village') + '</th>';
            html += '<th>' + (isVi ? 'SĐT' : 'Phone') + '</th>';
            html += '</tr></thead><tbody>';
            matchedFarmers.forEach(function (f) {
                var villageName = '';
                if (adminMap && adminMap[f['Village_Name']]) {
                    villageName = isVi ? adminMap[f['Village_Name']].vi : adminMap[f['Village_Name']].en;
                }
                var groupName = '';
                if (adminMap && adminMap[f['Farmer_Group_Name']]) {
                    groupName = isVi ? adminMap[f['Farmer_Group_Name']].vi : adminMap[f['Farmer_Group_Name']].en;
                } else {
                    groupName = f['Farmer_Group_Name'] || '';
                }
                html += '<tr class="cursor-pointer" onclick="onSearchTableClick(\'farmer\',\'' + escapeHtml(f['Farmer_ID']) + '\')">';
                html += '<td><strong>' + escapeHtml(f['Farmer_ID'] || '') + '</strong></td>';
                html += '<td>' + escapeHtml(f['Full_Name'] || '') + '</td>';
                html += '<td>' + escapeHtml(groupName) + '</td>';
                html += '<td>' + escapeHtml(villageName || f['Village_Name'] || '') + '</td>';
                html += '<td>' + escapeHtml(f['Phone_Number'] || '') + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table></div></div>';
        }

        // Plots table
        if (matchedPlots.length > 0) {
            html += '<div class="mb-4">';
            html += '<h6 class="mb-2" style="color:#1a237e;"><i class="fas fa-map-marked-alt me-1"></i> ' +
                (isVi ? 'Lô đất' : 'Plots') + ' (' + matchedPlots.length + ')</h6>';
            html += '<div class="table-responsive"><table class="table table-sm table-hover table-bordered search-results-table">';
            html += '<thead><tr>';
            html += '<th>' + (isVi ? 'Mã lô' : 'Plot ID') + '</th>';
            html += '<th>' + (isVi ? 'Tên lô' : 'Plot Name') + '</th>';
            html += '<th>' + (isVi ? 'Hộ dân' : 'Farmer') + '</th>';
            html += '<th>' + (isVi ? 'Địa điểm' : 'Place') + '</th>';
            html += '<th>' + (isVi ? 'Diện tích' : 'Area') + '</th>';
            html += '</tr></thead><tbody>';
            matchedPlots.forEach(function (p) {
                var farmerName = '';
                if (farmersMap && farmersMap[p['Farmer_ID']]) farmerName = farmersMap[p['Farmer_ID']]['Full_Name'] || '';
                html += '<tr class="cursor-pointer" onclick="onSearchTableClick(\'plot\',\'' + escapeHtml(p['Farmer_ID'] || '') + '\')">';
                html += '<td><strong>' + escapeHtml(p['Plot_Id'] || '') + '</strong></td>';
                html += '<td>' + escapeHtml(p['Plot_Name'] || '') + '</td>';
                html += '<td>' + escapeHtml(farmerName || p['Farmer_ID'] || '') + '</td>';
                html += '<td>' + escapeHtml(p['Place name'] || '') + '</td>';
                html += '<td>' + (p['Area (ha)'] || '-') + ' ha</td>';
                html += '</tr>';
            });
            html += '</tbody></table></div></div>';
        }

        // Supported table
        if (matchedSupported.length > 0) {
            html += '<div class="mb-4">';
            html += '<h6 class="mb-2" style="color:#1a237e;"><i class="fas fa-hands-helping me-1"></i> ' +
                (isVi ? 'Hỗ trợ' : 'Support') + ' (' + matchedSupported.length + ')</h6>';
            html += '<div class="table-responsive"><table class="table table-sm table-hover table-bordered search-results-table">';
            html += '<thead><tr>';
            html += '<th>' + (isVi ? 'Mã HT' : 'Support ID') + '</th>';
            html += '<th>' + (isVi ? 'Hộ dân' : 'Farmer') + '</th>';
            html += '<th>' + (isVi ? 'Năm' : 'Year') + '</th>';
            html += '<th>' + (isVi ? 'Hạng mục' : 'Item') + '</th>';
            html += '<th>' + (isVi ? 'Hỗ trợ bởi' : 'Supported by') + '</th>';
            html += '</tr></thead><tbody>';
            matchedSupported.forEach(function (s) {
                var farmId = s['Farmer ID'] || s['Farmer_ID'] || '';
                var farmerName = '';
                if (farmersMap && farmersMap[farmId]) farmerName = farmersMap[farmId]['Full_Name'] || '';
                html += '<tr class="cursor-pointer" onclick="onSearchTableClick(\'supported\',\'' + escapeHtml(farmId) + '\')">';
                html += '<td><strong>' + escapeHtml(s['Support_ID'] || '') + '</strong></td>';
                html += '<td>' + escapeHtml(farmerName || farmId) + '</td>';
                html += '<td>' + escapeHtml(s['Supported year'] || '') + '</td>';
                html += '<td>' + escapeHtml(s['Item_Detail'] || '') + '</td>';
                html += '<td>' + escapeHtml(s['Supported by'] || '') + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table></div></div>';
        }

        // Yearly Data table
        if (matchedYearly.length > 0) {
            html += '<div class="mb-4">';
            html += '<h6 class="mb-2" style="color:#1a237e;"><i class="fas fa-calendar-check me-1"></i> ' +
                (isVi ? 'Đánh giá hàng năm' : 'Yearly Data') + ' (' + matchedYearly.length + ')</h6>';
            html += '<div class="table-responsive"><table class="table table-sm table-hover table-bordered search-results-table">';
            html += '<thead><tr>';
            html += '<th>' + (isVi ? 'Mã' : 'Record ID') + '</th>';
            html += '<th>' + (isVi ? 'Hộ dân' : 'Farmer') + '</th>';
            html += '<th>' + (isVi ? 'Năm' : 'Year') + '</th>';
            html += '<th>' + (isVi ? 'Loài cây bóng' : 'Species') + '</th>';
            html += '</tr></thead><tbody>';
            matchedYearly.forEach(function (y) {
                var farmerName = '';
                if (farmersMap && farmersMap[y['Farmer_ID']]) farmerName = farmersMap[y['Farmer_ID']]['Full_Name'] || '';
                html += '<tr class="cursor-pointer" onclick="onSearchTableClick(\'yearly\',\'' + escapeHtml(y['Farmer_ID'] || '') + '\')">';
                html += '<td><strong>' + escapeHtml(y['Record_Id'] || '') + '</strong></td>';
                html += '<td>' + escapeHtml(farmerName || y['Farmer_ID'] || '') + '</td>';
                html += '<td>' + escapeHtml(y['Year'] || '') + '</td>';
                html += '<td>' + escapeHtml(y['Shade_Trees_Species'] || '') + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table></div></div>';
        }
    }

    // Show overlay (hides all tab content, no tab switching needed)
    var overlay = document.getElementById('searchResultsOverlay');
    var tabContent = document.getElementById('mainTabContent');
    if (overlay && tabContent) {
        overlay.innerHTML = html;
        overlay.classList.remove('d-none');
        tabContent.style.display = 'none';
    }
    // Sync Home tab visual state
    document.body.classList.remove('show-filters', 'tab-charts', 'mobile-filters-open');
    $('#mainTab .nav-link').removeClass('active').attr('aria-selected', 'false');
    $('#home-main-tab').addClass('active').attr('aria-selected', 'true');
    // Show AI widget (search results = Home context)
    var aiW = document.getElementById('aiChatWidget');
    if (aiW) aiW.style.display = '';
    $('#mobileBottomBar .bottom-bar-btn').removeClass('active');
    $('#mobileBottomBar .bottom-bar-btn[data-target="home-main-tab"]').addClass('active');
}

function closeSearchOverlay() {
    var overlay = document.getElementById('searchResultsOverlay');
    var tabContent = document.getElementById('mainTabContent');
    if (overlay) { overlay.classList.add('d-none'); overlay.innerHTML = ''; }
    if (tabContent) { tabContent.style.display = ''; }
}

function clearHomeSearchResults() {
    closeSearchOverlay();
}

function onSearchTableClick(type, id) {
    if (type === 'farmer') {
        showFarmerDetails(id);
    } else if (type === 'plot' || type === 'supported' || type === 'yearly') {
        // Open farmer detail for related records
        if (id) showFarmerDetails(id);
    }
}

// ==========================================
// OFFLINE BADGE SUPPORT
// ==========================================
function showOfflineBadge() {
    var badge = document.getElementById('offlineBadge');
    if (badge) badge.style.display = '';
    updateSyncPendingCount();
}

function hideOfflineBadge() {
    var badge = document.getElementById('offlineBadge');
    if (badge) badge.style.display = 'none';
}

function updateSyncPendingCount() {
    if (typeof PFFP_DB !== 'undefined' && PFFP_DB.getSyncQueueCount) {
        PFFP_DB.getSyncQueueCount().then(function (count) {
            var el = document.getElementById('syncPending');
            if (el) {
                if (count > 0) {
                    el.textContent = count;
                    el.style.display = '';
                } else {
                    el.style.display = 'none';
                }
            }
        });
    }
}

// Online/Offline listeners
window.addEventListener('online', function () {
    hideOfflineBadge();
    if (typeof PFFP_DB !== 'undefined' && PFFP_DB.processSyncQueue && typeof supabaseClient !== 'undefined') {
        var syncBadge = document.getElementById('syncingBadge');
        if (syncBadge) syncBadge.style.display = '';
        PFFP_DB.processSyncQueue(supabaseClient).then(function () {
            if (syncBadge) syncBadge.style.display = 'none';
            if (typeof loadData === 'function') loadData(true);
        }).catch(function () {
            if (syncBadge) syncBadge.style.display = 'none';
        });
    }
});

window.addEventListener('offline', function () {
    showOfflineBadge();
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js').then(function (reg) {
            console.log('SW registered:', reg.scope);
        }).catch(function (err) {
            console.warn('SW registration failed:', err);
        });
    });
}

// ==========================================
// AI CHAT WIDGET (Gemini Integration)
// ==========================================
var AI_PROXY_URL = PB_URL + '/api/custom/ai-chat';
var aiChatHistory = [];

function toggleAiChat() {
    var panel = document.getElementById('aiChatPanel');
    var fab = document.getElementById('aiChatFab');
    if (panel.classList.contains('open')) {
        panel.classList.remove('open');
        fab.classList.remove('active');
    } else {
        panel.classList.add('open');
        fab.classList.add('active');
        document.getElementById('aiChatInput').focus();
    }
}

function buildDataContext() {
    // Helper: compact serialize (pipe-delimited, truncated values)
    function ser(arr, cols) {
        if (!arr || arr.length === 0) return '(trống)\n';
        var lines = [cols.join('|')];
        arr.forEach(function (r) {
            lines.push(cols.map(function (c) {
                var v = r[c]; if (v === null || v === undefined) return '';
                return String(v).replace(/\|/g, '/').replace(/\n/g, ' ').substring(0, 100);
            }).join('|'));
        });
        return lines.join('\n') + '\n';
    }

    var farmers = rawData.farmers || [];
    var plots = rawData.plots || [];
    var yearly = rawData.yearly || [];
    var support = rawData.supported || [];
    var species = rawData.species || [];
    var training = rawData.trainingList || [];
    var op6 = rawData.op6 || [];

    // Use filtered data for stats
    var fF = filteredData.farmers || farmers;
    var fP = filteredData.plots || plots;
    var fY = filteredData.yearly || yearly;

    // Group-level aggregations (very compact, high value)
    var groups = {};
    fF.forEach(function (f) {
        var g = f.Farmer_Group_Name || 'N/A';
        if (!groups[g]) groups[g] = { n: 0, fem: 0, area: 0, plots: 0, done: 0, planted: 0, died: 0, cherry: 0, hq: 0, income: 0 };
        groups[g].n++;
        groups[g].area += parseFloat(f.Total_Coffee_Area) || 0;
        if ((f.Activity || '').trim() === 'Done') groups[g].done++;
        var gen = (f.Gender || '').toLowerCase();
        if (gen === 'nữ' || gen === 'female' || gen === 'f') groups[g].fem++;
    });
    var fgMap = {};
    fF.forEach(function (f) { fgMap[f.Farmer_ID] = f.Farmer_Group_Name || 'N/A'; });
    fP.forEach(function (p) { var g = fgMap[p.Farmer_ID]; if (g && groups[g]) groups[g].plots++; });
    fY.forEach(function (y) {
        var g = fgMap[y.Farmer_ID]; if (g && groups[g]) {
            groups[g].planted += parseFloat(y.Number_Shade_Trees_Planted) || 0;
            groups[g].died += parseFloat(y.Shade_Trees_Died) || 0;
            groups[g].cherry += parseFloat(y.Annual_Volume_Cherry) || 0;
            groups[g].hq += parseFloat(y.Volume_High_Quality) || 0;
            groups[g].income += parseFloat(y.Total_Coffee_Income) || 0;
        }
    });

    var totalArea = fP.reduce(function (s, p) { return s + (parseFloat(p['Area (ha)']) || 0); }, 0);
    var totalPlanted = fY.reduce(function (s, y) { return s + (parseFloat(y.Number_Shade_Trees_Planted) || 0); }, 0);
    var totalDied = fY.reduce(function (s, y) { return s + (parseFloat(y.Shade_Trees_Died) || 0); }, 0);
    var sv = totalPlanted > 0 ? ((totalPlanted - totalDied) / totalPlanted * 100).toFixed(1) : '0';
    var totalCherry = fY.reduce(function (s, y) { return s + (parseFloat(y.Annual_Volume_Cherry) || 0); }, 0);
    var totalHQ = fY.reduce(function (s, y) { return s + (parseFloat(y.Volume_High_Quality) || 0); }, 0);
    var totalIncome = fY.reduce(function (s, y) { return s + (parseFloat(y.Total_Coffee_Income) || 0); }, 0);

    var ctx = 'PFFP Data (Prosperous Farmers & Forests Partnership) - Hướng Hóa, Quảng Trị. WWF+Slow Forest.\n\n';

    // Summary stats
    ctx += '== TỔNG QUAN (lọc: ' + fF.length + '/' + farmers.length + ' hộ) ==\n';
    ctx += 'Hộ: ' + fF.length + ', Nữ: ' + fF.filter(function (f) { var g = (f.Gender || '').toLowerCase(); return g === 'nữ' || g === 'female'; }).length;
    ctx += ', Lô: ' + fP.length + ', DT: ' + totalArea.toFixed(2) + 'ha\n';
    ctx += 'Trồng: ' + totalPlanted + ', Chết: ' + totalDied + ', Sống: ' + sv + '%\n';
    ctx += 'Cherry: ' + totalCherry.toFixed(1) + 'T, CLC: ' + totalHQ.toFixed(1) + 'T, Thu nhập: ' + totalIncome.toLocaleString() + ' VND\n';
    ctx += 'Done: ' + fF.filter(function (f) { return (f.Activity || '').trim() === 'Done'; }).length + '/' + fF.length + '\n\n';

    // Group aggregations
    ctx += '== NHÓM HỘ ==\n';
    Object.keys(groups).sort().forEach(function (g) {
        var d = groups[g];
        var gsv = d.planted > 0 ? ((d.planted - d.died) / d.planted * 100).toFixed(0) : '0';
        ctx += g + ': ' + d.n + 'hộ(' + d.fem + 'nữ) ' + d.plots + 'lô ' + d.area.toFixed(1) + 'ha Done=' + d.done + '/' + d.n + ' Trồng=' + d.planted + ' Sống=' + gsv + '% Cherry=' + d.cherry.toFixed(1) + 'T Income=' + d.income.toLocaleString() + '\n';
    });

    // Farmers - key columns
    ctx += '\n== HỘ DÂN (' + farmers.length + ') ==\n';
    ctx += ser(farmers, ['Farmer_ID', 'Full_Name', 'Gender', 'Year_Of_Birth', 'Phone_Number', 'Farmer_Group_Name', 'Ethnicity', 'Total_Coffee_Area', 'Participation Year', 'Supported by', 'Manage by', 'Status', 'Activity']);

    // Plots - key columns
    ctx += '\n== LÔ ĐẤT (' + plots.length + ') ==\n';
    ctx += ser(plots, ['Plot_Id', 'Farmer_ID', 'Plot_Name', 'Area (ha)', 'Place name', 'Num_Shade_Trees_Before', 'Num_Coffee_Trees', 'Coffee_Planted_Year', 'Border_Natural_Forest']);

    // Yearly - key columns
    ctx += '\n== DỮ LIỆU NĂM (' + yearly.length + ') ==\n';
    ctx += ser(yearly, ['Record_Id', 'Farmer_ID', 'Year', 'Annual_Volume_Cherry', 'Volume_High_Quality', 'Total_Coffee_Income', 'Number_Shade_Trees_Planted', 'Shade_Trees_Species', 'Shade_Trees_Died', 'Fertilizers_Applied', 'Pesticides_Applied', 'Op6_Activities', 'Attending training capacity organized by PFFP', 'Cherry sales registered to Slow', 'Cherry sales supplied to Slow']);

    // Support - key columns
    ctx += '\n== HỖ TRỢ (' + support.length + ') ==\n';
    ctx += ser(support, ['Support_ID', 'Farmer ID', 'Support code', 'Date', 'Item_Detail', 'Quantity', 'Unit', 'A live', 'Supported by', 'Supported year']);

    // Reference tables (small, full data)
    ctx += '\n== LOÀI CÂY (' + species.length + ') ==\n';
    ctx += ser(species, ['Species_ID', 'Species_name', 'Species type', 'Species Info']);

    ctx += '\n== OP6 (' + op6.length + ') ==\n';
    ctx += ser(op6, ['OP6 ID', 'Name_EN', 'Name_VI', 'Type']);

    ctx += '\n== ĐÀO TẠO (' + training.length + ') ==\n';
    ctx += ser(training, ['Train_ID', 'Name_EN', 'Name_VI']);

    // Notes
    ctx += '\nID: Farmer_ID={Village}{4số}, Plot_Id={FID}-{NN}, Record_Id={FID}-{Year}, Support_ID={PlotId}-{Year}\n';
    ctx += 'Year: "24Y"=2024, "25Y"=2025. Gender: "Nữ"=nữ. Activity: "Done"=hoàn thành.\n';

    // Project Document summary for AI
    ctx += '\n== TÀI LIỆU DỰ ÁN PFFP ==\n';
    ctx += 'Tên: Prosperous Farmers and Forests Partnership (PFFP), Quảng Trị, Việt Nam\n';
    ctx += 'Mã: DGBP 2022-40010 | Thời gian: 2023-2027 (4 năm)\n';
    ctx += 'Đối tác: WWF Finland(QL hành chính), Slow A/S Denmark(thương mại), WWF Vietnam(triển khai), WWF Denmark(tư vấn)\n';
    ctx += 'Khu vực: Huyện Hướng Hóa, Quảng Trị - giữa 2 KBT Bắc Hướng Hóa & Đắk Rông. QT chiếm 1/7 SL Arabica VN\n';
    ctx += 'Mục tiêu: Giảm tổn thương BĐKH rừng TN hành lang ĐDSH Quảng Trị, cải thiện sinh kế qua nông lâm kết hợp bền vững\n';
    ctx += 'Đối tượng: 2000 hộ nông dân nhỏ, dân tộc Bru-Vân Kiều ~50% dân số, phụ nữ 60%, thanh niên 25%\n';
    ctx += 'KQ1: 2500ha chuyển đổi nông lâm kết hợp tái sinh, 2000 hộ tăng thu nhập 40%, 800T cà phê bán châu Âu, 20+ loài cây che bóng bản địa\n';
    ctx += 'KQ2: 18000ha rừng TN bảo vệ (hành lang Bắc Hướng Hóa-Đắk Rông), 20ha phục hồi, 100 hộ hưởng lợi. Nơi cư trú sao la\n';
    ctx += 'Chuỗi GT: Crop-to-cup, HĐ 7 năm với EU, 1000T cà phê nhân, chứng nhận hữu cơ(3 năm chuyển đổi), cupping 83, defect 5%\n';
    ctx += 'ĐR1: Chuẩn bị(ESSF,FPIC,bản đồ,M&E) ĐR2: HĐ dài hạn khách hàng EU(800T) ĐR3: Đào tạo 2000HH(TOT)\n';
    ctx += 'ĐR4: Mô hình demo(1000ha+1500ha business) ĐR5: Cải thiện thu hoạch/chế biến(1000T)\n';
    ctx += 'ĐR6: Phục hồi rừng(20ha,100HH) ĐR7: Chuỗi giá trị bền vững, quản trị dự án\n';
    ctx += 'Tiến độ: 2024:100ha/60T | 2025:600ha/300T | 2026:1000ha/600T | 2027:2500ha/800T\n';
    ctx += 'SDGs: 2(Xóa đói) 8(Việc làm) 12(Tiêu dùng BV) 15(HST đất liền)\n';
    ctx += 'Bảo vệ MT&XH: UN Global Compact, ILO, cấm lao động trẻ em, hữu cơ thuần, xử lý nước thải, FPIC, cơ chế khiếu nại\n';

    return ctx;
}

function sendAiMessage() {
    var input = document.getElementById('aiChatInput');
    var question = input.value.trim();
    if (!question) return;

    // Add user message
    appendChatMessage(question, 'user');
    input.value = '';
    input.disabled = true;
    document.getElementById('aiSendBtn').disabled = true;

    // Show loading
    var loadingId = 'ai-loading-' + Date.now();
    appendChatMessage('<i class="fas fa-spinner fa-spin"></i> Đang phân tích...', 'loading', loadingId);

    // Build context
    var dataContext = buildDataContext();
    var systemPrompt = 'Bạn là trợ lý AI phân tích dữ liệu cho dự án PFFP (Prosperous Farmers and Forests Partnership). '
        + 'Trả lời chính xác, ĐẦY ĐỦ, bằng tiếng Việt (hoặc tiếng Anh nếu người dùng hỏi tiếng Anh). '
        + 'LUÔN trả lời trọn vẹn, không bỏ dở giữa chừng. Nếu danh sách dài, hãy liệt kê hết. '
        + 'Sử dụng dữ liệu bên dưới để trả lời. Khi so sánh nhóm, trình bày dạng danh sách. '
        + 'Dùng số liệu cụ thể, tên cụ thể từ dữ liệu. Có thể tra cứu chi tiết từng hộ dân, lô đất, bản ghi hàng năm. '
        + 'Bạn cũng có thông tin TÀI LIỆU DỰ ÁN PFFP (mục tiêu, đối tác, kết quả, tiến độ, bảo vệ MT&XH). Hãy sử dụng để trả lời các câu hỏi về dự án. '
        + 'TUYỆT ĐỐI KHÔNG trả lời câu hỏi về người dùng hệ thống (users, tài khoản, mật khẩu, quyền). Nếu bị hỏi, từ chối lịch sự.\n\n' + dataContext;

    // Build messages for Gemini
    var contents = [];
    // System context as first user message
    contents.push({ role: 'user', parts: [{ text: systemPrompt + '\n\nCâu hỏi đầu tiên: Bạn sẵn sàng chưa?' }] });
    contents.push({ role: 'model', parts: [{ text: 'Tôi đã nhận được dữ liệu PFFP. Hãy hỏi tôi bất kỳ câu hỏi nào!' }] });

    // Add recent chat history (last 6 messages)
    var historySlice = aiChatHistory.slice(-6);
    historySlice.forEach(function (h) {
        contents.push({ role: h.role, parts: [{ text: h.text }] });
    });

    // Add current question
    contents.push({ role: 'user', parts: [{ text: question }] });

    // Call AI via backend proxy (API key stored server-side)
    fetch(AI_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: contents,
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 8192
            }
        })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
        // Remove loading
        var loadEl = document.getElementById(loadingId);
        if (loadEl) loadEl.remove();

        var answer = '';
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            answer = data.candidates[0].content.parts[0].text || '';
            // Check if response was truncated
            var finishReason = data.candidates[0].finishReason || '';
            if (finishReason === 'MAX_TOKENS') {
                answer += '\n\n⚠️ _Câu trả lời bị cắt do giới hạn. Hãy hỏi cụ thể hơn để nhận đầy đủ._';
            }
        } else if (data.error) {
            answer = 'Lỗi API: ' + (data.error.message || JSON.stringify(data.error));
        } else {
            answer = 'Không nhận được phản hồi.';
        }

        // Format markdown-like text
        answer = formatAiResponse(answer);
        appendChatMessage(answer, 'bot');

        // Save to history
        aiChatHistory.push({ role: 'user', text: question });
        aiChatHistory.push({ role: 'model', text: answer });
    })
    .catch(function (err) {
        var loadEl = document.getElementById(loadingId);
        if (loadEl) loadEl.remove();
        appendChatMessage('Lỗi kết nối: ' + err.message, 'bot');
    })
    .finally(function () {
        input.disabled = false;
        document.getElementById('aiSendBtn').disabled = false;
        input.focus();
    });
}

function appendChatMessage(text, type, id) {
    var messagesDiv = document.getElementById('aiChatMessages');
    var msgDiv = document.createElement('div');
    msgDiv.className = 'ai-msg ai-msg-' + type;
    if (id) msgDiv.id = id;
    if (type === 'user') {
        msgDiv.textContent = text; // User messages: plain text only (XSS safe)
    } else {
        msgDiv.innerHTML = text; // Bot messages: allow formatted HTML from formatAiResponse()
    }
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function formatAiResponse(text) {
    // Convert markdown bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Convert markdown lists
    text = text.replace(/^\* /gm, '&bull; ');
    text = text.replace(/^- /gm, '&bull; ');
    // Convert newlines to <br>
    text = text.replace(/\n/g, '<br>');
    return text;
}

// ==========================================
// PWA INSTALL BANNER (PC & Mobile)
// ==========================================
var deferredInstallPrompt = null;
var installBannerDismissed = false;

window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (!installBannerDismissed && !localStorage.getItem('pffp_install_dismissed')) {
        setTimeout(showInstallBanner, 2000);
    }
});

window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    hideInstallBanner();
    console.log('[PWA] App installed');
});

function showInstallBanner() {
    if (!deferredInstallPrompt || document.getElementById('pwaInstallBanner')) return;
    var t = translations[currentLang] || translations.vi;
    var banner = document.createElement('div');
    banner.id = 'pwaInstallBanner';
    banner.className = 'pwa-install-banner';
    banner.innerHTML =
        '<div class="pwa-install-icon"><i class="fas fa-mobile-alt"></i></div>' +
        '<div class="pwa-install-text">' +
            '<strong>' + (t.installBannerTitle || 'Install PFFP Dashboard') + '</strong>' +
            '<small>' + (t.installBannerMsg || 'Add to home screen') + '</small>' +
        '</div>' +
        '<div class="pwa-install-actions">' +
            '<button class="btn btn-sm btn-success pwa-install-btn" onclick="triggerInstall()">' +
                '<i class="fas fa-download"></i> ' + (t.btnInstall || 'Install') +
            '</button>' +
            '<button class="btn btn-sm btn-outline-secondary pwa-install-dismiss" onclick="dismissInstallBanner()">' +
                (t.btnDismiss || 'Later') +
            '</button>' +
        '</div>';
    document.body.appendChild(banner);
    setTimeout(function () { banner.classList.add('show'); }, 50);
}

function triggerInstall() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(function (choiceResult) {
        if (choiceResult.outcome === 'accepted') {
            console.log('[PWA] User accepted install');
        }
        deferredInstallPrompt = null;
        hideInstallBanner();
    });
}

function dismissInstallBanner() {
    installBannerDismissed = true;
    localStorage.setItem('pffp_install_dismissed', '1');
    hideInstallBanner();
}

function hideInstallBanner() {
    var banner = document.getElementById('pwaInstallBanner');
    if (banner) {
        banner.classList.remove('show');
        setTimeout(function () { banner.remove(); }, 300);
    }
}

// ==========================================
// SWIPE LEFT/RIGHT → BACKUP (instead of exit app)
// ==========================================
(function initSwipeBackup() {
    var touchStartX = 0;
    var touchStartY = 0;
    var touchStartTime = 0;
    var SWIPE_THRESHOLD = 100;
    var SWIPE_TIME_LIMIT = 500;
    var VERTICAL_LIMIT = 80;

    document.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
        if (!touchStartX) return;
        var deltaX = e.changedTouches[0].clientX - touchStartX;
        var deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY);
        var elapsed = Date.now() - touchStartTime;

        // Ignore if inside modal, scrollable table, map, or AI chat
        var target = e.target;
        if (target.closest('.modal, .table-responsive, .leaflet-container, .ai-chat-panel, input, textarea, select')) {
            touchStartX = 0;
            return;
        }

        if (elapsed < SWIPE_TIME_LIMIT && deltaY < VERTICAL_LIMIT) {
            if (deltaX < -SWIPE_THRESHOLD) {
                // Swipe LEFT → Backup
                e.preventDefault();
                showBackupConfirm();
            } else if (deltaX > SWIPE_THRESHOLD) {
                // Swipe RIGHT → also Backup (both directions)
                e.preventDefault();
                showBackupConfirm();
            }
        }
        touchStartX = 0;
    }, { passive: false });
})();

// ==========================================
// BACKUP FUNCTIONALITY - Export all PocketBase data
// ==========================================
function showBackupConfirm() {
    var t = translations[currentLang] || translations.vi;
    showConfirmDialog(
        '<i class="fas fa-database fa-2x text-success mb-2"></i>',
        t.backupTitle || 'Backup Data',
        'btn-success',
        function () { performBackup(); }
    );
}

function performBackup() {
    var t = translations[currentLang] || translations.vi;
    var tables = ['farmers', 'plots', 'yearly_data', 'supported', 'species', 'training_list', 'op6_activities_list', 'admin', 'drop_values'];
    var backupData = { exportDate: new Date().toISOString(), appVersion: 'PFFP Dashboard', tables: {} };
    var completed = 0;
    var total = tables.length;

    // Show loading
    var loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'flex';

    tables.forEach(function (tableName) {
        fetch(PB_URL + '/api/collections/' + tableName + '/records?perPage=999999')
            .then(function (res) { return res.json(); })
            .then(function (data) {
                backupData.tables[tableName] = {
                    totalItems: data.totalItems || 0,
                    items: data.items || []
                };
            })
            .catch(function (err) {
                console.warn('[Backup] Failed to fetch ' + tableName + ':', err);
                backupData.tables[tableName] = { totalItems: 0, items: [], error: err.message };
            })
            .finally(function () {
                completed++;
                if (completed === total) {
                    finishBackup(backupData);
                }
            });
    });
}

function finishBackup(backupData) {
    var t = translations[currentLang] || translations.vi;
    var loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'none';

    // Count total records
    var totalRecords = 0;
    Object.keys(backupData.tables).forEach(function (k) {
        totalRecords += backupData.tables[k].totalItems || 0;
    });

    if (totalRecords === 0) {
        showToast(t.backupEmpty || 'No data to backup', 'warning');
        return;
    }

    // Generate filename with timestamp
    var now = new Date();
    var dateStr = now.getFullYear() + '' +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') + '_' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0');
    var filename = 'PFFP_Backup_' + dateStr + '.json';

    // Download JSON file
    var blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast((t.backupSuccess || 'Backup exported!') + ' (' + totalRecords.toLocaleString() + ' records)', 'success');
}

function showConfirmDialog(iconHtml, message, btnClass, onConfirm) {
    var el = document.getElementById('confirmIcon');
    var msgEl = document.getElementById('confirmMessage');
    var okBtn = document.getElementById('btnConfirmOk');
    if (el) el.innerHTML = iconHtml;
    if (msgEl) msgEl.textContent = message;
    if (okBtn) {
        okBtn.className = 'btn px-4 ' + btnClass;
        okBtn.onclick = function () {
            bootstrap.Modal.getInstance(document.getElementById('confirmModal')).hide();
            if (onConfirm) onConfirm();
        };
    }
    new bootstrap.Modal(document.getElementById('confirmModal')).show();
}
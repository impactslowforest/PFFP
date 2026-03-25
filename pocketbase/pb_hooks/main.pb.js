/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// PFFP - Server-side Security Hooks & API Proxy
// ============================================================
// NOTE: PocketBase Goja JS engine isolates each callback scope.
// Helper functions defined at file level are NOT accessible inside
// routerAdd/onRecord* callbacks. All $security calls are inlined.

// ============================================================
// HOOK: Hash password on CREATE (app_users)
// ============================================================
onRecordCreateRequest((e) => {
    var record = e.record;
    var plainPassword = record.getString("Password");
    var status = record.getString("Status");
    var email = record.getString("Email");
    var fullName = record.getString("Full_name");
    var staffId = record.getString("Staff_ID");

    if (plainPassword && plainPassword.trim() !== "") {
        var salt = $security.randomString(16);
        var hash = $security.sha256(salt + ":" + plainPassword.trim());
        record.set("PasswordHash", hash);
        record.set("PasswordSalt", salt);

        // Send emails BEFORE masking password
        if (status === "Pending" && email && plainPassword) {
            try {
                var appUrl = $app.settings().meta.appUrl || "https://pffp.slowforest.vn";

                // Admin notification email
                var adminMsg = new MailerMessage({
                    from: {address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName},
                    to: [{address: "trung@slowforest.com"}, {address: "impact@slowforest.vn"}],
                    subject: "[PFFP] Đăng ký tài khoản mới - New Account Registration",
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background-color: white; padding: 25px; border-left: 4px solid #2E7D32;">
                                <h3 style="color: #2E7D32; margin-top: 0;">📋 Đăng ký tài khoản mới | New Account Registration</h3>
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr><td style="padding: 8px 0; color: #666;"><strong>Mã nhân viên | Staff ID:</strong></td><td style="padding: 8px 0;">` + staffId + `</td></tr>
                                    <tr><td style="padding: 8px 0; color: #666;"><strong>Họ tên | Full name:</strong></td><td style="padding: 8px 0;">` + fullName + `</td></tr>
                                    <tr><td style="padding: 8px 0; color: #666;"><strong>Email:</strong></td><td style="padding: 8px 0;">` + email + `</td></tr>
                                    <tr><td style="padding: 8px 0; color: #666;"><strong>Trạng thái | Status:</strong></td><td style="padding: 8px 0;"><span style="background-color: #fff3cd; color: #856404; padding: 4px 12px; border-radius: 3px;">Chờ phê duyệt | Pending Approval</span></td></tr>
                                </table>
                                <div style="margin-top: 20px; text-align: center;">
                                    <a href="` + appUrl + `/_/" style="display: inline-block; background-color: #2E7D32; color: white; padding: 10px 25px; text-decoration: none; border-radius: 4px; font-weight: bold;">Phê duyệt ngay | Approve Now</a>
                                </div>
                            </div>
                        </div>
                    `
                });
                $app.newMailClient().send(adminMsg);

                // User registration confirmation email (bilingual)
                var userMsg = new MailerMessage({
                    from: {address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName},
                    to: [{address: email}],
                    subject: "[PFFP] Đăng ký thành công - Registration Successful",
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
                            <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <h2 style="color: #2E7D32; margin-top: 0;">✅ PFFP - Đăng ký thành công | Registration Successful</h2>

                                <p style="font-size: 16px; color: #333;">
                                    <strong>Xin chào</strong> ` + fullName + `,<br>
                                    <strong>Hello</strong> ` + fullName + `,
                                </p>

                                <p style="font-size: 15px; color: #666;">
                                    <strong>🇻🇳 Việt:</strong> Tài khoản của bạn đã được đăng ký thành công! Vui lòng chờ Admin phê duyệt.<br>
                                    <strong>🇬🇧 English:</strong> Your account has been registered successfully! Please wait for Admin approval.
                                </p>

                                <div style="background-color: #f9f9f9; border-left: 4px solid #2E7D32; padding: 15px; margin: 20px 0;">
                                    <p style="margin: 5px 0; color: #555;"><strong>Mã nhân viên | Staff ID:</strong> ` + staffId + `</p>
                                    <p style="margin: 5px 0; color: #555;"><strong>Email:</strong> ` + email + `</p>
                                    <p style="margin: 5px 0; color: #555;"><strong>Mật khẩu | Password:</strong>
                                        <span style="color: #d32f2f; font-size: 18px; font-weight: bold; background-color: #ffebee; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-left: 10px; letter-spacing: 1px;">` + plainPassword + `</span>
                                    </p>
                                </div>

                                <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 12px; margin: 20px 0;">
                                    <p style="margin: 0; color: #1565c0; font-size: 14px;">
                                        ℹ️ <strong>VN:</strong> Vui lòng ghi nhớ mật khẩu này. Tài khoản sẽ được kích hoạt sau khi Admin phê duyệt.<br>
                                        <strong>EN:</strong> Please remember this password. Your account will be activated after Admin approval.
                                    </p>
                                </div>

                                <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0;">
                                    <p style="margin: 0; color: #856404; font-size: 14px;">
                                        ⚠️ <strong>VN:</strong> Không chia sẻ mật khẩu với bất kỳ ai.<br>
                                        <strong>EN:</strong> Do not share your password with anyone.
                                    </p>
                                </div>

                                <div style="text-align: center; margin-top: 30px;">
                                    <p style="color: #999; font-size: 14px;">
                                        <strong>VN:</strong> Sau khi được phê duyệt, bạn có thể đăng nhập tại:<br>
                                        <strong>EN:</strong> After approval, you can login at:
                                    </p>
                                    <a href="` + appUrl + `/#/login" style="display: inline-block; background-color: #2E7D32; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px; margin-top: 10px;">Đăng nhập | Login</a>
                                </div>

                                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

                                <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
                                    PFFP - Pocket Farmer Forest Programme<br>
                                    Slow Forest Vietnam
                                </p>
                            </div>
                        </div>
                    `
                });
                $app.newMailClient().send(userMsg);
                console.log("[PFFP] Sent registration emails: " + staffId);
            } catch (err) {
                console.error("[PFFP] Email error: " + err);
            }
        }

        record.set("Password", "********");
    }

    return e.next();
}, "app_users");

// ============================================================
// HOOK: Hash password on UPDATE (app_users)
// ============================================================
onRecordUpdateRequest((e) => {
    var record = e.record;
    var original = record.original();
    var plainPassword = record.getString("Password");

    // Send approval email if status changed Pending -> Act
    if (original) {
        var oldStatus = original.getString("Status");
        var newStatus = record.getString("Status");
        if (oldStatus === "Pending" && newStatus === "Act") {
            try {
                var email = record.getString("Email");
                var fullName = record.getString("Full_name");
                var staffId = record.getString("Staff_ID");
                var appUrl = $app.settings().meta.appUrl || "https://pffp.slowforest.vn";
                var approvalMsg = new MailerMessage({
                    from: {address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName},
                    to: [{address: email}],
                    subject: "[PFFP] Tài khoản đã được phê duyệt - Account Approved",
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
                            <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <h2 style="color: #2E7D32; margin-top: 0;">🎉 PFFP - Tài khoản đã được phê duyệt | Account Approved</h2>

                                <p style="font-size: 16px; color: #333;">
                                    <strong>Xin chào</strong> ` + fullName + `,<br>
                                    <strong>Hello</strong> ` + fullName + `,
                                </p>

                                <p style="font-size: 15px; color: #666;">
                                    <strong>🇻🇳 Việt:</strong> Chúc mừng! Tài khoản của bạn đã được Admin phê duyệt và kích hoạt thành công.<br>
                                    <strong>🇬🇧 English:</strong> Congratulations! Your account has been approved and activated by Admin.
                                </p>

                                <div style="background-color: #e8f5e9; border-left: 4px solid #2E7D32; padding: 15px; margin: 20px 0;">
                                    <p style="margin: 5px 0; color: #555;"><strong>Mã nhân viên | Staff ID:</strong> ` + staffId + `</p>
                                    <p style="margin: 5px 0; color: #555;"><strong>Email:</strong> ` + email + `</p>
                                    <p style="margin: 5px 0; color: #2E7D32; font-weight: bold; font-size: 16px;">✓ Trạng thái | Status: <span style="background-color: #c8e6c9; padding: 4px 12px; border-radius: 3px;">Đã kích hoạt | Activated</span></p>
                                </div>

                                <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 12px; margin: 20px 0;">
                                    <p style="margin: 0; color: #1565c0; font-size: 14px;">
                                        ℹ️ <strong>VN:</strong> Bạn có thể đăng nhập ngay bây giờ bằng mật khẩu đã được gửi trong email đăng ký.<br>
                                        <strong>EN:</strong> You can login now using the password sent in your registration email.
                                    </p>
                                </div>

                                <div style="text-align: center; margin-top: 30px;">
                                    <a href="` + appUrl + `/#/login" style="display: inline-block; background-color: #2E7D32; color: white; padding: 14px 35px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 17px;">Đăng nhập ngay | Login Now</a>
                                </div>

                                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

                                <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
                                    PFFP - Pocket Farmer Forest Programme<br>
                                    Slow Forest Vietnam
                                </p>
                            </div>
                        </div>
                    `
                });
                $app.newMailClient().send(approvalMsg);
                console.log("[PFFP] Sent approval email: " + email);
            } catch (err) {
                console.error("[PFFP] Approval email error: " + err);
            }
        }
    }

    // Hash password if changed
    if (plainPassword &&
        plainPassword.trim() !== "" &&
        plainPassword !== "********") {
        var salt = $security.randomString(16);
        var hash = $security.sha256(salt + ":" + plainPassword.trim());
        record.set("PasswordHash", hash);
        record.set("PasswordSalt", salt);
        record.set("Password", "********");
    } else if (original) {
        record.set("Password", original.getString("Password"));
    }

    return e.next();
}, "app_users");

// ============================================================
// HOOK: Strip sensitive fields from ALL API responses
// ============================================================
onRecordEnrich((e) => {
    e.record.hide("Password");
    e.record.hide("PasswordHash");
    e.record.hide("PasswordSalt");
    return e.next();
}, "app_users");

// ============================================================
// ROUTE: POST /api/custom/login
// ============================================================
routerAdd("POST", "/api/custom/login", (e) => {
    var body = e.requestInfo().body;
    var staffId = String(body.staffId || "").trim();
    var password = String(body.password || "").trim();

    if (!staffId || !password) {
        return e.json(400, {
            success: false,
            error: "Staff ID and password are required"
        });
    }

    var record;
    try {
        record = $app.findFirstRecordByData("app_users", "Staff_ID", staffId);
    } catch (err) {
        return e.json(401, { success: false, error: "Invalid credentials" });
    }

    if (!record) {
        return e.json(401, { success: false, error: "Invalid credentials" });
    }

    var status = record.getString("Status");
    if (status !== "Act") {
        return e.json(403, {
            success: false,
            error: "Account not active",
            accountStatus: status
        });
    }

    // Hash-based password comparison (PasswordHash = sha256(PasswordSalt + ":" + plainPassword))
    var storedHash = record.getString("PasswordHash");
    var storedSalt = record.getString("PasswordSalt");
    var isValid = false;
    if (storedHash && storedSalt) {
        var computedHash = $security.sha256(storedSalt + ":" + password);
        isValid = (computedHash === storedHash);
    } else {
        // Fallback for accounts with plain password not yet migrated
        var storedPassword = record.getString("Password");
        isValid = (storedPassword !== "********" && storedPassword === password);
    }

    if (!isValid) {
        return e.json(401, { success: false, error: "Invalid credentials" });
    }

    var userData = record.publicExport();
    delete userData.password;

    return e.json(200, {
        success: true,
        user: userData
    });
});


// ============================================================
// ROUTE: POST /api/forgot-password (with email sending)
// ============================================================
routerAdd("POST", "/api/forgot-password", (e) => {
    var body = e.requestInfo().body;
    var email = String(body.email || "").trim().toLowerCase();

    if (!email) {
        return e.json(400, {
            success: false,
            error: "Email la bat buoc"
        });
    }

    // Find user by email
    var record;
    try {
        record = $app.findFirstRecordByData("app_users", "Email", email);
    } catch (err) {
        // Security: Don't reveal if email exists or not
        return e.json(200, {
            success: true,
            message: "Neu email ton tai, mat khau moi da duoc gui"
        });
    }

    if (!record) {
        // Security: Don't reveal if email exists or not
        return e.json(200, {
            success: true,
            message: "Neu email ton tai, mat khau moi da duoc gui"
        });
    }

    // Check if account is active
    var status = record.getString("Status");
    if (status !== "Act") {
        return e.json(403, {
            success: false,
            error: "Tai khoan chua duoc kich hoat. Vui long lien he Admin."
        });
    }

    // Generate new password
    var newPassword = $security.randomStringWithAlphabet(
        10,
        "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    );

    // Hash and save new password
    var salt = $security.randomString(16);
    var hash = $security.sha256(salt + ":" + newPassword);
    record.set("PasswordHash", hash);
    record.set("PasswordSalt", salt);
    record.set("Password", "********");
    $app.save(record);

    // Send email with new password
    try {
        var fullName = record.getString("Full_name");
        var staffId = record.getString("Staff_ID");
        var appUrl = $app.settings().meta.appUrl || "https://pffp.slowforest.vn";

        var resetMsg = new MailerMessage({
            from: {
                address: $app.settings().meta.senderAddress,
                name: $app.settings().meta.senderName
            },
            to: [{address: email}],
            subject: "[PFFP] Mat khau moi cua ban",
            text: "Xin chao " + fullName + ",\n\n" +
                  "Ban da yeu cau dat lai mat khau.\n\n" +
                  "Thong tin dang nhap moi:\n\n" +
                  "Ma NV: " + staffId + "\n" +
                  "Email: " + email + "\n" +
                  "Mat khau moi: " + newPassword + "\n\n" +
                  "Vui long ghi nho mat khau nay va dang nhap tai:\n" +
                  appUrl + "/#/login\n\n" +
                  "Neu ban khong yeu cau dat lai mat khau, vui long lien he Admin ngay."
        });

        $app.newMailClient().send(resetMsg);
        console.log("[PFFP] Sent forgot password email to: " + email);

        return e.json(200, {
            success: true,
            newPassword: newPassword  // Still return for backward compatibility
        });
    } catch (err) {
        console.error("[PFFP] Forgot password email error: " + err);
        return e.json(500, {
            success: false,
            error: "Loi gui email. Vui long thu lai sau."
        });
    }
});

// ============================================================
// ROUTE: POST /api/custom/reset-password
// ============================================================
routerAdd("POST", "/api/custom/reset-password", (e) => {
    console.log("[PFFP] Forgot password request received");

    var body = e.requestInfo().body;
    var staffId = String(body.staffId || "").trim();
    var email = String(body.email || "").trim().toLowerCase();

    console.log("[PFFP] Request data - Staff ID: " + staffId + ", Email: " + email);

    if (!staffId || !email) {
        console.log("[PFFP] Missing staff ID or email");
        return e.json(400, {
            success: false,
            error: "Staff ID and email are required"
        });
    }

    var record;
    try {
        record = $app.findFirstRecordByData("app_users", "Staff_ID", staffId);
        console.log("[PFFP] Found user record");
    } catch (err) {
        console.log("[PFFP] User not found: " + staffId);
        return e.json(404, { success: false, error: "Account not found" });
    }

    var storedEmail = String(record.getString("Email") || "").trim().toLowerCase();
    console.log("[PFFP] Stored email: " + storedEmail + ", Provided email: " + email);

    if (storedEmail !== email) {
        console.log("[PFFP] Email mismatch!");
        return e.json(400, { success: false, error: "Email does not match" });
    }

    var newPassword = $security.randomStringWithAlphabet(
        10,
        "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    );

    var salt = $security.randomString(16);
    var hash = $security.sha256(salt + ":" + newPassword);
    record.set("PasswordHash", hash);
    record.set("PasswordSalt", salt);
    record.set("Password", "********");
    $app.save(record);
    console.log("[PFFP] Password updated in database");

    // Send email - copy EXACT format from registration (which works)
    var fullName = record.getString("Full_name");
    var appUrl = $app.settings().meta.appUrl || "https://pffp.slowforest.vn";

    try {
        console.log("[PFFP] Attempting to send email to: " + email);

        // Send styled bilingual HTML email to user only
        var userMsg = new MailerMessage({
            from: {address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName},
            to: [{address: email}],
            subject: "[PFFP] Mật khẩu mới - Password Reset",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
                    <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #2E7D32; margin-top: 0;">🔐 PFFP - Lấy lại mật khẩu | Password Reset</h2>

                        <p style="font-size: 16px; color: #333;">
                            <strong>Xin chào</strong> ` + fullName + `,<br>
                            <strong>Hello</strong> ` + fullName + `,
                        </p>

                        <p style="font-size: 15px; color: #666;">
                            <strong>🇻🇳 Việt:</strong> Mật khẩu mới của bạn đã được tạo thành công.<br>
                            <strong>🇬🇧 English:</strong> Your new password has been created successfully.
                        </p>

                        <div style="background-color: #f9f9f9; border-left: 4px solid #2E7D32; padding: 15px; margin: 20px 0;">
                            <p style="margin: 5px 0; color: #555;"><strong>Mã nhân viên | Staff ID:</strong> ` + staffId + `</p>
                            <p style="margin: 5px 0; color: #555;"><strong>Email:</strong> ` + email + `</p>
                            <p style="margin: 5px 0; color: #555;"><strong>Mật khẩu mới | New Password:</strong>
                                <span style="color: #d32f2f; font-size: 18px; font-weight: bold; background-color: #ffebee; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-left: 10px; letter-spacing: 1px;">` + newPassword + `</span>
                            </p>
                        </div>

                        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0;">
                            <p style="margin: 0; color: #856404; font-size: 14px;">
                                ⚠️ <strong>VN:</strong> Vui lòng ghi nhớ mật khẩu này. Không chia sẻ với bất kỳ ai.<br>
                                <strong>EN:</strong> Please remember this password. Do not share it with anyone.
                            </p>
                        </div>

                        <div style="text-align: center; margin-top: 30px;">
                            <a href="` + appUrl + `/#/login" style="display: inline-block; background-color: #2E7D32; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">Đăng nhập ngay | Login Now</a>
                        </div>

                        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

                        <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
                            PFFP - Pocket Farmer Forest Programme<br>
                            Slow Forest Vietnam
                        </p>
                    </div>
                </div>
            `
        });

        $app.newMailClient().send(userMsg);
        console.log("[PFFP] ✓ Password reset email sent to: " + email);

        return e.json(200, {
            success: true,
            newPassword: newPassword
        });
    } catch (err) {
        console.error("[PFFP] ✗ Email sending failed: " + String(err));
        return e.json(500, {
            success: false,
            error: "Loi gui email: " + String(err)
        });
    }
});

// ============================================================
// ROUTE: POST /api/custom/change-password
// ============================================================
routerAdd("POST", "/api/custom/change-password", (e) => {
    var body = e.requestInfo().body;
    var staffId = String(body.staffId || "").trim();
    var newPassword = String(body.newPassword || "").trim();

    if (!staffId || !newPassword) {
        return e.json(400, {
            success: false,
            error: "Staff ID and new password are required"
        });
    }

    if (newPassword.length < 6) {
        return e.json(400, {
            success: false,
            error: "Password must be at least 6 characters"
        });
    }

    var record;
    try {
        record = $app.findFirstRecordByData("app_users", "Staff_ID", staffId);
    } catch (err) {
        return e.json(404, { success: false, error: "User not found" });
    }

    var salt = $security.randomString(16);
    var hash = $security.sha256(salt + ":" + newPassword);
    record.set("PasswordHash", hash);
    record.set("PasswordSalt", salt);
    record.set("Password", "********");
    $app.save(record);

    return e.json(200, { success: true });
});

// ============================================================
// ROUTE: POST /api/custom/migrate-passwords (one-time)
// ============================================================
routerAdd("POST", "/api/custom/migrate-passwords", (e) => {
    var records = $app.findAllRecords("app_users");
    var migrated = 0;
    var skipped = 0;
    var errors = 0;

    for (var i = 0; i < records.length; i++) {
        var record = records[i];
        var existingHash = record.getString("PasswordHash");

        if (existingHash && existingHash !== "") {
            skipped++;
            continue;
        }

        var plainPassword = record.getString("Password");
        if (plainPassword && plainPassword.trim() !== "" && plainPassword !== "********") {
            try {
                var salt = $security.randomString(16);
                var hash = $security.sha256(salt + ":" + plainPassword.trim());
                record.set("PasswordHash", hash);
                record.set("PasswordSalt", salt);
                record.set("Password", "********");
                $app.save(record);
                migrated++;
            } catch (err) {
                errors++;
            }
        } else {
            skipped++;
        }
    }

    return e.json(200, {
        success: true,
        migrated: migrated,
        skipped: skipped,
        errors: errors
    });
});

// ============================================================
// ROUTE: POST /api/custom/ai-chat (Gemini proxy)
// ============================================================
routerAdd("POST", "/api/custom/ai-chat", (e) => {
    var GEMINI_API_KEY = "AIzaSyCqb5-dFoh-DnJ5HOVW5yEuHiDIUIyIpLE";
    var GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=";

    var body = e.requestInfo().body;
    var contents = body.contents;
    var generationConfig = body.generationConfig || {
        temperature: 0.3,
        maxOutputTokens: 8192
    };

    if (!contents) {
        return e.json(400, { error: { message: "contents is required" } });
    }

    try {
        var res = $http.send({
            method: "POST",
            url: GEMINI_API_URL + GEMINI_API_KEY,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: contents,
                generationConfig: generationConfig
            }),
            timeout: 60
        });

        return e.json(res.statusCode, res.json);
    } catch (err) {
        return e.json(500, {
            error: { message: "AI service error: " + String(err) }
        });
    }
});

// ============================================================
// ROUTE: POST /api/custom/fix-collection-rules (one-time)
// ============================================================
routerAdd("POST", "/api/custom/fix-collection-rules", (e) => {
    var collections = ["supported", "farmers", "plots", "yearly_data"];
    var fixed = [];
    for (var i = 0; i < collections.length; i++) {
        try {
            var coll = $app.findCollectionByNameOrId(collections[i]);
            coll.listRule = "";
            coll.viewRule = "";
            coll.createRule = "";
            coll.updateRule = "";
            coll.deleteRule = "";
            $app.save(coll);
            fixed.push(collections[i]);
        } catch (err) {
            fixed.push(collections[i] + ":ERR:" + String(err));
        }
    }
    return e.json(200, { success: true, fixed: fixed });
});

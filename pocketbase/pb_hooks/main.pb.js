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
                var adminMsg = new MailerMessage({
                    from: {address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName},
                    to: [{address: "trung@slowforest.com"}, {address: "impact@slowforest.vn"}],
                    subject: "[PFFP] Dang ky tai khoan moi",
                    text: "Ma NV: " + staffId + "\nHo ten: " + fullName + "\nEmail: " + email + "\nTrang thai: Cho phe duyet\n\nLink: " + appUrl + "/_/"
                });
                $app.newMailClient().send(adminMsg);

                var userMsg = new MailerMessage({
                    from: {address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName},
                    to: [{address: email}],
                    subject: "[PFFP] Dang ky thanh cong",
                    text: "Xin chao " + fullName + ",\n\nMa NV: " + staffId + "\nEmail: " + email + "\nMat khau: " + plainPassword + "\n\nVui long ghi nho mat khau.\nCho Admin phe duyet."
                });
                $app.newMailClient().send(userMsg);
                console.log("[PFFP] Sent emails: " + staffId);
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
                    subject: "[PFFP] Tai khoan da duoc phe duyet",
                    text: "Xin chao " + fullName + ",\n\nTai khoan da duoc phe duyet!\n\nMa NV: " + staffId + "\nEmail: " + email + "\n\nDang nhap: " + appUrl + "/#/login"
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

    var storedHash = record.getString("PasswordHash");
    var storedSalt = record.getString("PasswordSalt");
    var isValid = false;

    if (storedHash && storedSalt) {
        // Verify hashed password
        var computed = $security.sha256(storedSalt + ":" + password);
        isValid = $security.equal(computed, storedHash);
    } else {
        // Legacy fallback: check old plaintext Password field
        var oldPassword = record.getString("Password");
        if (oldPassword && oldPassword !== "********") {
            isValid = (oldPassword.trim() === password);
            // Auto-migrate on successful legacy login
            if (isValid) {
                var salt = $security.randomString(16);
                var hash = $security.sha256(salt + ":" + password);
                record.set("PasswordHash", hash);
                record.set("PasswordSalt", salt);
                record.set("Password", "********");
                $app.save(record);
            }
        }
    }

    if (!isValid) {
        return e.json(401, { success: false, error: "Invalid credentials" });
    }

    var userData = record.publicExport();
    delete userData.Password;
    delete userData.PasswordHash;
    delete userData.PasswordSalt;

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
    var body = e.requestInfo().body;
    var staffId = String(body.staffId || "").trim();
    var email = String(body.email || "").trim().toLowerCase();

    if (!staffId || !email) {
        return e.json(400, {
            success: false,
            error: "Staff ID and email are required"
        });
    }

    var record;
    try {
        record = $app.findFirstRecordByData("app_users", "Staff_ID", staffId);
    } catch (err) {
        return e.json(404, { success: false, error: "Account not found" });
    }

    var storedEmail = String(record.getString("Email") || "").trim().toLowerCase();
    if (storedEmail !== email) {
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

    return e.json(200, {
        success: true,
        newPassword: newPassword
    });
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

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

    if (plainPassword && plainPassword.trim() !== "") {
        var salt = $security.randomString(16);
        var hash = $security.sha256(salt + ":" + plainPassword.trim());
        record.set("PasswordHash", hash);
        record.set("PasswordSalt", salt);
        record.set("Password", "********");
    }

    return e.next();
}, "app_users");

// ============================================================
// HOOK: Hash password on UPDATE (app_users)
// ============================================================
onRecordUpdateRequest((e) => {
    var record = e.record;
    var plainPassword = record.getString("Password");

    if (plainPassword &&
        plainPassword.trim() !== "" &&
        plainPassword !== "********") {
        var salt = $security.randomString(16);
        var hash = $security.sha256(salt + ":" + plainPassword.trim());
        record.set("PasswordHash", hash);
        record.set("PasswordSalt", salt);
        record.set("Password", "********");
    } else {
        var original = record.original();
        if (original) {
            record.set("Password", original.getString("Password"));
        }
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

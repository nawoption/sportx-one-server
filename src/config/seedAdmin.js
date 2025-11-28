const Account = require("../models/accountModel");
const { hashPassword } = require("../utils/helper");
const Balance = require("../models/balanceModel");
const LimitSetting = require("../models/limitSettingModel");
const CommissionSetting = require("../models/commissionSettingModel");
const config = require("./index");

/**
 * Ensure a default Admin account exists. This runs at app startup after DB connection.
 * - Reads DEFAULT_ADMIN_USERNAME / DEFAULT_ADMIN_PASSWORD / DEFAULT_ADMIN_CONTACT from env (via config)
 * - If no account with role 'Admin' exists, it creates one with the provided credentials.
 */
const ensureDefaultAdmin = async () => {
    try {
        const existing = await Account.findOne({ role: "Admin", isDeleted: false });
        if (existing) {
            console.log("Default admin already exists — skipping creation.");
            return;
        }

        const username = config.env.DEFAULT_ADMIN_USERNAME || "admin";
        const password = config.env.DEFAULT_ADMIN_PASSWORD || "admin123";
        const contact = config.env.DEFAULT_ADMIN_CONTACT || "";

        const hashed = await hashPassword(password);

        const admin = new Account({
            username,
            password: hashed,
            contact,
            role: "Admin",
            status: "ACTIVE",
        });

        await admin.save();

        // Create default limit & commission settings for the admin so other routines can expect them
        try {
            const limit = new LimitSetting({ createdBy: admin._id });
            const commission = new CommissionSetting({ createdBy: admin._id });
            await limit.save();
            await commission.save();

            admin.limitSetting = limit._id;
            admin.commissionSetting = commission._id;
            await admin.save();
        } catch (e) {
            console.warn("Warning: failed to create default limit/commission settings for admin:", e.message);
        }

        // Create default balance for admin
        try {
            const starting = Number(config.env.DEFAULT_ADMIN_BALANCE || 0);
            await Balance.create({ account: admin._id, cashBalance: starting, accountBalance: starting });
        } catch (e) {
            console.warn("Warning: failed to create default balance for admin:", e.message);
        }

        console.log(`Created default admin account — username: ${username} password: ${password}`);
        console.log("Tip: set DEFAULT_ADMIN_USERNAME and DEFAULT_ADMIN_PASSWORD in environment to override defaults.");
    } catch (err) {
        console.error("Failed to create default admin account:", err);
    }
};

module.exports = ensureDefaultAdmin;

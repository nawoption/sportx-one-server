const mongoose = require("mongoose");
const config = require("../config");
const Account = require("../models/accountModel");
const Balance = require("../models/balanceModel");
const LimitSetting = require("../models/limitSettingModel");
const CommissionSetting = require("../models/commissionSettingModel");

const run = async () => {
    try {
        await mongoose.connect(config.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
        console.log("Connected to DB — checking for Admin accounts...");

        const admins = await Account.find({ role: "Admin", isDeleted: false }).lean();
        if (!admins || admins.length === 0) {
            console.log("No Admin accounts found — the seeder will create one on app startup.");
        } else {
            console.log(`Found ${admins.length} admin account(s):`);
            for (const [i, a] of admins.entries()) {
                console.log(`${i + 1}. username=${a.username} status=${a.status}`);

                // Check corresponding balance and settings
                const b = await Balance.findOne({ account: a._id }).lean();
                if (!b) console.log(`   - Balance: MISSING`);
                else
                    console.log(
                        `   - Balance: cash=${b.cashBalance} account=${b.accountBalance} commission=${b.commissionBalance}`
                    );

                const l = a.limitSetting ? await LimitSetting.findById(a.limitSetting).lean() : null;
                const c = a.commissionSetting ? await CommissionSetting.findById(a.commissionSetting).lean() : null;
                console.log(`   - LimitSetting: ${l ? "FOUND" : "MISSING"}`);
                console.log(`   - CommissionSetting: ${c ? "FOUND" : "MISSING"}`);
            }
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error("Failed to check admin seed:", err);
        process.exit(1);
    }
};

run();

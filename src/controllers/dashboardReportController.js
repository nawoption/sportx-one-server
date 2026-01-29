const Account = require("../models/accountModel");
const Balance = require("../models/balanceModel");
const downlineService = require("../services/downlineService");

exports.generateDashboardReport = async (req, res) => {
    try {
        const loggedInUser = req.user;
        const loggedInUserId = loggedInUser._id;
        const currentRole = loggedInUser.role;

        // 1. Define Hierarchy and Visible Roles
        const hierarchy = ["Admin", "Super", "Senior", "Master", "Agent", "User"];
        const currentIndex = hierarchy.indexOf(currentRole);

        // Only show roles that are strictly below the current logged-in role
        const visibleRoles = hierarchy.slice(currentIndex + 1);

        // 2. Fetch Data
        const myBalance = await Balance.findOne({ account: loggedInUserId });
        const allDownlineIds = await downlineService.getAllDownlineIds(loggedInUserId);
        const allDownlineAccounts = await Account.find({
            _id: { $in: allDownlineIds },
        }).select("_id role");

        // 3. Map IDs to Roles for Aggregation
        const roleMap = {};
        visibleRoles.forEach((role) => {
            roleMap[role] = allDownlineAccounts.filter((a) => a.role === role).map((a) => a._id);
        });

        // 4. Aggregate Balances for all downlines
        const balanceData = await Balance.aggregate([
            {
                $match: { account: { $in: allDownlineIds } },
            },
            {
                $group: {
                    _id: null,
                    totalDownlineCash: { $sum: "$cashBalance" },
                    // Conditional sums for each visible role
                    ...visibleRoles.reduce((acc, role) => {
                        acc[role.toLowerCase() + "Cash"] = {
                            $sum: { $cond: [{ $in: ["$account", roleMap[role]] }, "$cashBalance", 0] },
                        };
                        return acc;
                    }, {}),
                },
            },
        ]);

        const stats = balanceData[0] || { totalDownlineCash: 0 };

        // 5. Construct Balances Array
        const balances = visibleRoles.map((role) => {
            const roleKey = role.toLowerCase() + "Cash";
            return {
                role: role,
                amount: stats[roleKey] || 0,
                count: roleMap[role].length,
            };
        });

        // 6. Final Calculations
        // accountBalance: My Cash + All Downlines' Cash
        const accountBalance = (myBalance?.cashBalance || 0) + (stats.totalDownlineCash || 0);
        const totalMemberBalance = stats.totalDownlineCash || 0;

        res.status(200).json({
            success: true,
            data: {
                usercode: loggedInUser.username,
                role: currentRole,
                currency: "MMK",
                summary: {
                    cashBalance: myBalance?.cashBalance || 0,
                    accountBalance: accountBalance,
                    memberBalance: totalMemberBalance,
                },
                balances: balances,
            },
        });
    } catch (error) {
        console.error("Dashboard Report Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

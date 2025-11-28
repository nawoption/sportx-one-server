const Account = require("../models/accountModel");

// Get direct children
exports.getDirectDownline = async (req, res) => {
    try {
        const query = {
            isSubAccount: false,
            upline: req.user._id,
        };

        const children = await Account.find(query).select("username role parent commissionRate status ");

        return res.json({ success: true, count: children.length, users: children });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Get full downline tree (recursive)
async function buildTree(accountId) {
    const children = await Account.find({ upline: accountId, isSubAccount: false }).select(
        "username role parent commissionRate"
    );

    const result = [];

    for (const child of children) {
        const node = {
            _id: child._id,
            username: child.username,
            role: child.role,
            commissionRate: child.commissionRate,
            children: await buildTree(child._id),
        };
        result.push(node);
    }
    return result;
}

exports.getDownlineTree = async (req, res) => {
    try {
        const tree = await buildTree(req.user._id);

        return res.json({ success: true, tree });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

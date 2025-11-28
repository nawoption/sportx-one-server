const SubAccount = require("../models/subAccountModel");
const { hashPassword } = require("../utils/helper");
const { getActor } = require("../middlewares/authMiddlewares");

const subAccountController = {
    createSubAccount: async (req, res) => {
        try {
            const { username, password, contact } = req.body;

            const exists = await SubAccount.findOne({ username });
            if (exists) {
                return res.status(400).json({ message: "Username already exists" });
            }

            const actor = getActor(req);

            const hashed = await hashPassword(password);

            const sub = await SubAccount.create({
                username,
                password: hashed,
                contact,
                commissionSetting: actor.user.commissionSetting,
                limitSetting: actor.user.limitSetting,
                role: actor.type,
                createdBy: actor.id,
                createdByModel: actor.type,
            });

            res.status(201).json({
                message: "SubAccount created successfully",
                user: { ...sub.toObject(), password: undefined },
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    getSubAccounts: async (req, res) => {
        try {
            const subs = await SubAccount.find({
                createdBy: req.senior._id,
                createdByModel: "Senior",
            }).select("-password");

            res.status(200).json({ users: subs });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    resetPassword: async (req, res) => {
        try {
            const { id } = req.params;
            const newPassword = req.body.newPassword || "defaultPassword123";

            const user = await SubAccount.findById(id);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            user.password = await hashPassword(newPassword);
            await user.save();

            res.status(200).json({ message: "Password reset successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },
};

module.exports = subAccountController;

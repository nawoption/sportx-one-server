const Admin = require("../models/adminModel");
const { comparePassword, hashPassword, generateAccessToken, generateRefreshToken } = require("../utils/helper");
const BalanceAccount = require("../models/balanceAccountModel");

const adminController = {
    // ------------------- LOGIN ADMIN -------------------
    adminLoign: async (req, res) => {
        try {
            const { username, password } = req.body;

            // Find admin by username
            const admin = await Admin.findOne({ username, isDeleted: false });
            if (!admin) {
                return res.status(400).json({ message: "Invalid username or password" });
            }

            // Check password
            const isMatch = await comparePassword(password, admin.password);
            if (!isMatch) {
                return res.status(400).json({ message: "Invalid username or password" });
            }

            // Generate JWT token
            const accessToken = generateAccessToken({ id: admin._id, username: admin.username });
            const token = { accessToken };

            res.status(200).json({
                message: "Login successful",
                token,
                user: { ...admin.toObject(), password: undefined },
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },

    // ------------------- CREATE ADMIN -------------------
    createAdmin: async (req, res) => {
        try {
            const { username, password } = req.body;

            // check if username already exists
            const existingAdmin = await Admin.findOne({ username });
            if (existingAdmin) {
                return res.status(400).json({ message: "username already registered" });
            }

            // hash password
            const hashedPassword = await hashPassword(password);

            const newAdmin = new Admin({
                username,
                password: hashedPassword,
            });

            await newAdmin.save();

            await new BalanceAccount({ owner: newAdmin._id, ownerModel: "Admin" }).save();

            res.status(201).json({
                message: "Admin created successfully",
                admin: { ...newAdmin.toObject(), password: undefined },
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    },

    // ------------------- GET ALL ADMINS -------------------
    getAllAdmins: async (req, res) => {
        try {
            const admins = await Admin.find().select("-password");
            res.status(200).json(admins);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },

    // ------------------- GET SINGLE ADMIN -------------------
    getProfile: async (req, res) => {
        const adminId = req.params.id || req.admin._id;
        try {
            const admin = await Admin.findById(adminId).select("-password");
            if (!admin) {
                return res.status(404).json({ message: "Admin not found" });
            }
            const balanceAccount = await BalanceAccount.findOne({ owner: admin._id, ownerModel: "Admin" });

            res.status(200).json({ admin, balanceAccount });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },

    // ------------------- CHANGE PASSWORD -------------------
    changePassword: async (req, res) => {
        try {
            const id = req.admin._id;
            const { oldPassword, newPassword } = req.body;

            const admin = await Admin.findById(id);
            if (!admin) {
                return res.status(404).json({ message: "Admin not found" });
            }

            // Check old password
            const isMatch = await comparePassword(oldPassword, admin.password);
            if (!isMatch) {
                return res.status(400).json({ message: "Old password is incorrect" });
            }

            // Hash new password
            admin.password = await hashPassword(newPassword);
            admin.isChangedPassword = true;

            await admin.save();

            res.status(200).json({ message: "Password changed successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },

    // ------------------- DELETE ADMIN -------------------
    deleteAdmin: async (req, res) => {
        try {
            const { id } = req.params;

            const deletedAdmin = await Admin.findOneAndUpdate(
                { _id: id, isDeleted: false },
                { isDeleted: true },
                { new: true }
            );
            if (!deletedAdmin) {
                return res.status(404).json({ message: "Admin not found or deleted" });
            }

            res.status(200).json({ message: "Admin deleted successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },
};

module.exports = adminController;

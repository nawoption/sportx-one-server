const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config");

module.exports = {
    verifyToken: (token) => {
        return jwt.verify(token, config.env.JWT_SECRET);
    },

    generateToken: (payload) => {
        return jwt.sign(payload, config.env.JWT_SECRET, { expiresIn: config.env.JWT_EXPIRES_IN });
    },

    generateAccessToken: (payload) => {
        return jwt.sign(payload, config.env.JWT_SECRET, { expiresIn: config.env.JWT_EXPIRES_IN });
    },

    generateRefreshToken: (payload) => {
        return jwt.sign(payload, config.env.JWT_REFRESH_SECRET, { expiresIn: config.env.JWT_EXPIRES_IN });
    },

    hashPassword: async (password) => {
        const salt = await bcrypt.genSalt(10);
        return await bcrypt.hash(password, salt);
    },

    comparePassword: async (password, hashedPassword) => {
        return await bcrypt.compare(password, hashedPassword);
    },
};

require("dotenv").config();

const config = {
    env: {
        PORT: process.env.PORT || 3000,
        MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/sportxone",
        JWT_SECRET: process.env.JWT_SECRET || "your_jwt_secret_key",
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "your_jwt_secret_key",
        JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "30d",
        DEFAULT_ADMIN_BALANCE: process.env.DEFAULT_ADMIN_BALANCE || 0,
        DEFAULT_ADMIN_USERNAME: process.env.DEFAULT_ADMIN_USERNAME || "admin",
        DEFAULT_ADMIN_PASSWORD: process.env.DEFAULT_ADMIN_PASSWORD || "admin123",
        DEFAULT_ADMIN_CONTACT: process.env.DEFAULT_ADMIN_CONTACT || "",
    },
};

module.exports = config;

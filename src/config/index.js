require("dotenv").config();

const config = {
    env: {
        PORT: process.env.PORT || 3000,
        MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/sportxone",
        JWT_SECRET: process.env.JWT_SECRET || "your_jwt_secret_key",
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "your_jwt_secret_key",
        JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "30d",
    },
};

module.exports = config;

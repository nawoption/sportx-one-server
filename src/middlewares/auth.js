const jwt = require("jsonwebtoken");
const Account = require("../models/accountModel");

module.exports = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await Account.findById(decoded.id);
        if (!user) return res.status(401).json({ message: "Invalid token" });

        req.user = user;
        next();
    } catch (err) {
        console.log(err);
        return res.status(401).json({ message: err.message });
    }
};

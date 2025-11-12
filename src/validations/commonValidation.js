const Joi = require("joi");
const mongoose = require("mongoose");

module.exports = {
    loginSchema: Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required(),
    }),
    changePasswordSchema: Joi.object({
        oldPassword: Joi.string().required(),
        newPassword: Joi.string().min(6).required(),
    }),
    updateStatusSchema: Joi.object({
        status: Joi.string().valid("ACTIVE", "INACTIVE", "SUSPENDED").required(),
    }),
    idSchema: Joi.object({
        id: Joi.string()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error("any.invalid");
                }
                return value;
            }, "ObjectId Validation")
            .required(),
    }),
};

const Joi = require("joi");
const { limitValidationSchema } = require("./limitValidation");
const { commissionValidationSchema } = require("./comissionValidation");

const accountCreateSchema = Joi.object({
    username: Joi.string().alphanum().min(2).max(30).required(),
    password: Joi.string().min(6).required(),
    contact: Joi.string().optional(),
    role: Joi.string().valid("Admin", "Super", "Senior", "Master", "Agent", "User").required(),
    upline: Joi.string().optional(),
    limit: limitValidationSchema.required(),
    commission: commissionValidationSchema.optional(),
});

module.exports = {
    accountCreateSchema,
};

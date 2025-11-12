const Joi = require("joi");

exports.createAdminSchema = Joi.object({
    username: Joi.string().min(3).max(15).required(),
    password: Joi.string().min(8).required(),
});

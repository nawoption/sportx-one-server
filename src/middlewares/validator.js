const validator = {
    validateBody: (schema) => {
        return (req, res, next) => {
            const body = req.body || {}; // fallback to empty object
            const { error } = schema.validate(body, { abortEarly: false });
            if (error) {
                return res.status(400).json({ errors: error.details.map((err) => err.message) });
            }
            next();
        };
    },
    validateParam: (schema) => {
        return (req, res, next) => {
            const { error } = schema.validate(req.params, { abortEarly: false });
            if (error) {
                return res.status(400).json({ errors: error.details.map((err) => err.message) });
            }
            next();
        };
    },
    validateQuery: (schema) => {
        return (req, res, next) => {
            const { error } = schema.validate(req.query, { abortEarly: false });
            if (error) {
                return res.status(400).json({ errors: error.details.map((err) => err.message) });
            }
            next();
        };
    },
};

module.exports = validator;

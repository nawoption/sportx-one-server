const LimitSetting = require("../models/limitSettingModel");
const CommissionSetting = require("../models/commissionSettingModel");

/**
 * Validates that child settings do not exceed parent settings.
 * @param {Object} parentSettings - The Mongoose document/object for the parent's settings.
 * @param {Object} childData - The raw data object for the child's settings from req.body.
 * @param {string} type - 'limit' or 'commission' (for error logging).
 * @returns {void} Throws an error if validation fails.
 */
const validateHierarchyConstraints = (parentSettings, childData, type) => {
    if (!parentSettings) {
        throw new Error(`Parent ${type} settings not found.`);
    }

    // Iterate through all keys provided in the child data
    for (const key in childData) {
        // Skip metadata fields like _id, createdBy, createdAt
        if (["_id", "createdBy", "createdAt", "updatedAt", "__v"].includes(key)) continue;

        const parentValue = parentSettings[key];
        const childValue = childData[key];

        // If both values are numbers, we compare them
        if (typeof parentValue === "number" && typeof childValue === "number") {
            // For both Limit and Commission, Child value should NOT be greater than Parent value
            if (childValue > parentValue) {
                throw new Error(
                    `Validation Failed: Child ${type} for '${key}' (${childValue}) exceeds parent's limit (${parentValue}).`
                );
            }
        }
    }
};

/**
 * Main function to validate both limit and commission constraints against a parent account.
 */
exports.validateChildAccountSettings = async (parentAccount, childLimit, childCommission) => {
    // 1. Fetch parent's actual settings from DB
    const parentLimit = await LimitSetting.findById(parentAccount.limitSetting);
    const parentComm = await CommissionSetting.findById(parentAccount.commissionSetting);

    // 2. Validate Limit Settings (e.g., min/max bet, max per match)
    if (childLimit) {
        validateHierarchyConstraints(parentLimit, childLimit, "limit");
    }

    // 3. Validate Commission Settings (e.g., hdpOuFtLg, mixParlay3to8)
    if (childCommission) {
        validateHierarchyConstraints(parentComm, childCommission, "commission");
    }

    return true;
};

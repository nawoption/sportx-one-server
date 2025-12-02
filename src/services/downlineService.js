// services/downlineService.js
const mongoose = require("mongoose");
const Account = require("../models/accountModel");

/**
 * Recursively finds all downline IDs for a given user ID.
 * FIX: Uses the account's _id to initiate the downward hierarchy search
 * by matching it against the 'upline' field in the child documents.
 * * @param {string} rootId - The ID of the Super/Master/Agent account.
 * @returns {Promise<string[]>} - An array of all downline user IDs.
 */
exports.getAllDownlineIds = async (rootId) => {
    const objectId = new mongoose.Types.ObjectId(rootId);

    const result = await Account.aggregate([
        // 1. Match the starting account
        { $match: { _id: objectId } },

        // 2. Perform the recursive search (DOWNWARD TRAVERSAL)
        {
            $graphLookup: {
                from: "accounts", // The collection to search

                // --- FIX APPLIED HERE ---
                // Start with the current document's _id
                startWith: "$_id",

                // In the current document, use the _id field to connect from
                connectFromField: "_id",

                // In the target document, match against the 'upline' field
                connectToField: "upline",

                as: "allDownlines",
                maxDepth: 10,
            },
        },

        // 3. Project/reshape the result to get a clean array of IDs
        {
            $project: {
                // Map the resulting array to only extract the _id field
                allDownlineIds: {
                    $map: {
                        input: "$allDownlines",
                        as: "dl",
                        in: "$$dl._id",
                    },
                },
            },
        },
    ]);

    // Extract the final array of IDs
    const downlineIds = result.length > 0 ? result[0].allDownlineIds : [];

    // If Super/Master/Agent also needs to see their OWN bets, include the rootId here
    // return [objectId, ...downlineIds];

    // Otherwise, return only the downlines' IDs
    return downlineIds;
};

const matchService = require("../services/matchService");

exports.getPreMatchList = async (req, res) => {
    try {
        const matches = await matchService.getMatchesByStatus(["active"]);
        res.json({ success: true, data: matches });
    } catch (err) {
        res.status(500).json({ error: "Cannot fetch pre-match list." });
    }
};

exports.getLiveMatchList = async (req, res) => {
    try {
        const matches = await matchService.getMatchesByStatus(["live"]);
        res.json({ success: true, data: matches });
    } catch (err) {
        res.status(500).json({ error: "Cannot fetch live match list." });
    }
};

exports.getMatchResults = async (req, res) => {
    try {
        const matches = await matchService.getMatchesByStatus(["completed"]);
        res.json({ success: true, data: matches });
    } catch (err) {
        res.status(500).json({ error: "Cannot fetch match results." });
    }
};

exports.getMatchDetail = async (req, res) => {
    try {
        const { matchId } = req.params;
        const matchDetail = await Match.findOne({ apiMatchId: matchId }); // Match model ကို တိုက်ရိုက်ခေါ်ခြင်း

        if (!matchDetail) {
            return res.status(404).json({ success: false, message: "Match not found." });
        }

        res.json({ success: true, data: matchDetail });
    } catch (err) {
        res.status(500).json({ error: "Cannot fetch match detail." });
    }
};

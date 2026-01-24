const Match = require("../models/matchModel");

const mapApiDataToMatchModel = (apiMatchData) => {
    const mapScores = (scores) => ({
        home: parseInt(scores.home) || 0,
        away: parseInt(scores.away) || 0,
    });

    const mappedData = {
        apiMatchId: apiMatchData.id,
        league: apiMatchData.league_name,
        homeTeam: apiMatchData.home_team,
        awayTeam: apiMatchData.away_team,
        homeTeamMM: apiMatchData.home_team_mm,
        awayTeamMM: apiMatchData.away_team_mm,
        startTime: new Date(apiMatchData.match_time),
        status: apiMatchData.status.toLowerCase(),

        scores: {
            full_time: apiMatchData.scores.full_time ? mapScores(apiMatchData.scores.full_time) : undefined,
            live: apiMatchData.scores.live ? mapScores(apiMatchData.scores.live) : undefined,
        },

        odds: {
            handicap: {
                home_line: apiMatchData.odds.handicap.home_line,
                away_line: apiMatchData.odds.handicap.away_line,
                home_price: parseFloat(apiMatchData.odds.handicap.home_price),
                away_price: parseFloat(apiMatchData.odds.handicap.away_price),
            },
            over_under: {
                line: parseFloat(apiMatchData.odds.over_under.line),
                over_price: parseFloat(apiMatchData.odds.over_under.over_price),
                under_price: parseFloat(apiMatchData.odds.over_under.under_price),
            },
            one_x_two: {
                home_price: parseFloat(apiMatchData.odds.one_x_two.home_price),
                draw_price: parseFloat(apiMatchData.odds.one_x_two.draw_price),
                away_price: parseFloat(apiMatchData.odds.one_x_two.away_price),
            },
        },
    };

    return mappedData;
};

const upsertMatch = async (apiMatchData) => {
    try {
        const matchData = mapApiDataToMatchModel(apiMatchData);

        const existingMatch = await Match.findOne({ apiMatchId: matchData.apiMatchId });

        if (existingMatch) {
            existingMatch.status = matchData.status;
            existingMatch.scores = matchData.scores;
            existingMatch.odds = matchData.odds;
            await existingMatch.save();
            return existingMatch;
        } else {
            const newMatch = new Match(matchData);
            await newMatch.save();
            return newMatch;
        }
    } catch (error) {
        console.error(`Error processing match ${apiMatchData.id}:`, error);
        throw new Error("Match data processing failed.");
    }
};

const getMatchesByStatus = async (status) => {
    const statusQuery = Array.isArray(status) ? { $in: status } : status;

    return await Match.find({ status: statusQuery }).sort({ startTime: 1 }).lean();
};

module.exports = {
    upsertMatch,
    getMatchesByStatus,
    mapApiDataToMatchModel,
};

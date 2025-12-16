// ---------------------------------------
// 1️⃣ CALCULATE LEG OUTCOME (PER LEG)
// ---------------------------------------
const calculateLegOutcome = (betSystem, leg, score, stake) => {
    const home = score.home;
    const away = score.away;
    const handicap = Number(leg.line);

    let coverMargin = 0;

    // ---------- BODY ----------
    if (leg.betCategory === "body") {
        coverMargin = leg.market === "home" ? home + handicap - away : away + handicap - home;
    }

    // ---------- OVER / UNDER ----------
    else if (leg.betCategory === "overUnder") {
        const total = home + away;
        coverMargin = leg.market === "over" ? total - handicap : handicap - total;
    }

    // ================= MYANMAR =================
    if (betSystem === "myanmar") {
        // FULL WIN / FULL LOSE
        if (coverMargin > 0) {
            return {
                outcome: "won",
                cashDelta: stake, // +100
            };
        }

        if (coverMargin < 0) {
            return {
                outcome: "lost",
                cashDelta: -stake, // -100
            };
        }

        // -------- LINE EQUAL (PRICE MODE) --------
        const price = Number(leg.payoutRate); // e.g. 6 or 94

        // Which side wins on price?
        const isPriceWin =
            (leg.betCategory === "body" && leg.market === "away") ||
            (leg.betCategory === "overUnder" && leg.market === "under");

        if (isPriceWin) {
            // WIN PRICE
            return {
                outcome: "won",
                cashDelta: price,
            };
        }

        // LOSE PRICE → lose (100 − price)
        return {
            outcome: "lost",
            cashDelta: -(100 - price),
        };
    }

    // ================= INTERNATIONAL =================
    if (coverMargin > 0) {
        return { outcome: "won", multiplier: leg.odds };
    }
    if (coverMargin === 0) {
        return { outcome: "push", multiplier: 1 };
    }
    return { outcome: "lost", multiplier: 0 };
};

// ---------------------------------------
// 2️⃣ FINALIZE SLIP SETTLEMENT
// ---------------------------------------

const SINGLE_COMMISSION_RATE = 0.05;
const PARLAY_COMMISSION_RATE = 0.2;

const finalizeSlipSettlement = (betSlip) => {
    const { betSystem, betType, stake, legs } = betSlip;

    // ================= MYANMAR =================
    if (betSystem === "myanmar") {
        // ---------- SINGLE ----------
        if (betType === "single") {
            const leg = legs[0];

            // full lose
            if (leg.cashDelta === -stake) {
                return {
                    status: "lost",
                    payout: 0,
                    profit: -stake,
                };
            }

            let payout = stake + leg.cashDelta;

            if (leg.cashDelta > 0) {
                const commission = Math.floor(leg.cashDelta * SINGLE_COMMISSION_RATE);
                payout -= commission;
            }

            return {
                status: payout > stake ? "won" : "lost",
                payout,
                profit: payout - stake,
            };
        }

        // ---------- PARLAY ----------
        // ❌ ANY FULL LOSE → FULL LOSE
        const hasFullLose = legs.some((l) => l.cashDelta === -stake);

        if (hasFullLose) {
            return {
                status: "lost",
                payout: 0,
                profit: -stake,
            };
        }

        // 1️⃣ Multiply FULL WINS
        let base = stake;
        for (const leg of legs) {
            if (leg.cashDelta === stake) {
                base *= leg.odds; // ×2
            }
        }

        // 2️⃣ Add partial (+80 / −30)
        let partialDelta = 0;
        for (const leg of legs) {
            // partial = not full win / not full lose
            if (Math.abs(leg.cashDelta) !== stake) {
                const percent = Math.abs(leg.cashDelta);
                const sign = leg.cashDelta > 0 ? 1 : -1;

                // 🔥 APPLY ON BASE, NOT STAKE
                partialDelta += base * (percent / 100) * sign;
            }
        }

        let payout = base + partialDelta;

        // 3️⃣ Apply commission
        if (payout > stake) {
            payout = Math.floor(payout * (1 - PARLAY_COMMISSION_RATE));
        }

        return {
            status: payout > stake ? "won" : "lost",
            payout,
            profit: payout - stake,
        };
    }

    // ================= INTERNATIONAL =================
    let payout = stake;
    for (const leg of legs) {
        payout *= leg.odds;
    }

    payout = Math.floor(payout);

    return {
        status: payout > 0 ? "won" : "lost",
        payout,
        profit: payout - stake,
    };
};

module.exports = {
    calculateLegOutcome,
    finalizeSlipSettlement,
};

const SCORING = require('./scoring');

function calculateMapScorePoints(predA, predB, resA, resB) {
    if (
        predA === null ||
        predB === null ||
        resA === null ||
        resB === null 
    ) {
        return SCORING.MAP.MISS;
    }

    const diffA = Math.abs(Number(predA) - Number(resA));
    const diffB = Math.abs(Number(predB) - Number(resB));

    if (diffA === 0 && diffB === 0) {
        return SCORING.MAP.EXACT;
    }

    if (diffA <= 1 && diffB <= 1) {
        return SCORING.MAP.DIFF_1;
    }

    if (diffA <= 2 && diffB <= 2) {
        return SCORING.MAP.DIFF_2;
    }

    return SCORING.MAP.MISS;
}

module.exports = {
    calculateMapScorePoints,
};
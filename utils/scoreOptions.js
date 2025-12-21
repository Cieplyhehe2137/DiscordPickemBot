// utils/scoreOptions.js

/**
 * Zwraca listę opcji do dropdowna wyniku, zależnie od BO.
 * value to A:B
 */

function scoreOptionsForBo(bestOf, teamA, teamB) {
    const bo = Number(bestOf);

    if (bo === 1) {
        return [
            { label: `1-0 ${teamA}`, value: '1:0' },
            { label: `0-1 ${teamB}`, value: '0:1' },
        ];
    }

    if (bo === 3) {
        return [
            { label: `2-0 ${teamA}`, value: '2:0' },
            { label: `2-1 ${teamA}`, value: '2:1' },
            { label: `0-2 ${teamB}`, value: '0:2' },
            { label: `1-2 ${teamB}`, value: '1:2' },
        ];
    }

    if (bo === 5) {
        return [
            { label: `3-0 ${teamA}`, value: '3:0' },
            { label: `3-1 ${teamA}`, value: '3-1' },
            { label: `3-2 ${teamA}`, value: '3-2' },
            { label: `0-3 ${teamB}`, value: '0-3' },
            { label: `1-3 ${teamB}`, value: '1-3' },
            { label: `2-3 ${teamB}`, value: '2-3' },
        ];
    }

    return [];
}

module.exports = { scoreOptionsForBo }
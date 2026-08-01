// Wybór dostawcy danych o wynikach. Warstwa istnieje po to, żeby podmiana
// dostawcy (albo dołożenie drugiego) nie wymagała dotykania endpointów ani
// logiki dopasowywania meczów.

const { createPandascoreProvider } = require('./pandascore');

function getResultProvider(env = process.env) {
    const nazwa = (env.RESULT_PROVIDER || '').trim().toLowerCase();

    if (!nazwa) return null;

    if (nazwa === 'pandascore') {
        return createPandascoreProvider({ token: env.PANDASCORE_TOKEN });
    }

    throw new Error(`Nieznany dostawca wyników: ${nazwa}`);
}

module.exports = { getResultProvider };

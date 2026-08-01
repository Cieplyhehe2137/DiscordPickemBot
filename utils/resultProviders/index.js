// Wybór dostawcy danych o wynikach. Warstwa istnieje po to, żeby podmiana
// dostawcy (albo dołożenie drugiego) nie wymagała dotykania endpointów ani
// logiki dopasowywania meczów.

const { createPandascoreProvider } = require('./pandascore');
const { createStubProvider } = require('./stub');

function getResultProvider(env = process.env) {
    const nazwa = (env.RESULT_PROVIDER || '').trim().toLowerCase();

    if (!nazwa) return null;

    if (nazwa === 'pandascore') {
        return createPandascoreProvider({ token: env.PANDASCORE_TOKEN });
    }

    // Atrapa do przećwiczenia przepływu bez klucza do prawdziwego API.
    if (nazwa === 'stub') {
        return createStubProvider({ fixturePath: env.RESULT_PROVIDER_FIXTURE });
    }

    throw new Error(`Nieznany dostawca wyników: ${nazwa}`);
}

module.exports = { getResultProvider };

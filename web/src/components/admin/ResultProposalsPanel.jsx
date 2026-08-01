import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import {
    getResultProposals,
    syncResultProposals,
    acceptResultProposal,
    rejectResultProposal,
    setEventExternalLink,
    describeActionError
} from '../../lib/api';
import EmptyState from '../ui/EmptyState';

export default function ResultProposalsPanel({ slug, onResultApplied }) {
    const [proposals, setProposals] = useState([]);
    const [externalId, setExternalId] = useState('');
    const [zapisanyExternalId, setZapisanyExternalId] = useState('');
    const [providerConfigured, setProviderConfigured] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [info, setInfo] = useState(null);
    const [reloadToken, setReloadToken] = useState(0);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setError(null);

                const data = await getResultProposals(slug);

                if (cancelled) return;

                setProposals(data.proposals || []);
                setExternalId(data.externalTournamentId || '');
                setZapisanyExternalId(data.externalTournamentId || '');
                setProviderConfigured(!!data.providerConfigured);
            } catch (err) {
                console.error(err);
                if (!cancelled) setError(describeActionError(err, 'wczytać propozycji wyników'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

        return () => { cancelled = true; };
    }, [slug, reloadToken]);

    const odswiez = () => setReloadToken((n) => n + 1);

    async function handleZapiszLink() {
        try {
            setBusy(true);
            setError(null);
            setInfo(null);

            await setEventExternalLink(slug, externalId.trim());

            setZapisanyExternalId(externalId.trim());
            setInfo('Powiązanie z turniejem zapisane.');
        } catch (err) {
            console.error(err);
            setError(describeActionError(err, 'zapisać powiązania turnieju'));
        } finally {
            setBusy(false);
        }
    }

    async function handleSync() {
        try {
            setBusy(true);
            setError(null);
            setInfo(null);

            const data = await syncResultProposals(slug);
            const s = data.summary || {};

            setProposals(data.proposals || []);

            const czesci = [`pobrano ${s.pobranych}`, `dopasowano ${s.zapisanych}`];

            if (s.nierozpoznaneDruzyny?.length) {
                czesci.push(`nierozpoznane drużyny: ${[...new Set(s.nierozpoznaneDruzyny)].join(', ')}`);
            }

            if (s.niejednoznaczne) {
                czesci.push(`${s.niejednoznaczne} pominięto jako niejednoznaczne`);
            }

            setInfo(czesci.join(' · '));
        } catch (err) {
            console.error(err);
            setError(describeActionError(err, 'pobrać wyników od dostawcy'));
        } finally {
            setBusy(false);
        }
    }

    async function handleZatwierdz(p) {
        const zmiana = p.obecny_res_a !== null && p.obecny_res_a !== undefined
            ? `\n\nUWAGA: mecz ma już wynik ${p.obecny_res_a}:${p.obecny_res_b}. Zostanie NADPISANY.`
            : '';

        const potwierdzone = window.confirm(
            `Zatwierdzić wynik ${p.team_a} ${p.res_a}:${p.res_b} ${p.team_b}?` +
            `\n\nPunkty graczy zostaną przeliczone od nowa.${zmiana}`
        );

        if (!potwierdzone) return;

        try {
            setBusy(true);
            setError(null);

            await acceptResultProposal(p.id);

            odswiez();
            onResultApplied?.();
        } catch (err) {
            console.error(err);
            setError(describeActionError(err, 'zatwierdzić propozycji'));
        } finally {
            setBusy(false);
        }
    }

    async function handleOdrzuc(p) {
        try {
            setBusy(true);
            setError(null);

            await rejectResultProposal(p.id);
            odswiez();
        } catch (err) {
            console.error(err);
            setError(describeActionError(err, 'odrzucić propozycji'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <h3 className="text-xl font-black">Propozycje wyników</h3>

            <p className="mt-1 text-sm text-white/50">
                Wyniki pobrane od zewnętrznego dostawcy. Nic nie zapisuje się samo —
                każdy wynik wpisujesz świadomie, bo zatwierdzenie przelicza punkty graczy.
            </p>

            {!providerConfigured && (
                <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-200">
                    Dostawca wyników nie jest skonfigurowany — ustaw <code>RESULT_PROVIDER</code> w <code>server/.env</code>.
                </div>
            )}

            <div className="mt-5 flex flex-wrap items-end gap-3">
                <label className="flex-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-white/40">
                        ID turnieju u dostawcy
                    </span>

                    <input
                        value={externalId}
                        onChange={(e) => setExternalId(e.target.value)}
                        placeholder="np. 15234"
                        className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm"
                    />
                </label>

                <button
                    onClick={handleZapiszLink}
                    disabled={busy || externalId.trim() === zapisanyExternalId}
                    className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-black text-white/80 transition hover:bg-white/10 disabled:opacity-40"
                >
                    Zapisz
                </button>

                <button
                    onClick={handleSync}
                    disabled={busy || !providerConfigured || !zapisanyExternalId}
                    className="flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3 font-black transition hover:bg-violet-400 disabled:opacity-40"
                >
                    <Download size={16} />
                    {busy ? 'Pracuję...' : 'Pobierz wyniki'}
                </button>
            </div>

            {error && (
                <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
                    {error}
                </div>
            )}

            {info && (
                <div className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-sm font-bold text-violet-200">
                    {info}
                </div>
            )}

            <div className="mt-5">
                {loading && <p className="text-white/50">Ładowanie propozycji...</p>}

                {!loading && proposals.length === 0 && (
                    <EmptyState
                        icon={Download}
                        title="Brak propozycji do zatwierdzenia"
                        description="Podaj ID turnieju u dostawcy i kliknij „Pobierz wyniki”."
                    />
                )}

                {!loading && proposals.map((p) => {
                    const maObecny = p.obecny_res_a !== null && p.obecny_res_a !== undefined;
                    const rozniSie = maObecny
                        && (Number(p.obecny_res_a) !== Number(p.res_a)
                            || Number(p.obecny_res_b) !== Number(p.res_b));

                    return (
                        <div
                            key={p.id}
                            className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4"
                        >
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                                    Mecz #{p.match_no} · {p.phase} · BO{p.best_of}
                                </p>

                                <p className="mt-1 text-lg font-black">
                                    {p.team_a} <span className="text-violet-300">{p.res_a}:{p.res_b}</span> {p.team_b}
                                </p>

                                {rozniSie && (
                                    <p className="mt-1 text-sm font-bold text-amber-300">
                                        Nadpisze obecny wynik {p.obecny_res_a}:{p.obecny_res_b}
                                    </p>
                                )}

                                {maObecny && !rozniSie && (
                                    <p className="mt-1 text-sm text-white/40">
                                        Zgodne z już wpisanym wynikiem
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleZatwierdz(p)}
                                    disabled={busy}
                                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-black transition hover:bg-emerald-400 disabled:opacity-40"
                                >
                                    Zatwierdź
                                </button>

                                <button
                                    onClick={() => handleOdrzuc(p)}
                                    disabled={busy}
                                    className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 disabled:opacity-40"
                                >
                                    Odrzuć
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

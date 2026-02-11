import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

type Summary = {
    name: string;
    phase: string;
    isOpen: boolean;
    participants: number;
    predictions: number;
    deadline: string;
    isAdmin: boolean;
};

type Leader = {
    user_id: string;
    total_points: number;
};




const PHASES = [
    "SWISS_STAGE_1",
    "SWISS_STAGE_2",
    "SWISS_STAGE_3",
    "PLAYOFFS",
    "FINISHED",
];

export default function EventDashboard() {
    const { slug } = useParams();

    const [data, setData] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState("");
    const [top, setTop] = useState<Leader[]>([]);


    const loadTop = async () => {
        if (!slug) return;

        const res = await fetch(
            `http://localhost:3301/api/dashboard/${slug}/top`
        );

        const json = await res.json();
        setTop(json);
    };


    const loadSummary = async () => {
        if (!slug) return;

        try {
            setLoading(true);
            setError(null);

            const res = await fetch(
                `http://localhost:3301/api/dashboard/${slug}/summary`
            );

            if (!res.ok) {
                throw new Error("Nie udało się pobrać danych");
            }

            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error(err);
            setError("Błąd ładowania eventu");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSummary();
        loadTop();
    }, [slug]);


    useEffect(() => {
        if (!data?.deadline) {
            setTimeLeft("");
            return;
        }

        const interval = setInterval(() => {
            const now = new Date().getTime();
            const end = new Date(data.deadline).getTime();
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft("Czas minął");
                clearInterval(interval);
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((diff / (1000 * 60)) % 60);
            const seconds = Math.floor((diff / 1000) % 60);

            setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        }, 1000);

        return () => clearInterval(interval);
    }, [data?.deadline]);


    const handleOpen = async () => {
        await fetch(
            `http://localhost:3301/api/dashboard/${slug}/open`,
            { method: "POST" }
        );
        loadSummary();
    };

    const handleClose = async () => {
        await fetch(
            `http://localhost:3301/api/dashboard/${slug}/close`,
            { method: "POST" }
        );
        loadSummary();
    };

    const handlePhaseChange = async (phase: string) => {
        await fetch(
            `http://localhost:3301/api/dashboard/${slug}/phase`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ phase }),
            }
        );

        loadSummary();
    };

    if (loading)
        return <div className="p-10 text-white">Ładowanie...</div>;

    if (error)
        return <div className="p-10 text-red-400">{error}</div>;

    if (!data)
        return <div className="p-10 text-white">Brak danych</div>;

    const currentIndex = PHASES.indexOf(data.phase);

    return (
        <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black p-12 animate-fade-in text-white">
            <div className="max-w-6xl mx-auto space-y-12">

                <div className="relative overflow-hidden rounded-3xl p-12
          bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent
          border border-indigo-500/30">

                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.3),_transparent_60%)]" />

                    <div className="relative z-10 space-y-4">
                        <h1 className="text-5xl font-extrabold tracking-tight">
                            {data.name}
                        </h1>

                        {timeLeft && (
                            <div className="text-indigo-400 text-lg font-mono tracking-wider">
                                ⏳ {timeLeft}
                            </div>
                        )}

                        <div className="flex items-center gap-4">
                            <span
                                className={`px-5 py-2 rounded-full text-sm font-semibold ${data.isOpen
                                    ? "bg-green-500/20 text-green-400 animate-pulse"
                                    : "bg-red-500/20 text-red-400"
                                    }`}
                            >
                                {data.isOpen ? "OPEN" : "CLOSED"}
                            </span>

                            <span className="text-gray-400">
                                Faza: <span className="text-white">{data.phase}</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="relative mt-8">
                    <div className="flex justify-between items-center relative">

                        <div className="absolute top-1/2 left-0 right-0 h-1 bg-zinc-800 -translate-y-1/2 rounded-full" />

                        {PHASES.map((phase, index) => {
                            const isActive = data.phase === phase;
                            const isCompleted =
                                currentIndex !== -1 && index < currentIndex;

                            return (
                                <div
                                    key={phase}
                                    className="relative z-10 flex flex-col items-center w-full"
                                >
                                    <div
                                        className={`w-6 h-6 rounded-full border-2 transition-all duration-300
                      ${isActive
                                                ? "bg-indigo-500 border-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.8)]"
                                                : isCompleted
                                                    ? "bg-green-500 border-green-400"
                                                    : "bg-zinc-900 border-zinc-600"
                                            }`}
                                    />

                                    <span
                                        className={`mt-3 text-xs font-medium
                      ${isActive
                                                ? "text-indigo-400"
                                                : isCompleted
                                                    ? "text-green-400"
                                                    : "text-zinc-500"
                                            }`}
                                    >
                                        {phase.replace(/_/g, " ")}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">

                    <div className="bg-zinc-900/70 backdrop-blur p-8 rounded-2xl border border-zinc-800">
                        <p className="text-gray-400">Uczestnicy</p>
                        <p className="text-2xl font-semibold">
                            {data.participants}
                        </p>
                    </div>

                    <div className="bg-zinc-900/70 backdrop-blur p-8 rounded-2xl border border-zinc-800">
                        <p className="text-gray-400">Predykcje</p>
                        <p className="text-2xl font-semibold">
                            {data.predictions}
                        </p>
                    </div>

                </div>

                <div className="space-y-6">
                    <h2 className="text-xl font-semibold text-yellow-400">
                        🏆 Top 5 Graczy
                    </h2>

                    <div className="space-y-4">
                        {top.map((player, index) => {
                            const isFirst = index === 0;
                            const isSecond = index === 1;
                            const isThird = index === 2;

                            return (
                                <div
                                    key={player.user_id}
                                    className={`flex justify-between items-center p-6 rounded-2xl transition-all duration-300
            ${isFirst
                                            ? "bg-yellow-500/10 border border-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.5)]"
                                            : isSecond
                                                ? "bg-zinc-300/5 border border-zinc-400"
                                                : isThird
                                                    ? "bg-orange-500/10 border border-orange-400"
                                                    : "bg-zinc-900/70 border border-zinc-800"
                                        }
          `}
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="text-xl font-bold w-8">
                                            {index + 1}.
                                        </span>
                                        <span>{player.user_id}</span>
                                    </div>

                                    <span className="font-semibold">
                                        {player.total_points} pkt
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>


                {data.isAdmin && (
                    <>
                        <div className="flex gap-4 pt-6">
                            <button
                                onClick={handleOpen}
                                className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 transition"
                            >
                                🔓 Otwórz
                            </button>

                            <button
                                onClick={handleClose}
                                className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 transition"
                            >
                                🔒 Zamknij
                            </button>
                        </div>

                        <div className="pt-6">
                            <select
                                value={data.phase}
                                onChange={(e) =>
                                    handlePhaseChange(e.target.value)
                                }
                                className="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700"
                            >
                                {PHASES.map((p) => (
                                    <option key={p} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
}

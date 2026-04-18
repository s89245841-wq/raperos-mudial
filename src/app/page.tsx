"use client";

import { useState, useCallback, useMemo, Fragment } from "react";

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
interface MatchData {
  id: string;
  participants: string[];
  type: "1v1" | "1v1v1";
}

interface RoundData {
  name: string;
  matches: MatchData[];
  hasTriples: boolean;
}

/* ═══════════════════════════════════════════════════
   Bracket Algorithm
   ═══════════════════════════════════════════════════ */
function isPowerOf2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

function findBestTarget(low: number, high: number): number {
  // Prefer powers of 2
  for (let t = low; t <= high; t++) {
    if (isPowerOf2(t)) return t;
  }
  // Fallback: closest to a power of 2 (prefer larger to minimize triples)
  let best = high;
  let bestScore = Infinity;
  for (let t = high; t >= low; t--) {
    let p = 1;
    while (p <= t) p *= 2;
    const score = Math.min(Math.abs(t - p), Math.abs(t - p / 2));
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

function nextRoundSize(n: number): number {
  if (n <= 1) return 0;
  if (isPowerOf2(n)) return n / 2;
  return findBestTarget(Math.ceil(n / 3), Math.floor(n / 2));
}

function countTotalRounds(n: number): number {
  let c = 0;
  while (n > 1) {
    n = nextRoundSize(n);
    c++;
  }
  return c;
}

const ROUND_NAMES_FROM_END = [
  "🏆 Final",
  "⚡ Semifinal",
  "🔥 Cuartos de Final",
  "💥 Octavos de Final",
  "🎯 Ronda de 16",
];

function getRoundName(
  pos: number,
  total: number,
  hasTriples: boolean
): string {
  if (pos === total - 1) return "🏆 Final";
  if (hasTriples) {
    const phaseNames = [
      "🎯 Primera Fase",
      "⚡ Segunda Fase",
      "🔥 Tercera Fase",
    ];
    return phaseNames[pos] || `Fase ${pos + 1}`;
  }
  const fromEnd = total - 1 - pos;
  if (fromEnd < ROUND_NAMES_FROM_END.length) return ROUND_NAMES_FROM_END[fromEnd];
  return `Ronda ${pos + 1}`;
}

function generateBracket(names: string[]): RoundData[] {
  if (names.length < 2) return [];
  const total = countTotalRounds(names.length);
  const rounds: RoundData[] = [];
  let cur = [...names];

  while (cur.length > 1) {
    const n = cur.length;
    const matches: MatchData[] = [];

    if (isPowerOf2(n)) {
      for (let i = 0; i < n; i += 2) {
        matches.push({
          id: `R${rounds.length}-M${i / 2}`,
          participants: [cur[i], cur[i + 1]],
          type: "1v1",
        });
      }
    } else {
      const target = findBestTarget(Math.ceil(n / 3), Math.floor(n / 2));
      const triples = n - 2 * target;
      const doubles = target - triples;
      let idx = 0;
      for (let i = 0; i < triples; i++, idx += 3) {
        matches.push({
          id: `R${rounds.length}-M${i}`,
          participants: [cur[idx], cur[idx + 1], cur[idx + 2]],
          type: "1v1v1",
        });
      }
      for (let i = 0; i < doubles; i++, idx += 2) {
        matches.push({
          id: `R${rounds.length}-M${triples + i}`,
          participants: [cur[idx], cur[idx + 1]],
          type: "1v1",
        });
      }
    }

    const hasTriples = matches.some((m) => m.type === "1v1v1");
    rounds.push({
      name: getRoundName(rounds.length, total, hasTriples),
      matches,
      hasTriples,
    });
    cur = matches.map((_, i) => `W${rounds.length - 1}-${i}`);
  }
  return rounds;
}

function resolveName(
  name: string,
  bracket: RoundData[],
  winners: Record<string, number>
): string | null {
  const m = name.match(/^W(\d+)-(\d+)$/);
  if (!m) return name;
  const ri = +m[1],
    mi = +m[2];
  const match = bracket[ri]?.matches[mi];
  if (!match) return null;
  const wi = winners[match.id];
  if (wi === undefined) return null;
  return resolveName(match.participants[wi], bracket, winners);
}

function getPlaceholderLabel(p: string): string {
  const m = p.match(/^W(\d+)-(\d+)$/);
  if (m) {
    const ri = +m[1],
      mi = +m[2];
    return `Ganador M${mi + 1}`;
  }
  return p;
}

/* ═══════════════════════════════════════════════════
   MatchCard Component
   ═══════════════════════════════════════════════════ */
function MatchCard({
  match,
  bracket,
  winners,
  onSelectWinner,
  matchNumber,
}: {
  match: MatchData;
  bracket: RoundData[];
  winners: Record<string, number>;
  onSelectWinner: (matchId: string, idx: number) => void;
  matchNumber: number;
}) {
  const selectedWinner = winners[match.id];
  const allResolved = match.participants.every(
    (p) => resolveName(p, bracket, winners) !== null
  );

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all duration-300 ${
        allResolved
          ? "bg-[#12121e] border-white/10"
          : "bg-[#0e0e18] border-white/5"
      }`}
    >
      {/* Match number badge */}
      <div className="px-3 py-1 bg-white/[0.03] border-b border-white/5">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          Match {matchNumber}
          {match.type === "1v1v1" && (
            <span className="ml-1.5 text-amber-400">Triple</span>
          )}
        </span>
      </div>

      {match.participants.map((p, i) => {
        const resolvedName = resolveName(p, bracket, winners);
        const isWinner = selectedWinner === i;
        const display = resolvedName || getPlaceholderLabel(p);

        return (
          <div key={i}>
            {i > 0 && (
              <div className="flex items-center px-3 py-0">
                <div className="flex-1 border-t border-white/[0.04]" />
                <span className="px-2 text-[9px] text-zinc-600 font-black tracking-widest">
                  VS
                </span>
                <div className="flex-1 border-t border-white/[0.04]" />
              </div>
            )}
            <button
              onClick={() => allResolved && onSelectWinner(match.id, i)}
              disabled={!allResolved}
              className={`w-full text-left px-3 py-2 text-sm transition-all duration-200 ${
                !allResolved
                  ? "cursor-default text-zinc-600"
                  : isWinner
                  ? "bg-violet-500/20 text-violet-200 font-semibold cursor-pointer"
                  : "hover:bg-white/[0.04] text-zinc-300 cursor-pointer"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] border transition-all duration-200 ${
                    isWinner
                      ? "bg-violet-500 border-violet-400 text-white"
                      : allResolved
                      ? "border-zinc-600 text-zinc-500"
                      : "border-zinc-700 text-zinc-700"
                  }`}
                >
                  {isWinner ? "✓" : i + 1}
                </span>
                <span className="truncate">{display}</span>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════ */
export default function Home() {
  /* ─── HIP/HOP State ─── */
  const [text1, setText1] = useState("");
  const [text2, setText2] = useState("");
  const [hipResult, setHipResult] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showResult, setShowResult] = useState(false);

  /* ─── LLAVES State ─── */
  const [numP, setNumP] = useState(8);
  const [names, setNames] = useState<string[]>(() =>
    Array.from({ length: 8 }, (_, i) => `Participante ${i + 1}`)
  );
  const initialBracket = useMemo(
    () =>
      generateBracket(
        Array.from({ length: 8 }, (_, i) => `Participante ${i + 1}`)
      ),
    []
  );
  const [bracket, setBracket] = useState<RoundData[]>(initialBracket);
  const [winners, setWinners] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);

  /* ─── Handlers ─── */
  const regenerate = useCallback((newNames: string[]) => {
    setBracket(generateBracket(newNames));
    setWinners({});
  }, []);

  const handleCountChange = useCallback(
    (newCount: number) => {
      const clamped = Math.max(2, Math.min(32, newCount));
      setNumP(clamped);
      const newNames = Array.from({ length: clamped }, (_, i) =>
        names[i] || `Participante ${i + 1}`
      ).slice(0, clamped);
      setNames(newNames);
      regenerate(newNames);
    },
    [names, regenerate]
  );

  const handleNameChange = useCallback((idx: number, value: string) => {
    setNames((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }, []);

  const handleGenerate = useCallback(() => {
    regenerate(names);
  }, [names, regenerate]);

  const copyBracketText = useCallback(() => {
    if (bracket.length === 0) return;
    const lines: string[] = [];
    lines.push("🏆 Raperos Mudial — Llaves del Torneo");
    lines.push("═".repeat(40));
    lines.push("");
    bracket.forEach((round, ri) => {
      lines.push(`📋 ${round.name.toUpperCase()}`);
      lines.push("─".repeat(30));
      round.matches.forEach((match, mi) => {
        const label = `  Enfrentamiento ${mi + 1}:`;
        if (match.type === "1v1v1") {
          const parts = match.participants.map((p, pi) => {
            const marker = winners[match.id] === pi ? " ✅" : "";
            return `${p}${marker}`;
          });
          lines.push(`${label}`);
          lines.push(`    ${parts.join("  vs  ")}`);
        } else {
          const p1 = match.participants[0];
          const p2 = match.participants[1];
          const w1 = winners[match.id] === 0 ? " ✅" : "";
          const w2 = winners[match.id] === 1 ? " ✅" : "";
          lines.push(`${label} ${p1}${w1} vs ${p2}${w2}`);
        }
      });
      lines.push("");
    });
    const lastRound = bracket[bracket.length - 1];
    const finalMatch = lastRound?.matches[0];
    if (finalMatch && winners[finalMatch.id] !== undefined) {
      const champ = finalMatch.participants[winners[finalMatch.id]];
      lines.push("🏆🏆🏆 CAMPEÓN: " + champ + " 🏆🏆🏆");
    }
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [bracket, winners]);

  const handleShuffle = useCallback(() => {
    const shuffled = [...names];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setNames(shuffled);
    regenerate(shuffled);
  }, [names, regenerate]);

  const handleSelectWinner = useCallback(
    (matchId: string, idx: number) => {
      setWinners((prev) => {
        const next = { ...prev, [matchId]: idx };
        const m = matchId.match(/^R(\d+)/);
        if (m) {
          const roundIdx = +m[1];
          for (let r = roundIdx + 1; r < bracket.length; r++) {
            for (const match of bracket[r].matches) {
              delete next[match.id];
            }
          }
        }
        return next;
      });
    },
    [bracket]
  );

  /* ─── Champion ─── */
  const champion = useMemo(() => {
    if (bracket.length === 0) return null;
    const lastRound = bracket[bracket.length - 1];
    if (lastRound.matches.length !== 1) return null;
    const finalMatch = lastRound.matches[0];
    const wi = winners[finalMatch.id];
    if (wi === undefined) return null;
    return resolveName(finalMatch.participants[wi], bracket, winners);
  }, [bracket, winners]);

  /* ─── Random HIP/HOP ─── */
  const handleEmpezar = useCallback(() => {
    if (!text1.trim() || !text2.trim() || isAnimating) return;
    setIsAnimating(true);
    setShowResult(false);

    const winnerIdx = Math.random() < 0.5 ? 0 : 1;
    const texts = [text1.trim(), text2.trim()];
    const winner = texts[winnerIdx];
    let step = 0;
    const maxSteps = 16;

    const tick = () => {
      const displayIdx =
        step >= maxSteps - 3 ? winnerIdx : step % 2;
      setHipResult(texts[displayIdx]);
      step++;

      if (step >= maxSteps) {
        setHipResult(winner);
        setIsAnimating(false);
        setTimeout(() => setShowResult(true), 60);
        return;
      }

      const delay = 40 + Math.pow(step, 1.9) * 3.5;
      setTimeout(tick, delay);
    };
    tick();
  }, [text1, text2, isAnimating]);

  /* ─── Confetti positions (deterministic) ─── */
  const confetti = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        left: `${(i * 37 + 13) % 100}%`,
        top: `${(i * 43 + 7) % 100}%`,
        color: ["#8b5cf6", "#ec4899", "#06b6d4", "#22c55e", "#f59e0b"][
          i % 5
        ],
        delay: `${i * 0.12}s`,
        duration: `${1.5 + (i % 3) * 0.4}s`,
        size: 4 + (i % 3) * 2,
      })),
    []
  );

  /* ─── Match counter for numbering ─── */
  const matchCounters = useMemo(() => {
    let counter = 1;
    return bracket.map((round) =>
      round.matches.map(() => counter++)
    );
  }, [bracket]);

  /* ═══════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#0a0a12] text-white relative overflow-x-hidden">
      {/* Background decorative orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/[0.07] blur-[120px]" />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full bg-pink-600/[0.05] blur-[100px]" />
        <div className="absolute -bottom-40 right-1/3 w-[450px] h-[450px] rounded-full bg-cyan-600/[0.04] blur-[110px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a12]/80 border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center text-lg shadow-lg shadow-violet-500/20">
              🎤
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold bg-gradient-to-r from-violet-400 via-pink-400 to-violet-400 bg-clip-text text-transparent">
                Raperos Mudial
              </h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-medium">
                Freestyle Tournament
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-zinc-600">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            En vivo
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-20 space-y-6 sm:space-y-8">
        {/* ══════════ HIP/HOP Section ══════════ */}
        <section
          className="rounded-2xl bg-[#12121e]/80 backdrop-blur-sm border border-white/[0.06] overflow-hidden"
          style={{ animation: "slide-up 0.5s ease-out" }}
        >
          {/* Section Header */}
          <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-white/[0.04]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/20 flex items-center justify-center text-sm">
                🎵
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  HIP/HOP
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Selecciona aleatoriamente entre dos opciones
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 sm:px-6 py-5 sm:py-6 space-y-5">
            {/* Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Opción 1
                </label>
                <input
                  type="text"
                  value={text1}
                  onChange={(e) => setText1(e.target.value)}
                  placeholder="Ingresa un nombre o frase..."
                  className="w-full px-4 py-3 rounded-xl bg-[#0a0a14] border border-white/[0.08] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Opción 2
                </label>
                <input
                  type="text"
                  value={text2}
                  onChange={(e) => setText2(e.target.value)}
                  placeholder="Ingresa un nombre o frase..."
                  className="w-full px-4 py-3 rounded-xl bg-[#0a0a14] border border-white/[0.08] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                />
              </div>
            </div>

            {/* Button */}
            <div className="flex justify-center">
              <button
                onClick={handleEmpezar}
                disabled={!text1.trim() || !text2.trim() || isAnimating}
                className={`px-10 py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-300 ${
                  !text1.trim() || !text2.trim() || isAnimating
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-violet-600 to-pink-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98]"
                }`}
              >
                {isAnimating ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Seleccionando...
                  </span>
                ) : (
                  "🎯 Empezar"
                )}
              </button>
            </div>

            {/* Result */}
            {hipResult && (
              <div
                className={`mt-2 p-5 sm:p-6 rounded-xl border text-center transition-all duration-500 ${
                  showResult
                    ? "bg-gradient-to-br from-violet-500/10 to-pink-500/10 border-violet-500/30"
                    : "bg-[#0a0a14] border-white/[0.06]"
                }`}
                style={
                  showResult
                    ? { animation: "winner-reveal 0.6s ease-out" }
                    : undefined
                }
              >
                <p className="text-[10px] font-bold text-violet-400 uppercase tracking-[0.25em] mb-2">
                  {showResult ? "✨ Resultado" : "Seleccionando..."}
                </p>
                <p
                  className={`text-xl sm:text-2xl font-extrabold transition-all duration-300 ${
                    showResult
                      ? "bg-gradient-to-r from-violet-300 via-pink-300 to-violet-300 bg-clip-text text-transparent"
                      : "text-zinc-300"
                  }`}
                >
                  {hipResult}
                </p>
                {showResult && (
                  <div className="mt-3 flex justify-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className="text-lg"
                        style={{ animationDelay: `${i * 0.1}s` }}
                      >
                        ⭐
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ══════════ LLAVES Section ══════════ */}
        <section
          className="rounded-2xl bg-[#12121e]/80 backdrop-blur-sm border border-white/[0.06] overflow-hidden"
          style={{ animation: "slide-up 0.6s ease-out" }}
        >
          {/* Section Header */}
          <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-white/[0.04]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/20 flex items-center justify-center text-sm">
                🏆
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  LLAVES
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Sistema dinámico de brackets de freestyle
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 sm:px-6 py-5 sm:py-6 space-y-5">
            {/* Controls Row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Counter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Participantes:
                </span>
                <div className="flex items-center bg-[#0a0a14] rounded-xl border border-white/[0.08] overflow-hidden">
                  <button
                    onClick={() => handleCountChange(numP - 1)}
                    className="px-3 py-2 text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors font-bold text-lg"
                  >
                    −
                  </button>
                  <span className="px-4 py-2 text-lg font-bold text-white min-w-[3rem] text-center tabular-nums">
                    {numP}
                  </span>
                  <button
                    onClick={() => handleCountChange(numP + 1)}
                    className="px-3 py-2 text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors font-bold text-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-1.5">
                {[4, 6, 8, 12, 16].map((n) => (
                  <button
                    key={n}
                    onClick={() => handleCountChange(n)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      numP === n
                        ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                        : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={handleShuffle}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all flex items-center gap-1.5"
                >
                  🔀 Mezclar
                </button>
                <button
                  onClick={handleGenerate}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-xs font-bold text-white shadow-md shadow-violet-500/20 hover:shadow-violet-500/30 transition-all flex items-center gap-1.5"
                >
                  ⚡ Generar
                </button>
                <button
                  onClick={copyBracketText}
                  disabled={bracket.length === 0}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    copied
                      ? "bg-emerald-600/20 border border-emerald-500/30 text-emerald-400"
                      : bracket.length === 0
                        ? "bg-white/[0.02] border border-white/[0.04] text-zinc-600 cursor-not-allowed"
                        : "bg-white/[0.04] border border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.08]"
                  }`}
                >
                  {copied ? "✅ Copiado" : "📋 Copiar"}
                </button>
              </div>
            </div>

            {/* Participant Names Grid */}
            <div>
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Nombres de participantes
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {names.slice(0, numP).map((name, i) => (
                  <div key={i} className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-600">
                      {i + 1}.
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(i, e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-[#0a0a14] border border-white/[0.06] text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-all"
                      placeholder={`Participante ${i + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Bracket Info */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                {bracket.length} rondas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                {bracket.reduce((acc, r) => acc + r.matches.length, 0)}{" "}
                enfrentamientos
              </span>
              {bracket.some((r) => r.hasTriples) && (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Incluye rondas triples (1v1v1)
                </span>
              )}
            </div>

            {/* Bracket Display */}
            <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6 pb-2">
              <div className="flex gap-3 sm:gap-4 min-w-max items-stretch">
                {bracket.map((round, ri) => (
                  <Fragment key={ri}>
                    {ri > 0 && (
                      <div className="flex items-center justify-center px-1">
                        <svg
                          className="w-5 h-5 text-violet-500/20 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    )}
                    <div className="flex flex-col min-w-[200px] sm:min-w-[230px]">
                      {/* Round Header */}
                      <div className="text-center mb-3">
                        <span className="inline-block px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                          {round.name}
                        </span>
                      </div>
                      {/* Matches */}
                      <div className="flex-1 flex flex-col justify-around gap-3">
                        {round.matches.map((match, mi) => (
                          <MatchCard
                            key={match.id}
                            match={match}
                            bracket={bracket}
                            winners={winners}
                            onSelectWinner={handleSelectWinner}
                            matchNumber={matchCounters[ri][mi]}
                          />
                        ))}
                      </div>
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>

            {/* Scroll hint for mobile */}
            {bracket.length > 2 && (
              <p className="text-[10px] text-zinc-600 text-center sm:hidden">
                ← Desliza para ver todas las rondas →
              </p>
            )}

            {/* Champion Display */}
            {champion && (
              <div
                className="relative mt-6 rounded-2xl overflow-hidden"
                style={{ animation: "slide-up 0.5s ease-out" }}
              >
                {/* Confetti */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {confetti.map((c, i) => (
                    <div
                      key={i}
                      className="absolute rounded-full animate-ping"
                      style={{
                        left: c.left,
                        top: c.top,
                        width: c.size,
                        height: c.size,
                        backgroundColor: c.color,
                        animationDelay: c.delay,
                        animationDuration: c.duration,
                        opacity: 0.6,
                      }}
                    />
                  ))}
                </div>

                {/* Champion Card */}
                <div
                  className="relative p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-violet-500/15 via-pink-500/10 to-amber-500/15 border border-violet-500/30 text-center"
                  style={{
                    animation: "celebrate 2s ease-in-out infinite",
                    animationDelay: "0.5s",
                  }}
                >
                  <div
                    className="text-5xl sm:text-6xl mb-3"
                    style={{ animation: "float 3s ease-in-out infinite" }}
                  >
                    🏆
                  </div>
                  <h3 className="text-sm text-violet-400 font-bold uppercase tracking-[0.2em] mb-1">
                    ¡Campeón del Mundial!
                  </h3>
                  <p className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-violet-300 via-pink-300 to-amber-300 bg-clip-text text-transparent">
                    {champion}
                  </p>
                  <div className="mt-4 flex justify-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-xl">
                        ⭐
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Reset button when bracket is in progress */}
            {!champion && bracket.length > 0 && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => regenerate(names)}
                  className="px-5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-semibold text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
                >
                  🔄 Reiniciar Selecciones
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-white/[0.04] py-6 text-center">
        <p className="text-[11px] text-zinc-600">
          🎤 <span className="text-zinc-500 font-semibold">Raperos Mudial</span>{" "}
          — Freestyle Tournament System
        </p>
      </footer>
    </div>
  );
}

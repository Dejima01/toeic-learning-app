interface StreakInfoProps {
  onClose: () => void;
}

const RULES: { swatch: string; label: string; effect: string; effectClass: string }[] = [
  { swatch: 'metal-gold', label: '金・銀：復習を1問以上解いた', effect: '+1日', effectClass: 'text-emerald-600 dark:text-emerald-400' },
  { swatch: 'bg-gray-200 dark:bg-gray-700', label: '灰色：復習がなかった', effect: '維持', effectClass: 'text-gray-600 dark:text-gray-300' },
  { swatch: 'metal-copper', label: '銅：復習に手をつけなかった', effect: '途切れる', effectClass: 'text-red-500 dark:text-red-400' },
  { swatch: 'border border-dashed border-gray-300 dark:border-gray-600', label: '色なし：アプリを開かなかった', effect: '途切れる', effectClass: 'text-red-500 dark:text-red-400' },
];

/** カレンダータブの ⓘ で開く説明。開いている間はカレンダーの代わりに表示する */
export function StreakInfo({ onClose }: StreakInfoProps) {
  return (
    <section aria-labelledby="streak-info-title" className="flex flex-col px-4 py-4">
      <h2 id="streak-info-title" className="mb-3 text-lg font-bold text-gray-800 dark:text-gray-100">
        カレンダーの見方
      </h2>

      <section className="mb-4">
        <h3 className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-200">連続日数の数え方</h3>
        <ul className="space-y-1.5">
          {RULES.map((r) => (
            <li key={r.label} className="flex items-center gap-2 text-sm">
              <span className={`h-4 w-4 shrink-0 rounded ${r.swatch}`} />
              <span className="flex-1 text-gray-700 dark:text-gray-300">{r.label}</span>
              <span className={`shrink-0 font-bold ${r.effectClass}`}>{r.effect}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          金は「全部やった」、銀は「途中でやめた」日です。どちらも +1 されます。
        </p>
      </section>

      <section className="mb-4 space-y-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">ポイント</h3>
        <p>・今日はまだ途中なので、日付が変わるまでは<strong>昨日までの日数</strong>を表示します。</p>
        <p>・復習がない日も、<strong>アプリを開けば連続が続きます</strong>。開かなかった日は途切れます。</p>
        <p>・<strong>最長記録</strong>は、これまでで一番長く続いた連続日数です。</p>
        <p>・ホームの 🔥◯日 も同じ数え方です。</p>
      </section>

      <button
        type="button"
        onClick={onClose}
        className="w-full rounded bg-gray-200 py-3 font-bold text-gray-800 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
      >
        カレンダーに戻る
      </button>
    </section>
  );
}

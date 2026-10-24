/** 正規表現のメタ文字をエスケープする（"attribute A to B" の括弧などで例外にならないように） */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 例文中の対象単語を太字にする */
export function HighlightedSentence({ sentence, word }: { sentence: string; word: string }) {
  // 句や複合語（"attribute A to B" など）に対応するため最初の1単語だけ照合
  const baseWord = word.split(' ')[0];
  const parts = sentence.split(new RegExp(`(${escapeRegExp(baseWord)})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === baseWord.toLowerCase() ? (
          <strong key={i}>{part}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

interface FilledQuestionTextProps {
  /** 空欄を含む問題文（例: "Please respond to this email ______ 48 hours."） */
  questionText: string;
  /** 空欄に入る正解 */
  answer: string;
}

/**
 * 問題文の空欄（連続するアンダースコア）を正解で埋め、その部分に下線を引いて表示する。
 * 空欄が見つからない場合は問題文の末尾に正解を添える。
 */
export function FilledQuestionText({ questionText, answer }: FilledQuestionTextProps) {
  const filled = (
    <span className="font-bold underline decoration-2 underline-offset-4">{answer}</span>
  );

  const blank = questionText.match(/_{2,}/);
  if (!blank || blank.index === undefined) {
    return (
      <>
        {questionText} （{filled}）
      </>
    );
  }

  return (
    <>
      {questionText.slice(0, blank.index)}
      {filled}
      {questionText.slice(blank.index + blank[0].length)}
    </>
  );
}

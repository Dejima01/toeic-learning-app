export interface GrammarQuestion {
  id: string;
  question_text: string;
  choices: string[];
  correct_index: number;
  explanation: string;
  translation: string;
  level: number;
  chapter_num: number;
}

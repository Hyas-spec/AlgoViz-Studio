import { Formula } from './Formula';
import type { AnswerPayload } from '../lib/ai/answer';

interface AnswerCardProps {
  answer: AnswerPayload;
  onFollowup?: (text: string) => void;
}

/** 纯讲解模式：右页不再画图，用一张纸质问答卡承载结论、要点与追问。 */
export function AnswerCard({ answer, onFollowup }: AnswerCardProps) {
  return (
    <div className="answer-card">
      <div className="answer-kicker">AI 助教 / CONCEPT NOTE</div>
      <h2>{answer.title}</h2>
      <p className="answer-summary">{answer.summary}</p>

      {answer.formula ? (
        <div className="answer-formula" aria-label="公式">
          <Formula tex={answer.formula} />
        </div>
      ) : null}

      <ol className="answer-points">
        {answer.points.map((point, index) => (
          <li key={`${index}-${point.slice(0, 12)}`}>
            <b>{String(index + 1).padStart(2, '0')}</b>
            <span>{point}</span>
          </li>
        ))}
      </ol>

      {answer.code && answer.code.length > 0 ? (
        <pre className="answer-code">{answer.code.join('\n')}</pre>
      ) : null}

      <div className="answer-followups">
        <span>继续问</span>
        {answer.followups.map((followup) => (
          <button
            key={followup}
            type="button"
            onClick={() => onFollowup?.(followup)}
            title={onFollowup ? '把这个问题填进输入框' : undefined}
          >
            {followup}
          </button>
        ))}
      </div>
    </div>
  );
}

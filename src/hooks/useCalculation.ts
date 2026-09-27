import { useEffect, useState } from 'react';
import type { CalculationInputs, CalculationKind, CalculationReply } from '../engine/calculation';
import { startCalculation } from '../engine/calculationClient';

export function useCalculation<K extends CalculationKind>(kind: K, input: CalculationInputs[K] | null) {
  // analysisContext는 렌더마다 새 객체다. 값이 같으면 계산을 다시 시작하지 않는다.
  const key = input === null ? null : JSON.stringify(input);
  const [completed, setCompleted] = useState<{ kind: K; key: string; reply: CalculationReply<K> } | null>(null);
  useEffect(() => {
    if (key === null) return;
    return startCalculation(kind, JSON.parse(key) as CalculationInputs[K], (reply) => {
      setCompleted({ kind, key, reply });
    });
  }, [kind, key]);

  // effect가 실행되기 전 렌더에서도 이전 설정의 수치를 노출하지 않는다.
  const reply = completed?.kind === kind && completed.key === key ? completed.reply : null;
  return {
    result: reply && 'result' in reply ? reply.result : null,
    loading: key !== null && reply === null,
    error: reply !== null && 'error' in reply,
  };
}

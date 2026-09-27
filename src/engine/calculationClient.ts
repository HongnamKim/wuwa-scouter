import type { CalculationKind, CalculationInputs, CalculationReply } from './calculation';

/** 요청마다 Worker를 소유해 설정 변경/화면 이탈 시 실행 중인 계산까지 중단한다. */
export function startCalculation<K extends CalculationKind>(
  kind: K, input: CalculationInputs[K], onReply: (reply: CalculationReply<K>) => void,
): () => void {
  let worker: Worker | undefined;
  let active = true;
  const cancel = () => {
    active = false;
    worker?.terminate();
  };
  const finish = (reply: CalculationReply<K>) => {
    if (!active) return;
    cancel();
    onReply(reply);
  };
  try {
    worker = new Worker(new URL('./calculation.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<CalculationReply<K>>) => finish(event.data);
    worker.onerror = () => finish({ error: true });
    worker.onmessageerror = () => finish({ error: true });
    worker.postMessage({ kind, input });
  } catch {
    finish({ error: true });
  }
  return cancel;
}

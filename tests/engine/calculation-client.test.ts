import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startCalculation } from '../../src/engine/calculationClient';
import { calculate, type CalculationReply, type CalculationRequest } from '../../src/engine/calculation';
import { hiyukiBaseCtx } from './fixtures';

// 브라우저 Worker 경계만 대체한다. 계산에는 실제 엔진과 구조화 복제를 사용한다.
class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: { data: CalculationReply }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  request!: CalculationRequest;
  terminated = false;
  constructor() { TestWorker.instances.push(this); }
  postMessage(request: CalculationRequest) { this.request = structuredClone(request); }
  terminate() { this.terminated = true; }
  complete() { this.onmessage?.({ data: structuredClone({ result: calculate(this.request) }) }); }
}

beforeEach(() => {
  TestWorker.instances = [];
  vi.stubGlobal('Worker', TestWorker);
});
afterEach(() => vi.unstubAllGlobals());

describe('비동기 계산 수명', () => {
  it('시작할 때 계산을 실행하지 않고 Worker 응답이 도착하면 수치를 전달한다', () => {
    const replies: CalculationReply<'scores'>[] = [];
    startCalculation('scores', hiyukiBaseCtx(), (reply) => replies.push(reply));
    expect(replies).toEqual([]);
    const worker = TestWorker.instances[0];
    worker.complete();
    const reply = replies[0];
    expect('result' in reply && reply.result.mine).toBeCloseTo(13229, 0);
    expect('result' in reply && reply.result.best.perf).toBeGreaterThan(22000);
    expect(worker.terminated).toBe(true);
  });

  it('새 설정의 결과가 도착한 뒤 이전 요청의 늦은 응답은 무시한다', () => {
    const values: string[] = [];
    const cancel = startCalculation('scores', hiyukiBaseCtx(), () => values.push('old'));
    const oldWorker = TestWorker.instances[0];
    cancel();
    startCalculation('scores', { ...hiyukiBaseCtx(), ascensionLevel: 6 }, () => values.push('new'));
    TestWorker.instances[1].complete();
    oldWorker.complete();
    expect(values).toEqual(['new']);
    expect(oldWorker.terminated).toBe(true);
  });

  it('화면 이탈이나 StrictMode 정리 후에는 상태를 갱신하지 않는다', () => {
    const replies: CalculationReply<'scores'>[] = [];
    const cancel = startCalculation('scores', hiyukiBaseCtx(), (reply) => replies.push(reply));
    cancel();
    TestWorker.instances[0].complete();
    expect(replies).toEqual([]);
  });

  it.each(['onerror', 'onmessageerror'] as const)('%s가 나면 대기 대신 실패 상태로 끝낸다', (event) => {
    const replies: CalculationReply<'scores'>[] = [];
    startCalculation('scores', hiyukiBaseCtx(), (reply) => replies.push(reply));
    TestWorker.instances[0][event]?.();
    expect(replies).toEqual([{ error: true }]);
    expect(TestWorker.instances[0].terminated).toBe(true);
  });

  it('Worker를 시작할 수 없어도 무한 대기하지 않는다', () => {
    vi.stubGlobal('Worker', class { constructor() { throw new Error('blocked'); } });
    const replies: CalculationReply<'scores'>[] = [];
    startCalculation('scores', hiyukiBaseCtx(), (reply) => replies.push(reply));
    expect(replies).toEqual([{ error: true }]);
  });
});

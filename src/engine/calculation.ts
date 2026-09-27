import type { CalcContext } from './context';
import { buildPerfInput } from './build';
import { computePerf } from './perf';
import { theoryBest, kkjakReferencePerf, kkjakPerf, optimalThreeCoModeKkjak, threeCoModeOptions, mainRecommendation, twoPieceRecommendationGroups } from './theory';

function scores(ctx: CalcContext) {
  return {
    mine: computePerf(buildPerfInput(ctx)),
    best: theoryBest(ctx),
    kkjak: kkjakReferencePerf(ctx),
    mode: optimalThreeCoModeKkjak(ctx),
    modes: Object.fromEntries(threeCoModeOptions(ctx).map(({ value }) => [value, kkjakPerf(ctx, value)])),
  };
}

export interface CalculationInputs {
  scores: CalcContext;
  main: CalcContext;
  twoPiece: CalcContext;
  roster: Record<string, CalcContext>;
}

export interface CalculationResults {
  scores: ReturnType<typeof scores>;
  main: ReturnType<typeof mainRecommendation>;
  twoPiece: ReturnType<typeof twoPieceRecommendationGroups>;
  roster: Record<string, { primary: string; secondary: string }>;
}

export type CalculationKind = keyof CalculationInputs;
export type CalculationRequest = {
  [K in CalculationKind]: { kind: K; input: CalculationInputs[K] }
}[CalculationKind];
export type CalculationReply<K extends CalculationKind = CalculationKind> =
  { result: CalculationResults[K] } | { error: true };

/** localStorage 해석은 화면에서 끝내고, 순수 계산만 Worker에서 실행한다. */
export function calculate(request: CalculationRequest): CalculationResults[CalculationKind] {
  switch (request.kind) {
    case 'scores': return scores(request.input);
    case 'main': return mainRecommendation(request.input);
    case 'twoPiece': return twoPieceRecommendationGroups(request.input);
    case 'roster': return Object.fromEntries(Object.entries(request.input).map(([id, ctx]) => {
      const mine = computePerf(buildPerfInput(ctx));
      return [id, {
        primary: `${(mine / kkjakReferencePerf(ctx) * 100).toFixed(1)}%`,
        secondary: `${(mine / theoryBest(ctx).perf * 100).toFixed(1)}%`,
      }];
    }));
  }
}

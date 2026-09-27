import { calculate, type CalculationRequest, type CalculationReply } from './calculation';

self.onmessage = ({ data }: MessageEvent<CalculationRequest>) => {
  let reply: CalculationReply;
  try {
    reply = { result: calculate(data) };
  } catch {
    reply = { error: true };
  }
  self.postMessage(reply);
};

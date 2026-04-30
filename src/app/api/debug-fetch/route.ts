import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  const mod = await import('yahoo-finance2');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = mod as any;
  const YF = m.default;

  const ownNames = Object.getOwnPropertyNames(YF);
  const protoNames = YF.prototype ? Object.getOwnPropertyNames(YF.prototype) : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instance = new YF() as any;
  const instanceNames = Object.getOwnPropertyNames(instance);

  // Walk up prototype chain of instance
  const chain: string[] = [];
  let proto = Object.getPrototypeOf(instance);
  while (proto && proto !== Object.prototype) {
    chain.push(...Object.getOwnPropertyNames(proto));
    proto = Object.getPrototypeOf(proto);
  }

  return NextResponse.json({
    ownNames,
    protoNames,
    instanceNames,
    protoChain: [...new Set(chain)],
    toStr: YF.toString().slice(0, 200),
  });
}

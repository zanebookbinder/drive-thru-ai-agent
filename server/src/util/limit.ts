export type Limiter = <T>(fn: () => Promise<T>) => Promise<T>;

export function limitConcurrency(max: number): Limiter {
  let active = 0;
  const queue: Array<() => void> = [];

  const release = () => {
    active -= 1;
    const resume = queue.shift();
    if (resume) resume();
  };

  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active += 1;
    try {
      return await fn();
    } finally {
      release();
    }
  };
}

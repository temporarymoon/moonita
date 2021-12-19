import { useEffect } from "preact/hooks";

/** Lazy effectful computation */
export type Effect<T> = () => T;

/** A stream implementation which tracks effects */
export type ForeignStream<T> = (
  emit: (value: T) => Effect<void>
) => Effect<Effect<void>>;

/** A stream implementation whch does not track effects (the return effect is a canceler) */
export type Stream<T> = (emit: (value: T) => void) => Effect<void>;

/** Create a stream and a function to push values onto that stream. */
export const create = <T>(): [Stream<T>, (value: T) => void] => {
  const subscribed = new Set<(value: T) => void>();

  const emit = (value: T) => {
    for (const subscriber of subscribed) {
      subscriber(value);
    }
  };

  const stream: Stream<T> = (emit) => {
    subscribed.add(emit);

    return () => {
      subscribed.delete(emit);
    };
  };

  return [stream, emit];
};

/** Subscribe to a stream inside a component (taking care of cancelation) */
export const useStream = <T>(stream: Stream<T>, handler: (v: T) => void) => {
  useEffect(() => stream(handler), []);
};

/** Transform a purescript stream into a typescript one */
export const streamFromForeign =
  <T>(foreign: ForeignStream<T>): Stream<T> =>
  (emit) =>
    foreign((v) => () => emit(v))();

/** Transform a typescript stream into a purescript one */
export const streamToForeign =
  <T>(familiar: Stream<T>): ForeignStream<T> =>
  (emit) =>
  () =>
    familiar((v) => emit(v)());

/**
 * Takes a stream of streams and flattens it into a simple stream
 * which emits the values emitted by the last stream emitted by the initial stream.
 *
 * @param stream The stream to perform the flattening on.
 * @returns A stream which emits the values of the last stream emitted by the input.
 */
export const flat = <T>(stream: Stream<Stream<T>>): Stream<T> => {
  return (emit) => {
    let canceller: Effect<void> | null = null;

    return () => {
      stream((current) => {
        if (canceller) canceller();

        canceller = current((value) => {
          emit(value);
        });
      });

      if (canceller) canceller();
    };
  };
};

/** Map all incoming values from a stream */
export const map =
  <A, B>(f: (a: A) => B, stream: Stream<A>): Stream<B> =>
  (emit) =>
    stream((v) => emit(f(v)));

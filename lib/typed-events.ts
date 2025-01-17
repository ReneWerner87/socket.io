import { EventEmitter } from "events";
import { StrictEventEmitter as StrictEventEmitterType } from "strict-event-emitter-types";

/**
 * An events map is an interface that maps event names to their value, which
 * represents the type of the `on` listener.
 */
export interface EventsMap {
  [event: string]: any;
}

/**
 * The default events map, used if no EventsMap is given. Using this EventsMap
 * is equivalent to accepting all event names, and any data.
 */
export interface DefaultEventsMap {
  [event: string]: (...args: any[]) => void;
}

/**
 * Returns a union type containing all the keys of an event map.
 */
export type EventNames<Map extends EventsMap> = keyof Map & (string | symbol);

/** The tuple type representing the parameters of an event listener */
export type EventParams<
  Map extends EventsMap,
  Ev extends EventNames<Map>
> = Parameters<Map[Ev]>;

/**
 * The event names that are either in ReservedEvents or in UserEvents
 */
export type ReservedOrUserEventNames<
  ReservedEventsMap extends EventsMap,
  UserEvents extends EventsMap
> = EventNames<ReservedEventsMap> | EventNames<UserEvents>;

/**
 * Type of a listener of a user event or a reserved event. If `Ev` is in
 * `ReservedEvents`, the reserved event listener is returned.
 */
export type ReservedOrUserListener<
  ReservedEvents extends EventsMap,
  UserEvents extends EventsMap,
  Ev extends ReservedOrUserEventNames<ReservedEvents, UserEvents>
> = FallbackToUntypedListener<
  Ev extends EventNames<ReservedEvents>
    ? ReservedEvents[Ev]
    : Ev extends EventNames<UserEvents>
    ? UserEvents[Ev]
    : never
>;

/**
 * Returns an untyped listener type if `T` is `never`; otherwise, returns `T`.
 *
 * This is a hack to mitigate https://github.com/socketio/socket.io/issues/3833.
 * Needed because of https://github.com/microsoft/TypeScript/issues/41778
 */
type FallbackToUntypedListener<T> = [T] extends [never]
  ? (...args: any[]) => void | Promise<void>
  : T;

/**
 * Interface for classes that aren't `EventEmitter`s, but still expose a
 * strictly typed `emit` method.
 */
export interface TypedEventBroadcaster<EmitEvents extends EventsMap> {
  emit<Ev extends EventNames<EmitEvents>>(
    ev: Ev,
    ...args: EventParams<EmitEvents, Ev>
  ): boolean;
}

/**
 * Strictly typed version of an `EventEmitter`. A `TypedEventEmitter` takes type
 * parameters for mappings of event names to event data types, and strictly
 * types method calls to the `EventEmitter` according to these event maps.
 *
 * @typeParam ListenEvents - `EventsMap` of user-defined events that can be
 * listened to with `on` or `once`
 * @typeParam EmitEvents - `EventsMap` of user-defined events that can be
 * emitted with `emit`
 * @typeParam ReservedEvents - `EventsMap` of reserved events, that can be
 * emitted by socket.io with `emitReserved`, and can be listened to with
 * `listen`.
 */
export abstract class StrictEventEmitter<
    ListenEvents extends EventsMap,
    EmitEvents extends EventsMap,
    ReservedEvents extends EventsMap = {}
  >
  extends EventEmitter
  implements TypedEventBroadcaster<EmitEvents>, StrictEventEmitterType<EventEmitter, ReservedOrUserEventNames<ReservedEvents, ListenEvents>>
{
  /**
   * Emits a reserved event.
   *
   * This method is `protected`, so that only a class extending
   * `StrictEventEmitter` can emit its own reserved events.
   *
   * @param ev Reserved event name
   * @param args Arguments to emit along with the event
   */
  protected emitReserved<Ev extends EventNames<ReservedEvents>>(
    ev: Ev,
    ...args: EventParams<ReservedEvents, Ev>
  ): boolean {
    return super.emit(ev, ...args);
  }

  /**
   * Emits an event.
   *
   * This method is `protected`, so that only a class extending
   * `StrictEventEmitter` can get around the strict typing. This is useful for
   * calling `emit.apply`, which can be called as `emitUntyped.apply`.
   *
   * @param ev Event name
   * @param args Arguments to emit along with the event
   */
  protected emitUntyped(ev: string, ...args: any[]): boolean {
    return super.emit(ev, ...args);
  }
}

export type Last<T extends any[]> = T extends [...infer H, infer L] ? L : any;
export type AllButLast<T extends any[]> = T extends [...infer H, infer L]
  ? H
  : any[];
export type FirstArg<T> = T extends (arg: infer Param) => infer Result
  ? Param
  : any;
export type SecondArg<T> = T extends (
  err: Error,
  arg: infer Param
) => infer Result
  ? Param
  : any;

type PrependTimeoutError<T extends any[]> = {
  [K in keyof T]: T[K] extends (...args: infer Params) => infer Result
    ? (err: Error, ...args: Params) => Result
    : T[K];
};

type ExpectMultipleResponses<T extends any[]> = {
  [K in keyof T]: T[K] extends (err: Error, arg: infer Param) => infer Result
    ? (err: Error, arg: Param[]) => Result
    : T[K];
};

/**
 * Utility type to decorate the acknowledgement callbacks with a timeout error.
 *
 * This is needed because the timeout() flag breaks the symmetry between the sender and the receiver:
 *
 * @example
 * interface Events {
 *   "my-event": (val: string) => void;
 * }
 *
 * socket.on("my-event", (cb) => {
 *   cb("123"); // one single argument here
 * });
 *
 * socket.timeout(1000).emit("my-event", (err, val) => {
 *   // two arguments there (the "err" argument is not properly typed)
 * });
 *
 */
export type DecorateAcknowledgements<E> = {
  [K in keyof E]: E[K] extends (...args: infer Params) => infer Result
    ? (...args: PrependTimeoutError<Params>) => Result
    : E[K];
};

export type DecorateAcknowledgementsWithTimeoutAndMultipleResponses<E> = {
  [K in keyof E]: E[K] extends (...args: infer Params) => infer Result
    ? (...args: ExpectMultipleResponses<PrependTimeoutError<Params>>) => Result
    : E[K];
};

export type DecorateAcknowledgementsWithMultipleResponses<E> = {
  [K in keyof E]: E[K] extends (...args: infer Params) => infer Result
    ? (...args: ExpectMultipleResponses<Params>) => Result
    : E[K];
};

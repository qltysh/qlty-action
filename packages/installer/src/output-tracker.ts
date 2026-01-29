import EventEmitter from "node:events";

export default class OutputTracker<T> {
  _emitter: EventEmitter;
  _event: string;
  _trackerFn: (data: T) => void;
  _data: T[];

  static create<T>(emitter: EventEmitter, event: string): OutputTracker<T> {
    return new OutputTracker<T>(emitter, event);
  }

  constructor(emitter: EventEmitter, event: string) {
    this._emitter = emitter;
    this._event = event;
    this._data = [];

    this._trackerFn = (datum: T) => this._data.push(datum);
    this._emitter.on(this._event, this._trackerFn);
  }

  clear(): T[] {
    const result = [...this._data];
    this._data.length = 0;
    return result;
  }
}

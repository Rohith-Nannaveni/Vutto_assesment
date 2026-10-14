import { EventEmitter } from 'node:events';

// In-process event bus. Services emit AFTER a database write has succeeded;
// the socket layer subscribes. This keeps services free of socket.io imports and
// guarantees every code path (REST, socket, scheduler) broadcasts identically.
export const events = new EventEmitter();
export const EVENTS = Object.freeze({
  BID_ACCEPTED: 'bid:accepted',
  STATUS_CHANGED: 'auction:statusChanged',
});

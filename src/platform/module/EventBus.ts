export type EventHandler = (payload: unknown) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private moduleHandlers = new Map<string, Map<string, Set<EventHandler>>>();

  on(event: string, handler: EventHandler, moduleKey?: string): () => void {
    const store = moduleKey
      ? this.getModuleStore(moduleKey, event)
      : this.getGlobalStore(event);
    store.add(handler);
    return () => store.delete(handler);
  }

  async emit(event: string, payload: unknown): Promise<void> {
    const global = this.handlers.get(event);
    const tasks: Promise<void>[] = [];
    if (global) {
      for (const handler of global) {
        tasks.push(Promise.resolve(handler(payload)));
      }
    }
    for (const [, events] of this.moduleHandlers) {
      const handlers = events.get(event);
      if (handlers) {
        for (const handler of handlers) {
          tasks.push(Promise.resolve(handler(payload)));
        }
      }
    }
    await Promise.all(tasks);
  }

  registerModuleHandlers(
    moduleKey: string,
    registrations: Array<{ event: string; handler: EventHandler }>
  ): () => void {
    const unsubscribers = registrations.map(({ event, handler }) =>
      this.on(event, handler, moduleKey)
    );
    return () => unsubscribers.forEach((unsub) => unsub());
  }

  clearModule(moduleKey: string): void {
    this.moduleHandlers.delete(moduleKey);
  }

  private getGlobalStore(event: string): Set<EventHandler> {
    let store = this.handlers.get(event);
    if (!store) {
      store = new Set();
      this.handlers.set(event, store);
    }
    return store;
  }

  private getModuleStore(moduleKey: string, event: string): Set<EventHandler> {
    let moduleMap = this.moduleHandlers.get(moduleKey);
    if (!moduleMap) {
      moduleMap = new Map();
      this.moduleHandlers.set(moduleKey, moduleMap);
    }
    let store = moduleMap.get(event);
    if (!store) {
      store = new Set();
      moduleMap.set(event, store);
    }
    return store;
  }
}

export const platformEventBus = new EventBus();

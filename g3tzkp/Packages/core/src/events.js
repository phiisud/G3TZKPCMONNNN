export class EventEmitter {
    handlers = new Map();
    on(event, handler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event).add(handler);
    }
    off(event, handler) {
        this.handlers.get(event)?.delete(handler);
    }
    emit(event, data) {
        const handlers = this.handlers.get(event);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(data);
                }
                catch (error) {
                    // Silent error handling to avoid breaking event loop
                }
            }
        }
    }
    once(event, handler) {
        const onceHandler = (data) => {
            this.off(event, onceHandler);
            handler(data);
        };
        this.on(event, onceHandler);
    }
    removeAllListeners() {
        this.handlers.clear();
    }
}

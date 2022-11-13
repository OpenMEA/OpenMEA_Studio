export interface ILogEmitter {
    onLogMessage(handler: (msg: string) => void): void
}
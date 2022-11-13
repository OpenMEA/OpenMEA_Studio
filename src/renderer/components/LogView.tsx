import { ILogEmitter } from 'client/services/ILogEmitter';
import * as React from 'react'

const MAX_LOG_MESSAGES = 10_000

export interface LogViewProps {
    logEmitter: ILogEmitter
}

export interface LogViewState {
    logMessages: string[]
}

export class LogView extends React.Component<LogViewProps, LogViewState> {
    constructor(props: LogViewProps) {
        super(props)

        this.props.logEmitter.onLogMessage(this.handleLogMessage)

        this.state = {
            logMessages: []
        }
    }

    render = () => {
        let messages = []
        let key = 0

        for (let logMessage of this.state.logMessages) {
            key++
            const messageElement = <p key={key} className="text-sm font-mono">
                { logMessage }
            </p>

            messages.push(messageElement)
        }

        return <div style={{width: '100%', height: '100%', overflowX: 'scroll'}}
                    className="p-4"
                    ref={(elt) => this._scrollContainer = elt}>
            { messages }
        </div>
    }

    componentDidMount = () => {
        this.scrollToBottom()
    }

    componentDidUpdate = () => {
        this.scrollToBottom()
    }

    // ================= Private ==================
    private _unmounted = false
    private _scrollContainer: HTMLDivElement | null = null

    private handleLogMessage = (message: string) => {
        if (this._unmounted) {
            return
        }

        const logMessages = this.state.logMessages

        if (logMessages.length >= MAX_LOG_MESSAGES) {
            const numToRemove = logMessages.length - MAX_LOG_MESSAGES + 1
            logMessages.splice(0, numToRemove)
        }

        logMessages.push(message)
        this.forceUpdate()
    }

    private scrollToBottom = () => {
        this._scrollContainer?.scrollBy(0, this._scrollContainer.scrollHeight)
    }
}


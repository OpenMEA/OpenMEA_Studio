import { formatSI, parseSI } from 'client/Utils'
import * as React from 'react'


export interface SiNumberInputProps {
    value: number
    onChange: (value: number) => void

    className?: string
}

export interface SiNumberInputState {
    value: string
    isValid: boolean
}

export class SiNumberInput extends React.Component<SiNumberInputProps, SiNumberInputState> {
    constructor(props: SiNumberInputProps) {
        super(props)

        this.state = {
            value: formatSI(props.value),
            isValid: true,
        }
    }

    componentDidUpdate = (oldProps: SiNumberInputProps) => {
        if (oldProps.value != this.props.value || this._justEmittedValue) {
            this._justEmittedValue = false
            this.setState({
                value: formatSI(this.props.value),
                isValid: true
            })
        }
    }

    render = () => {
        const state = this.state
        let className = "input-short "

        if (this.props.className) {
            className += this.props.className
        }

        className += state.isValid ? "" : " error"

        return <input className={className}
                        type="text" 
                        value={state.value}
                        onChange={this.onChange}
                        onBlur={this.onSubmit}
                        onKeyDown={this.onKeyDown}/>   

    }

    // ===================== Private ====================

    // This is here because the the value emitted by props.onChange() may be
    // modified by other code before coming back as a new set of props.
    // As a result of this change, we may get the original seemingly unmodified value back,
    // and we need something to indicate that we should revert the user's input back to
    // its original value.
    private _justEmittedValue = false

    private onKeyDown = (evt: React.KeyboardEvent) => {
        // Treat "enter" as input submission.
        if (evt.key == 'Enter') {
            evt.preventDefault()
            this.onSubmit(null)
        
        } else if (evt.key == 'Escape') {
            evt.preventDefault()
            this.setState({
                value: formatSI(this.props.value),
                isValid: true
            })
        }
    }

    private onChange = (evt: any) => {
        this.setState({
            value: evt.target.value,
            isValid: true
        })
    }

    private onSubmit = (evt: any) => {
        const [value, parsed] = parseSI(this.state.value)

        if (!parsed) {
            this.setState({isValid: false})
            return
        }

        if (value != this.props.value) {
            this._justEmittedValue = true
            this.props.onChange(value)
        }        
    }
}

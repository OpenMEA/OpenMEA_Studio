import * as React from 'react'

export interface HidableProps {
    condition: boolean | null
} 

export class VisibleIf extends React.Component<HidableProps, {}> {
    render = () => {
        if (!this.props.condition) {
            return null
        }
    
        return this.props.children
    }
}
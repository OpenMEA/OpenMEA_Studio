import * as React from 'react'

export interface ElectrodeMarkerProps {
    name: string
    outline: string | null
    fill: string | null
    hoverColor: string
    style?: React.CSSProperties
    onClick: () => void
}

export function ElectrodeMarker(props: ElectrodeMarkerProps) {
    let className = "block m-0 text-xs text-gray-800 rounded-full text-center"

    if (props.outline && props.outline != "") {
        className += ` border border-${props.outline}-500 hover:border-${props.outline}-700`

    } else {
        className += ` border border-gray-300 hover:border-${props.hoverColor}-400`
    }

    if (props.fill && props.fill != "") {
        className += ` bg-${props.fill}-100 hover:border-${props.fill}-300`
    
    } else {
        className += ` hover:bg-${props.hoverColor}-50`
    }

    const onClick = (evt:any) => {
        evt.preventDefault()
        props.onClick()
        return false
    }

    const style ={
        height: '23px',
        width: '23px',
        paddingTop: '2px',
        color: 'black'
    }

    if (props.style) {
        Object.assign(style, props.style)
    }

    return <a href="" 
                style={style}
                className={className} 
                onClick={onClick}>{props.name}</a>
}

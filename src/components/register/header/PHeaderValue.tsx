/// <reference path="../../../_includes.ts" />

import * as React from 'react';
import * as ReactDOM from 'react-dom';

export interface PHeaderValueProps {
	label:string;
	value:number;
	formattedValue:string;
}

const HeaderValueContainerStyle:React.CSSProperties = {
	flex: '0 0 auto'
}

const HeaderValueStyle:React.CSSProperties = {
	display: 'flex',
	flexFlow: 'column nowrap',
	alignItems: 'center',
}

const LabelStyle:React.CSSProperties = {
	color: '#ffffff',
	fontStyle: 'italic',
	fontWeight: 'normal',
	fontSize: '13px'
}

const PositiveValueStyle:React.CSSProperties = {
	color: '#57B66D',
	fontWeight: 'bold',
	fontSize: '18px'
}

const NegativeValueStyle:React.CSSProperties = {
	color: '#CA6D64',
	fontWeight: 'bold',
	fontSize: '18px'
}

export class PHeaderValue extends React.Component<PHeaderValueProps, {}> {
  
	public render() {

		var valueStyle = this.props.value >= 0 ? PositiveValueStyle : NegativeValueStyle;
    	return (
			<div style={HeaderValueContainerStyle}>
				<div style={HeaderValueStyle}>
					<text style={LabelStyle}>{this.props.label}</text>
					<text style={valueStyle}>{this.props.formattedValue}</text>
				</div>		
			</div>		
		);
  	}
}
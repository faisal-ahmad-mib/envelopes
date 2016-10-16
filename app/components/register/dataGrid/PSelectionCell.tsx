/// <reference path="../../../_includes.ts" />

import * as React from 'react';
import { Cell } from 'fixed-data-table';
import { ITransaction } from '../../../interfaces/budgetEntities';
import { SimpleObjectMap } from '../../../utilities';

export interface PSelectionCellProps {
	width?:number;
	height?:number;
	rowIndex?:number;
	columnKey?:string;
	transactions:Array<ITransaction>;
	selectedTransactionsMap:SimpleObjectMap<boolean>;

	editTransaction:(transactionId:string, focusOnField:string)=>void;
	selectTransaction:(transactionId:string, unselectAllOthers:boolean)=>void;
	unselectTransaction:(transactionId:string)=>void;
}

export class PSelectionCell extends React.Component<PSelectionCellProps, {}> {
	
	constructor(props: any) {
        super(props);
		this.onClick = this.onClick.bind(this);
		this.onDoubleClick = this.onDoubleClick.bind(this);
		this.onChange = this.onChange.bind(this);
	}

	private onClick(event:MouseEvent):void {

		if((event.target as HTMLElement).localName == "div") {
			var transaction = this.props.transactions[this.props.rowIndex];
			this.props.selectTransaction(transaction.entityId, true);
		}
	}	

	private onDoubleClick(event:MouseEvent):void {

		var transaction = this.props.transactions[this.props.rowIndex];
		this.props.editTransaction(transaction.entityId, null);
	}

	private onChange(event:React.SyntheticEvent):void {
		
		var element = event.target as HTMLInputElement;
		var transaction = this.props.transactions[this.props.rowIndex];
		if(element.checked)
			this.props.selectTransaction(transaction.entityId, false);
		else
			this.props.unselectTransaction(transaction.entityId);
	}

	public render() {

		var selected:boolean = false;
		if(this.props.transactions) {

			// Get the transaction for the current row
			var transaction = this.props.transactions[this.props.rowIndex];
			// Check whether this transaction is currently selected
			var selectedValue = this.props.selectedTransactionsMap[transaction.entityId];
			if(selectedValue && selectedValue == true)
				selected = true;
		}

		var className = selected ? "register-transaction-cell-selected" : "register-transaction-cell";
		return (
			<div className={className} onClick={this.onClick} onDoubleClick={this.onDoubleClick}>
				<input style={{marginTop:"0px"}} type="checkbox" checked={selected} onChange={this.onChange} />
			</div>
		);
  	}
}
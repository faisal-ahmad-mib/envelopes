/// <reference path="../../../_includes.ts" />

import * as _ from 'lodash';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Button, FormGroup, FormControl, Glyphicon, Overlay, Popover } from 'react-bootstrap';

import { PTransactionsList } from './PTransactionsList';
import { TransactionSources } from '../../../constants';
import { DateWithoutTime } from '../../../utilities/';
import { ITransactionObject } from '../../../interfaces/objects';
import * as budgetEntities from '../../../interfaces/budgetEntities';
import { IEntitiesCollection, ISimpleEntitiesCollection } from '../../../interfaces/state';

export interface PDefaultCategoryActivityDialogProps {
	entitiesCollection:IEntitiesCollection
}

export interface PDefaultCategoryActivityDialogState {
	show:boolean;
	target:HTMLElement;
	placement:string;
	subCategoryName:string;
	transactions:Array<ITransactionObject>;
}

const PopoverStyle = {
	maxWidth: 'none',
	width:'520px'
}

const TitleStyle = {
	width: "100%",
	color: "#4D717A",
	fontSize: "24px",
}

export class PDefaultCategoryActivityDialog extends React.Component<PDefaultCategoryActivityDialogProps, PDefaultCategoryActivityDialogState> {

	constructor(props: any) {
        super(props);
		this.hide = this.hide.bind(this);
		this.onCloseClick = this.onCloseClick.bind(this);
		this.state = {
			show:false, 
			target:null, 
			placement:"left",
			subCategoryName:null,
			transactions:null
		};
	}

	public isShowing():boolean {
		return this.state.show;
	}

	private onCloseClick():void { 
		// Hide the dialog
		this.hide();
	}
	
	public show(subCategoryId:string, month:DateWithoutTime, target:HTMLElement, placement:string = "bottom"):void {

		// Get the subCategory for the passed subCategoryId
		var subCategory = this.props.entitiesCollection.subCategories.getEntityById(subCategoryId);
		var monthlySubCategoryBudget = this.props.entitiesCollection.monthlySubCategoryBudgets.getMonthlySubCategoryBudgetsForSubCategoryInMonth(subCategoryId, month.toISOString());
		if(subCategory && monthlySubCategoryBudget) {

			var state = Object.assign({}, this.state) as PDefaultCategoryActivityDialogState;
			state.show = true;
			state.target = target;
			state.placement = placement;
			state.subCategoryName = subCategory.name;
			state.transactions = this.buildTransactionObjects(subCategoryId, month);
			this.setState(state);
		}
	}

	public hide():void {
		var state = Object.assign({}, this.state) as PDefaultCategoryActivityDialogState;
		state.show = false;
		this.setState(state);
	}

	private buildTransactionObjects(subCategoryId:string, month:DateWithoutTime):Array<ITransactionObject> {

		var entitiesCollection = this.props.entitiesCollection;
		// Get all the transactions for the specified month
		var transactions = entitiesCollection.transactions.getTransactionsByMonth(month);
		var transactionObjects:Array<ITransactionObject> = [];
		_.forEach(transactions, (transaction)=>{
			if(transaction.subCategoryId == subCategoryId && transaction.isTombstone == 0 && transaction.source != TransactionSources.Matched) {

				var account = entitiesCollection.accounts.getEntityById(transaction.accountId);
				var accountName = account ? account.accountName : "";
				var payee = transaction.payeeId ? entitiesCollection.payees.getEntityById(transaction.payeeId) : null;
				var payeeName = payee ? payee.name : "";
				var category = transaction.subCategoryId ? entitiesCollection.subCategories.getEntityById(transaction.subCategoryId) : null;
				var categoryName = category ? category.name : "";
				
				var transactionObject:ITransactionObject = {
					entityId: transaction.entityId,
					isTransaction: true,
					account: accountName,
					date: DateWithoutTime.createFromUTCTime(transaction.date).toISOString(),
					payee: payeeName,
					category: categoryName,
					memo: transaction.memo,
					amount: transaction.amount
				} 

				transactionObjects.push(transactionObject);
			}
		});

		return transactionObjects;
	}

	public render() {

		return (
			<Overlay show={this.state.show} placement={this.state.placement} 
				rootClose={true} onHide={this.onCloseClick} target={()=> ReactDOM.findDOMNode(this.state.target)}>
				<Popover id="defaultCategoryActivityDialog" style={PopoverStyle}>
					<div style={TitleStyle}>{this.state.subCategoryName}</div>
					<PTransactionsList 
						showAccountColumn={true}
						showCategoryColumn={false}
						transactions={this.state.transactions}
					/>
					<div className="buttons-container" style={{paddingTop:"10px"}}>
						<div className="spacer" />
						<Button className="dialog-primary-button" onClick={this.onCloseClick}>
							Close&nbsp;<Glyphicon glyph="ok-circle"/>
						</Button>
					</div>
				</Popover>
			</Overlay>
		);
	}
}

/// <reference path="../../../_includes.ts" />

import * as _ from 'lodash';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Form, FormControl, FormGroup, Col, ControlLabel, Overlay, Popover } from 'react-bootstrap';

import * as objects from '../../../interfaces/objects';
import * as budgetEntities from '../../../interfaces/budgetEntities';
import { IEntitiesCollection } from '../../../interfaces/state';

export interface PPayeeSelectorProps {
	activeField:string;
	selectedPayeeId:string;
	manuallyEnteredPayeeName:string;
	payeesList:Array<objects.IPayeeObject>;
	setActiveField?:(activeField:string)=>void;
	setSelectedPayeeId:(payeeId:string, callback?:()=>any)=>void;
	setManuallyEnteredPayeeName:(payeeName:string)=>void;
	handleTabPressed:(shiftPressed:boolean)=>void;
}

const PayeeSelectorStyle:React.CSSProperties = {
	borderColor: '#2FA2B5',
	borderTopWidth: '2px',
	borderBottomWidth: '2px',
	borderLeftWidth: '2px',
	borderRightWidth: '2px',
}

const PopoverStyle:React.CSSProperties = {
	maxWidth: 'none', 
	width:'240px'
}

const ScrollableContainerStyle = {
	overflowY: "auto",
}

const NewPayeeCreationMessageStyle = {
	color: "#588697",
	fontSize: "12px"
}

export class PPayeeSelector extends React.Component<PPayeeSelectorProps, {}> {

	private payeeInput:FormControl;

	constructor(props:PPayeeSelectorProps) {
        super(props);
		this.onFocus = this.onFocus.bind(this);
		this.onChange = this.onChange.bind(this);
		this.onKeyDown = this.onKeyDown.bind(this);
		this.state = {showPopover:false};	
	}

	private setSelectedPayeeId(payeeId:string) {

		// This method is called when the user selects an item from the popover using mouse click
		if(this.props.selectedPayeeId != payeeId) {
			this.props.setSelectedPayeeId(payeeId, ()=>{
				// Call handleTabPressed as we want to move the focus on to the next control
				this.props.handleTabPressed(false);
			});
		}
	}

	private onFocus():void {
		if(this.props.activeField != "payee" && this.props.setActiveField)
			this.props.setActiveField("payee");
	}

	public setFocus():void {
		// Set the focus on the input control
		var domNode = ReactDOM.findDOMNode(this.payeeInput) as any;
		domNode.focus();
		domNode.select();
	}

	private onChange(event:React.FormEvent<any>) {

		// Get the entered value from the payee input control and pass to the transaction dialog
		var value = (event.target as any).value;
		this.props.setManuallyEnteredPayeeName(value);
	}

	private onKeyDown(event:React.KeyboardEvent<any>):void {

		if(this.props.activeField == "payee" && (event.keyCode == 38 || event.keyCode == 40)) {

			// Get the currently selected payeeId
			var currentPayeeId = this.props.selectedPayeeId;
			var payees = this.props.payeesList;
			var index = _.findIndex(payees, {entityId: currentPayeeId});

			// Up Arrow Key
			if(event.keyCode == 38) {
				// Decrement the index to get the previous payee
				index--;
				// If we have gone below 0, go back to the last index
				if(index < 0)
					index = payees.length - 1;
			}
			// Down Arrow Key
			else if(event.keyCode == 40) {
				// Increment the index to get the next payee
				index++;
				// If we have gone above the last index, go back to the first index
				if(index >= payees.length)
					index = 0;
			}

			// Get the payee corresponding to the index and set it as the selected payee
			var newPayee = payees[index];
			this.props.setSelectedPayeeId(newPayee.entityId);
		}
		// Tab Key
		else if(event.keyCode == 9) {
			// Prevent the default action from happening as we are manually handling it
			event.preventDefault();
			// Let the parent dialog know that tab was pressed
			this.props.handleTabPressed(event.shiftKey);
		}
	}

	private getPayeesDisplayList(payeesList:Array<objects.IPayeeObject>, selectedPayeeId:string):JSX.Element {

		var payeesPopoverItem;
		var payeesPopoverItems;
		var transferPayeesPopoverItems = [];
		var nonTransferPayeesPopoverItems = [];

		var selectedPayee = selectedPayeeId ? _.find(this.props.payeesList, {entityId: selectedPayeeId}) : null;

		payeesPopoverItem = <li key="0" className="custom-dropdown-2list-section">Transfer to/from account:</li>;
		transferPayeesPopoverItems.push(payeesPopoverItem);
		payeesPopoverItem = <li key="1" className="custom-dropdown-2list-section">Memorized:</li>;
		nonTransferPayeesPopoverItems.push(payeesPopoverItem);
		
		// Iterate through the passed payees and create list items for them
		_.forEach(payeesList, (payee)=>{

			if(selectedPayee && selectedPayee.entityId == payee.entityId)
				payeesPopoverItem = <li key={payee.entityId} className="custom-dropdown-2list-item-selected" id={payee.entityId}>{payee.name}</li>;
			else
				payeesPopoverItem = <li key={payee.entityId} className="custom-dropdown-2list-item" id={payee.entityId} onClick={this.setSelectedPayeeId.bind(this, payee.entityId)}>{payee.name}</li>;

			if(payee.isTransferPayee)
				transferPayeesPopoverItems.push(payeesPopoverItem);
			else
				nonTransferPayeesPopoverItems.push(payeesPopoverItem);
		});

		// Concatenate the two arrays to get the single array of items
		payeesPopoverItems = transferPayeesPopoverItems.concat(nonTransferPayeesPopoverItems);

		return (
			<ul className="custom-dropdown-list" style={ScrollableContainerStyle}>
				{payeesPopoverItems}
			</ul>
		);
	}

	public render() {

		var popoverContents;

		// Get the currently selected payee from state so that we can highlight the corresponding item
		var payees = this.props.payeesList;
		var selectedPayeeId = this.props.selectedPayeeId;
		var selectedPayee = selectedPayeeId ? _.find(payees, {entityId: selectedPayeeId}) : null;

		// Do we have a manuallyEnteredPayeeName for the input box. If we have, then set that in the input box.
		// If not, then check if we have a selected input. If so, then set the name of the selected payee in the input box.
		// If neither of the above is true, set it as blank.
		var payeeValue = "";
		if(this.props.manuallyEnteredPayeeName) {

			// Show the manuallyEnteredPayeeName in the payee input box
			payeeValue = this.props.manuallyEnteredPayeeName;
			// Filter the list of payees by the manuallyEnteredPayeeName
			var filteredPayeesList = _.filter(this.props.payeesList, (payeeObj:objects.IPayeeObject)=>{
				return payeeObj.name.includes(this.props.manuallyEnteredPayeeName);
			});

			if(filteredPayeesList.length == 0) {

				// There are no matches, and the filteredPayeesList is empty, so we will display a messaage at the
				// top informing the user that a new payee will be created. 
				var payeeCreationMessage = `"${this.props.manuallyEnteredPayeeName}" payee will be created`;
				popoverContents = <label style={NewPayeeCreationMessageStyle}>{payeeCreationMessage}</label>;
			}
			else if(filteredPayeesList.length == 1 && filteredPayeesList.length[0] == this.props.manuallyEnteredPayeeName) {

				// We got back one item in the filteredPayeesList and it is an exact match. We will just display
				// the payees list with that single item in it.
				popoverContents = this.getPayeesDisplayList(filteredPayeesList, this.props.selectedPayeeId);
			}
			else {
				// We got back one or more items in the filteredPayeesList, then display the link at the top 
				// offering to create a new payee by the entered name. Also display the list of filtered payees 
				// below that.
				popoverContents = this.getPayeesDisplayList(filteredPayeesList, this.props.selectedPayeeId);
			}
		}
		else {
			if(selectedPayee)
				payeeValue = selectedPayee.name;

			popoverContents = this.getPayeesDisplayList(this.props.payeesList, this.props.selectedPayeeId);
		}

		return (
			<FormGroup onKeyDown={this.onKeyDown}>
				<Col componentClass={ControlLabel} sm={3}>
					Payee
				</Col>
				<Col sm={9}>
					<FormControl ref={(n) => this.payeeInput = n } type="text" componentClass="input" style={PayeeSelectorStyle} 
						onFocus={this.onFocus} onChange={this.onChange} value={payeeValue} />
					<Overlay show={this.props.activeField == "payee"} placement="right" target={ ()=> ReactDOM.findDOMNode(this.payeeInput) }>
						<Popover id="selectPayeePopover" style={PopoverStyle} title="Payees">
							{popoverContents}
						</Popover>
					</Overlay>
				</Col>
			</FormGroup>
		);
	}
}

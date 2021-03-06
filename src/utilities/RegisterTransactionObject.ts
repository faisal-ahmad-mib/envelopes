/// <reference path='../_includes.ts' />

import { InternalCategories } from '../constants'; 
import { DateWithoutTime } from './DateWithoutTime';
import { SimpleObjectMap } from './SimpleObjectMap';
import { SerializationUtilities } from './SerializationUtilities'; 
import { IEntitiesCollection } from '../interfaces/state';
import * as budgetEntities from '../interfaces/budgetEntities';

export class RegisterTransactionObject {

	public entityType:string;
	public refTransaction:budgetEntities.ITransaction;
	public refScheduledTransaction:budgetEntities.IScheduledTransaction;
	public refAccount:budgetEntities.IAccount;
	public refPayee:budgetEntities.IPayee;
	public refSubCategory:budgetEntities.ISubCategory;
	public refMasterCategory:budgetEntities.IMasterCategory;
	public refTransferAccount:budgetEntities.IAccount;

	public entityId:string;
	public parentEntityId:string;
	public date:DateWithoutTime;
	public checkNumber:string;
	public flag:string;
	public memo:string;
	public inflow:number;
	public outflow:number;
	public amount:number;
	public cleared:string;

	public get accountName():string {
		return this.refAccount.accountName;
	}

	public get accountOnBudget():boolean {
		return (this.refAccount.onBudget == 1);
	}

	public get payeeName():string {
		return (this.refPayee ? this.refPayee.name : "");
	}

	public get categoryName():string {

		if(!this.refSubCategory)
			return "";
		else if(this.refSubCategory.internalName == InternalCategories.ImmediateIncomeSubCategory) {
			return "Inflow: To be Budgeted";
		}
		else {
			return `${this.refMasterCategory.name}: ${this.refSubCategory.name}`;
		}
	}
	// ****************************************************************************************************
	// Utility Methods
	// ****************************************************************************************************
	public isSelected(selectedTransactionsMap:SimpleObjectMap<boolean>):boolean {

		var selected:boolean = false;
		var selectedValue:boolean;
		if(this.entityType == "transaction")
			selectedValue = selectedTransactionsMap[this.refTransaction.entityId];
		else 
			selectedValue = selectedTransactionsMap[this.refScheduledTransaction.entityId];

		if(selectedValue && selectedValue == true)
			selected = true;

		return selected;
	}

	public isAccepted():boolean {

		if(this.entityType == "transaction")
			return (this.refTransaction.accepted == 1);

		return true;
	}

	public getCSSClassName(selectedTransactionsMap:SimpleObjectMap<boolean>):string {

		var className:string;
		// Check whether this is currently selected or not
		var selected:boolean = this.isSelected(selectedTransactionsMap);
		var accepted:boolean = this.isAccepted();
		
		// CSS class name based on whether we are selected/accepted or not
		if(this.entityType == "scheduledTransaction")
			className = selected ? "register-transaction-cell-selected" : "register-scheduled-transaction-cell";
		else {
			if(accepted)
				className = selected ? "register-transaction-cell-selected" : "register-transaction-cell";
			else
				className = selected ? "register-unapproved-transaction-cell-selected" : "register-unapproved-transaction-cell";
		}

		return className;
	}

	public checkIfObjectIsStale(entitiesCollection:IEntitiesCollection):boolean {

		// We are basically going to compare the source entities of the registerTransactionObject with the entities
		// in the entitiesCollection to see if anything has changed.
		if(this.entityType == "transaction") {
			var transaction1 = this.refTransaction;
			var transaction2 = entitiesCollection.transactions.getEntityById(transaction1.entityId);
			if(transaction1 !== transaction2)
				return true;
		}
		else if(this.entityType == "scheduledTransaction") {
			var scheduledTransaction1 = this.refScheduledTransaction;
			var scheduledTransaction2 = entitiesCollection.scheduledTransactions.getEntityById(scheduledTransaction1.entityId);
			if(scheduledTransaction1 !== scheduledTransaction2)
				return true;
		}

		var account1 = this.refAccount;
		var account2 = entitiesCollection.accounts.getEntityById(account1.entityId);
		if(account1 !== account2)
			return true;

		var payee1 = this.refPayee;
		var payee2 = payee1 ? entitiesCollection.payees.getEntityById(payee1.entityId) : null;
		if(payee1 && payee2 && payee1 !== payee2)
			return true;

		var subCategory1 = this.refSubCategory;
		var subCategory2 = subCategory1 ? entitiesCollection.subCategories.getEntityById(subCategory1.entityId) : null;
		if(subCategory1 && subCategory2 && subCategory1 !== subCategory2)
			return true;

		var masterCategory1 = this.refMasterCategory;
		var masterCategory2 = masterCategory1 ? entitiesCollection.masterCategories.getEntityById(masterCategory1.entityId) : null;
		if(masterCategory1 && masterCategory2 && masterCategory1 !== masterCategory2)
			return true;

		var transferAccount1 = this.refTransferAccount;
		var transferAccount2 = transferAccount1 ? entitiesCollection.accounts.getEntityById(transferAccount1.entityId) : null;
		if(transferAccount1 && transferAccount2 && transferAccount1 !== transferAccount2)
			return true;

		return false;
	}

	// ****************************************************************************************************
	// Static Factory Methods
	// ****************************************************************************************************
	public static createFromTransaction(transaction:budgetEntities.ITransaction, entitiesCollection:IEntitiesCollection):RegisterTransactionObject {

		var account = entitiesCollection.accounts.getEntityById(transaction.accountId);
		var payee = transaction.payeeId ? entitiesCollection.payees.getEntityById(transaction.payeeId) : null;
		var subCategory = transaction.subCategoryId ? entitiesCollection.subCategories.getEntityById(transaction.subCategoryId) : null;
		var masterCategory = subCategory ? entitiesCollection.masterCategories.getEntityById(subCategory.masterCategoryId) : null;
		var transferAccount = transaction.transferAccountId ? entitiesCollection.accounts.getEntityById(transaction.transferAccountId) : null;

		var registerTransactionObject = new RegisterTransactionObject();
		registerTransactionObject.entityType = "transaction";
		registerTransactionObject.refTransaction = transaction;
		registerTransactionObject.entityId = transaction.entityId;
		registerTransactionObject.date = DateWithoutTime.createFromUTCTime(transaction.date);
		registerTransactionObject.checkNumber = transaction.checkNumber ? transaction.checkNumber : "";
		registerTransactionObject.flag = transaction.flag;
		registerTransactionObject.memo = transaction.memo ? transaction.memo : "";
		registerTransactionObject.outflow = transaction.amount < 0 ? -transaction.amount : 0;
		registerTransactionObject.inflow = transaction.amount > 0 ? transaction.amount : 0;
		registerTransactionObject.amount = transaction.amount;
		registerTransactionObject.cleared = transaction.cleared;

		// Set references to the other entities that this transaction references
		registerTransactionObject.refAccount = account;
		registerTransactionObject.refPayee = payee;
		registerTransactionObject.refSubCategory = subCategory;
		registerTransactionObject.refMasterCategory = masterCategory;
		registerTransactionObject.refTransferAccount = transferAccount;
		return registerTransactionObject;
	}

	public static createFromScheduledTransaction(scheduledTransaction:budgetEntities.IScheduledTransaction, entitiesCollection:IEntitiesCollection):RegisterTransactionObject {

		var registerTransactionObject:RegisterTransactionObject = null;
		var upcomingInstances = scheduledTransaction.upcomingInstances;
		var upcomingInstanceDates = upcomingInstances ? SerializationUtilities.deserializeISODateArray(upcomingInstances) : null;
		if(upcomingInstanceDates && upcomingInstanceDates.length > 0) {
		
			var account = entitiesCollection.accounts.getEntityById(scheduledTransaction.accountId);
			var payee = scheduledTransaction.payeeId ? entitiesCollection.payees.getEntityById(scheduledTransaction.payeeId) : null;
			var subCategory = scheduledTransaction.subCategoryId ? entitiesCollection.subCategories.getEntityById(scheduledTransaction.subCategoryId) : null;
			var masterCategory = subCategory ? entitiesCollection.masterCategories.getEntityById(subCategory.masterCategoryId) : null;
			var transferAccount = scheduledTransaction.transferAccountId ? entitiesCollection.accounts.getEntityById(scheduledTransaction.transferAccountId) : null;

			registerTransactionObject = new RegisterTransactionObject();
			registerTransactionObject.entityType = "scheduledTransaction";
			registerTransactionObject.refScheduledTransaction = scheduledTransaction;
			registerTransactionObject.entityId = scheduledTransaction.entityId;
			registerTransactionObject.date = DateWithoutTime.createFromISOString(upcomingInstanceDates[0]);
			registerTransactionObject.checkNumber = "";
			registerTransactionObject.flag = scheduledTransaction.flag;
			registerTransactionObject.memo = scheduledTransaction.memo ? scheduledTransaction.memo : "";
			registerTransactionObject.outflow = scheduledTransaction.amount < 0 ? -scheduledTransaction.amount : 0;
			registerTransactionObject.inflow = scheduledTransaction.amount > 0 ? scheduledTransaction.amount : 0;
			registerTransactionObject.amount = scheduledTransaction.amount;
			registerTransactionObject.cleared = null;

			// Set references to the other entities that this transaction references
			registerTransactionObject.refAccount = account;
			registerTransactionObject.refPayee = payee;
			registerTransactionObject.refSubCategory = subCategory;
			registerTransactionObject.refMasterCategory = masterCategory;
			registerTransactionObject.refTransferAccount = transferAccount;
		}

		return registerTransactionObject;
	}
}
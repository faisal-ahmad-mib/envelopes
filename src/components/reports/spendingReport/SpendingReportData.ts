/// <reference path='../../../_includes.ts' />

import * as _ from 'lodash';

import { DateWithoutTime, SimpleObjectMap, MultiDictionary } from '../../../utilities';
import { ITransaction } from '../../../interfaces/budgetEntities';
import { ISpendingReportItemData } from '../../../interfaces/reports';

export class SpendingReportData {

	private startMonth:DateWithoutTime;
	private endMonth:DateWithoutTime;

	// These variables contain data while we are adding it
	private overallItemDataMap:SimpleObjectMap<ISpendingReportItemData> = {};
	private monthlyItemDataMap:SimpleObjectMap<ISpendingReportItemData> = {};
	private itemTransactions = new MultiDictionary<string, ITransaction>();

	// These variables contain data that has been prepared for presentation.
	private overallSortedItemIds:Array<string>;
	private overallSortedItemNames:Array<string>;
	private bundledItemIds:Array<string>;
	private overallItemDataArray:Array<ISpendingReportItemData>;
	private overallTotalSpending:number;
	private allMonthNames:Array<string>;

	constructor(startMonth:DateWithoutTime, endMonth:DateWithoutTime) {
		this.startMonth = startMonth;
		this.endMonth = endMonth;
	}

	public getOverallItemData(itemId:string, itemName:string):ISpendingReportItemData {

		// First check if we already have an existing item against this itemId
		var itemData = this.overallItemDataMap[itemId];
		// If it is not found, then create and return a new one
		if(!itemData) {
			
			itemData = {
				itemId: itemId,
				itemName: itemName,
				monthName: null,
				value: 0
			};

			this.overallItemDataMap[itemId] = itemData;
		}

		return itemData;
	}

	public getMonthlyItemData(itemId:string, itemName:string, monthName:string):ISpendingReportItemData {

		var key = `${itemId}_${monthName}`;
		// First check if we already have an existing item against this itemId
		var itemData = this.monthlyItemDataMap[key];
		// If it is not found, then create and return a new one
		if(!itemData) {
			
			itemData = {
				itemId: itemId,
				itemName: itemName,
				monthName: monthName,
				value: 0
			};

			this.monthlyItemDataMap[key] = itemData;
		}

		return itemData;
	}

	public setTransactionReferenceForItem(itemId:string, transaction:ITransaction):void {
		this.itemTransactions.setValue(itemId, transaction);
	}

	public getTransactionsForItem(itemId:string):Array<ITransaction> {
		if(itemId != "all_other_categories")
			return this.itemTransactions.getValue(itemId);
		else {
			// Make a new array for transactions of all the bundled items and return that
			var bundledTransactions:Array<ITransaction> = [];
			_.forEach(this.bundledItemIds, (itemId)=>{
				var transactions = this.itemTransactions.getValue(itemId);
				bundledTransactions = bundledTransactions.concat(transactions);
			});

			// Sort these transactions by data
			bundledTransactions = _.orderBy(bundledTransactions, ["date", "amount"], ["desc", "asc"]);
			return bundledTransactions;
		}
	}

	public prepareDataForPresentation():void {

		// Create an array from itemData objects in the overallItemDataMap 
		var keys = _.keys(this.overallItemDataMap);
		var overallItemDataArray:Array<ISpendingReportItemData> = _.map(keys, (key)=>{
			return this.overallItemDataMap[key];
		});

		// Sort the items by value in descending order
		overallItemDataArray = _.orderBy(overallItemDataArray, ["value", "itemName"], ["desc", "asc"]);

		// If the nummber of items exceeds 10, then bundle all items beyond that into a single
		// "All Other Categories" item.
		if(overallItemDataArray.length > 10) {

			var excessItems = overallItemDataArray.splice(10);
			// Iterate through all the excess items and sum up their value. 
			var valueOfExcessItems = _.reduce(excessItems, (sum , itemData)=>{
				return sum + itemData.value;
			}, 0);

			// Create a new item to bundle these excess items
			var bundleItem:ISpendingReportItemData = {
				itemId: "all_other_categories",
				itemName: "All Other Categories",
				monthName: null,
				value: valueOfExcessItems
			};

			overallItemDataArray.push(bundleItem);

			// Save the ids of all excess items (that we have now bundled) in the local variable
			this.bundledItemIds = _.map(excessItems, "itemId") as Array<string>;
		}

		// Save the overallItemDataArray in the class variable
		this.overallItemDataArray = overallItemDataArray;

		// Save the sorted itemIds and itemNames from the above array in the class variable
		this.overallSortedItemIds = _.map(overallItemDataArray, "itemId") as Array<string>;
		this.overallSortedItemNames = _.map(overallItemDataArray, "itemName") as Array<string>;

		// Calculate the overallTotalSpending and save in the class variable
		this.overallTotalSpending = _.reduce(overallItemDataArray, (sum , itemData)=>{
			return sum + itemData.value;
		}, 0);
		
		// Build an array of all month names
		this.allMonthNames = [];
		var month = this.startMonth.clone();
		while(month.isAfter(this.endMonth) == false) {
			this.allMonthNames.push(month.format("MM/YYYY"));
			month.addMonths(1);
		}
	}

	// Getter methods for the prepared data for presentation
	public getOverallItemDataArray():Array<ISpendingReportItemData> {
		return this.overallItemDataArray;
	}

	public getOverallTotalSpending():number {
		return this.overallTotalSpending;
	}

	public getOverallSortedItemIds():Array<string> {
		return this.overallSortedItemIds;
	}

	public getOverallSortedItemNames():Array<string> {
		return this.overallSortedItemNames;
	}

	public getAllMonthNames():Array<string> {
		return this.allMonthNames;
	}

	public getMonthlyValuesForItem(itemId:string):Array<number> {

		var monthlyValues:Array<number> = [];
		var month = this.startMonth.clone();
		while(month.isAfter(this.endMonth) == false) {

			var monthName = month.toISOString();
			if(itemId != "all_other_categories") {

				var key = `${itemId}_${monthName}`;
				var itemData = this.monthlyItemDataMap[key];
				if(!itemData)
					monthlyValues.push(0);
				else
					monthlyValues.push(itemData.value);
			}
			else {
				var monthValue = 0;
				// We need to get monthly values for all bundled items and sum those up
				_.forEach(this.bundledItemIds, (itemId)=>{
					var key = `${itemId}_${monthName}`;
					var itemData = this.monthlyItemDataMap[key];
					if(itemData)
						monthValue += itemData.value;
				});

				monthlyValues.push(monthValue);
			}

			month.addMonths(1);
		}

		return monthlyValues;
	}

	public getMonthlyTotalValues():Array<number> {

		var monthlyTotalValues:Array<number> = [];
		var itemIds = this.overallSortedItemIds;
		// We need to return an array of values, where each value is the sum of all item values for a single month

		var month = this.startMonth.clone();
		while(month.isAfter(this.endMonth) == false) {

			var monthName = month.toISOString();
			var monthTotal = 0;
			_.forEach(itemIds, (itemId)=>{

				if(itemId != "all_other_categories") {
					let key = `${itemId}_${monthName}`;
					let itemData = this.monthlyItemDataMap[key];
					if(itemData)
						monthTotal += itemData.value;
				}
				else {
					_.forEach(this.bundledItemIds, (itemId)=>{
						let key = `${itemId}_${monthName}`;
						let itemData = this.monthlyItemDataMap[key];
						if(itemData)
							monthTotal += itemData.value;
					});
				}
			})

			monthlyTotalValues.push(monthTotal);
			month.addMonths(1);
		}

		return monthlyTotalValues;
	}
}

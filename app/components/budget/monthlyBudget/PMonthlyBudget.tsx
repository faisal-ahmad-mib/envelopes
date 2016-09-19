/// <reference path="../../../_includes.ts" />

import * as _ from 'lodash';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { PHeaderRow } from './PHeaderRow';
import { PMasterCategoryRow } from './PMasterCategoryRow';

import { DateWithoutTime, SimpleObjectMap } from '../../../utilities';
import { IEntitiesCollection, ISimpleEntitiesCollection, IBudgetState } from '../../../interfaces/state';
import * as budgetEntities from '../../../interfaces/budgetEntities';

export interface PMonthlyBudgetProps {
	currentMonth:DateWithoutTime;
	entitiesCollection:IEntitiesCollection;
	// Dispatcher Functions
	updateEntities:(entities:ISimpleEntitiesCollection)=>void;
}

const MonthlyBudgetContainerStyle = {
	flex: "1 1 auto",
	minWidth: "600px",
	backgroundColor: "#FFFFFF",
	borderColor: "#DFE4E9",
	borderStyle: "solid",
	borderTopWidth: "1px",
	borderBottomWidth: "0px",
	borderRightWidth: "1px",
	borderLeftWidth: "0px"
}

const MonthlyBudgetSubContainerStyle = {
	width: "100%",
	height: "100%",
	display: "flex",
	flexFlow: 'column nowrap',
	overflowY: "scroll"
}

export class PMonthlyBudget extends React.Component<PMonthlyBudgetProps, {}> {

	public render() {

		var masterCategoryRow:JSX.Element; 
		var masterCategoryRows:Array<JSX.Element> = [];

		var masterCategoriesArray = this.props.entitiesCollection.masterCategories;
		var subCategoriesArray = this.props.entitiesCollection.subCategories;
		var monthlySubCategoryBudgetsArray = this.props.entitiesCollection.monthlySubCategoryBudgets;

		if(masterCategoriesArray) {

			// Get the MonthlySubCategoryBudget entities for the current month
			var monthString = this.props.currentMonth.toISOString();
			var monthlySubCategoryBudgets = monthlySubCategoryBudgetsArray.getMonthlySubCategoryBudgetsByMonth(monthString);
			// Create a map of these monthly subcategory budget entities by subCategoryId
			var monthlySubCategoryBudgetsMap:SimpleObjectMap<budgetEntities.IMonthlySubCategoryBudget> = {};
			_.forEach(monthlySubCategoryBudgets, (monthlySubCategoryBudget)=>{
				monthlySubCategoryBudgetsMap[monthlySubCategoryBudget.subCategoryId] = monthlySubCategoryBudget;
			});

			// Add the Debt Payment master category row at the top, provided we have any debt categories
			var debtPaymentMasterCategory = masterCategoriesArray.getDebtPaymentMasterCategory();
			var debtPaymentSubCategories = subCategoriesArray.getVisibleNonTombstonedSubCategoriesForMasterCategory(debtPaymentMasterCategory.entityId);
			if(debtPaymentSubCategories.length > 0) {

				var debtPaymentMonthlySubCategoryBudgets:Array<budgetEntities.IMonthlySubCategoryBudget> = [];
				_.forEach(debtPaymentSubCategories, (subCategory)=>{
					var monthlySubCategoryBudget = monthlySubCategoryBudgetsMap[subCategory.entityId];
					debtPaymentMonthlySubCategoryBudgets.push(monthlySubCategoryBudget);
				});

				masterCategoryRow = (
					<PMasterCategoryRow
						key={debtPaymentMasterCategory.entityId} masterCategory={debtPaymentMasterCategory} 
						subCategories={debtPaymentSubCategories} monthlySubCategoryBudgets={debtPaymentMonthlySubCategoryBudgets} />
				);

				masterCategoryRows.push(masterCategoryRow);
			}

			// Iterate through the rest of the master categories and create rows for them
			_.forEach(masterCategoriesArray, (masterCategory)=>{
				// Skip the Internal Master Categories
				if(masterCategory.isTombstone == 0 && masterCategory.isHidden == 0 && !masterCategory.internalName) {

					var masterCategorySubCategories = subCategoriesArray.getVisibleNonTombstonedSubCategoriesForMasterCategory(masterCategory.entityId);
					var masterCategoryMonthlySubCategoryBudgets:Array<budgetEntities.IMonthlySubCategoryBudget> = [];
					_.forEach(masterCategorySubCategories, (subCategory)=>{
						var monthlySubCategoryBudget = monthlySubCategoryBudgetsMap[subCategory.entityId];
						masterCategoryMonthlySubCategoryBudgets.push(monthlySubCategoryBudget);
					});

					masterCategoryRow = (
						<PMasterCategoryRow
							key={masterCategory.entityId} masterCategory={masterCategory} 
							subCategories={masterCategorySubCategories} monthlySubCategoryBudgets={masterCategoryMonthlySubCategoryBudgets} />
					);

					masterCategoryRows.push(masterCategoryRow);
				}
			});
		}

    	return (
			<div style={MonthlyBudgetContainerStyle}>
				<PHeaderRow />
				<div style={MonthlyBudgetSubContainerStyle}>
					{masterCategoryRows}
				</div>
			</div>
		);
  	}

}
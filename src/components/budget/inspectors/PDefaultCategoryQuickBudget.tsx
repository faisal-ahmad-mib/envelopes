/// <reference path="../../../_includes.ts" />

import * as _ from 'lodash';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { DataFormatter, DateWithoutTime } from '../../../utilities';
import { IEntitiesCollection, ISimpleEntitiesCollection } from '../../../interfaces/state';
import * as budgetEntities from '../../../interfaces/budgetEntities';

export interface PDefaultCategoryQuickBudgetProps {
	dataFormatter:DataFormatter;
	monthlySubCategoryBudget:budgetEntities.IMonthlySubCategoryBudget;
	// Dispatcher Functions
	updateEntities:(entities:ISimpleEntitiesCollection)=>void;
}

const QuickBudgetContainerStyle:React.CSSProperties = {
	display: "flex",
	flexFlow: "column nowrap",
	width: "100%",
	minHeight: "100px",
	paddingTop: "10px",
	paddingLeft: "10px",
	paddingRight: "10px"
}

const ListStyle:React.CSSProperties = {
	paddingTop: "10px",
	paddingLeft: "20px",
	paddingRight: "20px",
	listStyleType: "none",
	width: "100%"
}

const ListItemStyle:React.CSSProperties = {
	width: "100%"
}

export class PDefaultCategoryQuickBudget extends React.Component<PDefaultCategoryQuickBudgetProps, {}> {

	constructor(props:PDefaultCategoryQuickBudgetProps) {
        super(props);
		this.setBudgetedToBudgetedLastMonth = this.setBudgetedToBudgetedLastMonth.bind(this);
		this.setBudgetedToSpentLastMonth = this.setBudgetedToSpentLastMonth.bind(this);
		this.setBudgetedToAverageBudgeted = this.setBudgetedToAverageBudgeted.bind(this);
		this.setBudgetedToAverageSpent = this.setBudgetedToAverageSpent.bind(this);
		this.setBudgetedToUpcomingTransactions = this.setBudgetedToUpcomingTransactions.bind(this);
	}

	private setBudgetedToBudgetedLastMonth():void {

		// Get the monthlySubCategoryBudget entity for the current month
		var monthlySubCategoryBudget = this.props.monthlySubCategoryBudget;
		// If the current budgeted value is different from what was budgeted last month, update it
		var budgetedPreviousMonth = monthlySubCategoryBudget.budgetedPreviousMonth ? monthlySubCategoryBudget.budgetedPreviousMonth : 0;
		if(budgetedPreviousMonth != monthlySubCategoryBudget.budgeted)
			this.setBudgetedValue(monthlySubCategoryBudget, budgetedPreviousMonth);
	}

	private setBudgetedToSpentLastMonth():void {

		// Get the monthlySubCategoryBudget entity for the current month
		var monthlySubCategoryBudget = this.props.monthlySubCategoryBudget;
		// If the current budgeted value is different from what was spent last month, update it
		var spentPreviousMonth = monthlySubCategoryBudget.spentPreviousMonth ? monthlySubCategoryBudget.spentPreviousMonth : 0;
		if(spentPreviousMonth != monthlySubCategoryBudget.budgeted)
			this.setBudgetedValue(monthlySubCategoryBudget, spentPreviousMonth);
	}

	private setBudgetedToAverageBudgeted():void {

		// Get the monthlySubCategoryBudget entity for the current month
		var monthlySubCategoryBudget = this.props.monthlySubCategoryBudget;
		// If the current budgeted value is different from budgeted average, update it
		var budgetedAverage = monthlySubCategoryBudget.budgetedAverage ? monthlySubCategoryBudget.budgetedAverage : 0;
		if(budgetedAverage != monthlySubCategoryBudget.budgeted)
			this.setBudgetedValue(monthlySubCategoryBudget, budgetedAverage);
	}

	private setBudgetedToAverageSpent():void {

		// Get the monthlySubCategoryBudget entity for the current month
		var monthlySubCategoryBudget = this.props.monthlySubCategoryBudget;
		// If the current budgeted value is different from spent average, update it
		var spentAverage = monthlySubCategoryBudget.spentAverage ? monthlySubCategoryBudget.spentAverage : 0;
		if(spentAverage != monthlySubCategoryBudget.budgeted)
			this.setBudgetedValue(monthlySubCategoryBudget, spentAverage);
	}

	private setBudgetedToUpcomingTransactions():void {

		// Get the monthlySubCategoryBudget entity for the current month
		var monthlySubCategoryBudget = this.props.monthlySubCategoryBudget;
		// If the current budgeted value is different from upcomingTransactions, update it
		var upcomingTransactions = monthlySubCategoryBudget.upcomingTransactions ? monthlySubCategoryBudget.upcomingTransactions : 0;
		// The upcomingTransactions is a negative number, so negate it before comparing to the budgeted value, or
		// using it to set the budgeted value
		if(-upcomingTransactions != monthlySubCategoryBudget.budgeted)
			this.setBudgetedValue(monthlySubCategoryBudget, -upcomingTransactions);
	}

	private setBudgetedValue(monthlySubCategoryBudget:budgetEntities.IMonthlySubCategoryBudget, value:number):void {

		var updatedMonthlySubCategoryBudget = Object.assign({}, monthlySubCategoryBudget);
		updatedMonthlySubCategoryBudget.budgeted = value;
		this.props.updateEntities({
			monthlySubCategoryBudgets: [updatedMonthlySubCategoryBudget]
		});
	}

	private getQuickBudgetItems(monthlySubCategoryBudget:budgetEntities.IMonthlySubCategoryBudget):Array<JSX.Element> {

		var dataFormatter = this.props.dataFormatter;
		// Get the quick budget values
		var budgetedLastMonthValue:number = monthlySubCategoryBudget.budgetedPreviousMonth ? monthlySubCategoryBudget.budgetedPreviousMonth : 0;
		var spentLastMonthValue:number = monthlySubCategoryBudget.spentPreviousMonth ? monthlySubCategoryBudget.spentPreviousMonth : 0;
		var averageBudgetedValue:number = monthlySubCategoryBudget.budgetedAverage;
		var averageSpentValue:number = monthlySubCategoryBudget.spentAverage;
		var upcomingTransactions:number = monthlySubCategoryBudget.upcomingTransactions ? monthlySubCategoryBudget.upcomingTransactions : 0;

		var quickBudgetItems:Array<JSX.Element> = [
			<li key="qbBudgetLastMonth" style={ListItemStyle}>
				<button className="quick-budget-button" onClick={this.setBudgetedToBudgetedLastMonth}>
					Budgeted Last Month: {dataFormatter.formatCurrency(budgetedLastMonthValue)}
				</button>
			</li>,
			<li key="qbSpentLastMonth" style={ListItemStyle}>
				<button className="quick-budget-button" onClick={this.setBudgetedToSpentLastMonth}>
					Spent Last Month: {dataFormatter.formatCurrency(spentLastMonthValue)}
				</button>
			</li>,
			<li key="qbAverageBudgeted" style={ListItemStyle}>
				<button className="quick-budget-button" onClick={this.setBudgetedToAverageBudgeted}>
					Average Budgeted: {dataFormatter.formatCurrency(averageBudgetedValue)}
				</button>
			</li>,
			<li key="qbAverageSpent" style={ListItemStyle}>
				<button className="quick-budget-button" onClick={this.setBudgetedToAverageSpent}>
					Average Spent: {dataFormatter.formatCurrency(averageSpentValue)}
				</button>
			</li>
		];

		// We only need to be concerned with upcoming transactions if they are outflows
		if(upcomingTransactions < 0) {
			quickBudgetItems.unshift(
				<li key="qbUpcoming" style={ListItemStyle}>
					<button className="quick-budget-button" onClick={this.setBudgetedToUpcomingTransactions}>
						Budget for Upcoming: {dataFormatter.formatCurrency(-upcomingTransactions)}
					</button>
				</li>
			);
		}

		return quickBudgetItems;
	}

	public render() {

		// Get the Quick Budet items
		var quickBudgetItems = this.getQuickBudgetItems(this.props.monthlySubCategoryBudget);

		return (
			<div style={QuickBudgetContainerStyle}>
				<div className="inspector-section-header">
					QUICK BUDGET
				</div>
				<ul style={ListStyle}>
					{quickBudgetItems}
				</ul>
			</div>
		);
	}
}
/// <reference path='../../_includes.ts' />

import * as _ from 'lodash';
import { DateWithoutTime, Logger } from '../../utilities';
import { BudgetKnowledge } from '../KnowledgeObjects'; 
import { IDatabaseQuery } from '../../interfaces/persistence';
import { IReferenceDataForCalculations } from '../../interfaces/calculations';
import { executeSqlQueries, executeSqlQueriesAndSaveKnowledge } from '../QueryExecutionUtility';

export class AccountCalculations {

	public performCalculations(budgetId:string,
								budgetKnowledge:BudgetKnowledge,
								referenceData:IReferenceDataForCalculations,
								accountIds:string[],
								startMonth:DateWithoutTime,
								endMonth:DateWithoutTime):Promise<boolean> {

		Logger.info(`AccountCalculations::Performing calculations (startMonth: ${startMonth.toISOString()}; endMonth: ${endMonth}; accountIds: ${accountIds})`);
			
		return executeSqlQueries([
			this.performMonthlyAccountCalculations(budgetId, budgetKnowledge, accountIds, startMonth, endMonth),
			this.performAccountCalculations(budgetId, budgetKnowledge, accountIds)
		]);
	}
			
	private performMonthlyAccountCalculations(budgetId:string, budgetKnowledge:BudgetKnowledge, 
				accountIds:string[], startMonth:DateWithoutTime, endMonth:DateWithoutTime):IDatabaseQuery {

		var accountIdsWrappedInApostrophes:string[] = _.map(accountIds, function(s) {return `'${s}'`; });
		var accountIdsINClause = accountIdsWrappedInApostrophes.join(", ");
		
		var monthsApart:number = startMonth.monthsApart(endMonth);
		var monthEpochValues:string[] = []; 
		for(var i = 0; i <= monthsApart; i++){
			monthEpochValues.push(`(${startMonth.clone().addMonths(i).getUTCTimeSeconds()})`);
		}
		var monthsVirtualTable:string = `
(SELECT "" as month_epoch, date(datetime("", 'unixepoch')) as month FROM (VALUES ${monthEpochValues.join(",")}))`;
					
		return {
			name: "account_monthly_calculations",
			query: `
WITH e_accounts_monthly AS (
SELECT m.month, m.month_epoch, a.entityId as accountId,
	COALESCE(SUM(CASE WHEN t.isCleared = 1 OR t.isReconciled = 1 THEN amount ELSE 0 END), 0) as clearedBalance,
	COALESCE(SUM(CASE WHEN t.isCleared = 0 AND t.isReconciled = 0 THEN amount ELSE 0 END), 0) as unclearedBalance,
	COALESCE(SUM(CASE WHEN t.isAccepted = 0 AND t.isReconciled = 0 THEN 1 ELSE 0 END), 0) as infoCount,
	COALESCE(SUM(CASE WHEN t.affectsBudget = 1 AND t.amount <> 0 AND t.isUncategorized = 1 THEN 1 ELSE 0 END), 0) as warningCount,
	COALESCE(SUM(CASE WHEN t.affectsBudget = 1 AND t.isUncategorized = 0 AND isTransferAccountOnBudget = 1 THEN 1 ELSE 0 END), 0) as errorCount
FROM ${monthsVirtualTable} m,
	(SELECT entityId FROM Accounts WHERE entityId IN (${accountIdsINClause})) a
	LEFT JOIN TransactionCalculations t ON t.accountId = a.entityId AND t.month_epoch = m.month_epoch
GROUP BY m.month, a.entityId
)
REPLACE INTO AccountMonthlyCalculations(budgetId, entityId, isTombstone, month, accountId, 
clearedBalance, unclearedBalance, infoCount, warningCount, errorCount, deviceKnowledge)
SELECT ?1,
('mac/' || strftime('%Y-%m', datetime(month_epoch, 'unixepoch')) || '/' || accountId) as entityId, 0, month, accountId,
clearedBalance, unclearedBalance, infoCount, warningCount, errorCount, ?2
FROM e_accounts_monthly              
			`,
			arguments: [budgetId, budgetKnowledge.getNextValueForCalculations()]
		};
	};
	
	private performAccountCalculations(budgetId:string, budgetKnowledge:BudgetKnowledge, accountIds:string[]):IDatabaseQuery {

		var accountIdsWrappedInApostrophes:string[] = _.map(accountIds, function(s) {return `'${s}'`; });
		var accountIdsINClause = accountIdsWrappedInApostrophes.join(", ");
		
		return {
			name: "account_calculations",
			query: `
WITH e_accounts_monthly_agg AS (
SELECT ac.accountId,
	SUM(ac.clearedBalance) as clearedBalance,
	SUM(ac.unclearedBalance) as unclearedBalance,
	SUM(ac.infoCount) as infoCount,
	SUM(ac.warningCount) as warningCount,
	SUM(ac.errorCount) as errorCount
FROM AccountMonthlyCalculations ac 
WHERE ac.accountId IN (${accountIdsINClause})
GROUP BY ac.accountId
)
REPLACE INTO Accounts(budgetId, entityId, isTombstone, accountType, accountName, 
lastEnteredCheckNumber, lastReconciledDate, lastReconciledBalance, closed, sortableIndex, onBudget, note,
clearedBalance, unclearedBalance, infoCount, warningCount, errorCount, deviceKnowledge, deviceKnowledgeForCalculatedFields)
SELECT ?1, m.accountId, 0, a.accountType, a.accountName, 
a.lastEnteredCheckNumber, a.lastReconciledDate, a.lastReconciledBalance, a.closed, a.sortableIndex, a.onBudget, a.note,
m.clearedBalance, m.unclearedBalance, m.infoCount, m.warningCount, m.errorCount, a.deviceKnowledge, ?2
FROM e_accounts_monthly_agg m
INNER JOIN Accounts a ON m.accountId = a.entityId
			`,
			arguments: [budgetId, budgetKnowledge.getNextValueForCalculations()]
		};
	};
}

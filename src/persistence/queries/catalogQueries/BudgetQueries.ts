/// <reference path='../../../_includes.ts' />

import { DateWithoutTime } from '../../../utilities';
import { IDatabaseQuery } from '../../../interfaces/persistence';
import * as catalogEntities from '../../../interfaces/catalogEntities';

export class BudgetQueries {

	// *********************************************************************************************************
	// Queries for inserting data into the database
	// *********************************************************************************************************
	public static insertDatabaseObject(dbObject:catalogEntities.IBudget):IDatabaseQuery {

		var query:IDatabaseQuery = {

			query: "REPLACE INTO Budgets (entityId, budgetName, dataFormat, lastAccessedOn, firstMonth, lastMonth, isTombstone, isCloudSynced, deviceKnowledge) VALUES (?,?,?,?,?,?,?,?,?)",
			arguments: [
				dbObject.entityId,
				dbObject.budgetName,
				dbObject.dataFormat,
				dbObject.lastAccessedOn,
				dbObject.firstMonth,
				dbObject.lastMonth,
				dbObject.isTombstone,
				dbObject.isCloudSynced,
				dbObject.deviceKnowledge
			]
		};

		return query;
	}

	public static loadDatabaseObject(deviceKnowledge:number):IDatabaseQuery {

		var query:IDatabaseQuery = {

			name: "budgets",
			query: "SELECT * FROM Budgets WHERE deviceKnowledge = 0 OR deviceKnowledge > ?",
			arguments: [
				deviceKnowledge
			]
		};

		return query;
	}

	public static updateLastAccessedOnForBudget(budgetId:string):IDatabaseQuery {

		var currentDate = Date.now();
		var query:IDatabaseQuery = {

			query: "UPDATE Budgets SET lastAccessedOn = ? WHERE entityId = ?",
			arguments: [
				currentDate,
				budgetId
			]
		};

		return query;
	}

	// *********************************************************************************************************
	// Queries for reading data from the database
	// *********************************************************************************************************
	public static getAllBudgets():IDatabaseQuery {

		return {
			name: "budgets",
			query: "SELECT * FROM Budgets",
			arguments: []
		}
	}

	public static findBudgetById(budgetId:string):IDatabaseQuery {

		return {
			name: "budgets",
			query: "SELECT * FROM Budgets WHERE entityId = ?",
			arguments: [budgetId]
		}
	}
}
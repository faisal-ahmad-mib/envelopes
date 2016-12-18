/// <reference path='../_includes.ts' />

import * as _ from 'lodash';

import { BudgetFactory } from './BudgetFactory';
import { DatabaseFactory } from './DatabaseFactory';
import { EntityFactory } from './EntityFactory';
import { CalculationsManager } from './CalculationsManager';
import { DropboxManager } from './DropboxManager';
import * as commonInterfaces from '../interfaces/common'; 
import { IImportedAccountObject } from '../interfaces/objects';
import { IEntity } from '../interfaces/common';
import * as catalogEntities from '../interfaces/catalogEntities';
import * as budgetEntities from '../interfaces/budgetEntities';
import * as catalogQueries from './queries/catalogQueries';
import * as budgetQueries from './queries/budgetQueries';
import * as persistenceHelpers from './helpers';
import * as miscQueries from './queries/miscQueries';
import { IDatabaseQuery } from '../interfaces/persistence';
import { DateWithoutTime, Logger, KeyGenerator } from '../utilities';
import { CatalogKnowledge, BudgetKnowledge } from './KnowledgeObjects';
import { IEntitiesCollection, ISimpleEntitiesCollection } from '../interfaces/state/IEntitiesCollection';
import { executeSqlQueries, executeSqlQueriesAndSaveKnowledge, setDatabaseReference } from './QueryExecutionUtility';
import { IScheduledTransactionCalculationsResult } from '../interfaces/calculations';

export class PersistenceManager {

	// ************************************************************************************************
	// Singleton Implementation
	// ************************************************************************************************
	private static instance:PersistenceManager;

	public static getInstance():PersistenceManager { 

		if(!PersistenceManager.instance)
			PersistenceManager.instance =  new PersistenceManager();

		return PersistenceManager.instance;
	};
	// ************************************************************************************************

	private deviceId:string;
	private catalogKnowledge:CatalogKnowledge;
	private budgetKnowledge:BudgetKnowledge;
	private activeBudget:catalogEntities.IBudget;
	private calculationsManager:CalculationsManager = new CalculationsManager();
	private dropboxManager:DropboxManager = new DropboxManager();

	// Persistence helper classes for catalog entities
	private budgetHelper = new persistenceHelpers.BudgetHelper();
	private globalSettingHelper = new persistenceHelpers.GlobalSettingHelper();

	// Persistence helper classes for budget entities
	private accountHelper = new persistenceHelpers.AccountHelper();
	private masterCategoryHelper = new persistenceHelpers.MasterCategoryHelper();
	private monthlyBudgetHelper = new persistenceHelpers.MonthlyBudgetHelper();
	private monthlySubCategoryBudgetHelper = new persistenceHelpers.MonthlySubCategoryBudgetHelper();
	private payeeHelper = new persistenceHelpers.PayeeHelper();
	private payeeLocationHelper = new persistenceHelpers.PayeeLocationHelper();
	private payeeRenameConditionHelper = new persistenceHelpers.PayeeRenameConditionHelper();
	private scheduledTransactionHelper = new persistenceHelpers.ScheduledTransactionHelper();
	private settingHelper = new persistenceHelpers.SettingHelper();
	private subCategoryHelper = new persistenceHelpers.SubCategoryHelper();
	private transactionHelper = new persistenceHelpers.TransactionHelper();

	public initialize(refreshDatabaseAtStartup:boolean = false):Promise<boolean> {

		if(process.env.NODE_ENV === 'test') {

			// Open a connection to the database.
			var refDatabase = openDatabase("ENAB", "1.0", "ENAB Test Database", 5 * 1024 * 1024);
			// Set the reference of the database in the QueryExecutionUtility
			setDatabaseReference(refDatabase);
			// Explicitly set refreshDatabaseAtStartup to true to force a blank database
			refreshDatabaseAtStartup = true;
		}
		// Ensure that the database tables are created and all the migrations have been run
		var databaseFactory = new DatabaseFactory();
		return databaseFactory.createDatabase(refreshDatabaseAtStartup)
			.then((retVal:boolean)=>{

				// Load the catalog knowledge values from the database
				return this.loadCatalogKnowledgeValuesFromDatabase();
			})
			.then((catalogKnowledge:CatalogKnowledge)=>{

				this.catalogKnowledge = catalogKnowledge;
				// Get the deviceId from the database
				return this.getDeviceInformation(catalogKnowledge);
			})
			.then((deviceId:string)=>{

				this.deviceId = deviceId;
				return this.dropboxManager.initialize(deviceId);
			});
	}

	public selectBudgetToOpen():Promise<catalogEntities.IBudget> {

		// Get all the budget entities from the database
		var query = catalogQueries.BudgetQueries.getAllBudgets();
		return executeSqlQueries([query])
			.then((result:any)=>{

				if(result.budgets && result.budgets.length > 0) {
					// Iterate through the budgets to find the one that has the latest 'lastAccesson' value
					var budget = result.budgets[0];
					for(var i = 1; i < result.budgets.length; i++) {

						if(result.budgets[i].lastAccessedOn > budget.lastAccessedOn)
							budget = result.budgets[i];
					}

					return budget;
				}
				else {

					// Currently there is no budget in the database. Create a blank new budget.
					var budgetFactory = new BudgetFactory();
					var budgetEntity = EntityFactory.createNewBudget();
					budgetEntity.budgetName = "My Budget"; 
					return budgetFactory.createNewBudget(budgetEntity, this.catalogKnowledge);
				}
			});
	}

	public loadBudget(budget:catalogEntities.IBudget):Promise<ISimpleEntitiesCollection> {

		Logger.info(`Loading budget ${budget.budgetName}.`);
		// Set this as the currently active budget in persistence manager
		this.activeBudget = budget;
		// Load the budget knowledge values for this budget
		return this.loadBudgetKnowledgeValuesFromDatabase(budget.entityId)
			.then((budgetKnowledge:BudgetKnowledge)=>{

				this.budgetKnowledge = budgetKnowledge;
				// Run scheduled transaction calculations when opening the budget
				return this.calculationsManager.performScheduledTransactionCalculations(budget.entityId, budgetKnowledge, true);
			})
			.then((retVal:IScheduledTransactionCalculationsResult)=>{

				var catalogDeviceKnowledge = this.catalogKnowledge.lastDeviceKnowledgeLoadedFromLocalStorage;
				var budgetDeviceKnowledge = this.budgetKnowledge.lastDeviceKnowledgeLoadedFromLocalStorage;
				var budgetDeviceKnowledgeForCalculations = this.budgetKnowledge.lastDeviceKnowledgeForCalculationsLoadedFromLocalStorage;
				return this.loadEntitiesFromDatabase(budget.entityId, budgetDeviceKnowledge, budgetDeviceKnowledgeForCalculations, catalogDeviceKnowledge);
			});
	}

	public syncDataWithDatabase(updatedEntitiesCollection:ISimpleEntitiesCollection, existingEntitiesCollection:IEntitiesCollection):Promise<ISimpleEntitiesCollection> {

		var budgetId = this.activeBudget.entityId;
		var budgetKnowledge = this.budgetKnowledge;
		var changedEntitiesFromDatabase:ISimpleEntitiesCollection;

		// Persist the passed entities into the database
		return this.saveEntitiesToDatabase(updatedEntitiesCollection, existingEntitiesCollection)
			.then((retVal:boolean)=>{

				// Run pending calculations
				return this.calculationsManager.performPendingCalculations(budgetId, budgetKnowledge);
			})
			.then((retVal:boolean)=>{
				
				// Load updated data from the database
				var catalogDeviceKnowledge = this.catalogKnowledge.lastDeviceKnowledgeLoadedFromLocalStorage;
				var budgetDeviceKnowledge = this.budgetKnowledge.lastDeviceKnowledgeLoadedFromLocalStorage;
				var budgetDeviceKnowledgeForCalculations = this.budgetKnowledge.lastDeviceKnowledgeForCalculationsLoadedFromLocalStorage;
				return this.loadEntitiesFromDatabase(budgetId, budgetDeviceKnowledge, budgetDeviceKnowledgeForCalculations, catalogDeviceKnowledge);
			})
			.then((moreUpdatedEntities:ISimpleEntitiesCollection)=>{

				changedEntitiesFromDatabase = moreUpdatedEntities;
				// We received some updated entities from the UI for persistence. As a result of those changes,
				// some more entities would have been updated in the database (either by the persistence helpers
				// or as a result of performing pending calculations). We are going to merge these two collections
				// and write a diff file from the merged collection.
				var mergedChangedEntities = this.getChangedEntitiesForDiff(updatedEntitiesCollection, moreUpdatedEntities);
				return this.dropboxManager.writeDiffFile(this.activeBudget, mergedChangedEntities);
			})
			.then((retVal:boolean)=>{
				// Return the changes loaded from database back so they can be merged into the in-memory state
				return changedEntitiesFromDatabase;
			});
	}

	public createNewBudget(budget:catalogEntities.IBudget):Promise<catalogEntities.IBudget> {

		// Create a blank new budget.
		var budgetFactory = new BudgetFactory();
		return budgetFactory.createNewBudget(budget, this.catalogKnowledge)
	}

	public ensureMonthlyDataExistsForMonth(month:DateWithoutTime, existingEntitiesCollection:IEntitiesCollection):Promise<ISimpleEntitiesCollection> {

		var budgetId = this.activeBudget.entityId;
		var budgetKnowledge = this.budgetKnowledge;

		Logger.info(`PersistenceManager::Ensure that monthly budget data for the month of '${month.toISOString()}' already exists.`);
		var budgetFactory = new BudgetFactory();
		return budgetFactory.createMonthlyBudgetDataForMonth(budgetId, month, true, budgetKnowledge)
			.then((retVal:any)=>{

				// Run pending calculations
				Logger.info(`PersistenceManager::Performing pending calculations.`);
				return this.calculationsManager.performPendingCalculations(budgetId, budgetKnowledge);
			})
			.then((retVal:boolean)=>{
				
				Logger.info(`PersistenceManager::Loading updated data from the database.`);
				// Load updated data from the database
				var catalogDeviceKnowledge = this.catalogKnowledge.lastDeviceKnowledgeLoadedFromLocalStorage;
				var budgetDeviceKnowledge = this.budgetKnowledge.lastDeviceKnowledgeLoadedFromLocalStorage;
				var budgetDeviceKnowledgeForCalculations = this.budgetKnowledge.lastDeviceKnowledgeForCalculationsLoadedFromLocalStorage;
				return this.loadEntitiesFromDatabase(budgetId, budgetDeviceKnowledge, budgetDeviceKnowledgeForCalculations, catalogDeviceKnowledge);
			});
	}

	public performScheduledTransactionCalculations():Promise<ISimpleEntitiesCollection> {

		Logger.info(`PersistenceManager::Performing calculations for all scheduled transaction.`);
		var budgetId = this.activeBudget.entityId;
		var budgetKnowledge = this.budgetKnowledge;
		return this.calculationsManager.performScheduledTransactionCalculations(budgetId, budgetKnowledge, true)
			.then((retVal:IScheduledTransactionCalculationsResult)=>{
				
				Logger.info(`PersistenceManager::Loading updated data from the database.`);
				// Load updated data from the database
				var catalogDeviceKnowledge = this.catalogKnowledge.lastDeviceKnowledgeLoadedFromLocalStorage;
				var budgetDeviceKnowledge = this.budgetKnowledge.lastDeviceKnowledgeLoadedFromLocalStorage;
				var budgetDeviceKnowledgeForCalculations = this.budgetKnowledge.lastDeviceKnowledgeForCalculationsLoadedFromLocalStorage;
				return this.loadEntitiesFromDatabase(budgetId, budgetDeviceKnowledge, budgetDeviceKnowledgeForCalculations, catalogDeviceKnowledge);
			});
	}

	public generateUpcomingTransactionsNow(scheduledTransactionIds:Array<string>):Promise<ISimpleEntitiesCollection> {

		Logger.info(`PersistenceManager::Generating upcoming transactions for selected scheduled transactions now.`);
		var budgetId = this.activeBudget.entityId;
		var budgetKnowledge = this.budgetKnowledge;
		return this.calculationsManager.scheduledTransactionCalculations.generateUpcomingTransactionNow(budgetId, budgetKnowledge, scheduledTransactionIds)
			.then((retVal:IScheduledTransactionCalculationsResult)=>{

				Logger.info(`PersistenceManager::Running pending calculations.`);
				return this.calculationsManager.performPendingCalculations(budgetId, budgetKnowledge);
			})
			.then((retVal:boolean)=>{

				Logger.info(`PersistenceManager::Loading updated data from the database.`);
				// Load updated data from the database
				var catalogDeviceKnowledge = this.catalogKnowledge.lastDeviceKnowledgeLoadedFromLocalStorage;
				var budgetDeviceKnowledge = this.budgetKnowledge.lastDeviceKnowledgeLoadedFromLocalStorage;
				var budgetDeviceKnowledgeForCalculations = this.budgetKnowledge.lastDeviceKnowledgeForCalculationsLoadedFromLocalStorage;
				return this.loadEntitiesFromDatabase(budgetId, budgetDeviceKnowledge, budgetDeviceKnowledgeForCalculations, catalogDeviceKnowledge);
			});
	}
	// ************************************************************************************************
	// Internal/Utility Methods
	// ************************************************************************************************
	private getDeviceInformation(catalogKnowledge:CatalogKnowledge):Promise<string> {

		var queryList:Array<IDatabaseQuery> = [
			{name: "device", query: "SELECT * FROM GlobalSettings WHERE settingName = 'deviceId';", arguments: [] }
		];

		return executeSqlQueries(queryList)
			.then((result:any) => {

				var deviceRows:Array<any> = result.device;
				if(deviceRows && deviceRows.length > 0 && deviceRows[0].settingValue != null) {

					// We already have a device object. Get the deviceId from that and return
					return deviceRows[0].settingValue;
				}
				else {

					// We need to insert a row into the database for the device
					var deviceId:string = KeyGenerator.generateUUID();
					queryList = [ 
						{query: "REPLACE INTO GlobalSettings VALUES (?,?,?)", arguments: ["deviceId", deviceId, catalogKnowledge.getNextValue()]} 
					];
					return executeSqlQueries(queryList)
						.then((result:any) => {

							return deviceId;
						});
				}
			})
			.catch((error:Error) => {

				Logger.error(error);
				return null;
			});
	}

	private loadCatalogKnowledgeValuesFromDatabase():Promise<CatalogKnowledge> {

		var queryList:Array<IDatabaseQuery> = [
			miscQueries.KnowledgeValueQueries.getLoadCatalogKnowledgeValueQuery()
		];

		return executeSqlQueries(queryList)
			.then((result:any)=>{

				var catalogKnowledge:CatalogKnowledge = new CatalogKnowledge();
				if(result.catalogKnowledge && result.catalogKnowledge.length > 0) {

					catalogKnowledge.currentDeviceKnowledge = result.catalogKnowledge[0].currentDeviceKnowledge;
					catalogKnowledge.deviceKnowledgeOfServer = result.catalogKnowledge[0].deviceKnowledgeOfServer;
					catalogKnowledge.serverKnowledgeOfDevice = result.catalogKnowledge[0].serverKnowledgeOfDevice;
				}

				return catalogKnowledge;
			});
	}

	private saveCatalogKnowledgeValuesToDatabase(catalogKnowledge:CatalogKnowledge):Promise<any> {

		var query = miscQueries.KnowledgeValueQueries.getSaveCatalogKnowledgeValueQuery(catalogKnowledge);
		return executeSqlQueries([query]);
	}

	private loadBudgetKnowledgeValuesFromDatabase(budgetId:string):Promise<BudgetKnowledge> {

		var budgetKnowledge:BudgetKnowledge = new BudgetKnowledge();
		var queryList:Array<IDatabaseQuery> = [
			miscQueries.KnowledgeValueQueries.getLoadBudgetKnowledgeValueQuery(budgetId),
			miscQueries.KnowledgeValueQueries.getMaxDeviceKnowledgeFromBudgetEntities(budgetId)
		];

		return executeSqlQueries(queryList)
			.then((result:any)=>{

				var budgetKnowledgeFound = (result.budgetKnowledge && result.budgetKnowledge.length > 0);
				budgetKnowledge.currentDeviceKnowledge = budgetKnowledgeFound ? result.budgetKnowledge[0].currentDeviceKnowledge : 0;
				budgetKnowledge.currentDeviceKnowledgeForCalculations = budgetKnowledgeFound ? result.budgetKnowledge[0].currentDeviceKnowledgeForCalculations : 0;
				budgetKnowledge.deviceKnowledgeOfServer = budgetKnowledgeFound ? result.budgetKnowledge[0].deviceKnowledgeOfServer : 0;
				budgetKnowledge.serverKnowledgeOfDevice = budgetKnowledgeFound ? result.budgetKnowledge[0].serverKnowledgeOfDevice : 0;
				budgetKnowledge.lastDeviceKnowledgeLoadedFromLocalStorage = 0;

				if(result.budgetKnowledgeFromEntities && result.budgetKnowledgeFromEntities.length > 0) {

					// This is the max device knowledge value that has been assigned to an entity of this budget
					// We want to ensure that the deviceKnowledge value that we loaded from the BudgetVersionKnowledge
					// table is not less then this.
					var deviceKnowledgeFromEntities = result.budgetKnowledgeFromEntities[0].deviceKnowledge;
					if(deviceKnowledgeFromEntities > 0 && (deviceKnowledgeFromEntities >= budgetKnowledge.currentDeviceKnowledge)) {
						// We want to set the current device knowledge to be one more than the max device knowledge
						budgetKnowledge.currentDeviceKnowledge = deviceKnowledgeFromEntities + 1;
					}
				}

				return budgetKnowledge;
			});
	}

	private saveBudgetKnowledgeValuesToDatabase(budgetId:string, budgetKnowledge:BudgetKnowledge):Promise<any> {

		var query = miscQueries.KnowledgeValueQueries.getSaveBudgetKnowledgeValueQuery(budgetId, budgetKnowledge);
		return executeSqlQueries([query]);
	}

	private saveEntitiesToDatabase(entitiesCollection:ISimpleEntitiesCollection, existingEntitiesCollection:IEntitiesCollection):Promise<boolean> {

		var budgetId = this.activeBudget.entityId;
		var budgetKnowledge = this.budgetKnowledge;
		var catalogKnowledge = this.catalogKnowledge;

		// Create queries to persist these entities
		var queriesList:Array<IDatabaseQuery> = [];
		queriesList = _.concat(

			// Get the Data Persistence Queries for saving the catalog entities
			this.budgetHelper.getPersistenceQueries(entitiesCollection, existingEntitiesCollection, catalogKnowledge),
			this.globalSettingHelper.getPersistenceQueries(entitiesCollection, existingEntitiesCollection, catalogKnowledge),
			
			// Get the Data Persistence Queries for saving the budget entities
			this.accountHelper.getPersistenceQueries(budgetId, entitiesCollection, existingEntitiesCollection, budgetKnowledge),
			this.masterCategoryHelper.getPersistenceQueries(budgetId, entitiesCollection, existingEntitiesCollection, budgetKnowledge),
			this.monthlyBudgetHelper.getPersistenceQueries(budgetId, entitiesCollection, existingEntitiesCollection, budgetKnowledge),
			this.monthlySubCategoryBudgetHelper.getPersistenceQueries(budgetId, entitiesCollection, existingEntitiesCollection, budgetKnowledge),
			this.payeeHelper.getPersistenceQueries(budgetId, entitiesCollection, existingEntitiesCollection, budgetKnowledge),
			this.payeeLocationHelper.getPersistenceQueries(budgetId, entitiesCollection, existingEntitiesCollection, budgetKnowledge),
			this.payeeRenameConditionHelper.getPersistenceQueries(budgetId, entitiesCollection, existingEntitiesCollection, budgetKnowledge),
			this.scheduledTransactionHelper.getPersistenceQueries(budgetId, entitiesCollection, existingEntitiesCollection, budgetKnowledge),
			this.settingHelper.getPersistenceQueries(budgetId, entitiesCollection, existingEntitiesCollection, budgetKnowledge),
			this.subCategoryHelper.getPersistenceQueries(budgetId, entitiesCollection, existingEntitiesCollection, budgetKnowledge),
			this.transactionHelper.getPersistenceQueries(budgetId, entitiesCollection, existingEntitiesCollection, budgetKnowledge)
		)

		if(queriesList.length > 0)
			return executeSqlQueriesAndSaveKnowledge(queriesList, budgetId, budgetKnowledge, catalogKnowledge);
		else	
			return Promise.resolve(true);
	}

	private loadEntitiesFromDatabase(budgetId:string, budgetDeviceKnowlege:number, budgetDeviceKnowledgeForCalculations:number, catalogDeviceKnowledge:number):Promise<ISimpleEntitiesCollection> {

		var queryList = [
			// Whenever we load the entities for a particular budget, we also update it's lastAccessedOn value
			catalogQueries.BudgetQueries.updateLastAccessedOnForBudget(budgetId),
			catalogQueries.BudgetQueries.loadDatabaseObject(catalogDeviceKnowledge),
			catalogQueries.GlobalSettingQueries.loadDatabaseObject(catalogDeviceKnowledge),
			budgetQueries.AccountQueries.loadDatabaseObject(budgetId, budgetDeviceKnowlege, budgetDeviceKnowledgeForCalculations),
			budgetQueries.MasterCategoryQueries.loadDatabaseObject(budgetId, budgetDeviceKnowlege),
			budgetQueries.MonthlyBudgetQueries.loadDatabaseObject(budgetId, budgetDeviceKnowlege, budgetDeviceKnowledgeForCalculations),
			budgetQueries.MonthlySubCategoryBudgetQueries.loadDatabaseObject(budgetId, budgetDeviceKnowlege, budgetDeviceKnowledgeForCalculations),
			budgetQueries.PayeeQueries.loadDatabaseObject(budgetId, budgetDeviceKnowlege),
			budgetQueries.PayeeLocationQueries.loadDatabaseObject(budgetId, budgetDeviceKnowlege),
			budgetQueries.PayeeRenameConditionQueries.loadDatabaseObject(budgetId, budgetDeviceKnowlege),
			budgetQueries.ScheduledTransactionQueries.loadDatabaseObject(budgetId, budgetDeviceKnowlege, budgetDeviceKnowledgeForCalculations),
			budgetQueries.SettingQueries.loadDatabaseObject(budgetId, budgetDeviceKnowlege),
			budgetQueries.SubCategoryQueries.loadDatabaseObject(budgetId, budgetDeviceKnowlege),
			budgetQueries.TransactionQueries.loadDatabaseObject(budgetId, budgetDeviceKnowlege, budgetDeviceKnowledgeForCalculations),
			// Also load the knowledge values that are in the database
			miscQueries.KnowledgeValueQueries.getLoadCatalogKnowledgeValueQuery(),
			miscQueries.KnowledgeValueQueries.getLoadBudgetKnowledgeValueQuery(budgetId),
		];

		return executeSqlQueries(queryList)
			.then((result:any)=>{

				// Use the loaded knowledge values to update the values in the budgetKnowledge object
				this.catalogKnowledge.lastDeviceKnowledgeLoadedFromLocalStorage = result.catalogKnowledge[0].currentDeviceKnowledge;
				this.budgetKnowledge.lastDeviceKnowledgeLoadedFromLocalStorage = result.budgetKnowledge[0].currentDeviceKnowledge;
				this.budgetKnowledge.lastDeviceKnowledgeForCalculationsLoadedFromLocalStorage = result.budgetKnowledge[0].currentDeviceKnowledgeForCalculations;

				// resolve the promise with the result object
				return Promise.resolve(result);
			});
	}

	private getChangedEntitiesForDiff(changedEntities1:ISimpleEntitiesCollection, changedEntities2:ISimpleEntitiesCollection):ISimpleEntitiesCollection {

		var mergedChanges:ISimpleEntitiesCollection = {
			accounts: [].concat(
				changedEntities1.accounts ? changedEntities1.accounts : []
			),
			masterCategories: [].concat(
				changedEntities1.masterCategories ? changedEntities1.masterCategories : [],
				changedEntities2.masterCategories ? changedEntities2.masterCategories : []
			),
			monthlyBudgets: [].concat(
				changedEntities1.monthlyBudgets ? changedEntities1.monthlyBudgets : []
			),
			monthlySubCategoryBudgets: [].concat(
				changedEntities1.monthlySubCategoryBudgets ? changedEntities1.monthlySubCategoryBudgets : []
			),
			payees: [].concat(
				changedEntities1.payees ? changedEntities1.payees : [],
				changedEntities2.payees ? changedEntities2.payees : []
			),
			payeeLocations: [].concat(
				changedEntities1.payeeLocations ? changedEntities1.payeeLocations : [],
				changedEntities2.payeeLocations ? changedEntities2.payeeLocations : []
			),
			payeeRenameConditions: [].concat(
				changedEntities1.payeeRenameConditions ? changedEntities1.payeeRenameConditions : [],
				changedEntities2.payeeRenameConditions ? changedEntities2.payeeRenameConditions : []
			),
			scheduledTransactions: [].concat(
				changedEntities1.scheduledTransactions ? changedEntities1.scheduledTransactions : [],
				changedEntities2.scheduledTransactions ? changedEntities2.scheduledTransactions : []
			),
			settings: [].concat(
				changedEntities1.settings ? changedEntities1.settings : [],
				changedEntities2.settings ? changedEntities2.settings : []
			),
			subCategories: [].concat(
				changedEntities1.subCategories ? changedEntities1.subCategories : [],
				changedEntities2.subCategories ? changedEntities2.subCategories : []
			),
			transactions: [].concat(
				changedEntities1.transactions ? changedEntities1.transactions : [],
				changedEntities2.transactions ? changedEntities2.transactions : []
			)
		}

		mergedChanges.accounts = mergedChanges.accounts.length > 0 ? mergedChanges.accounts : undefined;
		mergedChanges.masterCategories = mergedChanges.masterCategories.length > 0 ? mergedChanges.masterCategories : undefined;
		mergedChanges.monthlyBudgets = mergedChanges.monthlyBudgets.length > 0 ? mergedChanges.monthlyBudgets : undefined;
		mergedChanges.monthlySubCategoryBudgets = mergedChanges.monthlySubCategoryBudgets.length > 0 ? mergedChanges.monthlySubCategoryBudgets : undefined;
		mergedChanges.payees = mergedChanges.payees.length > 0 ? mergedChanges.payees : undefined;
		mergedChanges.payeeLocations = mergedChanges.payeeLocations.length > 0 ? mergedChanges.payeeLocations : undefined;
		mergedChanges.payeeRenameConditions = mergedChanges.payeeRenameConditions.length > 0 ? mergedChanges.payeeRenameConditions : undefined;
		mergedChanges.scheduledTransactions = mergedChanges.scheduledTransactions.length > 0 ? mergedChanges.scheduledTransactions : undefined;
		mergedChanges.settings = mergedChanges.settings.length > 0 ? mergedChanges.settings : undefined;
		mergedChanges.subCategories = mergedChanges.subCategories.length > 0 ? mergedChanges.subCategories : undefined;
		mergedChanges.transactions = mergedChanges.transactions.length > 0 ? mergedChanges.transactions : undefined;

		// Iterate through the entities and set all the calculated fields to undefined
		if(mergedChanges.accounts) {
			mergedChanges.accounts = _.map(mergedChanges.accounts, (account:budgetEntities.IAccount)=>{
				account.clearedBalance = undefined;
				account.unclearedBalance = undefined;
				account.infoCount = undefined;
				account.warningCount = undefined;
				account.errorCount = undefined;
				account.deviceKnowledgeForCalculatedFields = undefined;
				return account;
			});
		}

		if(mergedChanges.monthlyBudgets) {
			mergedChanges.monthlyBudgets = _.map(mergedChanges.monthlyBudgets, (monthlyBudget:budgetEntities.IMonthlyBudget)=>{
				monthlyBudget.previousIncome = undefined;
				monthlyBudget.immediateIncome = undefined;
				monthlyBudget.budgeted = undefined;
				monthlyBudget.cashOutflows = undefined;
				monthlyBudget.creditOutflows = undefined;
				monthlyBudget.balance = undefined;
				monthlyBudget.overSpent = undefined;
				monthlyBudget.availableToBudget = undefined;
				monthlyBudget.uncategorizedCashOutflows = undefined;
				monthlyBudget.uncategorizedCreditOutflows = undefined;
				monthlyBudget.uncategorizedBalance = undefined;
				monthlyBudget.hiddenBudgeted = undefined;
				monthlyBudget.hiddenCashOutflows = undefined;
				monthlyBudget.hiddenCreditOutflows = undefined;
				monthlyBudget.hiddenBalance = undefined;
				monthlyBudget.additionalToBeBudgeted = undefined;
				monthlyBudget.ageOfMoney = undefined;
				monthlyBudget.deviceKnowledgeForCalculatedFields = undefined;
				return monthlyBudget;
			});
		}

		if(mergedChanges.monthlySubCategoryBudgets) {
			mergedChanges.monthlySubCategoryBudgets = _.map(mergedChanges.monthlySubCategoryBudgets, (monthlySubCategoryBudget:budgetEntities.IMonthlySubCategoryBudget)=>{
				monthlySubCategoryBudget.cashOutflows = undefined;
				monthlySubCategoryBudget.positiveCashOutflows = undefined;
				monthlySubCategoryBudget.creditOutflows = undefined;
				monthlySubCategoryBudget.balance = undefined;
				monthlySubCategoryBudget.budgetedCashOutflows = undefined;
				monthlySubCategoryBudget.budgetedCreditOutflows = undefined;
				monthlySubCategoryBudget.unBudgetedCashOutflows = undefined;
				monthlySubCategoryBudget.unBudgetedCreditOutflows = undefined;
				monthlySubCategoryBudget.budgetedPreviousMonth = undefined;
				monthlySubCategoryBudget.spentPreviousMonth = undefined;
				monthlySubCategoryBudget.paymentPreviousMonth = undefined;
				monthlySubCategoryBudget.balancePreviousMonth = undefined;
				monthlySubCategoryBudget.budgetedAverage = undefined;
				monthlySubCategoryBudget.spentAverage = undefined;
				monthlySubCategoryBudget.paymentAverage = undefined;
				monthlySubCategoryBudget.budgetedSpending = undefined;
				monthlySubCategoryBudget.allSpending = undefined;
				monthlySubCategoryBudget.allSpendingSinceLastPayment = undefined;
				monthlySubCategoryBudget.transactionsCount = undefined;
				monthlySubCategoryBudget.upcomingTransactions = undefined;
				monthlySubCategoryBudget.upcomingTransactionsCount = undefined;
				monthlySubCategoryBudget.additionalToBeBudgeted = undefined;
				monthlySubCategoryBudget.goalTarget = undefined;
				monthlySubCategoryBudget.goalOverallFunded = undefined;
				monthlySubCategoryBudget.goalOverallLeft = undefined;
				monthlySubCategoryBudget.goalUnderFunded = undefined;
				monthlySubCategoryBudget.goalExpectedCompletion = undefined;
				monthlySubCategoryBudget.deviceKnowledgeForCalculatedFields = undefined;
				return monthlySubCategoryBudget;
			});
		}
		
		if(mergedChanges.transactions) {
			mergedChanges.transactions = _.map(mergedChanges.transactions, (transaction:budgetEntities.ITransaction)=>{
				transaction.cashAmount = undefined;
				transaction.creditAmount = undefined;
				transaction.subCategoryCreditAmountPreceding = undefined;
				transaction.deviceKnowledgeForCalculatedFields = undefined;
				return transaction;
			});
		}
		
		return mergedChanges;
	}
}
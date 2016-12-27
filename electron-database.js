const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Promise } = require('es6-promise');
const { app, ipcMain } = require('electron');

let budgetDatabase; 
let logsDatabase;

function initializeModule() {

	// Start listening for ipc messages related to database
	ipcMain.on('database-budget-request', handleDatabaseBudgetMessage);
	ipcMain.on('database-logs-request', handleDatabaseLogsMessage);

	// Initialize the databases 
	return initializeBudgetDatabase()
		.then(()=>{
			return initializeLogsDatabase();
		})
		.catch(function(error) {
			console.log(error);
		});
}

function finalizeModule() {

	// Remove the listeners from ipcMain
	ipcMain.removeListener('database-budget-request', handleDatabaseBudgetMessage);
	ipcMain.removeListener('database-logs-request', handleDatabaseLogsMessage);
	// Close the database. We will re-initialize it if we activate.
	return closeBudgetDatabase()
		.then(()=>{
			return closeLogsDatabase();
		});
}

function getAppFolderPath() {
	var appFolderName = (process.env.NODE_ENV === 'development') ? "ENAB-DEV" : "ENAB";  
	var appFolderPath = path.join(app.getPath('documents'), appFolderName);
	return appFolderPath;
}

function handleDatabaseBudgetMessage(event, args) {

	var requestId = args.requestId;
	var queryList = args.queryList;

	return executeDatabaseQueries(budgetDatabase, queryList)
		.then((resultObj)=>{
			// Pass the result object received from the database back to the caller
			event.sender.send(requestId, null, resultObj);
		})
		.catch(function(error) {
			// In case of error, send the error object back to the caller
			event.sender.send(requestId, error, null);
		});
}

function handleDatabaseLogsMessage(event, args) {

	var requestId = args.requestId;
	var queryList = args.queryList;

	return executeDatabaseQueries(logsDatabase, queryList)
		.then((resultObj)=>{
			// Pass the result object received from the database back to the caller
			event.sender.send(requestId, null, resultObj);
		})
		.catch(function(error) {
			// In case of error, send the error object back to the caller
			event.sender.send(requestId, error, null);
		});
}

function initializeBudgetDatabase() {

	return new Promise((resolve, reject)=>{

		var appFolderPath = getAppFolderPath();  
		// Ensure that the directory for the app exists
		if (!fs.existsSync(appFolderPath))
			fs.mkdirSync(appFolderPath);

		var databaseFileName = path.join(appFolderPath,'enab.db');
		// Open a connection to the database.
		budgetDatabase = new sqlite3.Database(databaseFileName);
		// Provide an error handler on the database object
		budgetDatabase.on('error', (err)=>{
			reject(err);
		});
		// Provide a success handler to use the returned database object when it is opened
		budgetDatabase.on('open', ()=>{
			resolve(true);
		});
	});
} 

function initializeLogsDatabase() {

	return new Promise((resolve, reject)=>{

		var appFolderPath = getAppFolderPath();  
		// Ensure that the directory for the app exists
		if (!fs.existsSync(appFolderPath))
			fs.mkdirSync(appFolderPath);

		var databaseFileName = path.join(appFolderPath,'enab-log.db');
		// Open a connection to the database.
		logsDatabase = new sqlite3.Database(databaseFileName);
		// Provide an error handler on the database object
		logsDatabase.on('error', (err)=>{
			reject(err);
		});
		// Provide a success handler to use the returned database object when it is opened
		logsDatabase.on('open', ()=>{
			resolve(true);
		});
	});
} 

function closeBudgetDatabase() {

	return new Promise((resolve, reject)=>{
		budgetDatabase.close(function(error) {

			budgetDatabase = null;
			if(error)
				reject(error);

			resolve();
		});
	});
}

function closeLogsDatabase() {

	return new Promise((resolve, reject)=>{
		logsDatabase.close(function(error) {

			logsDatabase = null;
			if(error)
				reject(error);

			resolve();
		});
	});
}

function executeDatabaseQueries(database, databaseQueries) {

	// We are getting an array of "IDatabaseQuery" objects here.
	// Each IDatabaseQuery has the following properties
	// - name?: string
	// - query: string
	// - arguments: Array<any>
	return new Promise((resolve, reject)=>{
		
		database.serialize(function() {

			var resultObj = {};
			// Start a transaction
			database.exec('BEGIN');
			var promises = databaseQueries.map(function(databaseQuery) {
				return executeDatabaseQuery(database, databaseQuery, resultObj);
			});

			Promise.all(promises)
				.then(()=>{
					// Commit the transaction
					database.exec('COMMIT');
					// Resolve the promise
					resolve(resultObj);
				})
				.catch((error)=>{
					// Rollback the transaction
					database.exec('ROLLBACK');
					// Reject the promise
					reject(error);
				});
		});
	});
}

function executeDatabaseQuery(database, databaseQuery, resultObj) {

	return new Promise((resolve, reject)=>{

		database.all(databaseQuery.query, databaseQuery.arguments, function(err, rows) {

			if(err) {
				console.log(err);
				reject(err);
			}

			if(databaseQuery.name)
				resultObj[databaseQuery.name] = rows;

			resolve();
		});
	});
}

module.exports = {
	initializeDatabaseModule: initializeModule,
	finalizeDatabaseModule: finalizeModule
};
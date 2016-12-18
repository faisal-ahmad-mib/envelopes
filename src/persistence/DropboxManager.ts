/// <reference path='../_includes.ts' />

import { IBudget } from '../interfaces/catalogEntities';
import { ISimpleEntitiesCollection } from '../interfaces/state';

export class DropboxManager {

	private deviceId:string;
	private dropboxDiffFolderPath:string;
	private appDiffFolderPath:string;
	private dropboxFolderFound:boolean = false;

	private get appFolderName():string {
		return (process.env.NODE_ENV === 'development') ? "ENAB-DEV" : "ENAB";  
	}

	public initialize(deviceId:string):Promise<boolean> {

		// Save the deviceId in the local variable
		this.deviceId = deviceId;

		// Load the dropbox config file and get the path for the dropbox folder. Ensure that 
		// the diff folders exist in both the app and dropbox folders
		return new Promise<any>((resolve, reject)=>{

			// Get the fs and path modules
			const remote = require('electron').remote;
			const { app } = require('electron').remote;
			const fs = remote.require('fs');
			const path = remote.require('path');

			var configFilePath:string;
			if(process.platform == "darwin")
				configFilePath = path.join(app.getPath("home"), ".dropbox/info.json");

			fs.readFile(configFilePath, (error, data)=>{

				if(error)
					reject(error);

				var configObj = JSON.parse(data);
				if(configObj && configObj.personal && configObj.personal.path) {

					// Save the location of the dropbox diff folder in the local variable
					this.dropboxFolderFound = true;
					this.dropboxDiffFolderPath = path.join(configObj.personal.path, this.appFolderName, "diffs");

					// Ensure that the app folder exists in the dropbox folder
					var dropboxAppFolderPath = path.join(configObj.personal.path, this.appFolderName);
					if (!fs.existsSync(dropboxAppFolderPath)) {
						fs.mkdirSync(dropboxAppFolderPath);
					}
					
					// Ensure that the diff folder exists in the dropbox app folder
					if (!fs.existsSync(this.dropboxDiffFolderPath)) {
						fs.mkdirSync(this.dropboxDiffFolderPath);
					}
				}

				// Also save the location for the app diff folder and ensure that it exists
				this.appDiffFolderPath = path.join(app.getPath("documents"), this.appFolderName, "diffs");
				if (!fs.existsSync(this.appDiffFolderPath)) {
					fs.mkdirSync(this.appDiffFolderPath);
				}

				resolve(true);
			});
		});
	}	

	public writeDiffFile(budget:IBudget, changedEntities:ISimpleEntitiesCollection):Promise<boolean> {

		return new Promise<any>((resolve, reject)=>{

			// Get the fs and path modules
			const remote = require('electron').remote;
			const { app } = require('electron').remote;
			const fs = remote.require('fs');
			const path = remote.require('path');

			// The name of the diff file is going to use the current time
			var diffFilePath = this.getNewDiffFilePath(budget);
			var diffFileContents = JSON.stringify(changedEntities);
			fs.writeFile(diffFilePath, diffFileContents, (error)=>{

				if(error)
					reject(error);
				else
					resolve(true);		
			});
		});
	}

	// ************************************************************************************************
	// Utility Methods
	// ************************************************************************************************
	private getNewDiffFilePath(budget:IBudget):string {

		const remote = require('electron').remote;
		const path = remote.require('path');
		const fs = remote.require('fs');

		// The name of the diff file is going to be the current local time
		var diffFileName = `${Date.now().toString()}.diff`;
		var diffFileFolderForBudget:string;

		if(budget.isCloudSynced)
			diffFileFolderForBudget = path.join(this.dropboxDiffFolderPath, budget.entityId);
		else
			diffFileFolderForBudget = path.join(this.appDiffFolderPath, budget.entityId);

		// Ensure that this folder exists
		if(!fs.existsSync(diffFileFolderForBudget)) {
			fs.mkdirSync(diffFileFolderForBudget);
		}

		return path.join(diffFileFolderForBudget, diffFileName);
	} 
} 
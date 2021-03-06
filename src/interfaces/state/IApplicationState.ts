import { IEntitiesCollection } from './IEntitiesCollection';
import { ISidebarState } from './ISidebarState';
import { IRegisterState } from './IRegisterState';
import { DateWithoutTime } from '../../utilities';
import { IBudget } from '../catalogEntities';

export interface IApplicationState {

	// ****************************************************************************************************
	// Shared Global Data
	// ****************************************************************************************************
	activeBudgetId:string;
	entitiesCollection:IEntitiesCollection;
	
	// ****************************************************************************************************
	// UI State
	// ****************************************************************************************************
	selectedBudgetMonth:DateWithoutTime;

	sidebarState:ISidebarState;
}
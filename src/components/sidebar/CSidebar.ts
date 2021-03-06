/// <reference path="../../_includes.ts" />

import { connect, Dispatch } from 'react-redux';

import { IAccount } from '../../interfaces/budgetEntities';
import { IApplicationState, ISimpleEntitiesCollection } from '../../interfaces/state';
import { GlobalActionsCreator, SidebarActionsCreator } from '../../actionCreators';

import { PSidebar } from './PSidebar';

const mapStateToProps = (state:IApplicationState) => {
	return {
		activeBudgetId: state.activeBudgetId,
    	entitiesCollection: state.entitiesCollection,
		sidebarState: state.sidebarState
  	};
};

const mapDispatchToProps = (dispatch:Dispatch<IApplicationState>) => {
  	return {
		setExpanded: (expanded:boolean) => {
			dispatch(SidebarActionsCreator.setSidebarExpanded(expanded));
		},  

		setSelectedTab: (selectedTab:string, selectedAccountId:string) => {
			dispatch(SidebarActionsCreator.setSelectedTab(selectedTab, selectedAccountId));
		},  

    	addAccount: (account:IAccount, currentBalance:number) => {
      		dispatch(SidebarActionsCreator.createNewAccount(account, currentBalance));
    	},

    	updateAccount: (account:IAccount, currentBalance:number) => {
      		dispatch(SidebarActionsCreator.updateExistingAccount(account, currentBalance));
    	},

		updateEntities:(entitiesCollection:ISimpleEntitiesCollection) => {
      		dispatch(GlobalActionsCreator.syncBudgetDataWithDatabase(entitiesCollection));
		}
	}
}

const CSidebar = connect(mapStateToProps, mapDispatchToProps)(PSidebar);
export default CSidebar;
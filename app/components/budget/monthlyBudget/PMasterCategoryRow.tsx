/// <reference path="../../../_includes.ts" />

import * as _ from 'lodash';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { SimpleObjectMap } from '../../../utilities';
import * as budgetEntities from '../../../interfaces/budgetEntities';

export interface PMasterCategoryRowProps {
	masterCategory:budgetEntities.IMasterCategory;
	subCategories:Array<budgetEntities.ISubCategory>;
	monthlySubCategoryBudgets:Array<budgetEntities.IMonthlySubCategoryBudget>;
	selectedMasterCategoriesMap:SimpleObjectMap<boolean>;

	selectMasterCategory:(masterCategory:budgetEntities.IMasterCategory, unselectAllOthers:boolean)=>void;
	unselectMasterCategory:(masterCategory:budgetEntities.IMasterCategory)=>void;
	showMasterCategoryEditDialog:(masterCategoryId:string, element:HTMLElement)=>void;
}

export interface PMasterCategoryRowState {
	expanded:boolean;
	hoverState:boolean;
}

const MasterCategoryRowContainerStyle = {
	height: "31px",
	width: "100%",
	display: "flex",
	flexFlow: 'row nowrap',
	alignItems: "center",
	backgroundColor: "#E5F5F9",
	borderColor: "#DFE4E9",
	borderStyle: "solid",
	borderTopWidth: "0px",
	borderBottomWidth: "1px",
	borderRightWidth: "0px",
	borderLeftWidth: "0px",
	paddingTop: "3px",
	paddingBottom: "3px"
}

const SelectionColumnStyle = {
	flex: "0 0 auto",
	width: "25px",
	paddingLeft: "8px"
}

const CategoryNameColumnStyle = {
	flex: "1 1 auto",
	paddingLeft: "8px"
}

const CategoryNameStyle = {
	fontSize: "14px",
	fontWeight: "bold",
	color: "#003440",
	marginBottom: "0px"
}

const ValueColumnStyle = {
	flex: "0 0 auto",
	width: "100px",
	textAlign: "right",
	paddingRight: "8px"
}

const ValueStyle = {
	fontSize: "14px",
	fontWeight: "normal",
	color: "#4D717A",
	marginBottom: "0px"
}

const GlyphStyle = {
	fontSize: "12px",
	cursor: 'pointer'
}

export class PMasterCategoryRow extends React.Component<PMasterCategoryRowProps, PMasterCategoryRowState> {

	private categoryNameLabel:HTMLLabelElement;

	constructor(props: any) {
        super(props);
		this.onGlyphClick = this.onGlyphClick.bind(this);
		this.onClick = this.onClick.bind(this);
		this.onCheckBoxSelectionChange = this.onCheckBoxSelectionChange.bind(this);
		this.handleMouseEnter = this.handleMouseEnter.bind(this);
		this.handleMouseLeave = this.handleMouseLeave.bind(this);
		this.onCategoryNameClick = this.onCategoryNameClick.bind(this);
		this.state = {hoverState:false, expanded:true};
	}

	private onClick(event:React.MouseEvent):void {

		if((event.target as HTMLElement).localName == "div") {
			var masterCategory = this.props.masterCategory;
			var selectedMasterCategoriesMap = this.props.selectedMasterCategoriesMap;
			var isSelected = selectedMasterCategoriesMap[masterCategory.entityId];

			if(isSelected)
				this.props.unselectMasterCategory(masterCategory);
			else
				this.props.selectMasterCategory(masterCategory, true);
		}
	}

	private onCheckBoxSelectionChange(event:React.SyntheticEvent):void {

		var masterCategory = this.props.masterCategory;
		var selectedMasterCategoriesMap = this.props.selectedMasterCategoriesMap;
		var isSelected = selectedMasterCategoriesMap[masterCategory.entityId];

		if(isSelected)
			this.props.unselectMasterCategory(masterCategory);
		else
			this.props.selectMasterCategory(masterCategory, false);
	}

	private handleMouseEnter() {
		var state = _.assign({}, this.state) as PMasterCategoryRowState;
		state.hoverState = true;
		this.setState(state);
	}

	private handleMouseLeave() {
		var state = _.assign({}, this.state) as PMasterCategoryRowState;
		state.hoverState = false;
		this.setState(state);
	}

	private onGlyphClick():void {
		var state = _.assign({}, this.state) as PMasterCategoryRowState;
		state.expanded = !state.expanded;
		this.setState(state);
	}

	private onCategoryNameClick(event:React.MouseEvent):void {
		var masterCategory = this.props.masterCategory;
		this.props.showMasterCategoryEditDialog(masterCategory.entityId, this.categoryNameLabel);
	}

	public render() {

		var glyphiconClass, containerClass:string;
		var collapseContainerIdentity = "subCategoriesContainer_" + this.props.masterCategory.entityId;

		var budgeted = 0, activity = 0, balance = 0;
		_.forEach(this.props.monthlySubCategoryBudgets, (monthlySubCategoryBudget)=>{

			budgeted += monthlySubCategoryBudget.budgeted;
			activity += monthlySubCategoryBudget.cashOutflows + monthlySubCategoryBudget.creditOutflows;
			balance += monthlySubCategoryBudget.balance;
		});

		var masterCategory = this.props.masterCategory;
		var selectedMasterCategoriesMap = this.props.selectedMasterCategoriesMap;
		var isSelected = selectedMasterCategoriesMap[masterCategory.entityId];
		if(!isSelected)
			isSelected = false;

		var masterCategoryRowContainerStyle = _.assign({}, MasterCategoryRowContainerStyle);
		if(isSelected) {
			masterCategoryRowContainerStyle["color"] = "#FFFFFF";
			masterCategoryRowContainerStyle["backgroundColor"] = "#005A6E";
		}

		if(this.state.expanded == true) {
			glyphiconClass = "glyphicon glyphicon-triangle-bottom";
			containerClass = "collapse in";
		}
		else {
			glyphiconClass = "glyphicon glyphicon-triangle-right";
			containerClass = "collapse";
		}

    	return (
			<div>
				<div style={MasterCategoryRowContainerStyle} onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}
						onClick={this.onClick}>
					<div style={SelectionColumnStyle}>
						<input type="checkbox" checked={isSelected} onChange={this.onCheckBoxSelectionChange} />
					</div>
					<span className={glyphiconClass} style={GlyphStyle} onClick={this.onGlyphClick}></span>
					<div style={CategoryNameColumnStyle}>
						<label className="budget-row-mastercategoryname"
						ref={(l)=> this.categoryNameLabel = l}
						onClick={this.onCategoryNameClick}>{this.props.masterCategory.name}</label>
					</div>
					<div style={ValueColumnStyle}>
						<label style={ValueStyle}>{budgeted}</label>
					</div>
					<div style={ValueColumnStyle}>
						<label style={ValueStyle}>{activity}</label>
					</div>
					<div style={ValueColumnStyle}>
						<label style={ValueStyle}>{balance}</label>
					</div>
				</div>
				<div className={containerClass} id={collapseContainerIdentity}>
					{this.props.children}
				</div>
			</div>
		);
  	}
}
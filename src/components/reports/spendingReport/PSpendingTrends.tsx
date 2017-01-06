/// <reference path="../../../_includes.ts" />

import * as _ from 'lodash';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

const pattern = require('patternomaly');
const { Chart } = require('chart.js');

import { UIConstants } from '../../../constants';
import { IReportState } from '../../../interfaces/state';
import { DataFormatter, DateWithoutTime, SimpleObjectMap } from '../../../utilities';
import { ISpendingReportItemData } from '../../../interfaces/reports';
import { SpendingReportData } from './SpendingReportData';

export interface PSpendingTrendsProps {
	dataFormatter:DataFormatter;
	reportState:IReportState;
	masterCategoryId:string;
	reportData:SpendingReportData;
}

const ChartContainerStyle:React.CSSProperties = {
	flex: "1 1 auto",
	display: "flex",
	width: "100%",
	height: "100%",
	justifyContent: "center",
	alignItems: "center",
	minWidth: UIConstants.ReportsChartMinWidth
}

var hardData = {
    labels: ["January", "February", "March", "April", "May", "June", "July"],
    datasets: [
        {
            label: "My First dataset",
            backgroundColor: [
                'rgba(255, 99, 132, 0.2)'
            ],
            borderColor: [
                'rgba(255,99,132,1)'
            ],
            borderWidth: 1,
            data: [65, 59, 80, 81, 56, 55, 40],
        },
        {
            label: "My Second dataset",
            backgroundColor: [
                'rgba(54, 162, 235, 0.2)',
            ],
            borderColor: [
                'rgba(54, 162, 235, 1)',
            ],
            borderWidth: 1,
            data: [65, 59, 80, 81, 56, 55, 40],
        },
		{
			type: 'line',
			fill: false,
			lineTension: 0,
			label: 'Line Component',
			data: [130, 118, 160, 162, 112, 110, 80],
		}
	]
};

export class PSpendingTrends extends React.Component<PSpendingTrendsProps, {}> {

	private chart:any;
	private refCanvas:HTMLCanvasElement;

	private initializeChart(props:PSpendingTrendsProps) {

		var Chart = require('chart.js');
		var element = ReactDOM.findDOMNode(this.refCanvas) as any;
      	var ctx = element.getContext("2d");
		var dataFormatter = props.dataFormatter;

		this.chart = new Chart(ctx, {
			type: 'bar',
			data: this.buildDataObject(props),
			options: {
				layout: {
					padding: {top:100, bottom:100, left:25, right:25}
				},
				legend: {
					display: false
				},
				scales: {
					xAxes: [{
						stacked: true
					}],
					yAxes: [{
						stacked: true,
						ticks: {
							callback: (value, index, values)=>{
								return dataFormatter.formatCurrency(value);
							}
						}
					}],
		        },
				tooltips: {
					position: "nearest",
					displayColors: false,
					backgroundColor: "#F5F6F8",
					titleFontColor: "#000000",
					bodyFontColor: "#000000",
					bodyFontSize: 16,
					bodyFontStyle: "bold",
					footerFontColor: "#000000",
					callbacks: {
						title: (tooltipItems, data)=>{
							var tooltipItem = tooltipItems[0];
							var title = data.datasets[tooltipItem.datasetIndex].label;
							return title;
						},
						label: (tooltipItem, data)=>{
							var value = data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
							var formattedValue = dataFormatter.formatCurrency(value);
							return formattedValue;
						},
						footer: (tooltipItems, data)=>{
							debugger;
							var tooltipItem = tooltipItems[0];
							var sumOfAllValues = _.reduce(data.datasets, (sum, dataset:any)=>{
								return sum + dataset.data[tooltipItem.index];
							}, 0);

							var value = data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
							var percentage = value == 0 ? 0 : value/sumOfAllValues*100;
							return `${Math.round(percentage*100)/100}% of Total`;	
						}
					}
				},
			}
		});
	}

	private buildDataObject(props:PSpendingTrendsProps):any {

		var reportData = props.reportData;
		var data = {
			labels: reportData.getAllMonthNames(),
			datasets: [],
		};

		// Add dataset for each item in the report data
		var itemIds = reportData.getOverallSortedItemIds();
		var itemNames = reportData.getOverallSortedItemNames();
		var colors = UIConstants.ChartColors;
		var hoverColors = UIConstants.ChartHoverColors;

		for(var i:number = 0; i < itemIds.length; i++) {

			var itemId = itemIds[i];
			var monthlyItemValues = reportData.getMonthlyValuesForItem(itemId);
			var color = colors[i];
			// We want a colors array of the same length as the values array. Woulc contain the same color as this 
			// item is going to be represented by the same color in all months.
			var backgroundColors:Array<string> = [];
			var borderColors:Array<string> = [];
			var hoverBackgroundColors:Array<string> = [];
			var hoverBorderColors:Array<string> = [];
			for(var k:number = 0; k < monthlyItemValues.length; k++) {
				backgroundColors.push(color);
				borderColors.push(color);
				hoverBackgroundColors.push(color);
				hoverBorderColors.push(color);
			}

			var dataSet = {
				label: itemNames[i],
				backgroundColor: backgroundColors,
				borderColor: borderColors,
				hoverBackgroundColor: hoverBackgroundColors,
				hoverBorderColor: hoverBorderColors,
				borderWidth: 1,
				data: monthlyItemValues
			};

			data.datasets.push(dataSet);
		}

		return data;
	}

	private updateDataObject(props:PSpendingTrendsProps):void {

	}

	public componentDidMount():void {

		this.initializeChart(this.props);
	}

	public componentWillUnmount():void {

		var chart = this.chart;
      	chart.destroy();
	}

	public componentWillReceiveProps(nextProps:PSpendingTrendsProps):void {

		this.updateDataObject(nextProps);
		this.chart.update();
	}

	public render() {

		return (
			<div style={ChartContainerStyle}>
				<canvas 
					style={{width: "100%", height: "100%"}}
					ref={(c)=> this.refCanvas = c }
				/>
			</div>
		);
	}
}
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"thd/recmobile/util/formatter"
], function(Controller, JSONModel, MessageBox, MessageToast, formatter) {
	"use strict";
	return Controller.extend("thd.recmobile.controller.Pallet", {
		formatter : formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the master list controller is instantiated. It sets up the event 
		 * handling for the master/detail communication and other lifecycle tasks.
		 * @public
		 */
		onInit : function () {
			this._oHistory = sap.ui.core.routing.History.getInstance();
			this._oComponent = this.getOwnerComponent();
			this._oServiceModel = this._oComponent.getModel();
			this._oView = this.getView();
			this._oList = this.byId("idPalletList");
			this._oItemTemplate = this.byId("idPalletListItem").clone();
			this.formatter.bindComponent(this);
			var iOriginalDelay = this._oView.byId("idPalletPageArticles").getBusyIndicatorDelay(),
				oViewData = {
					settings: {
						editalbe: true,
						busy : false,
						delay : iOriginalDelay,
						originalDelay: iOriginalDelay,
						EntryStatus: ""
					},
					data: {
						Pallet: {},
						IssueCount: 0,
						AllArticles: [],
						DGRArticles: [],
						CompleteArticles: []
					}
				},
				oViewModel = new JSONModel(oViewData);

			// Set the Waybill view's model.
			this._oComponent.setModel(oViewModel, "palletView");

			// Subscribe the view to the Scan event (Articles).
			this._oComponent.bindScanListener({
				id: "PALLET",
				onScan: function(sBarCode) {
					this._performSearch(sBarCode);
				}.bind(this)
			});

			// Register an event handler for navigation to this view.
			this._oComponent.getRouter().attachRoutePatternMatched(this._onRoutePatternMatched, this);
		},

		/**
		 * This method is called every time the View is rendered, after the HTML is placed in the
		 * DOM-Tree. It can be used to apply additional changes to the DOM after the Renderer has
		 * finished. (Even though this method is declared as "abstract", it does not need to be
		 * defined in controllers, if the method does not exist, it will simply not be called.)
		 * @public
		 */
		onAfterRendering : function () {
			this._setListScrollerHeight();
		},

		/**
		 * This method is called every time the View is rendered, before the Renderer is called
		 * and the HTML is placed in the DOM-Tree. It can be used to perform clean-up-tasks before
		 * re-rendering. (Even though this method is declared as "abstract", it does not need to
		 * be defined in controllers, if the method does not exist, it will simply not be called.)
		 */
		//onBeforeRendering : function() {},

		/**
		 * This method is called upon desctuction of the View. The controller should perform its
		 * internal destruction in this hook. It is only called once per View instance, unlike the
		 * onBeforeRendering and onAfterRendering hooks. (Even though this method is declared as
		 * "abstract", it does not need to be defined in controllers, if the method does not exist,
		 * it will simply not be called.)
		 * @public
		 */
		onExit : function () {
			// Destroy all of the locally constructed components.
			if (this._oArticleListDialog) {
				this._oArticleListDialog.destroy();
			}
			if (this._oArticleDialog) {
				this._oArticleDialog.destroy();
			}

			// Un-Assign the Article search to the Scan event.
			this._oComponent.setScanId("");
		},



		/* =========================================================== */
		/* event handler methods                                       */
		/* =========================================================== */

		/**
		 * Handle the "Back" navigation header button press event.
		 * @public
		 */
		onNavButtonPress : function () {
			this._oComponent.navigateBack();         
		},

		/**
		 * Called when the "Expand" event is fired on the header panel (expand button).
		 * @param {sap.ui.base.Event} oEvent header expand event object.
		 * @public
		 */
		onDetailHeaderExpand : function(oEvent) {
			if (oEvent.getId() !== "expand") {
				var oPanel = this._oView.byId("idPalletPanel");
				oPanel.setExpanded(!oPanel.getExpanded());
			} else {
			// Wait until the panel open/close animation completes, then recalculate
			// the detail view scroller area.
			jQuery.sap.delayedCall(500, this, this._setListScrollerHeight);
			}
		},

		/**
		 * Pallet list toolbar button event handler - Open the "Complete Articles" dialog.
		 * @param {sap.ui.base.Event} oEvent "Show All Pallets" button event object.
		 * @public
		 */
		onShowAll : function (oEvent) {
			this._oArticleListDialog.open();
		},

		/**
		 * Find an Article from the query string entered.
		 * @param {sap.ui.base.Event} oEvent Search button event object.
		 * @public
		 */
		onSearch : function (oEvent) {
			if (!oEvent.getParameter("clearButtonPressed")) {
				var sQuery = oEvent.getParameter("query");
				if (sQuery) {
					this._performSearch(sQuery.toUpperCase());
				}
			}
		},

		/**
		 * Handle the (mobile device) camera scanner button press event.
		 * @param {sap.ui.base.Event} oEvent Camera Scanner button press event object.
		 * @public
		 */
		onCameraScanner : function (oEvent) {
			if (typeof this._oComponent._cameraScanner === "function") {
				this._oComponent._cameraScanner();
			}
		},
		/**
		 * Show the selected Article selected by calling the search function.
		 * @param {sap.ui.base.Event} oEvent Search button event object.
		 * @public
		 */
		onSelect : function (oEvent) {
			var oArticle = null;

			if (oEvent.getId() === "selectionChange") {
				var sPath = this._oList.getSelectedContextPaths()[0];
				oArticle = this._oComponent.getModel("palletView").getProperty(sPath);
			} else {
				var sKey = "{" + oEvent.getSource().getCustomData()[0].getProperty("value").replace(/'/g, '"') + "}",
					mKey = JSON.parse(sKey),
					aArticles = this._oComponent.getModel("palletView").getProperty("/data/DGRArticles"),
					aSelectedArticle = aArticles.filter(function(oCheck) {
						return oCheck.PONbr === mKey.PONbr && oCheck.ItemID === mKey.ItemID;
					});
				oArticle = aSelectedArticle[0];
			}

			this._oList.removeSelections();
			if (oArticle) {
				this._performSearch(oArticle.Article);
			}
		},







		/* ********************************************* */
		// TODO - Make Component for Article List Dialog.
		/* ********************************************* */
		initArticleListDialog : function () {
			// Construct and the Dialog and bind it to the controller.
			this._oArticleListDialog = sap.ui.xmlfragment(
				this._oView.getId(),
				"thd.recmobile.viewFragment.ArticleListDialog",
				this
			);

			// Assign static properties to the controller.
			this._sArticleListDialogId = this._oArticleListDialog.getId();
			this._oArticleList = this._oView.byId("idArticleListDialogList");
			this._sArticleListCallerScanId = "";

			// Apply the content density mode to the dialog.
			this._oArticleListDialog.addStyleClass(this._oComponent.getContentDensityClass());

			// Bind the models to the controller.
			this._oArticleListDialog.setModel(this._oComponent.getModel("palletView"));
			this._oArticleListDialog.setModel(this._oComponent.getModel("i18n"), "i18n");
		},
		onArticleListDialogOpen : function (oEvent) {
			// Un-Assign the search to the Scan event.
			this._sArticleListCallerScanId = this._oComponent.getScanId();
			this._oComponent.setScanId("");
		},
		onArticleListDialogSelect : function (oEvent) {
			var oArticle = null;

			if (oEvent.getId() === "selectionChange") {
				var sPath = this._oArticleList.getSelectedContextPaths()[0];
				oArticle = this._oArticleListDialog.getModel().getProperty(sPath);
			} else {
				var sKey = "{" + oEvent.getSource().getCustomData()[0].getProperty("value").replace(/'/g, '"') + "}",
					mKey = JSON.parse(sKey),
					aArticles = this._oArticleListDialog.getModel().getProperty("/data/CompleteArticles"),
					aSelectedArticle = aArticles.filter(function(oCheck) {
						return oCheck.PONbr === mKey.PONbr && oCheck.ItemID === mKey.ItemID;
					});
				oArticle = aSelectedArticle[0];
			}
			
			// Remove the selected Article before closeing.
			this._oArticleList.removeSelections();

			// Close the Article List Dialog.
			this._closeArticleList();

			// Open the Article Detail Dialog.
			this._oArticleDialog.getModel().setData(oArticle);
			this._oArticleDialog.open();
		},
		onArticleListDialogButtonClose : function (oEvent) {
			// Remove the selected Article before closeing.
			this._oArticleList.removeSelections();
			// Close the Article List Dialog.
			this._closeArticleList();
		},
		_closeArticleList : function() {
			// Re-Assign the search to the Scan event.
			this._oComponent.setScanId(this._sArticleListCallerScanId);
			this._oArticleListDialog.close();
		},

		/* ********************************************* */
		// TODO - Make Component for Article Detail Dialog.
		/* ********************************************* */
		initArticleDialog : function () {
			// Construct and bind the Dialog.
			this._oArticleDialog = sap.ui.xmlfragment(
				this._oView.getId(),
				"thd.recmobile.viewFragment.ArticleDialog",
				this
			);
			this._sArticleDialogId = this._oArticleDialog.getId();
			this._sArticleDialogCallerScanId= "";

			// Apply the content density mode to the dialog.
			this._oArticleDialog.addStyleClass(this._oComponent.getContentDensityClass());

			// Bind the I18N model.
			this._oArticleDialog.setModel(new JSONModel({}));
			this._oArticleDialog.setModel(this._oComponent.getModel("i18n"), "i18n");

			// Bind the dialog's data
			this._oArticleDialog.bindObject("/");
		},
		onArticleDialogOpen : function (oEvent) {
			// Un-Assign the search to the Scan event.
			this._sArticleDialogCallerScanId = this._oComponent.getScanId();
			this._oComponent.setScanId("");
		},
		onArticleDialogIssues : function (oEvent) {
			// TODO - open the Report Issue dialog.
		},
		onArticleDialogDGR : function (oEvent) {

			// If the Article is being processed, just return.
			var oArticle = this._oArticleDialog.getModel().getData();
			if (oArticle.hasOwnProperty("isBusy")) {
				MessageToast.show(this._oComponent.getText("ArticleDialog_DGRInProcess"));
				return;
			}

			var oArticleToRGR = jQuery.extend({}, oArticle);

			// Set the row busy and add it to the "Needs DGR" model.
			var oPalletModel = this._oComponent.getModel("palletView"),
				aDGRArticles = oPalletModel.getProperty("/data/DGRArticles");
			for (var i = 0; i < aDGRArticles.length; i++) {
				if (aDGRArticles[i].PONbr === oArticle.PONbr
						&& aDGRArticles[i].ItemID === oArticle.ItemID) {
					oArticle.isBusy = true;
					break;
				}
			}
			if (!oArticle.hasOwnProperty("isBusy")) {
				MessageToast.show(this._oComponent.getText("ArticleDialog_DGRNotRequired"));
				return;
			}
			oPalletModel.setProperty("/data/DGRArticles", aDGRArticles);

			// Submit the Article for DGR.
			var sPath = this._oServiceModel.createKey("/PalletItemSet", {
					StoreID: oArticle.StoreID,
					WayBillNbr: oArticle.WayBillNbr,
					PalletID: oPalletModel.getProperty("/data/Pallet/PalletID"),
					PONbr: oArticle.PONbr,
					ItemID: oArticle.ItemID
				});
			this._oServiceModel.update(sPath, oArticleToRGR, {
				groupId: "ArticleDGR",
				success: function(oData, oResponse) {
					delete oArticleToRGR.isBusy;
					var bIsComplete = this._articleFullyReceived(oArticleToRGR),
						aDGR = oPalletModel.getProperty("/data/DGRArtilces");
					if (bIsComplete) {
						oArticleToRGR.ItemStatus = "X";	// Completely Received
	
						// Add the Artilce to the "Complete" model.
						var aRGR = oPalletModel.getProperty("/data/CompleteArticles");
						aRGR.push(oArticleToRGR);
						oPalletModel.setProperty("/data/RGRArtilces", aRGR);

						// Remove the Artilce from the "Needs DGR" model .
						var	aNewDGR = aDGR.filter(function(oArtilceToTest) {
							return !(oArtilceToTest.PONbr === oArticleToRGR.PONbr
										&& oArtilceToTest.ItemID === oArticleToRGR.ItemID);
						});
						oPalletModel.setProperty("/data/DGRArtilces", aNewDGR);

						// Update the stauses (if we are all done).
						if (aNewDGR.length === 0) {
							//Pallet
							oPalletModel.setProperty("/data/Pallet/PalletStatus", "X");
							//Waybill
							var oWaybillModel = this._oComponent.getModel("waybillView"),
								oWaybillData = oWaybillModel.getData();
							if (oWaybillData.OpenPallets.length === 0 && oWaybillData.OpenPOs.length === 0
									&& oWaybillData.DGRPallets.length === 0 && oWaybillData.DGRPOs.length === 0) {
								oWaybillModel.setProperty("/data/Waybill/EntryStatus", "C");
								oWaybillModel.setProperty("/data/Waybill/ActionCode", "04");
							}
						}

						// Toast the fully received Article;
						MessageToast.show(this._oComponent.getText(
							"ArticleDialog_DGRComplete",[oArticleToRGR.Article]),
							{duration: 1000}
						);

					} else {
						// Update the Article in the "Needs DGR" model.
						for (var ia = 0; ia < aDGR.length; ia++) {
							if (aDGR[ia].PONbr === oArticleToRGR.PONbr 
									&& aDGR[ia].ItemID === oArticleToRGR.ItemID) {
								aDGR[ia] = oArticleToRGR;
								break;
							}
						}
					}

					// Update the Article in the "All Artilces" model.
					var aAll = oPalletModel.getProperty("/data/AllArticles");
					for (var ib = 0; ib < aAll.length; ib++) {
						if (aAll[ib].PONbr === oArticleToRGR.PONbr 
								&& aAll[ib].ItemID === oArticleToRGR.ItemID) {
							aAll[ib] = oArticleToRGR;
							break;
						}
					}

				}.bind(this),
				error: function(oError) {
					// Remove the busy overlay flag. Leave the Article in the "Needs DGR" model.
					var aDGR = oPalletModel.getProperty("/data/DGRArticles");
					for (var j = 0; j < aDGR.length; j++) {
						if (aDGR[j].PONbr === oArticleToRGR.PONbr
								&& aDGR[j].ItemID === oArticleToRGR.ItemID) {
							delete aDGR[j].isBusy;
							break;
						}
					}
					oPalletModel.setProperty("/data/DGRArticles", aDGR);

					// TODO - parse oError map to get the message.
					// if (oError.statusCode < 500)  {
					// 	MessageBox.error(this._oComponent.getText("ArticleDialog_DGRFailed",[oArticleToRGR.Article]));
					// }
				}.bind(this)
			});

			// Close the Article List Dialog.
			this._closeArticleDialog();
		},
		onArticleDialogSpecialOrderPrint : function(oEvent) {
			
		},
		onArticleDialogClose : function (oEvent) {
			// Close the Pallet List Dialog.
			this._closeArticleDialog();
		},
		_closeArticleDialog : function() {
			// Re-Assign the search to the Scan event.
			this._oComponent.setScanId(this._sArticleDialogCallerScanId);
			this._oArticleDialog.close();
		},








		/* =========================================================== */
		/* Begin: helper methods                                       */
		/* =========================================================== */



		/* =========================================================== */
		/* begin: private methods                                      */
		/* =========================================================== */

		/**
		 * Set the busy overlay for the view.
		 * @param {boolean} bIsBusy Set to true to set or false to remove the overlay.
		 * @private
		 */
		_setBusy : function (bIsBusy) {
			var oModel = this._oComponent.getModel("palletView");
			if (bIsBusy) {
				oModel.setProperty("/settings/delay", 0);
				oModel.setProperty("/settings/busy", true);
			} else {
				var iDelay = oModel.getProperty("/settings/originalDelay");
				oModel.setProperty("/settings/busy", false);
				oModel.setProperty("/settings/delay", iDelay);
			}
		},

		/**
		 * This method is called each the router navigates to the view
		 * @param {sap.ui.base.Event} oEvent returned by the router.
		 * @private
		 */
		_onRoutePatternMatched: function(oEvent) {
			var bIsNew = this._oHistory.getDirection() === "NewEntry",
				sRouteName = oEvent.getParameter("name");
			if (sRouteName === "pallet") {
				// Assign the Pallet/PO search to the Scan event.
				this._oComponent.setScanId("PALLET");
				if (!bIsNew) {
					return;
				}
			} else {
				return;
			}

			var sBatchGroupId = "pallet",
				mNavArgs = oEvent.getParameter("arguments"),
				oPalletViewModel = this._oComponent.getModel("palletView"),
				oWaybillViewModel = this._oComponent.getModel("waybillView"),
				sEntryStatus = oWaybillViewModel.getProperty("/data/EntryStatus");

			// Set the Waybills "Entry Status" (Inbound/Pending/Componet) on the pallet.
			oPalletViewModel.setProperty("/settings/EntryStatus", sEntryStatus);

			// Try to find the the View's Pallet in it's model before going to the OData service.
			var aPallets = oWaybillViewModel.getProperty("/data/AllPallets"),
				aPalletFiter = aPallets.filter(function(oPalletToTest) {
					return oPalletToTest.PalletID === mNavArgs.PalletID;
				}),
				oPallet = aPalletFiter[0];
			if (jQuery.isEmptyObject(oPallet)) {

				// check the service model first - the waybill view should have loaded
				// our pallet before navigating here.
				var sPath = this._oServiceModel.createKey("/PalletHeaderSet", {
					StoreID: mNavArgs.store,
					WayBillNbr: mNavArgs.waybill,
					PalletID: mNavArgs.pallet
				});
				oPallet = this._oServiceModel.getProperty(sPath);
				if (oPallet) {
					oPalletViewModel.setProperty("/data/Pallet", oPallet);
					// Update the Exception count (issues) for the Pallet.
					var aIssues = oWaybillViewModel.getProperty("/data/Issues") || [],
						aPalletIssues = aIssues.filter(function(oIssue) {
							return oIssue.Pallet === oPallet.PalletId; 
						});
					oPalletViewModel.setProperty("/data/IssueCount", aPalletIssues.length);
				} else {
					// Load the Pallet.
					this._loadPallet({
						store: mNavArgs.store,
						waybill: mNavArgs.waybill,
						pallet: mNavArgs.pallet,
						group: sBatchGroupId
					});
				}

				// Load the Pallet's Articles.
				this._loadArticlesForPallet({
					store: mNavArgs.store,
					waybill: mNavArgs.waybill,
					pallet: mNavArgs.pallet,
					group: sBatchGroupId
				});
			}

			if (!this._oArticleListDialog) {
				// Bind the Pallet List Dialog.
				this.initArticleListDialog();
			}
			if (!this._oArticleDialog) {
				// Bind the Pallet Detail Dialog.
				this.initArticleDialog();
			}
		},

		/**
		 * Load the Pallet from the OData service.
		 * @Param {map} mParameters Parameters of the request.
		 * @private
		 */
		_loadPallet : function(mParameters) {
			var oModel = this._oComponent.getModel("palletView"),
				sPath = this._oServiceModel.createKey("/PalletHeaderSet", {
					StoreID: mParameters.store,
					WayBillNbr: mParameters.waybill,
					PalletID: mParameters.pallet
				});

			oModel.setProperty("/data/Pallet", {});
			oModel.setProperty("/data/IssueCount", 0);

			var fnSucess = mParameters.hasOwnProperty("success") ? mParameters.success : null,
				fnError = mParameters.hasOwnProperty("error") ? mParameters.error : null;

			this._oServiceModel.read(sPath, {
				groupId: mParameters.group,
				success: function(oPalletData) {
					oModel.setProperty("/data/Pallet", oPalletData);

					// Set the Issue Count for the Pallet.
					var oWaybillViewModel = this._oComponent.getModel("waybillView"),
						sPalletId = mParameters.pallet,
						aIssues = oWaybillViewModel.getProperty("/data/Issues") || [],
						aPalletIssues = aIssues.filter(function(oIssue) {
							return oIssue.Pallet === sPalletId; 
						});
					oModel.setProperty("/data/IssueCount", aPalletIssues.length);

					if (fnSucess) {
						fnSucess(oPalletData);
					}
				}.bind(this),
				error: function(oError) {
					jQuery.sap.log.error(
						"OData Error", 
						["Failed to load entity " + sPath], 
						["Pallet.Controller.js"]
					);
					if (fnError) {
						fnError(oError);
					}
				}
			});
		},

		_loadArticlesForPallet : function(mParameters) {
			var oModel = this._oComponent.getModel("palletView"),
				sPath = this._oServiceModel.createKey("/PalletHeaderSet",{
					StoreID: mParameters.store,
					WayBillNbr: mParameters.waybill,
					PalletID: mParameters.pallet
				}) + "/PalletItems";

			oModel.setProperty("/data/AllArticles", []);
			oModel.setProperty("/data/DGRArticles", []);
			oModel.setProperty("/data/CompleteArticles", []);

			var fnSucess = mParameters.hasOwnProperty("success") ? mParameters.success : null,
				fnError = mParameters.hasOwnProperty("error") ? mParameters.error : null;

			this._oServiceModel.read(sPath, {
				groupId: mParameters.group,
				filters: [
					// TODO - Add these values to the PalletHeaderSet entity as keys and remove these filters !!
					new sap.ui.model.Filter("StoreID", sap.ui.model.FilterOperator.EQ, mParameters.store),
					new sap.ui.model.Filter("WayBillNbr", sap.ui.model.FilterOperator.EQ, mParameters.waybill)
				],
				success: function(oArticleData) {
					// Update the "All Articles" model
					oModel.setProperty("/data/AllArticles", oArticleData.results);

					// Update the "Needs DGR" model
					var aDGRArticles = [];
						aDGRArticles = oArticleData.results.filter(function(oArticle) {
							return oArticle.ItemStatus === "R";	// Needs DGR
						});
					oModel.setProperty("/data/DGRArticles", aDGRArticles);

					// Update the "Complete" model.
					var aCompleteArticles = oArticleData.results.filter(function(oArticle) {
						return oArticle.ItemStatus !== "R";	// Needs DGR
					});
					oModel.setProperty("/data/CompleteArticles", aCompleteArticles);

					if (fnSucess) {
						fnSucess(oArticleData.results);
					}
				},
				error: function(oError) {
					jQuery.sap.log.error(
						"OData Error", 
						["Failed to load entity " + sPath], 
						["Pallet.Controller.js"]
					);
					if (fnError) {
						fnError(oError);
					}
				}
			});

		},

		/**
		 * Find an Article from the given string and open to the Article dialog if found.
		 * If not found, call the UPC service to see if a UPC was scanned (get Article from UPC).
		 * @param {string} sQuery string to lookup.
		 * @private
		 */
		_performSearch : function (sQuery) {
			var bFound = false,
				oModel = this._oComponent.getModel("palletView"),
				aDGRArticles = oModel.getProperty("/data/DGRArticles").filter(function(oArticle) {
					return oArticle.Article === sQuery;
				});
			if (aDGRArticles.length > 0) {
				bFound = true;
				// Open the Article Detail Dialog.
				this._oArticleDialog.getModel().setData(aDGRArticles[0]);
				this._oArticleDialog.open();
			} else {
				var aArticles = oModel.getProperty("/data/CompleteArticles").filter(function(oArticle) {
						return oArticle.Article === sQuery;
					});
				if (aArticles.length > 0) {
					bFound = true;
					// Open the Article Detail Dialog.
					this._oArticleDialog.getModel().setData(aArticles[0]);
					this._oArticleDialog.open();
				}
			}
			if (!bFound) {
				// TODO - Call the UPC service
			}
			// Clear the search field
			this._oView.byId("idPalletToolbarSearch").clear();
		},

		/**
		 * Check the Article Qty and any exception Damage/Shortage/Overage and return
		 * a value of true if the Article given is fully received
		 * @private
		 */
		_articleFullyReceived : function(oArticle) {
			var bIsFulfilled = false,
				sExceptionPath = this._oServiceModel.createKey("/ExceptionSet", {
					StoreID: oArticle.StoreID,
					WayBillNbr: oArticle.WayBillNbr,
					Pallet: oArticle.PalletID,
					PONbr: oArticle.PONbr,
					ItemID: oArticle.ItemID,
					Article: oArticle.Article
				}),
				oArticleException = this._oServiceModel.getProperty(sExceptionPath),
				iExceptionQty = 0;

			if (oArticleException && parseInt(oArticleException.Qty, 10) > 0
					&& (oArticleException.Type === "402"		// Shortage
						|| oArticleException.Type === "403")) {	// Overage
				iExceptionQty = parseInt(oArticleException.Qty, 10);
			}
			if (parseInt(oArticle.OpenQty, 10) - iExceptionQty <= 0) {
				bIsFulfilled = true;
			}
			return bIsFulfilled;
		},

		/**
		 * Calculate and set scroller height to take up the remainder of the
		 * view below the toolbar.
		 * @private
		 */
		_setListScrollerHeight : function() {
			var sScrollerId = "idPalletListScroller",
				oScroller = this._oView.byId(sScrollerId);
			if (!oScroller) {
				return;
			}

			var oPage = this._oView.byId("idPalletPage"),
				oToolbar = this._oView.byId("idPalletToolbar"),
				iPageHeight = oPage.$().outerHeight(true),
				iToolbarHeight = oToolbar ? oToolbar.$().outerHeight(true) : 0,
				iToolbarFromtop = oToolbar ? oToolbar.$().offset().top : 0,
				iHeight = iPageHeight - iToolbarFromtop - iToolbarHeight;
			
			oScroller.setHeight(iHeight.toString() + "px" );
		}
	});
});
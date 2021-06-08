import React, { Component } from "react";
import axios from "axios";
import SplitPane from "react-split-pane";

// import { SearchOutlined } from "@ant-design/icons";
// import { Button, Tooltip } from "antd";
import MapArea from "./MapArea";
import VizArea from "./VizArea";

import "./viewer.less";
import Sidebar from "../components/sidebar/Sidebar";
import BasemapList from "../components/BasemapList/BasemapList";
import LayersList from "../components/LayerList/LayersList";
import { Footer } from "../components";
import Bookmarks from "../components/Bookmarks/Bookmarks";
import DistrictsSelector from "../components/DistrictsSelector/DistrictsSelector";

import { simpleErrorCatch } from "../utils/CommonUtil";
import { BASEMAP_EFFECTS, MAP_DIV_ID } from "../utils/Constants";
import { BookmarkInterface, GISServerInfoInterface, LayersInfoInterface, VizInfoInterface } from "../utils/Interfaces";
import PlacesAOI from "../components/PlacesAOI/PlacesAOI";
import Measurement from "../components/Measurement/Measurement";
import { Button } from "antd";
// import PlacesSearch from "../components/PlacesSearch/PlacesSearch";

interface State {
    statusStats: { name: string; value: number; itemStyle: { color: string } }[];
    projTypeStats: { name: string; value: number; itemStyle: { color: string } }[];
    selectedFeatures: any[];

    filterType: string[];
    filterStatus: string[];

    activeSidebarTool: string | null;

    // map
    selectedBasemap: string;
    featureLayersInfo: LayersInfoInterface;
    layerListMap: any;
    baseLayersList: { [key: string]: any };
    // boundaryFeatures: any[];
    visibilityMap: any;
    projectTypeVisibilityMap: { [categoryName: string]: boolean };
    categoriesInfo: { [categoryName: string]: { name: string; displayName: string; count: number; icon: string | undefined } };
    visibleAgg: string; // "simple" | "heatmap" | "cluster" | "clusterGroup";

    // viz
    vizInfo: VizInfoInterface[];

    // aoi
    wizardStep: number;
    placesAOILoading: boolean;
    aoiRenderer: "simple" | "heatmap";
    bufferStats: {
        center: number[];
        radius: number;
        // area: number;
        totalFeatures: number;
    } | null;

    // measurement
    activeMeasure: null | "coord" | "distance" | "area";
    measureCollection: {
        id: number;
        timestamp: number;
        type: "distance" | "area";
        value: string;
    }[];

    // search
    searchLoading: boolean;
    searchHasResult: boolean;
    searchResults: {
        id: string | number;
        properties: { name: string; value: any }[];
        projectName: string;
        type: string;
    }[];
}

interface Props {
    doLogout: () => void;
    bookmarks: any;
    updateUserBookmarks: (action: "add" | "delete", bookmark: BookmarkInterface | string) => void;
    userInfo: {
        firstName: string;
        lastName: string;
        role: string;
        userName: string;
    } | null;
    gisServerInfo: GISServerInfoInterface | null;
}

class Viewer extends Component<Props, State> {
    state: State = {
        statusStats: [],
        projTypeStats: [],

        selectedFeatures: [],

        filterType: [],
        filterStatus: [],

        activeSidebarTool: null,

        // map & layers
        selectedBasemap: "OSM",
        featureLayersInfo: {},
        // boundaryFeatures: [],
        layerListMap: null,
        baseLayersList: {},
        visibilityMap: {},
        projectTypeVisibilityMap: {},
        categoriesInfo: {},
        visibleAgg: "simple", //["simple"],

        // viz
        vizInfo: [],

        // aoi
        wizardStep: 0,
        placesAOILoading: false,
        aoiRenderer: "simple",
        bufferStats: null,

        // measurement
        activeMeasure: null,
        measureCollection: [],

        // search
        searchLoading: false,
        searchHasResult: false,
        searchResults: []
    };

    featureCategoriesMap = window.__REAP__CONFIG__.featureCategories;
    splitPaneRef = React.createRef<SplitPane>();

    constructor(props: Props) {
        super(props);

        // check if basemap setting is saved
        this.state.selectedBasemap = "OSM";

        const categoriesInfo: { [categoryName: string]: { name: string; displayName: string; count: 0; icon: undefined } } = {};
        Object.keys(this.featureCategoriesMap).forEach((categoryName) => {
            categoriesInfo[categoryName] = {
                name: categoryName,
                displayName: this.featureCategoriesMap[categoryName].displayName,
                icon: undefined,
                count: 0
            };
        });

        this.state.categoriesInfo = categoriesInfo;

        const projectTypeVisibilityMap: { [categoryName: string]: boolean } = {};
        const realEstateCategories = window.__REAP__CONFIG__.realEstateCategories;
        Object.keys(realEstateCategories).forEach((catName) => {
            projectTypeVisibilityMap[catName] = true;
        });

        this.state.projectTypeVisibilityMap = projectTypeVisibilityMap;
    }

    componentDidMount() {
        this.fetchLayers();
        this.fetchVizInfo();

        window.addEventListener("AOIBufferStepsWizard", this.AOIBufferStepsWizard);
    }

    componentWillUnmount() {
        window.removeEventListener("AOIBufferStepsWizard", this.AOIBufferStepsWizard);
    }

    fetchLayers = () => {
        const { gisServerInfo, userInfo } = this.props;
        const serverUrl = window.__REAP__CONFIG__.reapAdminUrl;

        if (!gisServerInfo || !userInfo) {
            return;
        }

        let layerInfoURL = `${serverUrl}users/${userInfo.userName}/profile/layers`;

        axios
            .get(layerInfoURL)
            .then((res) => {
                const { data } = res;
                const featureLayersInfo: any = {};
                data.forEach((layer: any) => {
                    featureLayersInfo[layer.name] = {
                        info: layer
                    };
                });

                this.setState(
                    {
                        featureLayersInfo
                    },
                    () => this.initLayersInfo()
                );
            })
            .catch(simpleErrorCatch);
    };

    fetchVizInfo = () => {
        const vizInfoURL = process.env.PUBLIC_URL + "/data/visualizations.json";

        axios
            .get(vizInfoURL)
            .then((res) => {
                const { data } = res;
                this.setState(
                    {
                        vizInfo: data
                    },
                    () => window.dispatchEvent(new CustomEvent("loadDefaultViz"))
                );
            })
            .catch(simpleErrorCatch);
    };

    resetDataFilter = () => {
        this.setState({
            selectedFeatures: [],
            filterType: [],
            filterStatus: []
        });
    };

    setDataFilter = (fieldName: string, filters: { [key: string]: boolean }) => {
        const appliedFilters = Object.keys(filters).filter((filterKey) => filters[filterKey]);
        const filterName = fieldName === "Status" ? "filterStatus" : "filterType";

        const filter: any = {};
        filter[filterName] = appliedFilters;

        this.setState({
            ...filter
        });
    };

    selectFeatures = (featuresArray: any[]) => {
        this.setState({
            selectedFeatures: featuresArray
        });
    };

    updateStatData = (
        statusStats: { name: string; value: number; itemStyle: { color: string } }[],
        projTypeStats: { name: string; value: number; itemStyle: { color: string } }[]
    ) => {
        this.setState({
            statusStats,
            projTypeStats
        });
    };

    updateActiveSidebarTool = (toolName: string | null = null) => {
        if (toolName !== "reset") {
            this.setState(
                {
                    activeSidebarTool: toolName
                },
                () => {
                    window.dispatchEvent(new CustomEvent("resize"));
                    if (!toolName) {
                        window.dispatchEvent(new CustomEvent("clearActiveSidebar"));
                    }
                }
            );

            return;
        }

        // do reset
        const { visibilityMap, projectTypeVisibilityMap } = this.state;
        Object.keys(visibilityMap).forEach((layerName) => {
            visibilityMap[layerName] = true;
        });

        Object.keys(projectTypeVisibilityMap).forEach((projType) => {
            projectTypeVisibilityMap[projType] = true;
        });

        this.setState(
            {
                activeSidebarTool: null,

                // feature
                selectedFeatures: [],

                // map & layers
                selectedBasemap: "OSM",
                visibleAgg: "simple", //["simple"],//
                visibilityMap,
                projectTypeVisibilityMap,

                // aoi
                wizardStep: 0,
                placesAOILoading: false,
                aoiRenderer: "simple",
                bufferStats: null,

                // measurement
                activeMeasure: null,
                measureCollection: [],

                // search
                searchLoading: false,
                searchHasResult: false,
                searchResults: []
            },
            () => {
                window.dispatchEvent(new CustomEvent("clearActiveSidebar"));
                window.dispatchEvent(new CustomEvent("loadDefaultViz"));
                window.dispatchEvent(new CustomEvent("updateVisibleRenderer", { detail: { selectedRendererName: "simple" } }));
                window.dispatchEvent(new CustomEvent("changeBasemap", { detail: { basemapName: "OSM" } }));
                this.updateBasemapEffect();

                window.dispatchEvent(new CustomEvent("toggleLayerVisibility", { detail: { visibleAll: true } }));
                window.dispatchEvent(new CustomEvent("toggleProjTypeVisibility"));
                window.dispatchEvent(new CustomEvent("AOIBufferStepsWizard", { detail: { action: "cleanUp" } }));

                window.dispatchEvent(new CustomEvent("measurementTool", { detail: { action: "cleanUp" } }));

                this.splitPaneRef.current?.setState(
                    (prevState) => {
                        return {
                            ...prevState,
                            draggedSize: "50%"
                        };
                    },
                    () => {
                        window.dispatchEvent(new CustomEvent("resize"));
                        window.dispatchEvent(new CustomEvent("event_initialExtent"));
                    }
                );
            }
        );
    };

    // setBoundaryFeatures = (features: any[]) => {
    //     this.setState({
    //         boundaryFeatures: features
    //     });
    // };

    // map ops
    changeBasemap = (basemapName: string) => {
        this.setState(
            {
                selectedBasemap: basemapName
            },
            () => {
                window.dispatchEvent(new CustomEvent("changeBasemap", { detail: { basemapName } }));
            }
        );
    };

    updateBasemapEffect = (effectName: string | null = null) => {
        const mapEl = document.getElementById(MAP_DIV_ID);
        if (!mapEl) {
            return;
        }

        const appliedEffects = Array.from(mapEl.classList).filter((className) => className.startsWith("baseEffect"));
        appliedEffects.forEach((className) => mapEl.classList.remove(className));

        if (effectName) {
            mapEl.classList.add(BASEMAP_EFFECTS[effectName].className);
        }
    };

    initLayersInfo = () => {
        const baselayers = window.__REAP__CONFIG__.layers.baselayers;
        // const boundaryLayer = window.__REAP__CONFIG__.layers.boundaryLayer;

        const baseLayersList: { [key: string]: any } = {};

        // baseLayersList[boundaryLayer.name] = boundaryLayer;
        baselayers.forEach((layerInfo) => {
            baseLayersList[layerInfo.name] = layerInfo;
        });

        const layers = [
            ...Object.values(this.state.featureLayersInfo)
            // {
            //     info: boundaryLayer
            // },
            // ...baselayers.map((layer) => {
            //     return {
            //         info: layer
            //     };
            // })
        ];

        const initialvisibilityMap: { [layerName: string]: boolean } = {};
        layers.forEach((layerInfo) => {
            initialvisibilityMap[layerInfo.info.name] = true;
        });
        Object.keys(this.featureCategoriesMap).forEach((categoryName) => {
            initialvisibilityMap["CAT__" + categoryName] = true;
        });
        Object.keys(baseLayersList).forEach((layerName) => {
            initialvisibilityMap[layerName] = true;
        });

        this.setState(
            {
                baseLayersList,
                layerListMap: layers,
                visibilityMap: initialvisibilityMap
            },
            () => window.dispatchEvent(new CustomEvent("loadDefaultLayers"))
        );
    };

    toggleVisibilityMap = (layerName: string, isSilent: boolean = false) => {
        const { visibilityMap } = this.state;
        const status = !visibilityMap[layerName];
        this.setState(
            {
                visibilityMap: {
                    ...visibilityMap,
                    [layerName]: status
                }
            },
            () => {
                if (!isSilent) {
                    window.dispatchEvent(new CustomEvent("toggleLayerVisibility", { detail: { layerName, status } }));
                }
            }
        );
    };

    toggleProjectTypeVisibilityMap = (projectType: string, isSilent: boolean = false) => {
        const { projectTypeVisibilityMap } = this.state;
        const status = !projectTypeVisibilityMap[projectType];
        this.setState(
            {
                projectTypeVisibilityMap: {
                    ...projectTypeVisibilityMap,
                    [projectType]: status
                }
            },
            () => {
                if (!isSilent) {
                    window.dispatchEvent(new CustomEvent("toggleProjTypeVisibility"));
                }
            }
        );
    };

    updateFeatureStats = (
        categoriesStats?: { [categoryName: string]: number },
        categoriesIconMap: { [categoryName: string]: string } = {},
        bufferStats: { center: number[]; radius: number; totalFeatures: number } | null = null
    ) => {
        const { categoriesInfo } = this.state;
        let cleanUpAOI = false;

        if (categoriesStats) {
            Object.keys(categoriesStats).forEach((categoryName) => {
                if (categoriesInfo[categoryName]) {
                    categoriesInfo[categoryName].count = categoriesStats[categoryName];
                }
                if (!categoriesIconMap[categoryName]) {
                    categoriesInfo[categoryName].icon = categoriesIconMap[categoryName];
                }
            });
        } else {
            Object.keys(categoriesInfo).forEach((categoryName) => {
                categoriesInfo[categoryName].count = 0;
                categoriesInfo[categoryName].icon = undefined;
            });

            cleanUpAOI = true;
        }

        this.setState(
            {
                categoriesInfo,
                placesAOILoading: false,
                bufferStats: bufferStats
            },
            () => window.dispatchEvent(new CustomEvent("AOIBufferStepsWizard", { detail: { clear: cleanUpAOI, target: "wizard", action: "resultLoaded" } }))
        );
    };

    updateVisibleRenderer = (selectedRendererName: "simple" | "heatmap" | "cluster" | "clusterGroup") => {
        const { visibleAgg } = this.state;
        let visibleLayerRenderer = [...visibleAgg];

        if (visibleLayerRenderer.includes(selectedRendererName)) {
            visibleLayerRenderer.splice(visibleLayerRenderer.indexOf(selectedRendererName), 1);
        } else {
            if (selectedRendererName === "cluster") {
                visibleLayerRenderer = ["cluster"];
            } else {
                if (visibleLayerRenderer.includes("cluster")) {
                    visibleLayerRenderer.splice(visibleLayerRenderer.indexOf("cluster"), 1);
                }

                visibleLayerRenderer.push(selectedRendererName);
                // if (selectedRendererName === "heatmap") {
                //     visibleLayerRenderer = ["heatmap"];
                // } else if (selectedRendererName === "simple") {
                //     visibleLayerRenderer = ["simple"];
                // }
            }
        }

        this.setState({ visibleAgg: visibleLayerRenderer }, () => {
            window.dispatchEvent(new CustomEvent("updateVisibleRenderer", { detail: { selectedRendererName } }));
        });
    };

    toggleAOILoading = (loadingState: boolean) => {
        this.setState({
            placesAOILoading: loadingState
        });
    };

    AOIBufferStepsWizard = (e: CustomEventInit<{ step: number; action: "next" | "resultLoaded" | "cleanUp"; target: "map" | "wizard" }>) => {
        const { detail } = e;

        if (!detail) {
            return;
        }

        if (detail.action === "cleanUp") {
            this.setState({
                wizardStep: 0,
                aoiRenderer: "simple"
            });
            return;
        }

        if (detail.target !== "wizard") {
            return;
        }

        if (detail.action === "next") {
            this.setState({ wizardStep: this.state.wizardStep + 1 });
        }

        if (detail.action === "resultLoaded") {
            // setIsLoaded(true);
        }
    };

    updateAOIRenderer = (selectedRenderer: "simple" | "heatmap") => {
        this.setState(
            {
                aoiRenderer: selectedRenderer
            },
            () => window.dispatchEvent(new CustomEvent("AOIBufferStepsWizard", { detail: { target: "map", action: "toggleRenderer" } }))
        );
    };

    updateWizardStep = (nextStep: number) => {
        this.setState({
            wizardStep: nextStep
        });
    };

    updateMeasurementState = (measureTool: null | "coord" | "distance" | "area" = null) => {
        this.setState(
            {
                activeMeasure: measureTool,
                selectedFeatures: []
            },
            () => {
                window.dispatchEvent(new CustomEvent("measurementTool", { detail: { action: "start", tool: measureTool } }));
            }
        );
    };

    updateMeasureCollection = (newMeasure: { id: number; timestamp: number; type: "distance" | "area"; value: string } | null = null) => {
        let updatedMeasureCollection: any[] = [];
        if (newMeasure) {
            const { measureCollection } = this.state;
            updatedMeasureCollection = [newMeasure, ...measureCollection];
        }

        this.setState({
            measureCollection: updatedMeasureCollection
        });
    };

    removeMeasureItem = (id: number) => {
        const { measureCollection } = this.state;

        const targetId = measureCollection.findIndex((measureItem) => measureItem.id === id);
        if (targetId === -1) {
            return;
        }

        measureCollection.splice(targetId, 1);

        this.setState(
            {
                measureCollection
            },
            () => {
                window.dispatchEvent(new CustomEvent("measurementTool", { detail: { action: "delete", id } }));
            }
        );
    };

    setSearchStatus = ({
        searchText,
        searchResults
    }: {
        searchText?: string;
        searchResults?: {
            id: string | number;
            properties: { name: string; value: any }[];
            projectName: string;
            type: string;
        }[];
    }) => {
        if (searchText) {
            this.setState(
                {
                    searchLoading: true,
                    searchHasResult: true,
                    searchResults: []
                },
                () => {
                    window.dispatchEvent(new CustomEvent("searchTool", { detail: { searchText } }));
                    window.dispatchEvent(new CustomEvent("resize"));
                }
            );
            return;
        }

        if (searchResults) {
            this.setState({
                searchLoading: false,
                searchHasResult: true,
                searchResults
            });
            return;
        }

        this.setState({
            searchLoading: false,
            searchHasResult: false,
            searchResults: []
        });
    };

    // ui

    sidebarTools = () => {
        let tools = [
            {
                key: "reset",
                title: "Home",
                icon: <span className="material-icons">house</span>,
                component: <span />,
                noAction: true
            },
            {
                key: "realestate",
                title: "Real Estate",
                icon: <div className="material-icons">layers</div>,
                component: (
                    <LayersList
                        featureLayersInfo={this.state.featureLayersInfo}
                        projectTypeVisibilityMap={this.state.projectTypeVisibilityMap}
                        toggleProjectTypeVisibilityMap={this.toggleProjectTypeVisibilityMap}
                        layerListMap={this.state.layerListMap}
                        visibleAgg={this.state.visibleAgg}
                        visibilityMap={this.state.visibilityMap}
                        updateVisibleRenderer={this.updateVisibleRenderer}
                        toggleVisibilityMap={this.toggleVisibilityMap}
                        searchLoading={this.state.searchLoading}
                        setSearchStatus={this.setSearchStatus}
                        searchResults={this.state.searchResults}
                        searchHasResult={this.state.searchHasResult}
                    />
                )
            },
            {
                key: "urbanization",
                title: "Urbanization",
                icon: <img src={process.env.PUBLIC_URL + "/images/urban-sprawl-icon.png"} alt="Urbanization" width={40} />,
                component: (
                    <PlacesAOI
                        bufferStats={this.state.bufferStats}
                        placesAOILoading={this.state.placesAOILoading}
                        wizardStep={this.state.wizardStep}
                        updateWizardStep={this.updateWizardStep}
                        aoiRenderer={this.state.aoiRenderer}
                        updateAOIRenderer={this.updateAOIRenderer}
                        categoriesInfo={this.state.categoriesInfo}
                        visibilityMap={this.state.visibilityMap}
                        toggleVisibilityMap={this.toggleVisibilityMap}
                    />
                )
            },
            {
                key: "basemap",
                title: "Base Maps",
                icon: <div className="material-icons">map</div>,
                component: (
                    <BasemapList
                        baseLayersList={this.state.baseLayersList}
                        visibilityMap={this.state.visibilityMap}
                        selectedBasemap={this.state.selectedBasemap}
                        toggleVisibilityMap={this.toggleVisibilityMap}
                        changeBasemap={this.changeBasemap}
                        updateBasemapEffect={this.updateBasemapEffect}
                    />
                )
            },
            {
                key: "bookmarks",
                title: "Bookmarks",
                icon: <div className="material-icons">bookmarks</div>,
                component: <Bookmarks bookmarks={this.props.bookmarks} updateUserBookmarks={this.props.updateUserBookmarks} />
            },
            {
                key: "measurement",
                title: "Measurement",
                icon: <div className="material-icons">architecture</div>,
                component: (
                    <Measurement
                        activeMeasure={this.state.activeMeasure}
                        updateMeasurementState={this.updateMeasurementState}
                        measureCollection={this.state.measureCollection}
                        removeMeasureItem={this.removeMeasureItem}
                    />
                )
            }
        ];

        tools = tools.map((toolInfo) => {
            return {
                ...toolInfo,
                onOpen: () => this.updateActiveSidebarTool(toolInfo.key),
                onClose: () => this.updateActiveSidebarTool()
            };
        });

        return tools;
    };

    render() {
        const sidebarTools = this.sidebarTools();
        const { activeSidebarTool } = this.state;
        let secondarySidebarTool: any = null;
        if (activeSidebarTool) {
            const activeToolInfo = sidebarTools.filter((toolInfo) => toolInfo.key === activeSidebarTool);
            secondarySidebarTool = activeToolInfo.length ? activeToolInfo[0] : null;
        }
        return (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
                {/* <Header /> */}
                <div style={{ display: "flex", flexDirection: "row", height: "calc(100% - 35px)", width: "100%" }}>
                    <Sidebar tools={sidebarTools} doLogout={this.props.doLogout} userInfo={this.props.userInfo} />
                    <div
                        className="secondarySidebar"
                        style={{
                            boxShadow: activeSidebarTool ? "rgb(34, 34, 34) 2px 0px 1px 1px" : "initial"
                        }}
                    >
                        {activeSidebarTool ? (
                            <div style={{ width: 250, display: "flex", flexDirection: "column", position: "relative", height: "100%" }}>
                                {secondarySidebarTool ? secondarySidebarTool.component : ""}

                                <Button type="link" style={{ position: "absolute", right: 0, top: 5 }} onClick={() => this.updateActiveSidebarTool()}>
                                    <span className="material-icons">close</span>
                                </Button>
                            </div>
                        ) : (
                            <div />
                        )}
                    </div>
                    {/* <div
                        style={{
                            display: "flex",
                            flexDirection: "row-reverse",
                            padding: "5px 10px",
                            borderBottom: "1px solid #ccc",
                            backgroundColor: "#fafafa"
                        }}
                    >
                        <Tooltip title="Search">
                            <Button type="primary" shape="circle" icon={<SearchOutlined />} />
                        </Tooltip>
                    </div> */}
                    <div className="mapVizContainer" style={{ position: "relative" }}>
                        <SplitPane
                            ref={this.splitPaneRef}
                            split="vertical"
                            style={{ width: "100%" }}
                            defaultSize={"50%"}
                            primary="second"
                            onDragStarted={() => {
                                const vizContainer = document.getElementById("vizContainer");
                                if (vizContainer) {
                                    vizContainer.classList.add("mouseActions-overlay");
                                }
                            }}
                            onDragFinished={() => {
                                const vizContainer = document.getElementById("vizContainer");
                                if (vizContainer) {
                                    vizContainer.classList.remove("mouseActions-overlay");
                                }
                                window.dispatchEvent(new CustomEvent("splitResize"));
                                window.dispatchEvent(new CustomEvent("resize"));
                            }}
                        >
                            <div className="mapContainer">
                                <MapArea
                                    wizardStep={this.state.wizardStep}
                                    updateWizardStep={this.updateWizardStep}
                                    aoiRenderer={this.state.aoiRenderer}
                                    visibilityMap={this.state.visibilityMap}
                                    updateFeatureStats={this.updateFeatureStats}
                                    gisServerInfo={this.props.gisServerInfo}
                                    layersInfo={this.state.featureLayersInfo}
                                    toggleVisibilityMap={this.toggleVisibilityMap}
                                    resetDataFilter={this.resetDataFilter}
                                    selectedFeatures={this.state.selectedFeatures}
                                    updateStatData={this.updateStatData}
                                    selectFeatures={this.selectFeatures}
                                    filterStatus={this.state.filterStatus}
                                    filterType={this.state.filterType}
                                    // setBoundaryFeatures={this.setBoundaryFeatures}
                                    projectTypeVisibilityMap={this.state.projectTypeVisibilityMap}
                                    updateUserBookmarks={this.props.updateUserBookmarks}
                                    toggleAOILoading={this.toggleAOILoading}
                                    visibleAgg={this.state.visibleAgg}
                                    activeMeasure={this.state.activeMeasure}
                                    updateMeasurementState={this.updateMeasurementState}
                                    updateMeasureCollection={this.updateMeasureCollection}
                                    setSearchStatus={this.setSearchStatus}
                                    searchResults={this.state.searchResults}
                                    toggleProjectTypeVisibilityMap={this.toggleProjectTypeVisibilityMap}
                                />
                                <div
                                    style={{
                                        position: "absolute",
                                        top: 5,
                                        left: 5,
                                        width: "100%",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        pointerEvents: "none"
                                    }}
                                >
                                    <DistrictsSelector />
                                    {/* <PlacesSearch /> */}
                                </div>
                            </div>
                            <div id="vizContainer" className="vizContainer">
                                <VizArea vizInfo={this.state.vizInfo} selectedFeatures={this.state.selectedFeatures} />
                            </div>
                        </SplitPane>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }
}

export default Viewer;

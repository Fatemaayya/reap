import React, { Component } from "react";
import { Spin } from "antd";

// openlayers
import { Feature, Map as olMap, View as olMapView } from "ol";
import { format as olCoordinateFormat } from "ol/coordinate";
import { MousePosition, defaults as olDefaultControls, ScaleLine as olScaleLineControl } from "ol/control";
import { click as olClickEvent } from "ol/events/condition";
import { Extent } from "ol/extent";
import GeoJSON from "ol/format/GeoJSON";
import { Circle, Point, SimpleGeometry, Polygon, LineString } from "ol/geom";
import GeometryType from "ol/geom/GeometryType";
import { Tile as olTileLayer, Vector as VectorLayer, Heatmap as HeatmapLayer, Image as ImageLayer } from "ol/layer";
import { bbox as bboxStrategy } from "ol/loadingstrategy";
import { unByKey } from "ol/Observable";
import Overlay from "ol/Overlay";
import { get as olGetProj } from "ol/proj";
import { Draw, Select as olSelectInteraction } from "ol/interaction";
import { OSM, Vector as VectorSource, Cluster as ClusterSource, ImageWMS } from "ol/source";
// import { /* getDistance as olGetSphereDistance, */ getArea as olGetSphereArea } from "ol/sphere";
import { Fill, Stroke, Style, Text, Circle as CircleStyle, Icon } from "ol/style";

// ol-ext
// import PopupFeature from "ol-ext/overlay/PopupFeature";
import PopupFeature from "../components/custom/PopupFeature";
import AnimatedCluster from "ol-ext/layer/AnimatedCluster";
import Chart from "ol-ext/style/Chart";
import Hover from "ol-ext/interaction/Hover";
// @ts-ignore
import ConvexHull from "ol-ext/geom/ConvexHull";

import { BASEMAP_LIST, MAP_DIV_ID } from "../utils/Constants";
import { formatArea, formatLength, meters2Degrees } from "../utils/CommonUtil";
import { BookmarkInterface, GISServerInfoInterface, GoogleFeatureInterface, LayersInfoInterface } from "../utils/Interfaces";

import "./mapArea.less";

import Legend from "../components/Legend/Legend";
import PopoverRadiusInput from "../components/PopoverRadiusInput/PopoverRadiusInput";
import OverlayPositioning from "ol/OverlayPositioning";

interface State {
    isLoading: boolean;
    colorMap: { [propName: string]: { color: string; fontColor: string } };

    popoverAnchorCoord: number[] | null;
}

interface Props {
    filterType: string[];
    filterStatus: string[];
    selectedFeatures: any[];
    visibilityMap: any;
    resetDataFilter: () => void;
    selectFeatures: (featuresCollection: any) => void;
    updateStatData: (
        statusData: { name: string; value: number; itemStyle: { color: string } }[],
        projTypeData: { name: string; value: number; itemStyle: { color: string } }[]
    ) => void;
    // setBoundaryFeatures: (features: any[]) => void;

    layersInfo: LayersInfoInterface;
    gisServerInfo: GISServerInfoInterface | null;
    updateFeatureStats: (
        categoriesStats?: { [categoryName: string]: number },
        categoriesIconMap?: { [categoryName: string]: string },
        bufferStats?: { center: number[]; radius: number; totalFeatures: number }
    ) => void;
    toggleVisibilityMap: (layerName: string, isSilent?: boolean) => void;
    projectTypeVisibilityMap: { [categoryName: string]: boolean };
    visibleAgg: "simple" | "heatmap" | "cluster" | "clusterGroup";

    updateUserBookmarks: (action: "add" | "delete", bookmark: BookmarkInterface | string) => void;
    wizardStep: number;
    updateWizardStep: (nextStep: number) => void;

    aoiRenderer: "simple" | "heatmap";
    toggleAOILoading: (loadingState: boolean) => void;

    // measurement
    activeMeasure: null | "coord" | "distance" | "area";
    updateMeasurementState: (measureTool?: "coord" | "distance" | "area" | null) => void;
    updateMeasureCollection: (newMeasure?: { id: number; timestamp: number; type: "distance" | "area"; value: string } | null) => void;

    // search
    setSearchStatus: ({
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
    }) => void;

    toggleProjectTypeVisibilityMap: (projectType: string, isSilent?: boolean) => void;
}

class MapArea extends Component<Props, State> {
    state: State = {
        isLoading: false,
        colorMap: {},
        popoverAnchorCoord: null
    };

    simpleFeaturelayer: any[] = [];

    // @ts-ignore to force type
    reapMap: olMap;
    // @ts-ignore to force type
    reapMapView: olMapView;
    // @ts-ignore to force type
    baseLayer: olTileLayer;

    primaryPopUp: PopupFeature | null = null;
    primarySelectInteraction: olSelectInteraction | null = null;

    // realEstateLayer: VectorLayer | null = null;
    realEstateLayers: {
        simple: VectorLayer | null;
        heatmap: HeatmapLayer | null;
        cluster: AnimatedCluster | null;
    } = {
        simple: null,
        heatmap: null,
        cluster: null
    };

    urbanFeatureResultLayers: { simple: VectorLayer | null; heatmap: HeatmapLayer | null } = { simple: null, heatmap: null };
    sketchLayer: VectorLayer | null = null;
    measurementLayer: VectorLayer | null = null;
    measurementInteraction: Draw | null = null;
    measureTooltip: Overlay | null = null;
    helpTooltip: Overlay | null = null;
    measureTooltipElement: any;
    helpTooltipElement: any;
    sketchFeature: any = null;

    constructor(props: Props) {
        super(props);
        this.initMap();
    }

    componentDidMount() {
        this.reapMap.setTarget(MAP_DIV_ID);
        this.postDOMLoad();

        window.addEventListener("resize", this.updateMapSize);
        window.addEventListener("loadDefaultLayers", this.event_addDefaultLayers);
        window.addEventListener("changeBasemap", this.event_changeBasemap);
        window.addEventListener("createBookmark", this.event_createBookmark);
        window.addEventListener("gotoBookmark", this.event_gotoBookmark);
        window.addEventListener("gotoFeature", this.event_gotoFeature);
        window.addEventListener("gotoExtent", this.event_gotoExtent);
        window.addEventListener("zoomInEvent", this.event_zoomIn);
        window.addEventListener("zoomOutEvent", this.event_zoomOut);
        window.addEventListener("toggleLayerVisibility", this.event_layerVisibility);
        window.addEventListener("AOIBufferStepsWizard", this.drawAOI);
        window.addEventListener("toggleProjTypeVisibility", this.event_projTypeVisibility);
        window.addEventListener("updateVisibleRenderer", this.event_updateVisibleRenderer);
        window.addEventListener("measurementTool", this.event_measurementTool);
        window.addEventListener("searchTool", this.event_searchTool);
        window.addEventListener("event_initialExtent", this.event_initialExtent);
    }
    
    componentWillUnmount() {
        window.removeEventListener("resize", this.updateMapSize);
        window.removeEventListener("changeBasemap", this.event_changeBasemap);
        window.removeEventListener("createBookmark", this.event_createBookmark);
        window.removeEventListener("gotoBookmark", this.event_gotoBookmark);
        window.removeEventListener("gotoFeature", this.event_gotoFeature);
        window.removeEventListener("loadDefaultLayers", this.event_addDefaultLayers);
        window.removeEventListener("gotoExtent", this.event_gotoExtent);
        window.removeEventListener("zoomInEvent", this.event_zoomIn);
        window.removeEventListener("zoomOutEvent", this.event_zoomOut);
        window.removeEventListener("toggleLayerVisibility", this.event_layerVisibility);
        window.removeEventListener("AOIBufferStepsWizard", this.drawAOI);
        window.removeEventListener("toggleProjTypeVisibility", this.event_projTypeVisibility);
        window.removeEventListener("updateVisibleRenderer", this.event_updateVisibleRenderer);
        window.removeEventListener("measurementTool", this.event_measurementTool);
        window.removeEventListener("searchTool", this.event_searchTool);
        window.removeEventListener("event_initialExtent", this.event_initialExtent);
    }

    postDOMLoad = () => {
        // add controls
        const template = "Latitude: {y}, Longitude: {x}";
        const mousePositionControl = new MousePosition({
            target: "footerCoords",
            coordinateFormat: function (coord) {
                return olCoordinateFormat(coord as number[], template, 6);
            },
            projection: olGetProj("EPSG:4326")
        });
        this.reapMap.addControl(mousePositionControl);

        const updateFooterZoom = (zoomVal: number) => {
            var zoom = Math.round(zoomVal);
            const footerZoomLevel = document.getElementById("footerZoomLevel");
            if (footerZoomLevel) {
                footerZoomLevel.innerText = `Zoom Level: ${zoom}`;
            }
        };

        // event listeners
        this.reapMapView.on("change:resolution", (event) => {
            var zoom = Math.round(event.target.getZoom());
            updateFooterZoom(zoom);
        });

        this.reapMap.on("pointermove", (evt) => {
            if (evt.dragging) {
                return;
            }
            // var coordinate = this.reapMap.getEventCoordinate(evt.originalEvent as MouseEvent);
            // displaySnap(coordinate);
        });

        // cursor point on feature hover
        const mapTargetEl = this.reapMap.getTargetElement();
        this.reapMap.on("pointermove", (evt) => {
            if (evt.dragging || !mapTargetEl) {
                return;
            }

            const pixel = this.reapMap.getEventPixel(evt.originalEvent);
            const hit = this.reapMap.hasFeatureAtPixel(pixel);

            if (hit) {
                mapTargetEl.style.cursor = "pointer";
            } else {
                mapTargetEl.style.cursor = "";
            }
        });

        // feature selection

        // select interaction working on "click"
        const selectInteraction = new olSelectInteraction({
            condition: olClickEvent,
            layers: this.simpleFeaturelayer
        });
        this.reapMap.addInteraction(selectInteraction);

        selectInteraction.on("select", (e) => {
            if ([1, 2].includes(this.props.wizardStep) || this.props.activeMeasure) {
                return;
            }

            const features = e.target.getFeatures().getArray();
            this.props.selectFeatures(features /*, statusStats, projTypeStats */);
        });

        this.primarySelectInteraction = selectInteraction;

        // popup
        this.primaryPopUp = new PopupFeature({
            popupClass: "default anim",
            select: selectInteraction,
            canFix: true,
            closeBox: true,
            template: (feature: any) => {
                if (!(this.props.wizardStep === 0 || this.props.wizardStep === 3)) {
                    return undefined;
                }
                if (this.props.activeMeasure) {
                    return undefined;
                }

                const layerName = feature.get("layerName");
                if (layerName === "URBAN_FEATURES") {
                    return {
                        title: (f: any) => feature.get("name"),
                        attributes: {
                            name: { title: "Name" },
                            catType: { title: "Type" }
                        }
                    };
                } else if (this.props.layersInfo[layerName]) {
                    const info = this.props.layersInfo[layerName].info;

                    const attributes: any = {};
                    info.displayAttributes.forEach((attribtueName) => {
                        attributes[attribtueName.name] = { title: attribtueName.label };
                    });

                    return {
                        title: (f: any) => feature.get("Project_Na"),
                        attributes
                    };
                }
            }
        });

        this.reapMap.addOverlay(this.primaryPopUp as any);

        // defaults
        updateFooterZoom(this.reapMapView.getZoom() || 0);

        this.gotoInitialExtent();
    };

    initMap() {
        this.baseLayer = new olTileLayer({
            source: new OSM(),
            opacity: 0.9,
            className: "baseMapLayer"
        });

        this.reapMapView = new olMapView({
            projection: "EPSG:4326",
            center: [81.6296, 21.2514],
            zoom: 12
        });

        const otherLayers: any[] = [];
        const { baselayers /* boundaryLayer */ } = window.__REAP__CONFIG__.layers;
        baselayers.forEach((layerInfo) => {
            const layer = new ImageLayer({
                source: new ImageWMS({
                    url: layerInfo.url,
                    params: layerInfo.params ? layerInfo.params : {},
                    ratio: layerInfo.ratio,
                    serverType: layerInfo.serverType,
                    crossOrigin: layerInfo.crossOrigin
                })
            });

            layer.set("__NAME__", layerInfo.name);

            otherLayers.push(layer);
        });

        // boundary layer
        // const featureVectorSource = new VectorSource({
        //     format: new GeoJSON(),
        //     url: function () {
        //         return boundaryLayer.url;
        //     },
        //     strategy: bboxStrategy
        // });

        // featureVectorSource.once("change", (event) => {
        //     if (featureVectorSource.getState() === "ready") {
        //         if (!featureVectorSource.isEmpty()) {
        //             this.props.setBoundaryFeatures(featureVectorSource.getFeatures());
        //             const initialBoundaryFeature = featureVectorSource.getFeatureById(boundaryLayer.defaultId);
        //             if (initialBoundaryFeature) {
        //                 this.gotoExtent(initialBoundaryFeature.getGeometry() as any);
        //             }
        //         }
        //     }
        // });

        // var vectorLayer = new VectorLayer({
        //     source: featureVectorSource,
        //     style: (feature: any) => {
        //         const styleInfo = boundaryLayer.style;
        //         const layerStyle: any = {};

        //         if (styleInfo.fill) {
        //             layerStyle.fill = new Fill({
        //                 color: styleInfo.fill
        //             });
        //         }

        //         if (styleInfo.text) {
        //             let label = feature.get(styleInfo.text.labelProperty);
        //             if (styleInfo.text.postFix) {
        //                 label += styleInfo.text.postFix;
        //             }

        //             let fontSize = "15px";
        //             if (styleInfo.text.size) {
        //                 fontSize = styleInfo.text.size + "px";
        //             }

        //             let font = fontSize + " " + (styleInfo.text.font ? styleInfo.text.font : "Helvetica, Arial Bold, sans-serif");

        //             layerStyle.text = new Text({
        //                 textAlign: "center",
        //                 textBaseline: "middle",
        //                 font: font,
        //                 text: label,
        //                 fill: new Fill({ color: "#222" })
        //             });
        //         }

        //         layerStyle.stroke = new Stroke({
        //             color: styleInfo.stroke,
        //             width: styleInfo.strokeWidth || 0
        //         });

        //         return new Style(layerStyle);
        //     }
        // });

        // vectorLayer.set("__NAME__", boundaryLayer.name);

        // otherLayers.push(vectorLayer);

        this.reapMap = new olMap({
            layers: [this.baseLayer, ...otherLayers],
            controls: olDefaultControls({
                attributionOptions: { collapsible: true },
                rotateOptions: {
                    autoHide: false,
                    tipLabel: "Click to reset rotation. \n (Use Alt+Shift+Drag to rotate the map)",
                    label: "navigation",
                    className: "ol-rotate material-icons"
                }
            }).extend([
                new olScaleLineControl({
                    bar: true,
                    text: true,
                    minWidth: 140
                })
            ]),
            view: this.reapMapView
        });

        this.reapMap.getViewport().addEventListener("mouseout", () => {
            if (this.helpTooltipElement) {
                this.helpTooltipElement.classList.add("hidden");
            }
        });
    }

    addDefaultLayers = () => {
        const { gisServerInfo, layersInfo } = this.props;
        const realEstateCategories = window.__REAP__CONFIG__.realEstateCategories;

        if (!gisServerInfo) {
            return;
        }

        let layerInfoURL = "";
        layerInfoURL += gisServerInfo.securityInfo.isSSLEnabled ? "https://" : "http://";
        layerInfoURL += gisServerInfo.hostName + (gisServerInfo.portNumber ? ":" + gisServerInfo.portNumber : "");
        layerInfoURL += "/geoserver/" + gisServerInfo.workspaceName;

        const colors = ["#003f5c", "#2f4b7c", "#665191", "#a05195", "#d45087", "#f95d6a", "#ff7c43", "#ffa600", "rgba(255, 0, 0, 0.9)"];
        const colorMap: { [propType: string]: { color: string; fontColor: string } } = {};

        // Style for the clusters
        const groupClusterstyleCache: any = {};
        function getStyle(feature: any, resolution: any) {
            var features = feature.get("features");
            var size = features.length;
            // Feature style
            if (size === 1) return featureStyle(feature);
            // ClusterStyle
            else {
                const projectTy = Object.keys(colorMap);
                const data = new Array(projectTy.length).fill(0);
                for (let i = 0, f; (f = features[i]); i++) {
                    const index = projectTy.indexOf(f.get("Project_Ty"));
                    data[index]++;
                }
                let style = groupClusterstyleCache[data.join(",")];
                if (!style) {
                    const radius = Math.min(size + 7, 20);
                    style = groupClusterstyleCache[data.join(",")] = new Style({
                        image: new Chart({
                            type: "pie",
                            radius: radius,
                            data: data,
                            rotateWithView: true,
                            stroke: new Stroke({
                                color: "rgba(0,0,0,0)",
                                width: 0
                            })
                        }) as any
                    });
                }
                return [style];
            }
        }

        // Style for the features
        function featureStyle(f: any) {
            const sel = f.get("features");
            if (sel) {
                const type = sel[0].get("Project_Ty");
                let style = groupClusterstyleCache[type];
                if (!style) {
                    // var color = ol.style.Chart.colors.classic[type];
                    style = groupClusterstyleCache[type] = new Style({
                        image: new CircleStyle({
                            radius: 10,
                            fill: new Fill({
                                color: colorMap[type].color
                            }),
                            stroke: new Stroke({
                                color: "rgba(255, 204, 0, 0.2)",
                                width: 1
                            })
                        }),
                        text: new Text({
                            textAlign: "center",
                            textBaseline: "middle",
                            font: "15px Helvetica, Arial Bold, sans-serif",
                            text: type,
                            fill: new Fill({ color: colorMap[type].fontColor || "#222" }),
                            offsetY: -15
                        })
                    });
                }
                return [style];
            } else
                return [
                    new Style({
                        // Draw a link beetween points (or not)
                        stroke: new Stroke({
                            color: "#fff",
                            width: 1
                        })
                    })
                ];
        }

        // Style for simple features
        const simpleStyle = (feature: any) => {
            const { projectTypeVisibilityMap } = this.props;
            // WARN: hardcoded!!!
            const projectName = feature.get("Project_Na");

            // WARN: hardcoded!!!
            const type = feature.get("Project_Ty");

            if (!projectTypeVisibilityMap[type]) {
                return new Style();
            }

            let text = projectName.length > 12 ? projectName.substr(0, 9) + "..." : projectName;

            return new Style({
                image: new CircleStyle({
                    radius: 7,
                    fill: new Fill({
                        color: colorMap[type].color
                    }),
                    stroke: new Stroke({
                        color: "#fff",
                        width: 2
                    })
                }),
                text:
                    (this.reapMapView.getZoom() || 0) > 14
                        ? new Text({
                              textAlign: "center",
                              textBaseline: "middle",
                              font: "16px Helvetica, Arial Bold, sans-serif",
                              text: text,
                              fill: new Fill({ color: colorMap[type].fontColor || "#222" }),
                              stroke: new Stroke({ color: "#fff", width: 2 }),
                              offsetY: -15
                          })
                        : undefined
            });
        };

        // Object.values(layersInfo).forEach((layerInfo) => {
        const layerInfo = Object.values(layersInfo)[0];
        const featureVectorSource = new VectorSource({
            format: new GeoJSON(),
            url: function (extent) {
                return (
                    layerInfoURL +
                    "/ows?service=WFS&" +
                    `version=1.0.0&request=GetFeature&typename=${gisServerInfo.workspaceName}:${layerInfo.info.name}&maxFeatures=10000&` +
                    "outputFormat=application/json&srsname=EPSG:4326&" +
                    `bbox=${extent.join(",")}` +
                    ",EPSG:4326"
                );
            },
            strategy: bboxStrategy
        });

        featureVectorSource.once("change", () => {
            if (featureVectorSource.getState() === "ready") {
                if (!featureVectorSource.isEmpty()) {
                    const projTypes: string[] = [];

                    featureVectorSource.forEachFeature(function (feature) {
                        var properties = feature.getProperties();

                        if (!projTypes.includes(properties.Project_Ty)) {
                            projTypes.push(properties.Project_Ty);
                        }
                    });

                    projTypes.forEach((projType) => {
                        colorMap[projType] = {
                            color: realEstateCategories[projType].color || colors.pop() + "" || "#ccc",
                            fontColor: realEstateCategories[projType].fontColor || "#222"
                        };
                    });

                    this.setState({ colorMap });
                }
            }
        });

        var vectorLayer = new VectorLayer({
            source: featureVectorSource,
            // minZoom: layerInfo.info.visibilityInfo.aggZoom,
            // maxZoom: layerInfo.info.visibilityInfo.maxZoom,
            style: simpleStyle
        });

        vectorLayer.set("__NAME__", layerInfo.info.name);
        vectorLayer.set("isAggLayer", true);
        vectorLayer.set("aggLayerType", "simple");

        this.realEstateLayers.simple = vectorLayer;

        this.simpleFeaturelayer.push(vectorLayer);

        vectorLayer.getSource().on("addfeature", function (f) {
            f.feature.set("layerName", layerInfo.info.name);
        });

        // heatmap
        const heatmapLayer = new HeatmapLayer({
            source: featureVectorSource,
            // minZoom: layerInfo.info.visibilityInfo.minZoom,
            // maxZoom: layerInfo.info.visibilityInfo.aggZoom,
            visible: false
        });
        heatmapLayer.set("__PARENT_LAYER_NAME__", layerInfo.info.name);
        heatmapLayer.set("isAggLayer", true);
        heatmapLayer.set("aggLayerType", "heatmap");

        this.realEstateLayers.heatmap = heatmapLayer;

        const clusterSource = new ClusterSource({
            distance: 40,
            source: featureVectorSource,
            // @ts-ignore
            geometryFunction: (feature: Feature) => {
                const { projectTypeVisibilityMap } = this.props;
                // WARN: hardcoded!!!
                const type = feature.get("Project_Ty");

                if (!projectTypeVisibilityMap[type]) {
                    return null;
                }

                return feature.getGeometry();
            }
        });

        // cluster
        const styleCache: any = {};
        const clusterLayer = new AnimatedCluster({
            name: "Cluster",
            source: clusterSource,
            // minZoom: layerInfo.info.visibilityInfo.minZoom,
            // maxZoom: layerInfo.info.visibilityInfo.aggZoom,
            visible: false,
            // animationDuration: $("#animatecluster").prop('checked') ? 700:0,
            // Cluster style
            style: (feature: any, resolution: any) => {
                var size = feature.get("features").length;
                var style = styleCache[size];
                if (!style) {
                    var color = size > 25 ? "192,0,0" : size > 8 ? "255,128,0" : "0,128,0";
                    var radius = Math.max(8, Math.min(size * 0.75, 20));
                    style = styleCache[size] = new Style({
                        image: new CircleStyle({
                            radius: radius,
                            stroke: new Stroke({
                                color: "rgba(" + color + ",0.3)",
                                width: 7,
                                lineCap: "butt"
                            }),
                            fill: new Fill({
                                color: "rgba(" + color + ",1)"
                            })
                        }),
                        text: new Text({
                            text: size.toString(),
                            //font: 'bold 12px comic sans ms',
                            //textBaseline: 'top',
                            fill: new Fill({
                                color: "#fff"
                            })
                        })
                    });
                }
                return style;
            }
        });
        // @ts-ignore
        clusterLayer.set("isAggLayer", true);
        // @ts-ignore
        clusterLayer.set("__PARENT_LAYER_NAME__", layerInfo.info.name);
        // @ts-ignore
        clusterLayer.set("aggLayerType", "cluster");

        this.realEstateLayers.cluster = clusterLayer;

        // Add over interaction that draw hull in a layer
        const vector = new VectorLayer({ source: new VectorSource() });
        vector.setMap(this.reapMap);

        const hover = new Hover({
            cursor: "pointer",
            layerFilter: function (l: any) {
                return l === clusterLayer;
            }
        });
        this.reapMap.addInteraction(hover as any);

        // @ts-ignore
        hover.on("enter", function (e) {
            let h = e.feature.get("convexHull");
            if (!h) {
                const cluster = e.feature.get("features");
                // calculate convex hull
                if (cluster && cluster.length) {
                    const c = [];
                    for (let i = 0, f; (f = cluster[i]); i++) {
                        c.push(f.getGeometry().getCoordinates());
                    }
                    // @ts-ignore
                    h = ConvexHull(c);
                    e.feature.get("convexHull", h);
                }
            }
            vector.getSource().clear();
            if (h.length > 2) vector.getSource().addFeature(new Feature(new Polygon([h])));
        });
        // @ts-ignore
        hover.on("leave", function (e) {
            vector.getSource().clear();
        });

        // group cluster
        const groupClusterSource = new ClusterSource({
            distance: 40,
            source: featureVectorSource
        });
        var groupClusterLayer = new AnimatedCluster({
            name: "ClusterGroup",
            source: groupClusterSource,
            // minZoom: layerInfo.info.visibilityInfo.minZoom,
            // maxZoom: layerInfo.info.visibilityInfo.aggZoom,
            visible: false,
            // Cluster style
            style: getStyle
        });
        // @ts-ignore
        groupClusterLayer.set("isAggLayer", true);
        // @ts-ignore
        groupClusterLayer.set("__PARENT_LAYER_NAME__", layerInfo.info.name);
        // @ts-ignore
        groupClusterLayer.set("aggLayerType", "clusterGroup");

        this.reapMap.addLayer(vectorLayer);
        this.reapMap.addLayer(heatmapLayer);
        this.reapMap.addLayer(clusterLayer as any);
        this.reapMap.addLayer(groupClusterLayer as any);
        // });
    };

    updateVisibleRenderer = (selectedRendererName: "simple" | "heatmap" | "cluster" | "clusterGroup") => {
        let simpleLayerName = "";
        this.reapMap.getLayers().forEach((layer) => {
            if (layer.get("isAggLayer")) {
                // const parentVisibility = layersMap[layer.get("__PARENT_LAYER_NAME__")].getVisible();
                layer.setVisible(layer.get("aggLayerType") === selectedRendererName);

                if (layer.get("__NAME__")) {
                    simpleLayerName = layer.get("__NAME__");
                }
            }
        });

        if (simpleLayerName && !this.props.visibilityMap[simpleLayerName]) {
            this.props.toggleVisibilityMap(simpleLayerName, true);
        }
    };

    queryGoogleFeatures = (location: number[], radius: number) => {
        const featureCategoriesMap = window.__REAP__CONFIG__.featureCategories;
        // @ts-ignore
        const { google } = window;

        let totalFeatures = 0;
        const categoriesStats: { [key: string]: number } = {};
        const categoriesIconMap: { [key: string]: string } = {};
        Object.keys(featureCategoriesMap).forEach((categoryName) => {
            categoriesStats[categoryName] = 0;
        });

        var request = {
            location: new google.maps.LatLng(location[1], location[0]),
            radius
        };
        let featuresArray: any[] = [];

        this.props.toggleAOILoading(true);

        // REF: https://github.com/googlemaps/google-maps-services-js/issues/59#issuecomment-399626833
        // why we are using Google Place Javascript lib
        const service = new google.maps.places.PlacesService(document.createElement("div"));
        service.nearbySearch(request, (res: any, PlacesServiceStatus: any, PlaceSearchPagination: any) => {
            featuresArray = [...featuresArray, ...res];

            if (PlaceSearchPagination.hasNextPage) {
                PlaceSearchPagination.nextPage();
                return;
            }

            const features = featuresArray.map((resultFeature: GoogleFeatureInterface) => {
                const featureCoord = [resultFeature.geometry.location.lng(), resultFeature.geometry.location.lat()];

                const featureTypes = resultFeature.types;
                let catType = "";
                Object.keys(featureCategoriesMap).forEach((categoryName) => {
                    if (
                        featureCategoriesMap[categoryName].types.includes(featureTypes[0]) ||
                        featureCategoriesMap[categoryName].types.includes(featureTypes[1])
                    ) {
                        categoriesStats[categoryName]++;
                        totalFeatures++;
                        catType = categoryName;
                    }

                    if (!categoriesIconMap.hasOwnProperty(categoryName)) {
                        categoriesIconMap[categoryName] = process.env.PUBLIC_URL + "/" + featureCategoriesMap[categoryName].icon; // resultFeature.icon;
                    }
                });

                const feature = new Feature({
                    geometry: new Point(featureCoord),
                    name: resultFeature.name,
                    iconPath: categoriesIconMap[catType], // resultFeature.icon,
                    layerName: "URBAN_FEATURES",
                    catType
                });

                return feature;
            });

            const source = new VectorSource({ wrapX: false, features });

            this.urbanFeatureResultLayers.simple = new VectorLayer({
                source: source,
                style: (feature: any) => {
                    const { visibilityMap } = this.props;
                    const catType = feature.get("catType");
                    if (visibilityMap["CAT__" + catType]) {
                        return new Style({
                            image: new Icon({
                                scale: 1,
                                src: feature.get("iconPath")
                            }),
                            text:
                                (this.reapMapView.getZoom() || 0) > 14
                                    ? new Text({
                                          textAlign: "center",
                                          textBaseline: "top",
                                          offsetY: 10,
                                          font: "10px 'Open Sans', sans-serif",
                                          text: feature.get("name"),
                                          fill: new Fill({ color: "#222" })
                                      })
                                    : undefined
                        });
                    }
                    return new Style();
                }
            });
            this.urbanFeatureResultLayers.simple.set("__NAME__", "URBAN_FEATURES_LAYER");

            this.simpleFeaturelayer.push(this.urbanFeatureResultLayers.simple);
            this.reapMap.addLayer(this.urbanFeatureResultLayers.simple);

            // heatmap
            this.urbanFeatureResultLayers.heatmap = new HeatmapLayer({
                source: source,
                gradient: [
                    "rgba(167,163,34,1.0)",
                    "rgba(255,83,247, 1.0)",
                    "rgba(198,255,36, 1.0)",
                    "rgba(232,150,12, 1.0)",
                    "rgba(255,0,0, 1.0)",
                    "rgba(255,83,76, 1.0)",
                    "rgba(86,12,232, 1.0)",
                    "rgba(23,219,255, 1.0)"
                ],
                visible: false
            });
            this.reapMap.addLayer(this.urbanFeatureResultLayers.heatmap);

            this.props.updateFeatureStats(categoriesStats, categoriesIconMap, {
                radius,
                totalFeatures,
                center: [location[1], location[0]]
            });
        });
    };

    searchDefaultLayer = (searchText: string) => {
        if (!this.realEstateLayers.simple) {
            return;
        }

        const { layersInfo } = this.props;
        const layerInfo = Object.values(layersInfo)[0];
        const searchAttributeNames = layerInfo.info.searchAttributes
            .filter((attributeInfo) => attributeInfo.type === "string")
            .map((attribteInfo) => attribteInfo.name);

        const { projectTypeVisibilityMap } = this.props;

        const resultFeatures: any[] = [];
        this.realEstateLayers.simple
            .getSource()
            .getFeatures()
            .forEach((feature) => {
                // WARN: hardcoded!!!
                const type = feature.get("Project_Ty");

                const qualifingAttribs: { name: string; value: any }[] = [];

                if (projectTypeVisibilityMap[type]) {
                    searchAttributeNames.forEach((attributeName) => {
                        const featureVal = (feature.get(attributeName) || "") as string;
                        if (featureVal.toLowerCase().includes(searchText.toLowerCase())) {
                            qualifingAttribs.push({ name: attributeName, value: featureVal });
                        }
                    });
                }

                if (qualifingAttribs.length) {
                    resultFeatures.push({
                        id: feature.getId(),
                        properties: qualifingAttribs,
                        // WARN: hardcoded!!!
                        projectName: feature.get("Project_Na"),
                        type
                    });
                }
            });

        this.props.setSearchStatus({ searchResults: resultFeatures });
    };

    startMeasurement = (tool: "distance" | "area") => {
        if (!this.measurementLayer) {
            const vectorSource = new VectorSource();
            this.measurementLayer = new VectorLayer({
                source: vectorSource,
                style: new Style({
                    fill: new Fill({
                        color: "rgba(255, 255, 255, 0.2)"
                    }),
                    stroke: new Stroke({
                        color: "#ffcc33",
                        width: 2
                    }),
                    image: new CircleStyle({
                        radius: 7,
                        fill: new Fill({
                            color: "#ffcc33"
                        })
                    })
                })
            });

            this.reapMap.addLayer(this.measurementLayer);
        }

        if (this.primarySelectInteraction) {
            this.primarySelectInteraction.getFeatures().clear();
            this.primarySelectInteraction.setActive(false);
        }

        // @ts-ignore
        if (this.primaryPopUp && this.primaryPopUp.getVisible()) {
            // @ts-ignore
            this.primaryPopUp.hide();
        }

        this.addMeasurementInteraction(tool);
        this.reapMap.on("pointermove", this.pointerMoveHandler);
    };

    endMeasurement = () => {
        if (!this.measurementLayer) {
            return;
        }

        this.reapMap.removeLayer(this.measurementLayer);
        this.measurementLayer = null;

        if (this.measureTooltipElement) {
            this.measureTooltipElement.parentNode.removeChild(this.measureTooltipElement);
        }
        this.measureTooltipElement = null;

        const tooltips = document.querySelectorAll(".ol-tooltip");
        for (let index = 0; index < tooltips.length; index++) {
            const tooltipEl = tooltips[index];
            if (tooltipEl) {
                tooltipEl.parentNode?.removeChild(tooltipEl);
            }
        }

        this.props.updateMeasureCollection();
        if (this.primarySelectInteraction) {
            this.primarySelectInteraction.setActive(true);
        }
    };

    /**
     * Handle pointer move.
     * @param {import("../src/ol/MapBrowserEvent").default} evt The event.
     */
    pointerMoveHandler = (evt: any) => {
        if (evt.dragging) {
            return;
        }

        let helpMsg = "Click to start drawing...";

        // if(this.measurementInteraction){
        //     console.log(this.measurementInteraction);
        //     if(this.measurementInteraction.getPointerCount()_ === "Polygon"){
        //         helpMsg = "Click to continue drawing the Polygon...";
        //     }
        //     else if(this.measurementInteraction.type_ === "Line"){
        //         helpMsg = "Click to continue drawing the Line...";
        //     }
        // }

        if (this.sketchFeature) {
            const geom = this.sketchFeature.getGeometry();
            if (geom instanceof Polygon) {
                helpMsg = "Click to continue drawing the Polygon...";
            } else if (geom instanceof LineString) {
                helpMsg = "Click to continue drawing the Line...";
            }
        }

        if (!this.helpTooltip) {
            return;
        }

        this.helpTooltipElement.innerHTML = helpMsg;
        this.helpTooltip.setPosition(evt.coordinate);

        this.helpTooltipElement.classList.remove("hidden");
    };

    addMeasurementInteraction = (tool: "distance" | "area") => {
        if (!this.measurementLayer) {
            return;
        }

        var type = tool === "area" ? GeometryType.POLYGON : GeometryType.LINE_STRING;
        this.measurementInteraction = new Draw({
            source: this.measurementLayer.getSource(),
            type: type,
            style: new Style({
                fill: new Fill({
                    color: "rgba(255, 255, 255, 0.2)"
                }),
                stroke: new Stroke({
                    color: "rgba(0, 0, 0, 0.5)",
                    lineDash: [10, 10],
                    width: 2
                }),
                image: new CircleStyle({
                    radius: 5,
                    stroke: new Stroke({
                        color: "rgba(0, 0, 0, 0.7)"
                    }),
                    fill: new Fill({
                        color: "rgba(255, 255, 255, 0.2)"
                    })
                })
            })
        });

        this.reapMap.addInteraction(this.measurementInteraction);

        const tsId = new Date().getTime();
        this.createMeasureTooltip("tt_" + tsId);
        this.createHelpTooltip();

        var listener: any;
        this.measurementInteraction.on("drawstart", (evt) => {
            // set sketch
            this.sketchFeature = evt.feature;

            // @ts-ignore
            var tooltipCoord = evt.coordinate;

            listener = this.sketchFeature.getGeometry().on("change", (evt: any) => {
                var geom = evt.target;
                var output;
                if (geom instanceof Polygon) {
                    output = formatArea(geom);
                    tooltipCoord = geom.getInteriorPoint().getCoordinates();
                } else if (geom instanceof LineString) {
                    output = formatLength(geom);
                    tooltipCoord = geom.getLastCoordinate();
                }

                if (!this.measureTooltip) {
                    return;
                }

                this.measureTooltipElement.innerHTML = output;
                this.measureTooltip.setPosition(tooltipCoord);
            });
        });

        this.measurementInteraction.on("drawend", (evt) => {
            if (!this.measureTooltip) {
                return;
            }

            evt.feature.setId(tsId);

            this.measureTooltipElement.className = "ol-tooltip ol-tooltip-static";
            this.measureTooltip.setOffset([0, -7]);
            // unset sketch
            this.sketchFeature = null;
            // unset tooltip so that a new one can be created
            this.measureTooltipElement = null;
            this.createMeasureTooltip();
            unByKey(listener);

            this.props.updateMeasurementState();
            if (this.primarySelectInteraction) {
                this.primarySelectInteraction.setActive(true);
            }
            setTimeout(() => {
                if (this.measurementInteraction) {
                    this.reapMap.removeInteraction(this.measurementInteraction);
                }
                if (this.helpTooltip) {
                    this.reapMap.removeOverlay(this.helpTooltip);
                }
                if (this.helpTooltipElement) {
                    this.helpTooltipElement.parentNode.removeChild(this.helpTooltipElement);
                    this.helpTooltipElement = null;
                }
                this.reapMap.un("pointermove", this.pointerMoveHandler);

                var geom = evt.feature.getGeometry();
                var output;
                if (geom instanceof Polygon) {
                    output = formatArea(geom);
                } else if (geom instanceof LineString) {
                    output = formatLength(geom);
                }

                this.props.updateMeasureCollection({
                    id: tsId,
                    timestamp: tsId,
                    type: tool,
                    value: output || ""
                });
            }, 100);
        });
    };

    /**
     * Creates a new measure tooltip
     */
    createMeasureTooltip = (uid?: string) => {
        if (this.measureTooltipElement) {
            this.measureTooltipElement.parentNode.removeChild(this.measureTooltipElement);
        }
        this.measureTooltipElement = document.createElement("div");
        if (uid) {
            this.measureTooltipElement.id = uid;
        }

        this.measureTooltipElement.className = "ol-tooltip ol-tooltip-measure";
        this.measureTooltip = new Overlay({
            element: this.measureTooltipElement,
            offset: [0, -15],
            positioning: OverlayPositioning.BOTTOM_CENTER
        });
        this.reapMap.addOverlay(this.measureTooltip);
    };

    /**
     * Creates a new help tooltip
     */
    createHelpTooltip = () => {
        if (this.helpTooltipElement) {
            this.helpTooltipElement.parentNode.removeChild(this.helpTooltipElement);
        }
        this.helpTooltipElement = document.createElement("div");
        this.helpTooltipElement.className = "ol-tooltip hidden";
        this.helpTooltip = new Overlay({
            element: this.helpTooltipElement,
            offset: [15, 0],
            positioning: OverlayPositioning.CENTER_LEFT
        });
        this.reapMap.addOverlay(this.helpTooltip);
    };

    // window event
    event_addDefaultLayers = (e: CustomEventInit) => {
        this.addDefaultLayers();
    };

    event_changeBasemap = (e: CustomEventInit<{ basemapName: string }>) => {
        if (e.detail) {
            const { basemapName } = e.detail;
            this.changeBasemap(basemapName);
        }
    };

    event_createBookmark = (e: CustomEventInit<{ name: string; label: string }>) => {
        if (!e.detail) {
            return;
        }
        const { name, label } = e.detail;
        const timestamp = new Date().getTime();
        const extent = this.reapMapView.calculateExtent(this.reapMap.getSize());
        if (!isFinite(extent[0])) {
            console.error("Map extent error");
            return;
        }

        this.props.updateUserBookmarks("add", { name, label, extent, timestamp });

        // UpdateStoreObject("RP_BOOKMARKS", { name, label, extent, timestamp });
        // window.dispatchEvent(new CustomEvent("bookmarkCreated"));
    };

    event_initialExtent = () => {
        this.gotoInitialExtent();
    }

    event_gotoBookmark = (e: CustomEventInit<{ bookmark: BookmarkInterface }>) => {
        if (!e.detail) {
            return;
        }
        const { bookmark } = e.detail;
        this.gotoExtent(bookmark.extent);
    };

    event_gotoExtent = (e: CustomEventInit<{ extent: number[] }>) => {
        if (!e.detail) {
            return;
        }

        const { extent } = e.detail;
        this.gotoExtent(extent as Extent);
    };

    event_gotoFeature = (e: CustomEventInit<{ id: number | string }>) => {
        if (!e.detail) {
            return;
        }

        const { id } = e.detail;
        this.gotoFeature(id);
    };

    event_zoomIn = () => {
        this.updateMapZoom((this.reapMapView.getZoom() || 0) + 1);
    };

    event_zoomOut = () => {
        this.updateMapZoom((this.reapMapView.getZoom() || 0) - 1);
    };

    event_layerVisibility = (e: CustomEventInit<{ layerName: string; status: boolean; visibleAll?: boolean }>) => {
        if (!e.detail) {
            return;
        }

        const { layerName, status, visibleAll } = e.detail;

        if (visibleAll) {
            // @ts-ignore
            this.primaryPopUp.hide();

            if (this.urbanFeatureResultLayers.simple && this.urbanFeatureResultLayers.heatmap) {
                this.urbanFeatureResultLayers.simple.changed();
                const features = this.urbanFeatureResultLayers.heatmap.getSource().getFeatures();
                features.forEach((feature) => feature.set("weight", 10));
            }

            this.realEstateLayers.simple?.setVisible(true);
            this.realEstateLayers.heatmap?.setVisible(false);
            // @ts-ignore
            this.realEstateLayers.cluster.setVisible(false);

            return;
        }

        if (layerName.startsWith("CAT__") && this.urbanFeatureResultLayers.simple && this.urbanFeatureResultLayers.heatmap) {
            this.urbanFeatureResultLayers.simple.changed();

            const features = this.urbanFeatureResultLayers.heatmap.getSource().getFeatures();
            features.forEach((feature) => {
                const { visibilityMap } = this.props;
                const catType = feature.get("catType");

                feature.set("weight", visibilityMap["CAT__" + catType] ? 10 : 0);
            });
            return;
        }

        this.setLayerVisibility(layerName, status);
    };

    event_projTypeVisibility = () => {
        this.realEstateLayers.simple?.getSource().changed();
        const { projectTypeVisibilityMap } = this.props;

        this.realEstateLayers.heatmap
            ?.getSource()
            .getFeatures()
            .forEach((feature) => {
                const type = feature.get("Project_Ty");

                feature.set("weight", projectTypeVisibilityMap[type] ? 10 : 0);
            });
    };

    event_updateVisibleRenderer = (e: CustomEventInit<{ selectedRendererName: "simple" | "heatmap" | "cluster" | "clusterGroup" }>) => {
        if (!e.detail) {
            return;
        }

        this.updateVisibleRenderer(e.detail.selectedRendererName);
    };

    event_measurementTool = (e: CustomEventInit<{ action: "start" | "delete" | "cleanUp"; tool?: "distance" | "area"; id?: number }>) => {
        if (!e.detail) {
            return;
        }

        const { action, tool, id } = e.detail;

        if (action === "start" && tool) {
            this.startMeasurement(tool);
        }

        if (action === "delete" && id && this.measurementLayer) {
            const targetFeature = this.measurementLayer.getSource().getFeatureById(id);
            if (targetFeature) {
                this.measurementLayer.getSource().removeFeature(targetFeature);
            }

            const tooltipEl = document.getElementById("tt_" + id);
            if (tooltipEl) {
                tooltipEl.parentNode?.removeChild(tooltipEl);
            }
        }

        if (action === "cleanUp") {
            this.endMeasurement();
        }
    };

    event_searchTool = (e: CustomEventInit<{ searchText: string }>) => {
        if (!e.detail) {
            return;
        }

        const { searchText } = e.detail;
        this.searchDefaultLayer(searchText);
    };

    // map actions
    changeBasemap = (basemapName: string) => {
        const basemapInfo = BASEMAP_LIST[basemapName];
        this.baseLayer.setSource(basemapInfo.getSource());
    };

    gotoInitialExtent = () => {
        // inital extent
        const boundaryFeatures = window.__REAP__CONFIG__.boundaryFeatures;
        const initalExtent = boundaryFeatures.features[boundaryFeatures.defaultFeature];
        this.gotoExtent(initalExtent as any);
    }

    gotoExtent = (extent: Extent | SimpleGeometry, options: any = {}) => {
        this.reapMapView.fit(extent, { duration: 1200, maxZoom: options.maxZoom || undefined });
    };

    gotoFeature = (featureId: string | number) => {
        if (!this.realEstateLayers.simple) {
            return;
        }

        const targetFeature = this.realEstateLayers.simple.getSource().getFeatureById(featureId);
        if (targetFeature) {
            this.gotoExtent(targetFeature.getGeometry() as SimpleGeometry, { maxZoom: 20 });
        }
    };

    updateMapSize = () => {
        if (this.reapMap) {
            this.reapMap.updateSize();
        }
    };

    updateMapZoom = (zoomLevel: number) => {
        this.reapMapView.setZoom(zoomLevel);
    };

    setLayerVisibility = (layerName: string, status: boolean) => {
        this.reapMap.getLayers().forEach((mapLayer) => {
            if (mapLayer.get("__NAME__") === layerName && this.props.visibleAgg === "simple") {
                mapLayer.setVisible(status);
            }

            if (mapLayer.get("isAggLayer") && mapLayer.get("__PARENT_LAYER_NAME__") === layerName) {
                mapLayer.setVisible(this.props.visibleAgg === mapLayer.get("aggLayerType") && status);
            }
        });
    };

    drawAOI = (
        e: CustomEventInit<{
            step: number;
            action: "drawCenter" | "analysisInRadius" | "toggleRenderer" | "cleanUp";
            target: "map" | "wizard";
            radius?: number;
        }>
    ) => {
        const { detail } = e;
        if (!detail) {
            return;
        }

        if (detail.action === "cleanUp") {
            if (this.sketchLayer) {
                this.reapMap.removeLayer(this.sketchLayer);
                this.sketchLayer = null;
            }

            if (this.urbanFeatureResultLayers.simple && this.urbanFeatureResultLayers.heatmap) {
                this.simpleFeaturelayer.pop(); // UNSAFE: we are considering last added is target layer
                this.reapMap.removeLayer(this.urbanFeatureResultLayers.simple);
                this.reapMap.removeLayer(this.urbanFeatureResultLayers.heatmap);
                this.urbanFeatureResultLayers.simple = null;
                this.urbanFeatureResultLayers.heatmap = null;
            }

            this.setState(
                {
                    popoverAnchorCoord: null
                },
                () => this.props.updateFeatureStats()
            );
            return;
        }

        if (detail.target !== "map") {
            return;
        }

        if (detail.action === "drawCenter") {
            if (this.sketchLayer) {
                this.reapMap.removeLayer(this.sketchLayer);
                this.sketchLayer = null;
            }

            if (this.urbanFeatureResultLayers.simple && this.urbanFeatureResultLayers.heatmap) {
                this.simpleFeaturelayer.pop(); // UNSAFE: we are considering last added is target layer
                this.reapMap.removeLayer(this.urbanFeatureResultLayers.simple);
                this.reapMap.removeLayer(this.urbanFeatureResultLayers.heatmap);
                this.urbanFeatureResultLayers.simple = null;
                this.urbanFeatureResultLayers.heatmap = null;
            }

            if (this.primarySelectInteraction) {
                this.primarySelectInteraction.setActive(false);
            }

            const source = new VectorSource({ wrapX: false });
            this.sketchLayer = new VectorLayer({
                source: source,
                style: () => {
                    return [
                        new Style({
                            image: new CircleStyle({
                                radius: 7,
                                fill: new Fill({
                                    color: "rgba(255, 0, 0, 0.03)"
                                }),
                                stroke: new Stroke({
                                    color: "rgba(255, 0, 0, 0.3)",
                                    width: 2
                                })
                            })
                        }),
                        new Style({
                            stroke: new Stroke({
                                color: "rgba(255, 235, 59)",
                                width: 3
                                // lineDash: [2, 5]
                            }),
                            fill: new Fill({
                                color: "rgb(255, 235, 59, 0.3)"
                            })
                        })
                    ];
                }
            });
            this.sketchLayer.set("__NAME__", "drawLayer");
            this.reapMap.addLayer(this.sketchLayer);

            const drawInteraction = new Draw({
                source: source,
                type: GeometryType.POINT
            });

            drawInteraction.on("drawend", (e) => {
                // const geom = e.feature.getGeometry() as Circle;
                // let distance = olGetSphereDistance(geom.getCenter(), geom.getLastCoordinate());
                // distance = Math.round(distance * 100) / 100;
                // this.queryGoogleFeatures(geom.getCenter(), distance);
                this.reapMap.removeInteraction(drawInteraction);

                this.setState(
                    {
                        popoverAnchorCoord: e.target.downPx_
                    },
                    () => {
                        if (this.primarySelectInteraction) {
                            this.primarySelectInteraction.setActive(true);
                        }
                        window.dispatchEvent(new CustomEvent("AOIBufferStepsWizard", { detail: { target: "wizard", action: "next" } }));
                    }
                );
            });

            this.reapMap.addInteraction(drawInteraction);
            window.dispatchEvent(new CustomEvent("AOIBufferStepsWizard", { detail: { target: "wizard", action: "next" } }));
        } else if (detail.action === "analysisInRadius" && detail.radius) {
            const centerFeature = this.sketchLayer?.getSource().getFeatures()[0] as Feature;
            const center = (centerFeature.getGeometry() as Point).getCoordinates();

            // convert meters to degrees, create buffer area and show on map
            const bufferArea = new Circle(center, meters2Degrees(detail.radius));
            this.sketchLayer?.getSource().addFeature(new Feature(bufferArea));
            // this.sketchLayer?.getSource().removeFeature(centerFeature);

            this.setState(
                {
                    popoverAnchorCoord: null
                },
                () => {
                    this.queryGoogleFeatures(center, detail.radius as number);
                }
            );
        } else if (detail.action === "toggleRenderer") {
            const { aoiRenderer } = this.props;
            const oldRenderer = aoiRenderer === "simple" ? "heatmap" : "simple";

            this.urbanFeatureResultLayers[aoiRenderer]?.setVisible(true);
            this.urbanFeatureResultLayers[oldRenderer]?.setVisible(false);
        }
    };

    render() {
        const { colorMap, popoverAnchorCoord } = this.state;
        return (
            <div style={{ width: "100%", height: "100%", position: "relative" }}>
                <Spin spinning={this.state.isLoading} wrapperClassName="fullLoader">
                    <div id={MAP_DIV_ID} className="" style={{ position: "relative", width: "100%", height: "100%" }}>
                        {Array.isArray(popoverAnchorCoord) ? (
                            <PopoverRadiusInput coords={popoverAnchorCoord} updateWizardStep={this.props.updateWizardStep} />
                        ) : (
                            <span />
                        )}
                        {/* <div id={POPOVER_ANCHOR_DIV_ID} style={{ position: "absolute", bottom: 0, left: 0, pointerEvents: "none" }} /> */}
                    </div>

                    {this.props.visibleAgg === "simple" ? (
                        <div
                            style={{
                                position: "absolute",
                                bottom: 45,
                                left: 10
                            }}
                        >
                            <Legend
                                colorMap={colorMap}
                                toggleProjectTypeVisibilityMap={this.props.toggleProjectTypeVisibilityMap}
                                projectTypeVisibilityMap={this.props.projectTypeVisibilityMap}
                            />
                        </div>
                    ) : (
                        <span />
                    )}

                    {/* <div
                        style={{
                            position: "absolute",
                            bottom: 10,
                            left: 10
                        }}
                    >
                       <Radio.Group value={this.state.visibleAgg} onChange={(e) => this.updateVisibleRenderer(e.target.value)}>
                            <Radio.Button value="simple">Simple</Radio.Button>
                            <Radio.Button value="heatmap">Heatmap</Radio.Button>
                            <Radio.Button value="cluster">Cluster</Radio.Button>
                            <Radio.Button value="clusterGroup">Cluster Group</Radio.Button>
                        </Radio.Group>
                    </div> */}
                </Spin>
            </div>
        );
    }
}

export default MapArea;

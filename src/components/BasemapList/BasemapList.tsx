import React, { Fragment } from "react";
import { Typography, List, Avatar, Button } from "antd";
import { BASEMAP_EFFECTS, BASEMAP_LIST } from "../../utils/Constants";

import "./basemapList.less";

interface Props {
    selectedBasemap: string;
    baseLayersList: { [key: string]: any };
    visibilityMap: any;
    toggleVisibilityMap: (layerName: string) => void;
    changeBasemap: (basemapName: string) => void;
    updateBasemapEffect: (effectName?: string) => void;
}

export default (props: Props) => {
    return (
        <Fragment>
            <div style={{ flexGrow: 1 }}>
                <div>
                    <Typography.Title level={3}>Boundary Layers</Typography.Title>

                    <List
                        itemLayout="horizontal"
                        dataSource={Object.values(props.baseLayersList)}
                        renderItem={(layerInfo: any) => {
                            return (
                                <List.Item style={{ borderLeft: "5px solid " + layerInfo.accent }} onClick={() => props.toggleVisibilityMap(layerInfo.name)}>
                                    <Button type="link" style={{ padding: 5 }}>
                                        <span
                                            className={"material-icons" + (props.visibilityMap[layerInfo.name] ? "" : " layer-disabled")}
                                            style={{ fontSize: "1.2em" }}
                                        >
                                            {props.visibilityMap[layerInfo.name] ? "visibility" : "visibility_off"}
                                        </span>
                                    </Button>
                                    <div style={{ width: "100%" }}>
                                        <List.Item.Meta title={layerInfo.label || layerInfo.name} />
                                    </div>
                                </List.Item>
                            );
                        }}
                    />
                </div>

                <div>
                    <Typography.Title level={3}>Basemaps</Typography.Title>
                    <List
                        style={{ overflow: "auto", maxHeight: "calc(100vh - 405px)" }}
                        itemLayout="horizontal"
                        dataSource={Object.values(BASEMAP_LIST)}
                        renderItem={(basemapInfo) => {
                            const isSet = props.selectedBasemap === basemapInfo.name;
                            return (
                                <List.Item className={isSet ? "active" : ""} onClick={() => (isSet ? null : props.changeBasemap(basemapInfo.name))}>
                                    <List.Item.Meta avatar={<Avatar shape="square" size="large" src={basemapInfo.imgThumb} />} title={basemapInfo.label} />
                                    {isSet && <span className="material-icons">done</span>}
                                </List.Item>
                            );
                        }}
                    />
                </div>
            </div>

            <div>
                <Button onClick={() => props.updateBasemapEffect()}>None</Button>
                {Object.values(BASEMAP_EFFECTS).map((effectInfo, index) => (
                    <Button onClick={() => props.updateBasemapEffect(effectInfo.key)} key={index}>
                        {effectInfo.label}
                    </Button>
                ))}
            </div>
        </Fragment>
    );
};

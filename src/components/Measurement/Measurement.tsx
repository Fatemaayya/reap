import React from "react";
import { Button, List, Radio, Typography } from "antd";
import moment from "moment";

interface Props {
    measureCollection: any[];
    activeMeasure: null | "coord" | "distance" | "area";
    removeMeasureItem: (id: number) => void;
    updateMeasurementState: (measureTool: "coord" | "distance" | "area") => void;
}

const Measurement = (props: Props) => {
    return (
        <div style={{ height: "100%" }}>
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
                Measurement
            </Typography.Title>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: 5 }}>
                <Radio.Group buttonStyle="solid" value={props.activeMeasure} onChange={(e) => props.updateMeasurementState(e.target.value)}>
                    {/* <Radio.Button value="coord" disabled>
                        <span style={{ lineHeight: "1.2em" }} className="material-icons">
                            place
                        </span>
                    </Radio.Button> */}
                    <Radio.Button value="distance">
                        <span style={{ lineHeight: "1.2em" }} className="material-icons">
                            timeline
                        </span>
                    </Radio.Button>
                    <Radio.Button value="area">
                        <span style={{ lineHeight: "1.2em" }} className="material-icons">
                            tab_unselected
                        </span>
                    </Radio.Button>
                </Radio.Group>

                <Button onClick={() => window.dispatchEvent(new CustomEvent("measurementTool", { detail: { action: "cleanUp" } }))}>Clear</Button>
            </div>

            <List
                style={{ flexGrow: 1 }}
                itemLayout="horizontal"
                dataSource={props.measureCollection.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1))}
                renderItem={(measureItem) => {
                    let mtTimestamp = moment(measureItem.timestamp);
                    let timeString = mtTimestamp.format("DD-MMM-YYYY, hh:mm a");

                    if (!mtTimestamp.isBefore(moment(), "day")) {
                        timeString = mtTimestamp.fromNow();
                    }

                    const { value } = measureItem;
                    let title = value;
                    if (value.indexOf("<sup>") > -1) {
                        title = (
                            <span>
                                {value.substring(0, value.indexOf("<sup>"))} <sup>{value.substring(value.indexOf("<sup>") + 5, value.indexOf("</sup>"))}</sup>
                            </span>
                        );
                    }

                    return (
                        <List.Item
                            actions={[
                                <span className="material-icons dynamicDeleteIcon" onClick={() => props.removeMeasureItem(measureItem.id)}>
                                    &nbsp;
                                </span>
                            ]}
                        >
                            <Button type="link" style={{ padding: 5 }}>
                                <span className="material-icons" style={{ fontSize: "1.2em" }}>
                                    {measureItem.type === "area" ? "tab_unselected" : "timeline"}
                                </span>
                            </Button>
                            <div style={{ width: "100%" }}>
                                <List.Item.Meta title={title} description={timeString} />
                            </div>
                        </List.Item>
                    );
                }}
            />
        </div>
    );
};

export default Measurement;

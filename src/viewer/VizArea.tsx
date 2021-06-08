import React from "react";
import RadarChart from "../components/Charts/RadarChart";
import InfoPanel from "../components/InfoPanel/InfoPanel";
import TableauViz from "../components/TableauViz/TableauViz";
import { VizInfoInterface } from "../utils/Interfaces";

interface Props {
    vizInfo: VizInfoInterface[];
    selectedFeatures: any[];
}

const VizArea = (props: Props) => {
    let showViz = false;
    if (props.selectedFeatures.length && props.selectedFeatures[0].get("layerName") !== "URBAN_FEATURES") {
        showViz = true;
    }

    return (
        <div style={{ height: "100%", width: "100%" }}>
            {showViz ? (
                <div
                    style={{
                        height: "100%",
                        width: "calc(100% - 2em)",
                        paddingLeft: "2em",
                        display: "flex",
                        flexDirection: "column"
                    }}
                >
                    <div style={{ height: "45%" }}>
                        <RadarChart />
                    </div>
                    <InfoPanel feature={props.selectedFeatures[0]} />
                </div>
            ) : (
                <div
                    style={{
                        height: "100%",
                        width: "100%",
                        display: "flex",
                        flexDirection: "row",
                        borderBottom: "1px solid #eee"
                    }}
                >
                    <TableauViz vizInfo={props.vizInfo} />
                </div>
            )}
        </div>
    );
};

export default VizArea;

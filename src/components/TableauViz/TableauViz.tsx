import React, { Component } from "react";
import { Select, Typography } from "antd";
import { VizInfoInterface } from "../../utils/Interfaces";

import "./tableauViz.less";

interface Props {
    vizInfo: VizInfoInterface[];
}

class TableauViz extends Component<Props> {
    state = {
        selectedViz: 0
    };

    container = React.createRef<HTMLDivElement>();
    vizDivRef = React.createRef<HTMLDivElement>();

    // @ts-ignore
    tableau = window.tableau;
    viz: any = null;

    componentDidMount() {
        this.initViz();

        window.addEventListener("splitResize", this.handleResize);
        window.addEventListener("loadDefaultViz", this.loadDefaultViz);
    }

    componentWillUnmount() {
        window.removeEventListener("splitResize", this.handleResize);
        window.removeEventListener("loadDefaultViz", this.loadDefaultViz);
    }

    loadDefaultViz = () => {
        this.initViz();
    };

    initViz = () => {
        if (this.viz) {
            // If a viz object exists, delete it.
            this.viz.dispose();
        }

        if (!this.props.vizInfo.length) {
            return;
        }

        this.viz = new this.tableau.Viz(this.vizDivRef.current, this.props.vizInfo[this.state.selectedViz].url, { hideTabs: true, hideToolbar: true });
    };

    handleResize = () => {
        if (!this.container.current) {
            return;
        }

        try {
            var width = this.container.current.clientWidth - 10;
            var height = this.container.current.clientHeight;
            var sheet = this.viz.getWorkbook().getActiveSheet();

            sheet
                .changeSizeAsync({ behavior: "EXACTLY", maxSize: { height: height, width: width } })
                .then(this.viz.setFrameSize(parseInt("" + width, 10), parseInt("" + height, 10)));
        } catch (error) {
            console.error("Failed to update tableau panel");
        }
    };

    render() {
        const { vizInfo } = this.props;
        return (
            <div ref={this.container} style={{ position: "relative", width: "100%" }}>
                <div style={{ borderBottom: "1px solid #ccc", padding: 5, display: "flex", alignItems: "center" }}>
                    <Typography.Text strong style={{ margin: "0 1em" }}>
                        Views:
                    </Typography.Text>
                    <Select
                        defaultValue={vizInfo.length ? vizInfo[this.state.selectedViz].name : ""}
                        onChange={(value) => this.setState({ selectedViz: value }, () => this.initViz())}
                        style={{ width: "100%", textAlign: "initial" }}
                    >
                        {vizInfo.map((viz, index) => (
                            <Select.Option key={index} value={index}>
                                {viz.name}
                            </Select.Option>
                        ))}
                    </Select>
                </div>
                <div ref={this.vizDivRef} style={{ height: "calc(100% - 35px)", width: "100%", paddingTop: 5, overflowY: "auto" }} />
            </div>
        );
    }
}

export default TableauViz;

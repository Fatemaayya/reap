import React, { Component } from "react";
import "./App.less";
import axios from "axios";
import Viewer from "./viewer/Viewer";
import { message, Result } from "antd";
import { BookmarkInterface, GISServerInfoInterface } from "./utils/Interfaces";

interface State {
    isLoading: boolean;
    loadError: string | null;
    bookmarks: { [bookmarkKey: string]: BookmarkInterface };
    userInfo: {
        firstName: string;
        lastName: string;
        role: string;
        userName: string;
    } | null;
    gisServerInfo: GISServerInfoInterface | null;
}

class App extends Component<{}, State> {
    state: State = {
        isLoading: true,
        bookmarks: {},
        loadError: null,
        userInfo: null,
        gisServerInfo: null
    };

    // do login check
    componentDidMount() {
        this.postLoginLoading();
    }

    // fetch init
    postLoginLoading = () => {
        const serverUrl = window.__REAP__CONFIG__.reapAdminUrl;
        const principalUrl = `${serverUrl}access/principal/web?callback=cbk`;
        let userInfo: any = null;
        let gisServerInfo: any = null;

        // start iFrame
        const iFoo = (url: string) => {
            var iframe = document.createElement("iframe");
            iframe.src = url;
            iframe.name = "frame";
            iframe.style.height = "0px";
            iframe.style.width = "0px";
            iframe.style.border = "none";
            iframe.style.position = "absolute";
            iframe.style.bottom = "0px";

            document.body.appendChild(iframe);

            return new Promise((resolve, reject) => {
                iframe.onload = () => {
                    //  request admin
                    // load principle
                    axios
                        .get(principalUrl)
                        .then((res) => {
                            resolve(res);
                            // close iFrame
                            document.body.removeChild(iframe);
                        })
                        .catch((err) => {
                            this.throwAppError(err);
                        });
                };
            });
        };

        iFoo(principalUrl)
            .then((response: any) => {
                let { data } = response;
                if (typeof data === "string") {
                    if (data.startsWith("cbk")) {
                        // starts with known token
                        data = data.substr(5, data.length - 7);
                        data = data.replace(/\\/g, "");
                        data = JSON.parse(data);
                    } else {
                        console.error("invalid authorization, please login.");
                        throw new Error("invalid authorization, please login.");
                    }
                }
                const { userInfo: _userInfo, gisServerInfo: _gisServerInfo, message, status } = data;
                if (status !== "success" || !_userInfo) {
                    console.error("Failed to get user, " + message);
                    throw new Error("Failed to get user, " + message);
                }

                userInfo = _userInfo;
                gisServerInfo = _gisServerInfo;

                return axios.get(`${serverUrl}users/${userInfo.userName}/profile`);
            })
            .then((res) => {
                const { bookmarks } = res.data;

                setTimeout(() => {
                    this.setState({
                        userInfo,
                        bookmarks,
                        gisServerInfo,
                        isLoading: false
                    });
                }, 1000);
            })
            .catch((error) => {
                console.error(error);
                let msg = "";
                if (error && error.message) {
                    msg = error.message;
                }
                if (error && error.config && error.config.url) {
                    msg += ", (failed to reach " + error.config.url;
                }
                this.setState({
                    loadError: msg
                });
            });
    };

    fetchUserBookmarks = () => {
        const serverUrl = window.__REAP__CONFIG__.reapAdminUrl;
        const { userInfo } = this.state;

        if (!userInfo) {
            return;
        }

        axios.get(`${serverUrl}users/${userInfo.userName}/profile`).then((res) => {
            const { bookmarks } = res.data;

            this.setState({
                bookmarks
            });
        });
    };

    updateUserBookmarks = (action: "add" | "delete", bookmark: BookmarkInterface | string) => {
        const serverUrl = window.__REAP__CONFIG__.reapAdminUrl;
        const { bookmarks, userInfo } = this.state;

        if (!userInfo) {
            return;
        }

        const updatedBookmarks: any = {
            ...bookmarks
        };

        if (action === "add" && typeof bookmark !== "string") {
            updatedBookmarks[bookmark.timestamp] = bookmark;
        }

        if (action === "delete" && typeof bookmark === "string") {
            delete updatedBookmarks[bookmark];
        }

        axios.post(`${serverUrl}users/${userInfo.userName}/profile`, { bookmarks: updatedBookmarks }).finally(() => this.fetchUserBookmarks());
    };

    doLogout = () => {
        const logoutUrl = window.__REAP__CONFIG__.reapAdminLogoutUrl;
        axios.post(logoutUrl, "").finally(() => {
            axios.post(process.env.PUBLIC_URL + "/logout").finally(() => {
                window.location.href = process.env.PUBLIC_URL;
            });
        });
    };

    throwAppError = (error: Error) => {
        console.error(error);
        this.setState(
            {
                loadError: error.message
            },
            () => {
                message.destroy();
            }
        );
    };

    render() {
        const { isLoading, loadError } = this.state;

        if (loadError) {
            return (
                <div>
                    <Result status="error" title={"Failed to load app due to: " + loadError} />
                </div>
            );
        }

        if (isLoading) {
            return <div>loading...</div>;
        }

        return (
            <div className="App">
                <Viewer
                    doLogout={this.doLogout}
                    userInfo={this.state.userInfo}
                    gisServerInfo={this.state.gisServerInfo}
                    bookmarks={this.state.bookmarks}
                    updateUserBookmarks={this.updateUserBookmarks}
                />
            </div>
        );
    }
}

export default App;

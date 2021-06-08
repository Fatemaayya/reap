import React, { Fragment } from "react";
import { Button, Divider, Form, Input, List, Modal, Popconfirm, Tooltip, Typography } from "antd";

import { BookmarkInterface } from "../../utils/Interfaces";
import moment from "moment";

import "./bookmarks.less";

interface Props {
    bookmarks: { [bookmarkKey: string]: BookmarkInterface };
    updateUserBookmarks: (action: "add" | "delete", bookmark: BookmarkInterface | string) => void;
}

export default (props: Props) => {
    // const [bookmarks, setBookmarks] = useState<BookmarkInterface[]>([]);

    // useEffect(() => {
    //     const updateBookmarksList = () => {
    //         const storedBookmarks = JSON.parse(sessionStorage.getItem("RP_BOOKMARKS") || "[]");
    //         storedBookmarks.sort((a: BookmarkInterface, b: BookmarkInterface) => a.timestamp > b.timestamp);
    //         setBookmarks(storedBookmarks);
    //     };

    //     window.addEventListener("bookmarkCreated", updateBookmarksList);

    //     updateBookmarksList();

    //     return () => {
    //         window.removeEventListener("bookmarkCreated", updateBookmarksList);
    //     };
    // }, []);

    // actions
    const addBookmark = (values: any, closeModal: any) => {
        const bookmarkMeta = {
            label: values.label,
            name: "BOOKMARK_" + Math.random()
        };

        window.dispatchEvent(new CustomEvent("createBookmark", { detail: bookmarkMeta }));
        closeModal();
    };

    // const deleteBookmark = (bookmarkInfo: BookmarkInterface) => {
    //     const storedBookmarks: BookmarkInterface[] = JSON.parse(sessionStorage.getItem("RP_BOOKMARKS") || "[]");
    //     storedBookmarks.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));

    //     const targetIndex = storedBookmarks.findIndex((bookmark) => bookmark.name === bookmarkInfo.name);
    //     storedBookmarks.splice(targetIndex, 1);
    //     sessionStorage.setItem("RP_BOOKMARKS", JSON.stringify(storedBookmarks));

    //     setBookmarks(storedBookmarks);
    // };

    const gotoBookmark = (bookmark: BookmarkInterface) => {
        window.dispatchEvent(new CustomEvent("gotoBookmark", { detail: { bookmark } }));
    };

    // ui
    const createBookmarkModal = () => {
        const modal = Modal.confirm({
            title: "Create",
            icon: <span />,
            centered: true,
            maskClosable: false,
            okButtonProps: { style: { display: "none" } },
            cancelButtonProps: { style: { display: "none" } },
            onCancel: () => {
                modal.destroy();
            }
        });

        const modalBody = (
            <Form onFinish={(values) => addBookmark(values, modal.destroy)} onFinishFailed={(errorInfo) => console.warn(errorInfo)}>
                <Typography.Text type="secondary"> Add a label to your bookmark </Typography.Text>
                <Divider style={{ margin: "1em" }} />
                <Form.Item name="label" label="Label" rules={[{ required: true, message: "Please input a label for bookmark" }]}>
                    <Input autoFocus />
                </Form.Item>
                <div style={{ textAlign: "center" }}>
                    <Button htmlType="submit" type="primary">
                        Create
                    </Button>
                    <Button onClick={() => modal.destroy()}>Cancel</Button>
                </div>
            </Form>
        );

        modal.update({
            content: modalBody
        });
    };

    return (
        <Fragment>
            <Typography.Title level={3} style={{ margin: 0 }}>
                Bookmarks
            </Typography.Title>

            <Button
                size="large"
                type="primary"
                onClick={() => createBookmarkModal()}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 0 }}
            >
                <span className="material-icons" style={{ fontSize: "1.2em" }}>
                    add
                </span>
                New
            </Button>

            <List
                style={{ flexGrow: 1 }}
                itemLayout="horizontal"
                dataSource={Object.values(props.bookmarks).sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1))}
                renderItem={(bookmarkInfo) => {
                    let bktimestamp = moment(bookmarkInfo.timestamp);
                    let timeString = bktimestamp.format("DD-MMM-YYYY, hh:mm a");

                    if (!bktimestamp.isBefore(moment(), "day")) {
                        timeString = bktimestamp.fromNow();
                    }

                    return (
                        <List.Item
                            actions={[
                                <Popconfirm
                                    title="Delete bookmark?"
                                    placement="right"
                                    onConfirm={() => props.updateUserBookmarks("delete", "" + bookmarkInfo.timestamp)}
                                >
                                    <span className="material-icons dynamicDeleteIcon"> &nbsp; </span>
                                </Popconfirm>
                            ]}
                        >
                            <div style={{ width: "100%" }} onClick={() => gotoBookmark(bookmarkInfo)}>
                                <List.Item.Meta
                                    title={
                                        <div style={{ position: "relative", display: "flex" }}>
                                            {bookmarkInfo.bufferInfo ? (
                                                <Tooltip title="Has buffer">
                                                    <span
                                                        className="material-icons"
                                                        style={{
                                                            // position: "absolute",
                                                            // right: 0,
                                                            fontSize: 20,
                                                            color: "#717171"
                                                        }}
                                                    >
                                                        filter_tilt_shift
                                                    </span>
                                                </Tooltip>
                                            ) : (
                                                <span />
                                            )} &nbsp; {" "} &nbsp;
                                            {bookmarkInfo.label}
                                        </div>
                                    }
                                    description={timeString}
                                />
                            </div>
                            {/* <span className="material-icons">done</span> */}
                        </List.Item>
                    );
                }}
            />
        </Fragment>
    );
};

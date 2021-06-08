window.__REAP__CONFIG__.layers = {
    baselayers: [
        {
            name: "district",
            label: "Districts",
            accent: "#d65658",
            defaultVisibility: true,
            type: "ImageWMS",
            ratio: 1,
            serverType: "geoserver",
            crossOrigin: "anonymous",
            url: "http://103.248.60.18:8060/geoserver/reapdata/wms",
            params: {
                LAYERS: "reapdata:cgDistricts"
            }
        },
        {
            name: "cgBlocks",
            label: "Blocks",
            accent: "#4daf4a",
            defaultVisibility: true,
            type: "ImageWMS",
            ratio: 1,
            serverType: "geoserver",
            crossOrigin: "anonymous",
            url: "http://103.248.60.18:8060/geoserver/reapdata/wms",
            params: {
                LAYERS: "reapdata:cgBlocks"
            }
        },
        {
            name: "raipurVillageBoundary",
            label: "Village",
            accent: "#d1c40a",
            defaultVisibility: true,
            type: "ImageWMS",
            ratio: 1,
            serverType: "geoserver",
            crossOrigin: "anonymous",
            url: "http://103.248.60.18:8060/geoserver/reapdata/wms",
            params: {
                LAYERS: "reapdata:raipurVillageBoundary"
            }
        }
    ]
};

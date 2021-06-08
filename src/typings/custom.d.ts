export declare global {
    interface Window {
        __REAP__CONFIG__: {
            reapAdminUrl: string;
            reapAdminLogoutUrl: string;

            mapTiler_key: string;
            google_key: string;

            layers: {
                // boundaryLayer: {
                //     url: string;
                //     name: string;
                //     label: string;
                //     accent: string;
                //     labelProperty: string;
                //     defaultId: string;
                //     style: any;
                // };
                baselayers: {
                    name: string;
                    label: string;
                    accent: string;
                    defaultVisibility: boolean;
                    type: "ImageWMS";
                    ratio: number;
                    serverType: "geoserver";
                    crossOrigin: string;
                    url: string;
                    params: {
                        [key: string]: string;
                    };
                }[];
            };

            featureCategories: {
                [categoryName: string]: { displayName: string, icon: string; types: string[] };
            };

            realEstateCategories: {
                [typeName: string]: {
                    color: string;
                    fontColor: string;
                };
            };

            boundaryFeatures: {
                defaultFeature: string;
                features: { [featureName: string]: numbers[] };
            };
        };
    }
}

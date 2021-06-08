// added craco for webpack customization without ejecting cra
// https://github.com/sharegate/craco/blob/master/packages/craco/README.md

// const CracoAntDesignPlugin = require("craco-antd");
const CracoLessPlugin = require("craco-less");
// const path = require("path");
// const WorkerLoaderPlugin = require("craco-worker-loader");

module.exports = {
  plugins: [
    //   currently using less to override
    // {
    //   plugin: CracoAntDesignPlugin,
    //   options: {
    //     customizeThemeLessPath: path.join(__dirname, "src/style/AntDesign/customTheme.less"),
    //   },
    // },
    {
      plugin: CracoLessPlugin,
      options: {
        lessLoaderOptions: {
          lessOptions: {
            modifyVars: { },
            javascriptEnabled: true,
          },
        },
      },
    },
    // {
    //     plugin: WorkerLoaderPlugin
    // }
  ],
};


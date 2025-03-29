const { defineConfig } = require("@vue/cli-service");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const webpack = require('webpack');
module.exports = defineConfig({
  transpileDependencies: true,
  lintOnSave: true,
  configureWebpack: {
    plugins: [
      new NodePolyfillPlugin(),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "node_modules/cesium/Build/Cesium/Workers",
            to: "cesium/Workers",
          },
          {
            from: "node_modules/cesium/Build/Cesium/ThirdParty",
            to: "cesium/ThirdParty",
          },
          {
            from: "node_modules/cesium/Build/Cesium/Assets",
            to: "cesium/Assets",
          },
          {
            from: "node_modules/cesium/Build/Cesium/Widgets",
            to: "cesium/Widgets",
          },
        ],
      }),
      new webpack.DefinePlugin({
        CESIUM_BASE_URL: JSON.stringify("./cesium"),
      }),
    ],
    resolve: {
      fallback: {
        zlib: require.resolve("browserify-zlib"),
        http: require.resolve("stream-http"),
        https: require.resolve("https-browserify"),
        stream: require.resolve("stream-browserify"),
      },
    },
  },
});
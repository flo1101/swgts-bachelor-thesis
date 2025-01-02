const WebpackReactComponentNamePlugin = require("webpack-react-component-name");

module.exports = function override(config, env) {
  if (env === 'production') {
  // Disables minification of component names in browser inspector
    config.plugins.push(new WebpackReactComponentNamePlugin());
  }
  return config;
};
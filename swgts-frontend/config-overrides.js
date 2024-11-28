const WebpackReactComponentNamePlugin = require('webpack-react-component-name');

module.exports = function override(config, env) {
  if (env === 'production') {
    // Disables minification of component names to make inspecting React-compoennts in browser easier
    config.plugins.push(new WebpackReactComponentNamePlugin());
  }
  return config;
};
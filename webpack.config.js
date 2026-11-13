const path = require('node:path');

module.exports = (env, argv) => ({
  mode: argv.mode || 'development',
  devtool: argv.mode === 'production' ? false : 'cheap-source-map',
  entry: {
    background: './src/background.js',
    content: './src/content.js',
    popup: './src/popup.js',
    'popup-ui': './src/popup-ui.js',
    linkExtractor: './src/linkExtractor.js',
    localidades: './src/localidades.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    clean: true,
  },
  optimization: {
    splitChunks: false,
    runtimeChunk: false,
  },
});
